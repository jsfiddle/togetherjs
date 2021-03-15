"use strict";
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
function ChannelsMain(util) {
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
    var AbstractChannel = /** @class */ (function (_super) {
        __extends(AbstractChannel, _super);
        function AbstractChannel() {
            var _this = _super.call(this) || this;
            _this.rawdata = false;
            _this.closed = false;
            _this._buffer = [];
            return _this;
        }
        // TODO should only take string
        AbstractChannel.prototype.send = function (data) {
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
        };
        AbstractChannel.prototype._flush = function () {
            for (var i = 0; i < this._buffer.length; i++) {
                this._send(this._buffer[i]);
            }
            this._buffer = [];
        };
        // TODO any to remove
        AbstractChannel.prototype._incoming = function (data) {
            if (!this.rawdata) {
                try {
                    data = JSON.parse(data);
                }
                catch (e) {
                    console.error("Got invalid JSON data:", data.substr(0, 40));
                    throw e;
                }
            }
            if (this.onmessage) {
                this.onmessage(data);
            }
            this.emit("message", data);
        };
        return AbstractChannel;
    }(OnClass));
    var WebSocketChannel = /** @class */ (function (_super) {
        __extends(WebSocketChannel, _super);
        function WebSocketChannel(address) {
            var _this = _super.call(this) || this;
            _this.backoffTime = 50; // Milliseconds to add to each reconnect time
            _this.maxBackoffTime = 1500;
            _this.backoffDetection = 2000; // Amount of time since last connection attempt that shows we need to back off
            _this._reopening = false;
            _this._lastConnectTime = 0;
            _this._backoff = 0;
            if (address.search(/^https?:/i) === 0) {
                address = address.replace(/^http/i, 'ws');
            }
            _this.address = address;
            _this._setupConnection();
            return _this;
        }
        WebSocketChannel.prototype.toString = function () {
            var s = '[WebSocketChannel to ' + this.address;
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
        };
        WebSocketChannel.prototype.close = function () {
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
        };
        WebSocketChannel.prototype._send = function (data) {
            this.socket.send(data);
        };
        WebSocketChannel.prototype._ready = function () {
            return this.socket != null && this.socket.readyState == this.socket.OPEN;
        };
        WebSocketChannel.prototype._setupConnection = function () {
            var _this = this;
            if (this.closed) {
                return;
            }
            this._lastConnectTime = Date.now();
            this.socket = new WebSocket(this.address);
            this.socket.onopen = function () {
                _this._flush();
                _this._reopening = false;
            };
            this.socket.onclose = function (event) {
                _this.socket = null;
                var method = "error";
                if (event.wasClean) {
                    // FIXME: should I even log clean closes?
                    method = "log";
                }
                console[method]('WebSocket close', event.wasClean ? 'clean' : 'unclean', 'code:', event.code, 'reason:', event.reason || 'none');
                if (!_this.closed) {
                    _this._reopening = true;
                    if (Date.now() - _this._lastConnectTime > _this.backoffDetection) {
                        _this._backoff = 0;
                    }
                    else {
                        _this._backoff++;
                    }
                    var time = Math.min(_this._backoff * _this.backoffTime, _this.maxBackoffTime);
                    setTimeout(function () {
                        _this._setupConnection();
                    }, time);
                }
            };
            this.socket.onmessage = function (event) {
                _this._incoming(event.data);
            };
            this.socket.onerror = function (event) {
                console.error('WebSocket error:', event.data);
            };
        };
        WebSocketChannel.prototype.onclose = function () { };
        WebSocketChannel.prototype.onmessage = function () { };
        return WebSocketChannel;
    }(AbstractChannel)); // /WebSocketChannel
    /* Sends TO a window or iframe */
    var PostMessageChannel = /** @class */ (function (_super) {
        __extends(PostMessageChannel, _super);
        function PostMessageChannel(win, expectedOrigin) {
            var _this = _super.call(this) || this;
            _this._pingPollPeriod = 100; // milliseconds
            _this._pingPollIncrease = 100; // +100 milliseconds for each failure
            _this._pingMax = 2000; // up to a max of 2000 milliseconds
            _this._pingReceived = false;
            _this._pingFailures = 0;
            _this._pingTimeout = null;
            _this.window = null;
            _this.expectedOrigin = expectedOrigin;
            _this._receiveMessage = _this._receiveMessage.bind(_this);
            if (win) {
                _this.bindWindow(win, true);
            }
            _this._setupConnection();
            return _this;
        }
        PostMessageChannel.prototype.toString = function () {
            var s = '[PostMessageChannel';
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
        };
        PostMessageChannel.prototype.bindWindow = function (win, noSetup) {
            if (this.window) {
                this.close();
                // Though we deinitialized everything, we aren't exactly closed:
                this.closed = false;
            }
            if (win && "contentWindow" in win) {
                this.window = win.contentWindow;
            }
            else {
                this.window = win;
            }
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
        };
        PostMessageChannel.prototype._send = function (data) {
            this.window.postMessage(data, this.expectedOrigin || "*");
        };
        PostMessageChannel.prototype._ready = function () {
            return this.window != null && this._pingReceived;
        };
        PostMessageChannel.prototype._setupConnection = function () {
            if (this.closed || this._pingReceived || (!this.window)) {
                return;
            }
            this._pingFailures++;
            this._send("hello");
            // We'll keep sending ping messages until we get a reply
            var time = this._pingPollPeriod + (this._pingPollIncrease * this._pingFailures);
            time = time > this._pingPollMax ? this._pingPollMax : time;
            this._pingTimeout = setTimeout(this._setupConnection.bind(this), time);
        };
        PostMessageChannel.prototype._receiveMessage = function (event) {
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
        };
        PostMessageChannel.prototype.close = function () {
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
        };
        PostMessageChannel.prototype.onclose = function () { };
        PostMessageChannel.prototype.onmessage = function () { };
        return PostMessageChannel;
    }(AbstractChannel)); // /PostMessageChannel
    /* Handles message FROM an exterior window/parent */
    var PostMessageIncomingChannel = /** @class */ (function (_super) {
        __extends(PostMessageIncomingChannel, _super);
        function PostMessageIncomingChannel(expectedOrigin) {
            var _this = _super.call(this) || this;
            _this._pingTimeout = null;
            _this.source = null;
            _this.expectedOrigin = expectedOrigin;
            _this._receiveMessage = _this._receiveMessage.bind(_this);
            window.addEventListener("message", _this._receiveMessage, false);
            _this._setupConnection();
            return _this;
        }
        PostMessageIncomingChannel.prototype.toString = function () {
            var s = '[PostMessageIncomingChannel';
            if (this.source) {
                s += ' bound to source ' + s;
            }
            else {
                s += ' awaiting source';
            }
            return s + ']';
        };
        PostMessageIncomingChannel.prototype._send = function (data) {
            this.source.postMessage(data, this.expectedOrigin);
        };
        PostMessageIncomingChannel.prototype._ready = function () {
            return !!this.source;
        };
        PostMessageIncomingChannel.prototype._setupConnection = function () {
        };
        PostMessageIncomingChannel.prototype._receiveMessage = function (event) {
            if (this.expectedOrigin && this.expectedOrigin != "*" && event.origin != this.expectedOrigin) {
                // FIXME: Maybe not worth mentioning?
                console.info("Expected message from", this.expectedOrigin, "but got message from", event.origin);
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
        };
        PostMessageIncomingChannel.prototype.close = function () {
            this.closed = true;
            window.removeEventListener("message", this._receiveMessage, false);
            if (this._pingTimeout) {
                clearTimeout(this._pingTimeout);
            }
            if (this.onclose) {
                this.onclose();
            }
            this.emit("close");
        };
        PostMessageIncomingChannel.prototype.onclose = function () { };
        PostMessageIncomingChannel.prototype.onmessage = function () { };
        return PostMessageIncomingChannel;
    }(AbstractChannel));
    ; // /PostMessageIncomingChannel
    var Router = /** @class */ (function (_super) {
        __extends(Router, _super);
        function Router(channel) {
            var _this = _super.call(this) || this;
            _this._routes = Object.create(null);
            // TODO check calls of _channelMessage and _channelClosed bevause of this weird bindong that has been removed
            //this._channelMessage = this._channelMessage.bind(this);
            //this._channelClosed = this._channelClosed.bind(this);
            if (channel) {
                _this.bindChannel(channel);
            }
            return _this;
        }
        Router.prototype.bindChannel = function (channel) {
            if (this.channel) {
                this.channel.removeListener("message", this._channelMessage);
                this.channel.removeListener("close", this._channelClosed);
            }
            this.channel = channel;
            this.channel.on("message", this._channelMessage.bind(this));
            this.channel.on("close", this._channelClosed.bind(this));
        };
        Router.prototype._channelMessage = function (msg) {
            if (msg.type == "route") {
                var id = msg.routeId;
                var route = this._routes[id];
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
        };
        Router.prototype._channelClosed = function () {
            for (var id in this._routes) {
                this._closeRoute(id);
            }
        };
        Router.prototype._closeRoute = function (id) {
            var route = this._routes[id];
            if (route.onclose) {
                route.onclose();
            }
            route.emit("close");
            delete this._routes[id];
        };
        Router.prototype.makeRoute = function (id) {
            id = id || util.generateId();
            var route = new Route(this, id);
            this._routes[id] = route;
            return route;
        };
        return Router;
    }(OnClass)); // /Router
    var Route = /** @class */ (function (_super) {
        __extends(Route, _super);
        function Route(router, id) {
            var _this = _super.call(this) || this;
            _this.router = router;
            _this.id = id;
            return _this;
        }
        Route.prototype.send = function (msg) {
            this.router.channel.send({
                type: "route",
                routeId: this.id,
                message: msg
            });
        };
        Route.prototype.close = function () {
            if (this.router._routes[this.id] !== this) {
                // This route instance has been overwritten, so ignore
                return;
            }
            delete this.router._routes[this.id];
        };
        return Route;
    }(OnClass)); // /Route
    var channels = {
        "WebSocketChannel": function (address) { return new WebSocketChannel(address); },
        "PostMessageChannel": function (win, expectedOrigin) { return new PostMessageChannel(win, expectedOrigin); },
        "PostMessageIncomingChannel": function (expectedOrigin) { return new PostMessageIncomingChannel(expectedOrigin); },
        "Router": function () { return new Router(); },
    };
    channels = {
        "WebSocketChannel": function (address) { return new WebSocketChannel(address); },
        "PostMessageChannel": function (win, expectedOrigin) { return new PostMessageChannel(win, expectedOrigin); },
        "PostMessageIncomingChannel": function (expectedOrigin) { return new PostMessageIncomingChannel(expectedOrigin); },
        "Router": function () { return new Router(); },
    };
    return channels;
}
define(["util"], ChannelsMain);
