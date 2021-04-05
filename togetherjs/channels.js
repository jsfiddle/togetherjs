/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
define(["require", "exports", "./util"], function (require, exports, util_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Router = exports.WebSocketChannel = void 0;
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
    class AbstractChannel extends OnClass {
        constructor() {
            super();
            this.rawdata = false;
            this.closed = false;
            this._buffer = [];
        }
        send(data) {
            if (this.closed) {
                throw 'Cannot send to a closed connection';
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
            for (let i = 0; i < this._buffer.length; i++) {
                this._send(this._buffer[i]);
            }
            this._buffer = [];
        }
        _incoming(data) {
            // TODO the logic of this function has been changed a little, this should be equivalent but a check should be done
            if (!this.rawdata) {
                try {
                    const dataAsObject = JSON.parse(data);
                    if (this.onmessage) {
                        this.onmessage(dataAsObject);
                    }
                    this.emit("message", dataAsObject);
                }
                catch (e) {
                    console.error("Got invalid JSON data:", data.substr(0, 40));
                    throw e;
                }
            }
            else {
                // TODO we disable rawdata support for now
                console.error("rawdata support disabled", data);
                /*
                if(this.onmessage) {
                    this.onmessage(data);
                }
                //@ts-expect-error this is only relevant in rawdata mode which is not used in production (I think?)
                this.emit("message", data); // TODO if this is not used maybe we should remove it?
                */
            }
        }
    }
    class WebSocketChannel extends AbstractChannel {
        constructor(address) {
            super();
            this.backoffTime = 50; // Milliseconds to add to each reconnect time
            this.maxBackoffTime = 1500;
            this.backoffDetection = 2000; // Amount of time since last connection attempt that shows we need to back off
            this.socket = null;
            this._reopening = false;
            this._lastConnectTime = 0;
            this._backoff = 0;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            this.onmessage = (_jsonData) => { };
            if (address.search(/^https?:/i) === 0) {
                address = address.replace(/^http/i, 'ws');
            }
            this.address = address;
            this._setupConnection();
        }
        toString() {
            let s = '[WebSocketChannel to ' + this.address;
            if (!this.socket) {
                s += ' (socket unopened)';
            }
            else {
                s += ' readyState: ' + this.socket.readyState;
            }
            if (this.closed) {
                s += ' CLOSED';
            }
            return s + ']';
        }
        close() {
            this.closed = true;
            if (this.socket) {
                // socket.onclose will call this.onclose:
                this.socket.close();
            }
            else {
                if (this.onclose) {
                    this.onclose();
                }
                this.emit("close");
            }
        }
        _send(data) {
            if (this.socket == null) {
                console.error("cannot send with an unitialized socket:", data);
                return;
            }
            this.socket.send(data);
        }
        _ready() {
            return this.socket != null && this.socket.readyState == this.socket.OPEN;
        }
        _setupConnection() {
            if (this.closed) {
                return;
            }
            this._lastConnectTime = Date.now();
            this.socket = new WebSocket(this.address);
            this.socket.onopen = () => {
                this._flush();
                this._reopening = false;
            };
            this.socket.onclose = event => {
                this.socket = null;
                let method = "error";
                if (event.wasClean) {
                    // FIXME: should I even log clean closes?
                    method = "log";
                }
                console[method]('WebSocket close', event.wasClean ? 'clean' : 'unclean', 'code:', event.code, 'reason:', event.reason || 'none');
                if (!this.closed) {
                    this._reopening = true;
                    if (Date.now() - this._lastConnectTime > this.backoffDetection) {
                        this._backoff = 0;
                    }
                    else {
                        this._backoff++;
                    }
                    const time = Math.min(this._backoff * this.backoffTime, this.maxBackoffTime);
                    setTimeout(() => {
                        this._setupConnection();
                    }, time);
                }
            };
            this.socket.onmessage = (event) => {
                this._incoming(event.data);
            };
            this.socket.onerror = event => {
                console.error('WebSocket error:', event.data);
            };
        }
        onclose() { }
    }
    exports.WebSocketChannel = WebSocketChannel;
    /* Sends TO a window or iframe */
    class PostMessageChannel extends AbstractChannel {
        constructor(win, expectedOrigin) {
            super();
            this._pingPollPeriod = 100; // milliseconds
            this._pingPollIncrease = 100; // +100 milliseconds for each failure
            this._pingMax = 2000; // up to a max of 2000 milliseconds
            this._pingReceived = false;
            this._pingFailures = 0;
            this._pingTimeout = null;
            this.onmessage = () => { };
            this.expectedOrigin = expectedOrigin;
            this._receiveMessage = this._receiveMessage.bind(this);
            if (win) {
                this.bindWindow(win, true);
            }
            this._setupConnection();
        }
        toString() {
            let s = '[PostMessageChannel';
            if (this.window) {
                s += ' to window ' + this.window;
            }
            else {
                s += ' not bound to a window';
            }
            if (this.window && !this._pingReceived) {
                s += ' still establishing';
            }
            return s + ']';
        }
        bindWindow(win, noSetup) {
            if (this.window) {
                this.close();
                // Though we deinitialized everything, we aren't exactly closed:
                this.closed = false;
            }
            if (win && "contentWindow" in win) {
                if (win.contentWindow) {
                    this.window = win.contentWindow;
                }
                else {
                    throw new Error("Can't bind to an iframe without contentWindow, probably because the iframe hasn't loaded yet"); // TODO can we do something better here?
                }
            }
            else {
                this.window = win;
            }
            // FIXME: The distinction between this.window and window seems unimportant in the case of postMessage
            let w = this.window;
            // In a Content context we add the listener to the local window object, but in the addon context we add the listener to some other window, like the one we were given:
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
            return this.window != null && this._pingReceived;
        }
        _setupConnection() {
            if (this.closed || this._pingReceived || (!this.window)) {
                return;
            }
            this._pingFailures++;
            this._send("hello");
            // We'll keep sending ping messages until we get a reply
            let time = this._pingPollPeriod + (this._pingPollIncrease * this._pingFailures);
            time = time > this._pingMax ? this._pingMax : time;
            this._pingTimeout = setTimeout(this._setupConnection.bind(this), time);
        }
        _receiveMessage(event) {
            if (event.source !== this.window) {
                return;
            }
            if (this.expectedOrigin && event.origin != this.expectedOrigin) {
                console.info("Expected message from", this.expectedOrigin, "but got message from", event.origin);
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
        onclose() { }
    }
    /* Handles message FROM an exterior window/parent */
    class PostMessageIncomingChannel extends AbstractChannel {
        constructor(expectedOrigin) {
            super();
            this._pingTimeout = null;
            this.source = null;
            this.onmessage = () => { };
            this.expectedOrigin = expectedOrigin;
            this._receiveMessage = this._receiveMessage.bind(this);
            window.addEventListener("message", this._receiveMessage, false);
            this._setupConnection();
        }
        toString() {
            let s = '[PostMessageIncomingChannel';
            if (this.source) {
                s += ' bound to source ' + s;
            }
            else {
                s += ' awaiting source';
            }
            return s + ']';
        }
        _send(data) {
            if (this.source == null) {
                console.error("Cannot send with uninitialized channel:", data);
                return;
            }
            this.source.postMessage(data, this.expectedOrigin);
        }
        _ready() {
            return !!this.source;
        }
        _setupConnection() {
            // Nothing to do in this case
        }
        _receiveMessage(event) {
            if (this.expectedOrigin && this.expectedOrigin != "*" && event.origin != this.expectedOrigin) {
                // FIXME: Maybe not worth mentioning?
                console.info("Expected message from", this.expectedOrigin, "but got message from", event.origin);
                return;
            }
            if (!this.expectedOrigin) {
                this.expectedOrigin = event.origin;
            }
            if (!this.source) {
                this.source = event.source; // TODO theoratically event.source could be other types in the union but since we only only use Window I don't think it's possible
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
        onclose() {
            // Nothing to do in this case
        }
    }
    class Route extends OnClass {
        constructor(router, id) {
            super();
            this.router = router;
            this.id = id;
        }
        send(msg) {
            this.router.channel.send({
                type: "route",
                routeId: this.id,
                message: msg,
            });
        }
        close() {
            if (this.router._routes[this.id] !== this) {
                // This route instance has been overwritten, so ignore
                return;
            }
            delete this.router._routes[this.id];
        }
    }
    class Router extends OnClass {
        constructor(channel) {
            super();
            this._routes = Object.create(null);
            this.boundChannelMessage = this._channelMessage.bind(this);
            this.boundChannelClosed = this._channelClosed.bind(this);
            if (channel) {
                this.bindChannel(channel);
            }
        }
        bindChannel(channel) {
            if (this.channel) {
                this.channel.off("message", this.boundChannelMessage);
                this.channel.off("close", this.boundChannelClosed);
            }
            this.channel = channel;
            this.channel.on("message", this.boundChannelMessage);
            this.channel.on("close", this.boundChannelClosed);
        }
        _channelMessage(msg) {
            if (msg.type == "route") {
                const id = msg.routeId;
                const route = this._routes[id];
                if (!route) {
                    console.warn("No route with the id", id);
                    return;
                }
                if (msg.close) {
                    this._closeRoute(route.id);
                }
                else {
                    if (route.onmessage) {
                        route.onmessage(msg.message);
                    }
                    route.emit("message", msg.message);
                }
            }
        }
        _channelClosed() {
            for (const id in this._routes) {
                this._closeRoute(id);
            }
        }
        _closeRoute(id) {
            const route = this._routes[id];
            if (route.onclose) {
                route.onclose();
            }
            route.emit("close");
            delete this._routes[id];
        }
        makeRoute(id) {
            id = id || util_1.util.generateId();
            const route = new Route(this, id);
            this._routes[id] = route;
            return route;
        }
    }
    exports.Router = Router;
});
