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

type Origin = string;

type WindowLike = HTMLIFrameElement | WindowProxy | Window;

interface MessageFromChannel {
    message: TogetherJSNS.Message;
    routeId: string;
    type: string;
    close: boolean;
}

function channelsMain(util: Util) {
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

    abstract class AbstractChannel extends OnClass {
        rawdata = false;
        closed = false;
        _buffer: string[] = [];

        constructor() {
            super();
        }

        // TODO should only take string, ot not?
        send<T1 extends keyof TogetherJSNS.SessionSend.Map, T2 extends keyof TogetherJSNS.ChannelSend.Map>(data: TogetherJSNS.SessionSend.Map[T1] | TogetherJSNS.ChannelSend.Map[T2] | string): void {
            if(this.closed) {
                throw 'Cannot send to a closed connection';
            }
            if(typeof data != "string") {
                data = JSON.stringify(data);
            }
            if(!this._ready()) {
                this._buffer.push(data);
                return;
            }
            this._send(data);
        }

        _flush() {
            for(var i = 0; i < this._buffer.length; i++) {
                this._send(this._buffer[i]);
            }
            this._buffer = [];
        }

        _incoming(data: string) {
            // TODO the logic of this function has been changed a little, this should be equivalent but a check should be done
            if(!this.rawdata) {
                try {
                    const dataAsObject = JSON.parse(data) as TogetherJSNS.ValueOf<TogetherJSNS.SessionSend.Map> | TogetherJSNS.ValueOf<TogetherJSNS.ChannelSend.Map>;
                    if(this.onmessage) {
                        this.onmessage(dataAsObject);
                    }
                    this.emit("message", dataAsObject);
                }
                catch(e) {
                    console.error("Got invalid JSON data:", data.substr(0, 40));
                    throw e;
                }
            }
            else {
                if(this.onmessage) {
                    this.onmessage(data);
                }
                //@ts-expect-error this is only relevant in rawdata mode which is not used in production (I think?)
                this.emit("message", data); // TODO if this is not used maybe we should remove it?
            }
        }

        protected abstract _send(a: string): void;

        abstract _setupConnection(): void;
        abstract _ready(): boolean;

        /** must set this.closed to true */
        abstract close(): void;

        public onmessage?: (jsonData: any) => void;
        abstract onclose(): void;
    }

    class WebSocketChannel extends AbstractChannel {
        backoffTime = 50; // Milliseconds to add to each reconnect time
        maxBackoffTime = 1500;
        backoffDetection = 2000; // Amount of time since last connection attempt that shows we need to back off
        address: string;
        socket: WebSocket | null = null; // TODO ! initialized in _setupConnection
        _reopening: boolean = false;
        _lastConnectTime = 0;
        _backoff = 0;

        constructor(address: string) {
            super();
            if(address.search(/^https?:/i) === 0) {
                address = address.replace(/^http/i, 'ws');
            }
            this.address = address;
            this._setupConnection();
        }

        toString() {
            var s = '[WebSocketChannel to ' + this.address;
            if(!this.socket) {
                s += ' (socket unopened)';
            } else {
                s += ' readyState: ' + this.socket.readyState;
            }
            if(this.closed) {
                s += ' CLOSED';
            }
            return s + ']';
        }

        close() {
            this.closed = true;
            if(this.socket) {
                // socket.onclose will call this.onclose:
                this.socket.close();
            } else {
                if(this.onclose) {
                    this.onclose();
                }
                this.emit("close");
            }
        }

        _send(data: string) {
            this.socket.send(data);
        }

        _ready() {
            return this.socket != null && this.socket.readyState == this.socket.OPEN;
        }

        _setupConnection() {
            if(this.closed) {
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
                var method: keyof Console = "error";
                if(event.wasClean) {
                    // FIXME: should I even log clean closes?
                    method = "log";
                }
                console[method]('WebSocket close', event.wasClean ? 'clean' : 'unclean',
                    'code:', event.code, 'reason:', event.reason || 'none');
                if(!this.closed) {
                    this._reopening = true;
                    if(Date.now() - this._lastConnectTime > this.backoffDetection) {
                        this._backoff = 0;
                    } else {
                        this._backoff++;
                    }
                    var time = Math.min(this._backoff * this.backoffTime, this.maxBackoffTime);
                    setTimeout(() => {
                        this._setupConnection();
                    }, time);
                }
            };
            this.socket.onmessage = (event) => {
                this._incoming(event.data);
            };
            this.socket.onerror = event => {
                console.error('WebSocket error:', (event as MessageEvent).data);
            };
        }

        onclose() {}
        onmessage = (_jsonData: TogetherJSNS.ValueOf<TogetherJSNS.ChannelOnMessage.Map>) => {};

    } // /WebSocketChannel

    /* Sends TO a window or iframe */
    class PostMessageChannel extends AbstractChannel {
        private _pingPollPeriod = 100; // milliseconds
        private _pingPollIncrease = 100; // +100 milliseconds for each failure
        private _pingMax= 2000; // up to a max of 2000 milliseconds
        expectedOrigin: Origin;
        private _pingReceived: boolean = false;
        private _pingFailures = 0;
        private _pingTimeout: number | null = null;
        window!: Window; // TODO !

        constructor(win: WindowProxy, expectedOrigin: Origin) {
            super();
            this.expectedOrigin = expectedOrigin;
            this._receiveMessage = this._receiveMessage.bind(this);
            if(win) {
                this.bindWindow(win, true);
            }
            this._setupConnection();
        }

        toString() {
            var s = '[PostMessageChannel';
            if(this.window) {
                s += ' to window ' + this.window;
            } else {
                s += ' not bound to a window';
            }
            if(this.window && !this._pingReceived) {
                s += ' still establishing';
            }
            return s + ']';
        }

        bindWindow(win: WindowLike, noSetup: boolean) {
            if(this.window) {
                this.close();
                // Though we deinitialized everything, we aren't exactly closed:
                this.closed = false;
            }
            if(win && "contentWindow" in win) {
                if(win.contentWindow) {
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
            var w = this.window;
            // In a Content context we add the listener to the local window object, but in the addon context we add the listener to some other window, like the one we were given:
            if(typeof window != "undefined") {
                w = window;
            }
            w.addEventListener("message", this._receiveMessage, false);
            if(!noSetup) {
                this._setupConnection();
            }
        }

        _send(data: string) {
            this.window.postMessage(data, this.expectedOrigin || "*");
        }

        _ready() {
            return this.window != null && this._pingReceived;
        }

        _setupConnection() {
            if(this.closed || this._pingReceived || (!this.window)) {
                return;
            }
            this._pingFailures++;
            this._send("hello");
            // We'll keep sending ping messages until we get a reply
            var time = this._pingPollPeriod + (this._pingPollIncrease * this._pingFailures);
            time = time > this._pingMax ? this._pingMax : time;
            this._pingTimeout = setTimeout(this._setupConnection.bind(this), time);
        }

        _receiveMessage(event: MessageEvent) {
            if(event.source !== this.window) {
                return;
            }
            if(this.expectedOrigin && event.origin != this.expectedOrigin) {
                console.info("Expected message from", this.expectedOrigin,
                    "but got message from", event.origin);
                return;
            }
            if(!this.expectedOrigin) {
                this.expectedOrigin = event.origin;
            }
            if(event.data == "hello") {
                this._pingReceived = true;
                if(this._pingTimeout) {
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
            if(this._pingTimeout) {
                clearTimeout(this._pingTimeout);
            }
            window.removeEventListener("message", this._receiveMessage, false);
            if(this.onclose) {
                this.onclose();
            }
            this.emit("close");
        }

        onclose() {}
        onmessage = () => {};
    } // /PostMessageChannel

    /* Handles message FROM an exterior window/parent */
    class PostMessageIncomingChannel extends AbstractChannel {
        expectedOrigin: Origin;
        _pingTimeout: number | null = null;
        source: WindowProxy | null = null;

        constructor(expectedOrigin: Origin) {
            super();
            this.expectedOrigin = expectedOrigin;
            this._receiveMessage = this._receiveMessage.bind(this);
            window.addEventListener("message", this._receiveMessage, false);
            this._setupConnection();
        }

        toString() {
            var s = '[PostMessageIncomingChannel';
            if(this.source) {
                s += ' bound to source ' + s;
            } else {
                s += ' awaiting source';
            }
            return s + ']';
        }

        _send(data: string) {
            this.source.postMessage(data, this.expectedOrigin);
        }

        _ready() {
            return !!this.source;
        }

        _setupConnection() {
        }

        _receiveMessage(event: MessageEvent) { // TODO MessageEvent takes a T
            if(this.expectedOrigin && this.expectedOrigin != "*" && event.origin != this.expectedOrigin) {
                // FIXME: Maybe not worth mentioning?
                console.info("Expected message from", this.expectedOrigin, "but got message from", event.origin);
                return;
            }
            if(!this.expectedOrigin) {
                this.expectedOrigin = event.origin;
            }
            if(!this.source) {
                this.source = event.source as WindowProxy; // TODO theoratically event.source could be other types in the union but since we only only use Window I don't think it's possible
            }
            if(event.data == "hello") {
                // Just a ping
                this.source!.postMessage("hello", this.expectedOrigin);
                return;
            }
            this._incoming(event.data);
        }

        close() {
            this.closed = true;
            window.removeEventListener("message", this._receiveMessage, false);
            if(this._pingTimeout) {
                clearTimeout(this._pingTimeout);
            }
            if(this.onclose) {
                this.onclose();
            }
            this.emit("close");
        }

        onclose() {}
        onmessage = () => {}
    }; // /PostMessageIncomingChannel

    class Router extends OnClass {
        _routes: {[key: string]: Route} = Object.create(null);
        channel!: AbstractChannel; // TODO !

        constructor(channel?: AbstractChannel) {
            super();
            // TODO check calls of _channelMessage and _channelClosed bevause of this weird bindong that has been removed
            //this._channelMessage = this._channelMessage.bind(this);
            //this._channelClosed = this._channelClosed.bind(this);
            if(channel) {
                this.bindChannel(channel);
            }
        }

        bindChannel(channel: AbstractChannel) {
            if(this.channel) {
                this.channel.removeListener("message", this._channelMessage);
                this.channel.removeListener("close", this._channelClosed);
            }
            this.channel = channel;
            this.channel.on("message", this._channelMessage.bind(this));
            this.channel.on("close", this._channelClosed.bind(this));
        }

        _channelMessage(msg: MessageFromChannel) {
            if(msg.type == "route") {
                var id = msg.routeId;
                var route = this._routes[id];
                if(!route) {
                    console.warn("No route with the id", id);
                    return;
                }
                if(msg.close) {
                    this._closeRoute(route.id);
                }
                else {
                    if(route.onmessage) {
                        route.onmessage(msg.message);
                    }
                    route.emit("message", msg.message);
                }
            }
        }

        _channelClosed() {
            for(let id in this._routes) {
                this._closeRoute(id);
            }
        }

        _closeRoute(id: string) {
            var route = this._routes[id];
            if(route.onclose) {
                route.onclose();
            }
            route.emit("close");
            delete this._routes[id];
        }

        makeRoute(id: string) {
            id = id || util.generateId();
            var route = new Route(this, id);
            this._routes[id] = route;
            return route;
        }
    } // /Router

    class Route extends OnClass {
        private router: Router;
        public readonly id: string;
        public readonly onmessage: ((msg: TogetherJSNS.Message) => void) | undefined;
        public readonly onclose: (() => void) | undefined;

        constructor(router: Router, id: string) {
            super();
            this.router = router;
            this.id = id;
        }

        send(msg: TogetherJSNS.Message) {
            this.router.channel.send({
                type: "route",
                routeId: this.id,
                message: msg,
                clientId: null // TODO added this, does it introduce a bug?
            });
        }

        close() {
            if(this.router._routes[this.id] !== this) {
                // This route instance has been overwritten, so ignore
                return;
            }
            delete this.router._routes[this.id];
        }

    } // /Route

    let channels = {
        "WebSocketChannel": (address: string) => new WebSocketChannel(address),
        "PostMessageChannel": (win: WindowProxy, expectedOrigin: Origin) => new PostMessageChannel(win, expectedOrigin),
        "PostMessageIncomingChannel": (expectedOrigin: Origin) => new PostMessageIncomingChannel(expectedOrigin),
        "Router": () => new Router(),
    }

    return channels;
}

define(["util"], channelsMain);
