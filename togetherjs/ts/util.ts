/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this file,
You can obtain one at http://mozilla.org/MPL/2.0/.
*/

let assert;

class OnClass {
    _knownEvents?: string[];
    _listeners: { [name: string]: TogetherJSNS.CallbackForOnce<any>[] } = {}; // TODO any
    _listenerOffs?: [string, TogetherJSNS.CallbackForOnce<any>][];

    on<T>(name: string, callback: TogetherJSNS.CallbackForOnce<T>) {
        if(typeof callback != "function") {
            console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
            throw "Error: .once() called with non-callback";
        }
        if(name.search(" ") != -1) {
            let names = name.split(/ +/g);
            names.forEach(function(this: OnClass, n) {
                this.on(n, callback);
            }, this);
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
        if(!this._listeners) {
            this._listeners = {};
        }
        if(!this._listeners[name]) {
            this._listeners[name] = [];
        }
        if(this._listeners[name].indexOf(callback) == -1) {
            this._listeners[name].push(callback);
        }
    }

    once<T>(name: string, callback: TogetherJSNS.CallbackForOn<T>) {
        if(typeof callback != "function") {
            console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
            throw "Error: .once() called with non-callback";
        }
        let attr = "onceCallback_" + name;
        // FIXME: maybe I should add the event name to the .once attribute:
        if(!callback[attr]) {
            callback[attr] = function onceCallback(this: OnClass, msg: TogetherJSNS.Message & T) {
                callback.apply(this, arguments);
                this.off(name, onceCallback);
                delete callback[attr];
            };
        }
        this.on(name, callback[attr]);
    }

    off<T>(name: string, callback: TogetherJSNS.CallbackForOnce<T>) {
        if(this._listenerOffs) {
            // Defer the .off() call until the .emit() is done.
            this._listenerOffs.push([name, callback]);
            return;
        }
        if(name.search(" ") != -1) {
            let names = name.split(/ +/g);
            names.forEach(function(this: OnClass, n) {
                this.off(n, callback);
            }, this);
            return;
        }
        if((!this._listeners) || !this._listeners[name]) {
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

    removeListener2<T>(eventName: string, cb: TogetherJSNS.CallbackForOn<T>, ...args: any[]) {
        this.off(arguments);
    }

    removeListener = this.off.bind(this);

    emit(name: string, ...args2: unknown[]) {
        let offs = this._listenerOffs = [];
        if((!this._listeners) || !this._listeners[name]) {
            return;
        }
        var args = Array.prototype.slice.call(arguments, 1);
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

class AssertionError extends Error {
    public constructor(message?: string) {
        super();
        this.message = message || "";
        this.name = "AssertionError";
    }
}

class Module {
    constructor(public _name: string) { }
    toString() {
        return '[Module ' + this._name + ']';
    }
}

class Util {

    public Deferred;
    extend: { (conf: RequireConfig): RequireConfig; (base: unknown, extensions: unknown): unknown; };
    AssertionError: typeof AssertionError;
    mixinEvents: TogetherJSNS.TogetherJS["_mixinEvents"];
    Module = (name: string) => new Module(name);
    Class!: (superClass: Object, prototype?: Object) => any;

    public constructor($: JQueryStatic, tjs: TogetherJSNS.TogetherJS) {
        this.Deferred = $.Deferred; // TODO defered is of an type because it does not exists
        tjs.$ = $;
        this.extend = tjs._extend;
        this.AssertionError = AssertionError;
        this.mixinEvents = tjs._mixinEvents;
    }

    public forEachAttr<T extends object>(obj: T, callback: (o: T[Extract<keyof T, string>], k: keyof T) => void, context?: unknown) {
        context = context || obj;
        for(let a in obj) {
            if(obj.hasOwnProperty(a)) {
                callback.call(context, obj[a], a);
            }
        }
    }

    public trim(s: string) {
        return s.replace(/^\s+/, "").replace(/\s+$/, "");
    };

    public safeClassName(name: string) {
        return name.replace(/[^a-zA-Z0-9_\-]/g, "_") || "class";
    };

    public assert(nullable: any, ...args: any): asserts nullable;
    public assert(cond: boolean, ...args: any): asserts cond is true {
        if(!cond) {
            let args2 = ["Assertion error:"].concat(args);
            console.error.apply(console, args2);
            if(console.trace) {
                console.trace();
            }
            throw new this.AssertionError(args2.join(" "));
        }
    }

    /** Generates a random ID */
    public generateId(length: number = 10) {
        let letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV0123456789';
        let s = '';
        for(let i = 0; i < length; i++) {
            s += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        return s;
    }

    public pickRandom<T>(array: T[]) {
        return array[Math.floor(Math.random() * array.length)];
    }

    public static blobToBase64(blob: ArrayLike<number> | ArrayBufferLike | string) {
        // TODO
        // Oh this is just terrible
        let binary = '';
        let bytes;
        if(typeof blob === "string") {
            var enc = new TextEncoder();
            bytes = enc.encode(blob);
        }
        else {
            bytes = new Uint8Array(blob);
        }
        let len = bytes.byteLength;
        for(let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    public truncateCommonDomain(url: string, base: string) {
        /* Remove the scheme and domain from url, if it matches the scheme and domain
           of base */
        if(!base) {
            return url;
        }
        let regex = /^https?:\/\/[^\/]*/i;
        let match = regex.exec(url);
        let matchBase = regex.exec(base);
        if(match && matchBase && match[0] == matchBase[0]) {
            // There is a common scheme and domain
            return url.substr(match[0].length);
        }
        return url;
    }

    public makeUrlAbsolute(url: string, base: string) {
        if(url.search(/^(http|https|ws|wss):/i) === 0) {
            // Absolute URL
            return url;
        }
        if(url.search(/^\/\/[^\/]/) === 0) {
            let scheme = (/^(http|https|ws|wss):/i).exec(base);
            this.assert(scheme, "No scheme on base URL", base);
            return scheme[1] + ":" + url;
        }
        if(url.search(/^\//) === 0) {
            let domain = (/^(http|https|ws|wss):\/\/[^\/]+/i).exec(base);
            this.assert(domain, "No scheme/domain on base URL", base);
            return domain[0] + url;
        }
        let last = (/[^\/]+$/).exec(base);
        this.assert(last, "Does not appear to be a URL?", base);
        let lastBase = base.substr(0, last.index);
        return lastBase + url;
    }

    public assertValidUrl(url: string) {
        /* This does some simple assertions that the url is valid:
           - it must be a string
           - it must be http(s)://... or data:...
           - it must not contain a space, quotation, or close paren
        */
        this.assert(typeof url == "string", "URLs must be a string:", url);
        this.assert(url.search(/^(http:\/\/|https:\/\/|\/\/|data:)/i) === 0,
            "URL must have an http, https, data, or // scheme:", url);
        this.assert(url.search(/[\)\'\"\ ]/) === -1,
            "URLs cannot contain ), ', \", or spaces:", JSON.stringify(url));
    }

    public resolver<T>(deferred: JQueryDeferred<T>, func: (this: any, ...args: any[]) => any) {
        this.assert(deferred.then, "Bad deferred:", deferred);
        this.assert(typeof func == "function", "Not a function:", func);
        return function(this: any, ...args: any[]) {
            let result;
            try {
                result = func.apply(this, args);
            } catch(e) {
                deferred.reject(e);
                throw e;
            }
            if(result && result.then) {
                result.then(function(this: any) {
                    deferred.resolveWith(this, args);
                }, function(this: any) {
                    deferred.rejectWith(this, args);
                });
                // FIXME: doesn't pass progress through
            }
            else if(result === undefined) {
                deferred.resolve();
            }
            else {
                deferred.resolve(result);
            }
            return result;
        };
    }

    /** Detects if a value is a promise. Right now the presence of a `.then()` method is the best we can do. */
    public isPromise<T>(obj: any): obj is Promise<T> {
        return typeof obj == "object" && "then" in obj;
    }

    /** Makes a value into a promise, by returning an already-resolved promise if a non-promise objectx is given. */
    public makePromise<T>(obj: T) {
        if(this.isPromise(obj)) {
            return obj;
        }
        else {
            return $.Deferred(function(def) {
                def.resolve(obj);
            });
        }
    }

    // TODO update doc to say that function does not takes multiples arguments now
    /** Resolves several promises (the promises are the arguments to the function) or the first argument may be an array of promises.
       Returns a promise that will resolve with the results of all the promises.  If any promise fails then the returned promise fails.
       FIXME: if a promise has more than one return value (like with promise.resolve(a, b)) then the latter arguments will be lost.
    */
// work for form
public resolveMany1<T>(args1: JQueryDeferred<T>[]) {
    let args: JQueryDeferred<T>[] = args1;
    return this.Deferred(function(def: JQueryDeferred<T>) {
        if(!("length" in args)) {
            def.resolve();
            return;
        }
        let count = args.length;
        let allResults: (T | undefined)[] = [];
        let anyError = false;
        args.forEach(function(arg, index) {
            arg.then(function(result) {
                allResults[index] = result;
                count--;
                check();
            }, function(error) {
                allResults[index] = error;
                anyError = true;
                count--;
                check();
            });
        });
        function check() {
            if(!count) {
                if(anyError) {
                    def.reject.apply(def, allResults);
                }
                else {
                    def.resolve.apply(def, allResults);
                }
            }
        }
    });
}

// work for storage
public resolveMany<T>(args1: JQueryDeferred<T>[]) {
    var args: JQueryDeferred<T>[];
    var oneArg = false;
    if(arguments.length == 1 && Array.isArray(arguments[0])) {
        oneArg = true;
        args = arguments[0];
    }
    else {
        args = Array.prototype.slice.call(arguments);
    }
    return this.Deferred(function(def) {
        var count = args.length;
        if(!count) {
            def.resolve();
            return;
        }
        var allResults: (T | undefined)[] = [];
        var anyError = false;
        args.forEach(function(arg, index) {
            arg.then(function(result) {
                allResults[index] = result;
                count--;
                check();
            }, function(error) {
                allResults[index] = error;
                anyError = true;
                count--;
                check();
            });
        });
        function check() {
            if(!count) {
                if(anyError) {
                    if(oneArg) {
                        def.reject(allResults);
                    } else {
                        def.reject.apply(def, allResults);
                    }
                } else {
                    if(oneArg) {
                        def.resolve(allResults);
                    } else {
                        def.resolve.apply(def, allResults);
                    }
                }
            }
        }
    });
}

    public readFileImage(file: File) {
        return this.Deferred(function(def: JQueryDeferred<unknown>) {
            let reader = new FileReader();
            reader.onload = function() {
                if(this.result) {
                    def.resolve("data:image/jpeg;base64," + Util.blobToBase64(this.result));
                }
            };
            reader.onerror = function() {
                def.reject(this.error);
            };
            reader.readAsArrayBuffer(file);
        });
    }

    public matchElement(el: HTMLElement, selector?: string | true) {
        if(selector === true || !selector) {
            return !!selector;
        }
        try {
            return $(el).is(selector);
        } catch(e) {
            console.warn("Bad selector:", selector, "error:", e);
            return false;
        }

    }

    // TODO what ???
    public testExpose(objs: object) {
        const tsjTestSpy = window.TogetherJSTestSpy;
        if(!tsjTestSpy) {
            return;
        }
        this.forEachAttr(objs, function(value, attr) {
            tsjTestSpy[attr] = value;
        });
    }
}

define(["jquery", "jqueryPlugins"], function($: JQueryStatic) {
    // =================================================================================================

    let util = new Util($, window.TogetherJS);
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
      } else {
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
    };

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
