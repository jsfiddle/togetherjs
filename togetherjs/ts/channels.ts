/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { util } from "./util";

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

abstract class AbstractChannel extends OnClass<TogetherJSNS.On.Map> {
    rawdata = false;
    closed = false;
    _buffer: string[] = [];

    constructor() {
        super();
    }

    send<K extends keyof TogetherJSNS.AnyMessage.MapInTransit>(data: TogetherJSNS.AnyMessage.MapInTransit[K] | string): void {
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
        for(let i = 0; i < this._buffer.length; i++) {
            this._send(this._buffer[i]);
        }
        this._buffer = [];
    }

    _incoming(data: string) {
        // TODO the logic of this function has been changed a little, this should be equivalent but a check should be done
        if(!this.rawdata) {
            try {
                const dataAsObject = JSON.parse(data) as TogetherJSNS.ValueOf<TogetherJSNS.AnyMessage.MapForReceiving>;
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

    protected abstract _send(a: string): void;

    abstract _setupConnection(): void;
    abstract _ready(): boolean;

    /** must set this.closed to true */
    abstract close(): void;

    public onmessage?: (data: TogetherJSNS.ValueOf<TogetherJSNS.AnyMessage.MapForReceiving>) => void;
    abstract onclose(): void;
}

export class WebSocketChannel extends AbstractChannel {
    backoffTime = 50; // Milliseconds to add to each reconnect time
    maxBackoffTime = 1500;
    backoffDetection = 2000; // Amount of time since last connection attempt that shows we need to back off
    address: string;
    socket: WebSocket | null = null;
    _reopening = false;
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

    toString(): string {
        let s = '[WebSocketChannel to ' + this.address;
        if(!this.socket) {
            s += ' (socket unopened)';
        }
        else {
            s += ' readyState: ' + this.socket.readyState;
        }
        if(this.closed) {
            s += ' CLOSED';
        }
        return s + ']';
    }

    close(): void {
        this.closed = true;
        if(this.socket) {
            // socket.onclose will call this.onclose:
            this.socket.close();
        }
        else {
            if(this.onclose) {
                this.onclose();
            }
            this.emit("close");
        }
    }

    _send(data: string): void {
        if(this.socket == null) {
            console.error("cannot send with an unitialized socket:", data);
            return;
        }
        this.socket.send(data);
    }

    _ready(): boolean {
        return this.socket != null && this.socket.readyState == this.socket.OPEN;
    }

    _setupConnection(): void {
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
            let method: keyof Console = "error";
            if(event.wasClean) {
                // FIXME: should I even log clean closes?
                method = "log";
            }
            console[method]('WebSocket close', event.wasClean ? 'clean' : 'unclean', 'code:', event.code, 'reason:', event.reason || 'none');
            if(!this.closed) {
                this._reopening = true;
                if(Date.now() - this._lastConnectTime > this.backoffDetection) {
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
            console.error('WebSocket error:', (event as MessageEvent).data);
        };
    }

    onclose(): void { /* can be overriden */ }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onmessage: (jsonData: TogetherJSNS.ValueOf<TogetherJSNS.AnyMessage.MapForReceiving>) => void = (_jsonData: TogetherJSNS.ValueOf<TogetherJSNS.AnyMessage.MapForReceiving>) => { /* Do nothing be default */ };

}

class Route extends OnClass<TogetherJSNS.On.Map> {
    // eslint-disable-next-line no-use-before-define
    private router: Router;
    public readonly id: string;
    public readonly onmessage: ((msg: TogetherJSNS.AnyMessage.AnyForReceiving) => void) | undefined;
    public readonly onclose: (() => void) | undefined;

    constructor(router: Router, id: string) {
        super();
        this.router = router;
        this.id = id;
    }

    send(msg: TogetherJSNS.AnyMessage.AnyForReceiving) {
        this.router.channel.send({
            type: "route",
            routeId: this.id,
            message: msg,
        });
    }

    close() {
        if(this.router._routes[this.id] !== this) {
            // This route instance has been overwritten, so ignore
            return;
        }
        delete this.router._routes[this.id];
    }

}

export class Router extends OnClass<TogetherJSNS.On.Map> {
    _routes: {[key: string]: Route} = Object.create(null);
    channel!: AbstractChannel; // TODO !

    private boundChannelMessage = this._channelMessage.bind(this);
    private boundChannelClosed = this._channelClosed.bind(this);

    constructor(channel?: AbstractChannel) {
        super();
        if(channel) {
            this.bindChannel(channel);
        }
    }

    bindChannel(channel: AbstractChannel): void {
        if(this.channel) {
            this.channel.off("message", this.boundChannelMessage);
            this.channel.off("close", this.boundChannelClosed);
        }
        this.channel = channel;
        this.channel.on("message", this.boundChannelMessage);
        this.channel.on("close", this.boundChannelClosed);
    }

    _channelMessage(msg: TogetherJSNS.ValueOf<TogetherJSNS.AnyMessage.MapForReceiving>): void {
        if(msg.type == "route") {
            const id = msg.routeId;
            const route = this._routes[id];
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

    _channelClosed(): void {
        for(const id in this._routes) {
            this._closeRoute(id);
        }
    }

    _closeRoute(id: string): void {
        const route = this._routes[id];
        if(route.onclose) {
            route.onclose();
        }
        route.emit("close");
        delete this._routes[id];
    }

    makeRoute(id: string): Route {
        id = id || util.generateId();
        const route = new Route(this, id);
        this._routes[id] = route;
        return route;
    }
}
