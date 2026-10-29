/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Channel abstraction. Supported channels:

- WebSocket to an address (the hub; this is what a session uses)
- postMessage between windows (used by the embedding/addon host)

The interface:

  channel = new ChannelName(parameters)

The instantiation is specific to the kind of channel.

Properties:

  onmessage: set to function (jsonData)
  rawdata:   set to true if you want onmessage to receive raw string data
  onclose:   set to function ()
  send:      function (string or jsonData)
  close:     function ()

.send() encodes the data if it is not already a string.

Channels accept messages immediately, buffering them until the connection is
fully established.

*/

import util from "./util.js";
import { EventEmitter } from "./events.js";

var channels = util.Module("channels");

/* Subclasses must define:

- ._send(string)
- ._setupConnection()
- ._ready()
- .close() (and must set this.closed to true)

And must call:

- ._flush() on open
- ._incoming(string) on incoming message
- onclose() (not onmessage — instead _incoming)
- emit("close")

A subclass constructor sets its own fields and then ends with
`this._setupConnection()`. That call used to live in a `baseConstructor()`
that subclasses invoked last, after their own setup — which an ES class
cannot express, since super() has to come first and _setupConnection() reads
fields the subclass has yet to assign (WebSocketChannel.address, for one).
*/
class AbstractChannel extends EventEmitter {
  constructor() {
    super();
    this._buffer = [];
  }

  send(data) {
    if (this.closed) {
      throw new Error("Cannot send to a closed connection");
    }
    if (typeof data != "string") {
      data = JSON.stringify(data);
    }
    if (!this._ready()) {
      this._buffer.push(data);
      return;
    }
    this._send(data);
  }

  _flush() {
    for (var i = 0; i < this._buffer.length; i++) {
      this._send(this._buffer[i]);
    }
    this._buffer = [];
  }

  _incoming(data) {
    if (!this.rawdata) {
      try {
        data = JSON.parse(data);
      } catch (e) {
        console.error("Got invalid JSON data:", data.substr(0, 40));
        throw e;
      }
    }
    if (this.onmessage) {
      this.onmessage(data);
    }
    this.emit("message", data);
  }
}

/* Defaults on the prototype rather than as class fields, so that a subclass
   or a caller can assign over them without each instance carrying a copy. */
AbstractChannel.prototype.onmessage = null;
AbstractChannel.prototype.rawdata = false;
AbstractChannel.prototype.onclose = null;
AbstractChannel.prototype.closed = false;

channels.WebSocketChannel = class WebSocketChannel extends AbstractChannel {
  constructor(address) {
    super();
    if (address.search(/^https?:/i) === 0) {
      address = address.replace(/^http/i, "ws");
    }
    this.address = address;
    this.socket = null;
    this._reopening = false;
    this._lastConnectTime = 0;
    this._backoff = 0;
    this._setupConnection();
  }

  toString() {
    var s = "[WebSocketChannel to " + this.address;
    if (!this.socket) {
      s += " (socket unopened)";
    } else {
      s += " readyState: " + this.socket.readyState;
    }
    if (this.closed) {
      s += " CLOSED";
    }
    return s + "]";
  }

  close() {
    this.closed = true;
    if (this.socket) {
      // socket.onclose will call this.onclose:
      this.socket.close();
    } else {
      if (this.onclose) {
        this.onclose();
      }
      this.emit("close");
    }
  }

  _send(data) {
    this.socket.send(data);
  }

  _ready() {
    return this.socket && this.socket.readyState == this.socket.OPEN;
  }

  _setupConnection() {
    if (this.closed) {
      return;
    }
    this._lastConnectTime = Date.now();
    this.socket = new WebSocket(this.address);
    this.socket.onopen = (function () {
      this._flush();
      this._reopening = false;
    }).bind(this);
    this.socket.onclose = (function (event) {
      this.socket = null;
      var method = "error";
      if (event.wasClean) {
        // FIXME: should I even log clean closes?
        method = "log";
      }
      console[method]("WebSocket close", event.wasClean ? "clean" : "unclean",
                      "code:", event.code, "reason:", event.reason || "none");
      if (!this.closed) {
        this._reopening = true;
        if (Date.now() - this._lastConnectTime > this.backoffDetection) {
          this._backoff = 0;
        } else {
          this._backoff++;
        }
        var time = Math.min(this._backoff * this.backoffTime, this.maxBackoffTime);
        setTimeout((function () {
          this._setupConnection();
        }).bind(this), time);
      }
    }).bind(this);
    this.socket.onmessage = (function (event) {
      this._incoming(event.data);
    }).bind(this);
    this.socket.onerror = (function (event) {
      console.error("WebSocket error:", event.data);
    }).bind(this);
  }
};

// Milliseconds added to each successive reconnect delay, and the ceiling:
channels.WebSocketChannel.prototype.backoffTime = 50;
channels.WebSocketChannel.prototype.maxBackoffTime = 1500;
// Time since the last attempt that says we need to back off at all:
channels.WebSocketChannel.prototype.backoffDetection = 2000;

