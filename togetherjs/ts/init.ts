import type { TogetherJSNS } from "./types/togetherjs";

export class OnClass {
    _knownEvents?: string[];
    _listeners: { [name: string]: TogetherJSNS.CallbackForOnce<any>[] } = {}; // TODO any
    _listenerOffs?: [string, TogetherJSNS.CallbackForOnce<any>][];

    on<T extends keyof TogetherJSNS.On.Map>(name: T, callback: TogetherJSNS.On.Map[T]) {
        if(typeof callback != "function") {
            console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
            throw "Error: .once() called with non-callback";
        }
        if(name.search(" ") != -1) {
            let names = name.split(/ +/g);
            names.forEach((n) => {
                this.on(n as keyof TogetherJSNS.On.Map, callback); // TODO this cast is abusive, changing the name argument to be a array of event could solve that
            });
            return;
        }
        if(this._knownEvents && this._knownEvents.indexOf(name) == -1) {
            let thisString = "" + this;
            if(thisString.length > 20) {
                thisString = thisString.substr(0, 20) + "...";
            }
            console.warn(thisString + ".on('" + name + "', ...): unknown event");
            if(console.trace) {
                console.trace();
            }
        }

        if(!this._listeners[name]) {
            this._listeners[name] = [];
        }
        const cb = callback as TogetherJSNS.CallbackForOnce<any>; // TODO how to avoid this cast?
        if(this._listeners[name].indexOf(cb) == -1) {
            this._listeners[name].push(cb);
        }
    }

    once<T extends keyof TogetherJSNS.On.Map>(name: T, callback: TogetherJSNS.On.Map[T]) {
        if(typeof callback != "function") {
            console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
            throw "Error: .once() called with non-callback";
        }
        const cb = callback as TogetherJSNS.CallbackForOnce<any>;
        let attr = "onceCallback_" + name;
        // FIXME: maybe I should add the event name to the .once attribute:
        if(!cb[attr]) {
            cb[attr] = function onceCallback(this: OnClass, ...args: any[]) {
                cb.apply(this, args);
                this.off(name, onceCallback);
                delete cb[attr];
            } as TogetherJSNS.CallbackForOnce<any>;
        }
        this.on(name, cb[attr]);
    }

    off<T extends keyof TogetherJSNS.On.Map>(name: T, callback: TogetherJSNS.On.Map[T]) {
        if(this._listenerOffs) {
            // Defer the .off() call until the .emit() is done.
            this._listenerOffs.push([name, callback as TogetherJSNS.CallbackForOnce<any>]);
            return;
        }
        if(name.search(" ") != -1) {
            let names = name.split(/ +/g);
            names.forEach(function(this: OnClass, n) {
                this.off(n as keyof TogetherJSNS.On.Map, callback); // TODO cast as keyof TogetherJSNS.OnMap is abusive, we should forbid passing multiple events (as a space separated string) to this function
            }, this);
            return;
        }
        if(!this._listeners[name]) {
            return;
        }
        let l = this._listeners[name], _len = l.length;
        for(let i = 0; i < _len; i++) {
            if(l[i] == callback) {
                l.splice(i, 1);
                break;
            }
        }
    }

    removeListener = this.off.bind(this);

    emit<T extends keyof TogetherJSNS.On.Map>(name: T, ...args: Parameters<TogetherJSNS.On.Map[T]>) {
        let offs = this._listenerOffs = [];
        if((!this._listeners) || !this._listeners[name]) {
            return;
        }
        let l = this._listeners[name];
        l.forEach(function(this: OnClass, callback) {
            callback.apply(this, args);
        }, this);
        delete this._listenerOffs;
        if(offs.length) {
            offs.forEach(function(this: OnClass, item) {
                this.off(item[0], item[1]);
            }, this);
        }
    }
}