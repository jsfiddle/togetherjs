/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Channel abstraction.  Supported channels:

- WebSocket to an address
- postMessage between windows

In the future:

- XMLHttpRequest to a server (with some form of queuing)

The interface:

  channel = new ChannelName(parameters)

The instantiation is specific to the kind of channel

Methods:

  onmessage: set to function (jsonData)
  rawdata: set to true if you want onmessage to receive raw string data
  onclose: set to function ()
  send: function (string or jsonData)
  close: function ()

.send() will encode the data if it is not a string.

(should I include readyState as an attribute?)

Channels must accept messages immediately, caching if the connection
is not fully established yet.

*/

define(["util"], function (util) {

var channels = util.Module("channels");
/* Subclasses must define:

- ._send(string)
- ._setupConnection()
- ._ready()
- .close() (and must set this.closed to true)

And must call:

- ._flush() on open
- ._incoming(string) on incoming message
- onclose() (not onmessage - instead _incoming)
- emit("close")
*/

var AbstractChannel = util.mixinEvents({
  onmessage: null,
  rawdata: false,
  onclose: null,
  closed: false,

  baseConstructor: function () {
    this._buffer = [];
    this._setupConnection();
  },

  send: function (data) {
    if (this.closed) {
      throw 'Cannot send to a closed connection';
    }
    if (typeof data != "string") {
      data = JSON.stringify(data);
    }
    if (! this._ready()) {
      this._buffer.push(data);
      return;
    }
    this._send(data);
  },

  _flush: function () {
    for (var i=0; i<this._buffer.length; i++) {
      this._send(this._buffer[i]);
    }
    this._buffer = [];
  },

  _incoming: function (data) {
    if (! this.rawdata) {
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

});


channels.WebSocketChannel = util.Class(AbstractChannel, {

  constructor: function (address) {
    if (address.search(/^https?:/i) === 0) {
      address = address.replace(/^http/i, 'ws');
    }
    this.address = address;
    this.socket = null;
    this._reopening = false;
    this._lastConnectTime = 0;
    this._backoff = 0;
    this.baseConstructor();
  },

  backoffTime: 50, // Milliseconds to add to each reconnect time
  maxBackoffTime: 1500,
  backoffDetection: 2000, // Amount of time since last connection attempt that shows we need to back off

  toString: function () {
    var s = '[WebSocketChannel to ' + this.address;
    if (! this.socket) {
      s += ' (socket unopened)';
    } else {
      s += ' readyState: ' + this.socket.readyState;
    }
    if (this.closed) {
      s += ' CLOSED';
    }
    return s + ']';
  },

  close: function () {
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
  },

  _send: function (data) {
    this.socket.send(data);
  },

  _ready: function () {
    return this.socket && this.socket.readyState == this.socket.OPEN;
  },

  _setupConnection: function () {
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
      console[method]('WebSocket close', event.wasClean ? 'clean' : 'unclean',
                      'code:', event.code, 'reason:', event.reason || 'none');
      if (! this.closed) {
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
      console.error('WebSocket error:', event.data);
    }).bind(this);
  }

});


/* Sends TO a window or iframe */
channels.PostMessageChannel = util.Class(AbstractChannel, {
  _pingPollPeriod: 100, // milliseconds
  _pingPollIncrease: 100, // +100 milliseconds for each failure
  _pingMax: 2000, // up to a max of 2000 milliseconds

  constructor: function (win, expectedOrigin) {
    this.expectedOrigin = expectedOrigin;
    this._pingReceived = false;
    this._receiveMessage = this._receiveMessage.bind(this);
    if (win) {
      this.bindWindow(win, true);
    }
    this._pingFailures = 0;
    this.baseConstructor();
  },

  toString: function () {
    var s = '[PostMessageChannel';
    if (this.window) {
      s += ' to window ' + this.window;
    } else {
      s += ' not bound to a window';
    }
    if (this.window && ! this._pingReceived) {
      s += ' still establishing';
    }
    return s + ']';
  },

  bindWindow: function (win, noSetup) {
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
    if (! noSetup) {
      this._setupConnection();
    }
  },

  _send: function (data) {
    this.window.postMessage(data, this.expectedOrigin || "*");
  },

  _ready: function () {
    return this.window && this._pingReceived;
  },

  _setupConnection: function () {
    if (this.closed || this._pingReceived || (! this.window)) {
      return;
    }
    this._pingFailures++;
    this._send("hello");
    // We'll keep sending ping messages until we get a reply
    var time = this._pingPollPeriod + (this._pingPollIncrease * this._pingFailures);
    time = time > this._pingPollMax ? this._pingPollMax : time;
    this._pingTimeout = setTimeout(this._setupConnection.bind(this), time);
  },

  _receiveMessage: function (event) {
    if (event.source !== this.window) {
      return;
    }
    if (this.expectedOrigin && event.origin != this.expectedOrigin) {
      console.info("Expected message from", this.expectedOrigin,
                   "but got message from", event.origin);
      return;
    }
    if (! this.expectedOrigin) {
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
  },

  close: function () {
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

});


/* Handles message FROM an exterior window/parent */
channels.PostMessageIncomingChannel = util.Class(AbstractChannel, {

  constructor: function (expectedOrigin) {
    this.source = null;
    this.expectedOrigin = expectedOrigin;
    this._receiveMessage = this._receiveMessage.bind(this);
    window.addEventListener("message", this._receiveMessage, false);
    this.baseConstructor();
  },

  toString: function () {
    var s = '[PostMessageIncomingChannel';
    if (this.source) {
      s += ' bound to source ' + s;
    } else {
      s += ' awaiting source';
    }
    return s + ']';
  },

  _send: function (data) {
    this.source.postMessage(data, this.expectedOrigin);
  },

  _ready: function () {
    return !!this.source;
  },

  _setupConnection: function () {
  },

  _receiveMessage: function (event) {
    if (this.expectedOrigin && this.expectedOrigin != "*" &&
        event.origin != this.expectedOrigin) {
      // FIXME: Maybe not worth mentioning?
      console.info("Expected message from", this.expectedOrigin,
                   "but got message from", event.origin);
      return;
    }
    if (! this.expectedOrigin) {
      this.expectedOrigin = event.origin;
    }
    if (! this.source) {
      this.source = event.source;
    }
    if (event.data == "hello") {
      // Just a ping
      this.source.postMessage("hello", this.expectedOrigin);
      return;
    }
    this._incoming(event.data);
  },

  close: function () {
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

});

channels.Router = util.Class(util.mixinEvents({

  constructor: function (channel) {
    this._channelMessage = this._channelMessage.bind(this);
    this._channelClosed = this._channelClosed.bind(this);
    this._routes = Object.create(null);
    if (channel) {
      this.bindChannel(channel);
    }
  },

  bindChannel: function (channel) {
    if (this.channel) {
      this.channel.removeListener("message", this._channelMessage);
      this.channel.removeListener("close", this._channelClosed);
    }
    this.channel = channel;
    this.channel.on("message", this._channelMessage.bind(this));
    this.channel.on("close", this._channelClosed.bind(this));
  },

  _channelMessage: function (msg) {
    if (msg.type == "route") {
      var id = msg.routeId;
      var route = this._routes[id];
      if (! route) {
        console.warn("No route with the id", id);
        return;
      }
      if (msg.close) {
        this._closeRoute(route.id);
      } else {
        if (route.onmessage) {
          route.onmessage(msg.message);
        }
        route.emit("message", msg.message);
      }
    }
  },

  _channelClosed: function () {
    for (var id in this._routes) {
      this._closeRoute(id);
    }
  },

  _closeRoute: function (id) {
    var route = this._routes[id];
    if (route.onclose) {
      route.onclose();
    }
    route.emit("close");
    delete this._routes[id];
  },

  makeRoute: function (id) {
    id = id || util.generateId();
    var route = Route(this, id);
    this._routes[id] = route;
    return route;
  }
}));

var Route = util.Class(util.mixinEvents({
  constructor: function (router, id) {
    this.router = router;
    this.id = id;
  },

  send: function (msg) {
    this.router.channel.send({
      type: "route",
      routeId: this.id,
      message: msg
    });
  },

  close: function () {
    if (this.router._routes[this.id] !== this) {
      // This route instance has been overwritten, so ignore
      return;
    }
    delete this.router._routes[this.id];
  }

}));

return channels;

});
