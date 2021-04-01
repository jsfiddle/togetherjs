define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.OnClass = void 0;
    var OnClass = /** @class */ (function () {
        function OnClass() {
            this._listeners = {}; // TODO any
            this.removeListener = this.off.bind(this);
        }
        OnClass.prototype.on = function (name, callback) {
            var _this = this;
            if (typeof callback != "function") {
                console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
                throw "Error: .once() called with non-callback";
            }
            if (name.search(" ") != -1) {
                var names = name.split(/ +/g);
                names.forEach(function (n) {
                    _this.on(n, callback); // TODO this cast is abusive, changing the name argument to be a array of event could solve that
                });
                return;
            }
            if (this._knownEvents && this._knownEvents.indexOf(name) == -1) {
                var thisString = "" + this;
                if (thisString.length > 20) {
                    thisString = thisString.substr(0, 20) + "...";
                }
                console.warn(thisString + ".on('" + name + "', ...): unknown event");
                if (console.trace) {
                    console.trace();
                }
            }
            if (!this._listeners[name]) {
                this._listeners[name] = [];
            }
            var cb = callback; // TODO how to avoid this cast?
            if (this._listeners[name].indexOf(cb) == -1) {
                this._listeners[name].push(cb);
            }
        };
        OnClass.prototype.once = function (name, callback) {
            if (typeof callback != "function") {
                console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
                throw "Error: .once() called with non-callback";
            }
            var cb = callback;
            var attr = "onceCallback_" + name;
            // FIXME: maybe I should add the event name to the .once attribute:
            if (!cb[attr]) {
                cb[attr] = function onceCallback() {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    cb.apply(this, args);
                    this.off(name, onceCallback);
                    delete cb[attr];
                };
            }
            this.on(name, cb[attr]);
        };
        OnClass.prototype.off = function (name, callback) {
            if (this._listenerOffs) {
                // Defer the .off() call until the .emit() is done.
                this._listenerOffs.push([name, callback]);
                return;
            }
            if (name.search(" ") != -1) {
                var names = name.split(/ +/g);
                names.forEach(function (n) {
                    this.off(n, callback); // TODO cast as keyof TogetherJSNS.OnMap is abusive, we should forbid passing multiple events (as a space separated string) to this function
                }, this);
                return;
            }
            if (!this._listeners[name]) {
                return;
            }
            var l = this._listeners[name], _len = l.length;
            for (var i = 0; i < _len; i++) {
                if (l[i] == callback) {
                    l.splice(i, 1);
                    break;
                }
            }
        };
        OnClass.prototype.emit = function (name) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            var offs = this._listenerOffs = [];
            if ((!this._listeners) || !this._listeners[name]) {
                return;
            }
            var l = this._listeners[name];
            l.forEach(function (callback) {
                callback.apply(this, args);
            }, this);
            delete this._listenerOffs;
            if (offs.length) {
                offs.forEach(function (item) {
                    this.off(item[0], item[1]);
                }, this);
            }
        };
        return OnClass;
    }());
    exports.OnClass = OnClass;
});
