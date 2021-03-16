"use strict";
/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this file,
You can obtain one at http://mozilla.org/MPL/2.0/.
*/
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
var assert;
var OnClass = /** @class */ (function () {
    function OnClass() {
        this._listeners = {}; // TODO any
        this.removeListener = this.off.bind(this);
    }
    OnClass.prototype.on = function (name, callback) {
        console.log("on_class", this);
        if (typeof callback != "function") {
            console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
            throw "Error: .once() called with non-callback";
        }
        if (name.search(" ") != -1) {
            var names = name.split(/ +/g);
            names.forEach(function (n) {
                this.on(n, callback);
            }, this);
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
        if (!this._listeners) {
            this._listeners = {};
        }
        if (!this._listeners[name]) {
            this._listeners[name] = [];
        }
        if (this._listeners[name].indexOf(callback) == -1) {
            this._listeners[name].push(callback);
        }
    };
    OnClass.prototype.once = function (name, callback) {
        if (typeof callback != "function") {
            console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
            throw "Error: .once() called with non-callback";
        }
        var attr = "onceCallback_" + name;
        // FIXME: maybe I should add the event name to the .once attribute:
        if (!callback[attr]) {
            callback[attr] = function onceCallback(msg) {
                callback.apply(this, arguments);
                this.off(name, onceCallback);
                delete callback[attr];
            };
        }
        this.on(name, callback[attr]);
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
                this.off(n, callback);
            }, this);
            return;
        }
        if ((!this._listeners) || !this._listeners[name]) {
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
    OnClass.prototype.removeListener2 = function (eventName, cb) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            args[_i - 2] = arguments[_i];
        }
        this.off(arguments);
    };
    OnClass.prototype.emit = function (name) {
        var args2 = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args2[_i - 1] = arguments[_i];
        }
        var offs = this._listenerOffs = [];
        if ((!this._listeners) || !this._listeners[name]) {
            return;
        }
        var args = Array.prototype.slice.call(arguments, 1);
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
var AssertionError = /** @class */ (function (_super) {
    __extends(AssertionError, _super);
    function AssertionError(message) {
        var _this = _super.call(this) || this;
        _this.message = message || "";
        _this.name = "AssertionError";
        return _this;
    }
    return AssertionError;
}(Error));
var Module = /** @class */ (function () {
    function Module(_name) {
        this._name = _name;
    }
    Module.prototype.toString = function () {
        return '[Module ' + this._name + ']';
    };
    return Module;
}());
var Util = /** @class */ (function () {
    function Util($, tjs) {
        this.Module = function (name) { return new Module(name); };
        this.Deferred = $.Deferred; // TODO defered is of an type because it does not exists
        tjs.$ = $;
        this.extend = tjs._extend;
        this.AssertionError = AssertionError;
        this.mixinEvents = tjs._mixinEvents;
    }
    Util.prototype.forEachAttr = function (obj, callback, context) {
        context = context || obj;
        for (var a in obj) {
            if (obj.hasOwnProperty(a)) {
                callback.call(context, obj[a], a);
            }
        }
    };
    Util.prototype.trim = function (s) {
        return s.replace(/^\s+/, "").replace(/\s+$/, "");
    };
    ;
    Util.prototype.safeClassName = function (name) {
        return name.replace(/[^a-zA-Z0-9_\-]/g, "_") || "class";
    };
    ;
    Util.prototype.assert = function (cond) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (!cond) {
            var args2 = ["Assertion error:"].concat(args);
            console.error.apply(console, args2);
            if (console.trace) {
                console.trace();
            }
            throw new this.AssertionError(args2.join(" "));
        }
    };
    /** Generates a random ID */
    Util.prototype.generateId = function (length) {
        if (length === void 0) { length = 10; }
        var letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV0123456789';
        var s = '';
        for (var i = 0; i < length; i++) {
            s += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        return s;
    };
    Util.prototype.pickRandom = function (array) {
        return array[Math.floor(Math.random() * array.length)];
    };
    Util.blobToBase64 = function (blob) {
        // TODO
        // Oh this is just terrible
        var binary = '';
        var bytes;
        if (typeof blob === "string") {
            var enc = new TextEncoder();
            bytes = enc.encode(blob);
        }
        else {
            bytes = new Uint8Array(blob);
        }
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    };
    Util.prototype.truncateCommonDomain = function (url, base) {
        /* Remove the scheme and domain from url, if it matches the scheme and domain
           of base */
        if (!base) {
            return url;
        }
        var regex = /^https?:\/\/[^\/]*/i;
        var match = regex.exec(url);
        var matchBase = regex.exec(base);
        if (match && matchBase && match[0] == matchBase[0]) {
            // There is a common scheme and domain
            return url.substr(match[0].length);
        }
        return url;
    };
    Util.prototype.makeUrlAbsolute = function (url, base) {
        if (url.search(/^(http|https|ws|wss):/i) === 0) {
            // Absolute URL
            return url;
        }
        if (url.search(/^\/\/[^\/]/) === 0) {
            var scheme = (/^(http|https|ws|wss):/i).exec(base);
            this.assert(scheme, "No scheme on base URL", base);
            return scheme[1] + ":" + url;
        }
        if (url.search(/^\//) === 0) {
            var domain = (/^(http|https|ws|wss):\/\/[^\/]+/i).exec(base);
            this.assert(domain, "No scheme/domain on base URL", base);
            return domain[0] + url;
        }
        var last = (/[^\/]+$/).exec(base);
        this.assert(last, "Does not appear to be a URL?", base);
        var lastBase = base.substr(0, last.index);
        return lastBase + url;
    };
    Util.prototype.assertValidUrl = function (url) {
        /* This does some simple assertions that the url is valid:
           - it must be a string
           - it must be http(s)://... or data:...
           - it must not contain a space, quotation, or close paren
        */
        this.assert(typeof url == "string", "URLs must be a string:", url);
        this.assert(url.search(/^(http:\/\/|https:\/\/|\/\/|data:)/i) === 0, "URL must have an http, https, data, or // scheme:", url);
        this.assert(url.search(/[\)\'\"\ ]/) === -1, "URLs cannot contain ), ', \", or spaces:", JSON.stringify(url));
    };
    Util.prototype.resolver = function (deferred, func) {
        this.assert(deferred.then, "Bad deferred:", deferred);
        this.assert(typeof func == "function", "Not a function:", func);
        return function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            var result;
            try {
                result = func.apply(this, args);
            }
            catch (e) {
                deferred.reject(e);
                throw e;
            }
            if (result && result.then) {
                result.then(function () {
                    deferred.resolveWith(this, args);
                }, function () {
                    deferred.rejectWith(this, args);
                });
                // FIXME: doesn't pass progress through
            }
            else if (result === undefined) {
                deferred.resolve();
            }
            else {
                deferred.resolve(result);
            }
            return result;
        };
    };
    /** Detects if a value is a promise. Right now the presence of a `.then()` method is the best we can do. */
    Util.prototype.isPromise = function (obj) {
        return typeof obj == "object" && "then" in obj;
    };
    /** Makes a value into a promise, by returning an already-resolved promise if a non-promise objectx is given. */
    Util.prototype.makePromise = function (obj) {
        if (this.isPromise(obj)) {
            return obj;
        }
        else {
            return $.Deferred(function (def) {
                def.resolve(obj);
            });
        }
    };
    // TODO update doc to say that function does not takes multiples arguments now
    /** Resolves several promises (the promises are the arguments to the function) or the first argument may be an array of promises.
       Returns a promise that will resolve with the results of all the promises.  If any promise fails then the returned promise fails.
       FIXME: if a promise has more than one return value (like with promise.resolve(a, b)) then the latter arguments will be lost.
    */
    // work for form
    Util.prototype.resolveMany1 = function (args1) {
        var args = args1;
        return this.Deferred(function (def) {
            if (!("length" in args)) {
                def.resolve();
                return;
            }
            var count = args.length;
            var allResults = [];
            var anyError = false;
            args.forEach(function (arg, index) {
                arg.then(function (result) {
                    allResults[index] = result;
                    count--;
                    check();
                }, function (error) {
                    allResults[index] = error;
                    anyError = true;
                    count--;
                    check();
                });
            });
            function check() {
                if (!count) {
                    if (anyError) {
                        def.reject.apply(def, allResults);
                    }
                    else {
                        def.resolve.apply(def, allResults);
                    }
                }
            }
        });
    };
    // work for storage
    Util.prototype.resolveMany = function (args1) {
        var args;
        var oneArg = false;
        if (arguments.length == 1 && Array.isArray(arguments[0])) {
            oneArg = true;
            args = arguments[0];
        }
        else {
            args = Array.prototype.slice.call(arguments);
        }
        return this.Deferred(function (def) {
            var count = args.length;
            if (!count) {
                def.resolve();
                return;
            }
            var allResults = [];
            var anyError = false;
            args.forEach(function (arg, index) {
                arg.then(function (result) {
                    allResults[index] = result;
                    count--;
                    check();
                }, function (error) {
                    allResults[index] = error;
                    anyError = true;
                    count--;
                    check();
                });
            });
            function check() {
                if (!count) {
                    if (anyError) {
                        if (oneArg) {
                            def.reject(allResults);
                        }
                        else {
                            def.reject.apply(def, allResults);
                        }
                    }
                    else {
                        if (oneArg) {
                            def.resolve(allResults);
                        }
                        else {
                            def.resolve.apply(def, allResults);
                        }
                    }
                }
            }
        });
    };
    Util.prototype.readFileImage = function (file) {
        return this.Deferred(function (def) {
            var reader = new FileReader();
            reader.onload = function () {
                if (this.result) {
                    def.resolve("data:image/jpeg;base64," + Util.blobToBase64(this.result));
                }
            };
            reader.onerror = function () {
                def.reject(this.error);
            };
            reader.readAsArrayBuffer(file);
        });
    };
    Util.prototype.matchElement = function (el, selector) {
        if (selector === true || !selector) {
            return !!selector;
        }
        try {
            return $(el).is(selector);
        }
        catch (e) {
            console.warn("Bad selector:", selector, "error:", e);
            return false;
        }
    };
    // TODO what ???
    Util.prototype.testExpose = function (objs) {
        var tsjTestSpy = window.TogetherJSTestSpy;
        if (!tsjTestSpy) {
            return;
        }
        this.forEachAttr(objs, function (value, attr) {
            tsjTestSpy[attr] = value;
        });
    };
    return Util;
}());
define(["jquery", "jqueryPlugins"], function ($) {
    // =================================================================================================
    var util = new Util($, window.TogetherJS);
    assert = util.assert;
    util.Deferred = $.Deferred;
    window.TogetherJS.$ = $;
    /* A simple class pattern, use like:
  
      let Foo = util.Class({
        constructor: function (a, b) {
          init the class
        },
        otherMethod: ...
      });
  
    You can also give a superclass as the optional first argument.
  
    Instantiation does not require "new"
    */
    // TODO find and modernize all usage
    /**/
    function classFunOriginal(superClass, prototype) {
        var a;
        if (prototype === undefined) {
            prototype = superClass;
        }
        else {
            if (superClass.prototype) {
                superClass = superClass.prototype;
            }
            var newPrototype = Object.create(superClass);
            for (a in prototype) {
                if (prototype.hasOwnProperty(a)) {
                    newPrototype[a] = prototype[a];
                }
            }
            prototype = newPrototype;
        }
        var ClassObject = function () {
            var obj = Object.create(prototype);
            obj.constructor.apply(obj, arguments);
            obj.constructor = ClassObject;
            return obj;
        };
        ClassObject.prototype = prototype;
        if (prototype.constructor.name) {
            ClassObject.className = prototype.constructor.name;
            ClassObject.toString = function () {
                return '[Class ' + this.className + ']';
            };
        }
        if (prototype.classMethods) {
            for (a in prototype.classMethods) {
                if (prototype.classMethods.hasOwnProperty(a)) {
                    ClassObject[a] = prototype.classMethods[a];
                }
            }
        }
        return ClassObject;
    }
    ;
    util.Class = classFunOriginal;
    /**/
    /**
    (util as any).Module = (util as any).Class({
        constructor: function(name: string) {
            this._name = name;
        },
        toString: function() {
            return '[Module ' + this._name + ']';
        }
    });
    /**/
    return util;
});