/* Sends TO a window or iframe */
channels.PostMessageChannel = class PostMessageChannel extends AbstractChannel {
  constructor(win, expectedOrigin) {
    super();
    this.expectedOrigin = expectedOrigin;
    this._pingReceived = false;
    this._receiveMessage = this._receiveMessage.bind(this);
    if (win) {
      this.bindWindow(win, true);
    }
    this._pingFailures = 0;
    this._setupConnection();
  }

  toString() {
    var s = "[PostMessageChannel";
    if (this.window) {
      s += " to window " + this.window;
    } else {
      s += " not bound to a window";
    }
    if (this.window && !this._pingReceived) {
      s += " still establishing";
    }
    return s + "]";
  }

  bindWindow(win, noSetup) {
    if (this.window) {
      this.close();
      // Though we deinitialized everything, we aren't exactly closed:
      this.closed = false;
    }
    if (win && win.contentWindow) {
      win = win.contentWindow;
    }
    this.window = win;
    // FIXME: The distinction between this.window and window seems unimportant
    // in the case of postMessage
    var w = this.window;
    // In a Content context we add the listener to the local window
    // object, but in the addon context we add the listener to some
    // other window, like the one we were given:
    if (typeof window != "undefined") {
      w = window;
    }
    w.addEventListener("message", this._receiveMessage, false);
    if (!noSetup) {
      this._setupConnection();
    }
  }

  _send(data) {
    this.window.postMessage(data, this.expectedOrigin || "*");
  }

  _ready() {
    return this.window && this._pingReceived;
  }

  _setupConnection() {
    if (this.closed || this._pingReceived || (!this.window)) {
      return;
    }
    this._pingFailures++;
    this._send("hello");
    // We'll keep sending ping messages until we get a reply
    var time = this._pingPollPeriod + (this._pingPollIncrease * this._pingFailures);
    time = time > this._pingMax ? this._pingMax : time;
    this._pingTimeout = setTimeout(this._setupConnection.bind(this), time);
  }

  _receiveMessage(event) {
    if (event.source !== this.window) {
      return;
    }
    if (this.expectedOrigin && event.origin != this.expectedOrigin) {
      console.info("Expected message from", this.expectedOrigin,
                   "but got message from", event.origin);
      return;
    }
    if (!this.expectedOrigin) {
      this.expectedOrigin = event.origin;
    }
    if (event.data == "hello") {
      this._pingReceived = true;
      if (this._pingTimeout) {
        clearTimeout(this._pingTimeout);
        this._pingTimeout = null;
      }
      this._flush();
      return;
    }
    this._incoming(event.data);
  }

  close() {
    this.closed = true;
    this._pingReceived = false;
    if (this._pingTimeout) {
      clearTimeout(this._pingTimeout);
    }
    window.removeEventListener("message", this._receiveMessage, false);
    if (this.onclose) {
      this.onclose();
    }
    this.emit("close");
  }
};

channels.PostMessageChannel.prototype._pingPollPeriod = 100; // milliseconds
channels.PostMessageChannel.prototype._pingPollIncrease = 100; // +100ms per failure
channels.PostMessageChannel.prototype._pingMax = 2000; // up to a max of 2000ms

/* Handles messages FROM an exterior window/parent */
channels.PostMessageIncomingChannel = class PostMessageIncomingChannel extends AbstractChannel {
  constructor(expectedOrigin) {
    super();
    this.source = null;
    this.expectedOrigin = expectedOrigin;
    this._receiveMessage = this._receiveMessage.bind(this);
    window.addEventListener("message", this._receiveMessage, false);
    this._setupConnection();
  }

  toString() {
    var s = "[PostMessageIncomingChannel";
    if (this.source) {
      s += " bound to source " + this.source;
    } else {
      s += " awaiting source";
    }
    return s + "]";
  }

  _send(data) {
    this.source.postMessage(data, this.expectedOrigin);
  }

  _ready() {
    return !!this.source;
  }

  _setupConnection() {
    // Nothing to do: the connection exists once a message arrives.
  }

  _receiveMessage(event) {
    if (this.expectedOrigin && this.expectedOrigin != "*" &&
        event.origin != this.expectedOrigin) {
      // FIXME: Maybe not worth mentioning?
      console.info("Expected message from", this.expectedOrigin,
                   "but got message from", event.origin);
      return;
    }
    if (!this.expectedOrigin) {
      this.expectedOrigin = event.origin;
    }
    if (!this.source) {
      this.source = event.source;
    }
    if (event.data == "hello") {
      // Just a ping
      this.source.postMessage("hello", this.expectedOrigin);
      return;
    }
    this._incoming(event.data);
  }

  close() {
    this.closed = true;
    window.removeEventListener("message", this._receiveMessage, false);
    if (this._pingTimeout) {
      clearTimeout(this._pingTimeout);
    }
    if (this.onclose) {
      this.onclose();
    }
    this.emit("close");
  }
};

export default channels;
