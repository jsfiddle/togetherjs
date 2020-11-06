/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["jquery", "jqueryPlugins"], function($: JQuery) {

    class AssertionError extends Error {
        public constructor(message?: string) {
            super();
            this.message = message || "";
            this.name = "AssertionError";
        }
    }

    let util2 = class Util {

        public Deferred: any;
        extend: { (conf: RequireConfig): RequireConfig; (base: unknown, extensions: unknown): unknown; };
        AssertionError: typeof AssertionError;
        mixinEvents: TogetherJS.TogetherJS["_mixinEvents"];
        Module: () => any;

        public constructor($: JQuery, tjs: TogetherJS.TogetherJS) {
            this.Deferred = $.Deferred; // TODO defered is of an type because it does not exists
            tjs.$ = $;
            this.extend = tjs._extend;
            this.AssertionError = AssertionError;

            this.mixinEvents = tjs._mixinEvents;

            this.Module = this.Class({
                constructor: function(name: string) {
                    this._name = name;
                },
                toString: function() {
                    return '[Module ' + this._name + ']';
                }
            });
        }

        public Class(superClass: TogetherJS.Util.ObjectWithName, prototype?: object) {
            let a: keyof object;
            let proto: object = prototype || superClass;
            
            if(superClass.prototype) {
                superClass = superClass.prototype;
            }
            let newPrototype = Object.create(superClass);
            for(a in proto) {
                if(proto.hasOwnProperty(a)) {
                    newPrototype[a] = proto[a];
                }
            }
            proto = newPrototype;
        
            let ClassObject = function() {
                let obj = Object.create(proto);
                obj.constructor.apply(obj, arguments);
                obj.constructor = ClassObject;
                return obj;
            };
            ClassObject.prototype = proto;
            if(proto.constructor.name) {
                ClassObject.className = proto.constructor.name;
                ClassObject.toString = function() {
                    return '[Class ' + this.className + ']';
                };
            }
            if(proto.classMethods) {
                for(a in proto.classMethods) {
                    if(proto.classMethods.hasOwnProperty(a)) {
                        ClassObject[a] = proto.classMethods[a];
                    }
                }
            }
            return ClassObject;
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

        public assert(cond: boolean, ...args: any) {
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
        public generateId(length: number) {
            length = length || 10;
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

        public blobToBase64(blob: ArrayLike<number> | ArrayBufferLike) {
            // TODO
            // Oh this is just terrible
            let binary = '';
            let bytes = new Uint8Array(blob);
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

        public resolver(deferred: Promise<unknown>, func) {
            this.assert(deferred.then, "Bad deferred:", deferred);
            this.assert(typeof func == "function", "Not a function:", func);
            return function() {
                let result;
                try {
                    result = func.apply(this, arguments);
                } catch(e) {
                    deferred.reject(e);
                    throw e;
                }
                if(result && result.then) {
                    result.then(function() {
                        deferred.resolveWith(this, arguments);
                    }, function() {
                        deferred.rejectWith(this, arguments);
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

        /** Resolves several promises (the promises are the arguments to the function) or the first argument may be an array of promises.
           Returns a promise that will resolve with the results of all the promises.  If any promise fails then the returned promise fails.
           FIXME: if a promise has more than one return value (like with promise.resolve(a, b)) then the latter arguments will be lost.
        */
        public resolveMany() {
            let args;
            let oneArg = false;
            if(arguments.length == 1 && Array.isArray(arguments[0])) {
                oneArg = true;
                args = arguments[0];
            }
            else {
                args = Array.prototype.slice.call(arguments);
            }
            return this.Deferred(function(def) {
                let count = args.length;
                if(!count) {
                    def.resolve();
                    return;
                }
                let allResults = [];
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
                            if(oneArg) {
                                def.reject(allResults);
                            }
                            else {
                                def.reject.apply(def, allResults);
                            }
                        }
                        else {
                            if(oneArg) {
                                def.resolve(allResults);
                            }
                            else {
                                def.resolve.apply(def, allResults);
                            }
                        }
                    }
                }
            });
        }

        public readFileImage(el) {
            return this.Deferred(function(def) {
                let reader = new FileReader();
                reader.onload = function() {
                    def.resolve("data:image/jpeg;base64," + this.blobToBase64(this.result));
                };
                reader.onerror = function() {
                    def.reject(this.error);
                };
                reader.readAsArrayBuffer(el.files[0]);
            });
        }

        public matchElement(el, selector) {
            let res = selector;
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

        public testExpose(objs) {
            if(typeof TogetherJSTestSpy == "undefined") {
                return;
            }
            this.forEachAttr(objs, function(value, attr) {
                TogetherJSTestSpy[attr] = value;
            });
        }

    }

    // =================================================================================================

    let util = {};

    util.Deferred = $.Deferred;
    TogetherJS.$ = $;

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
    util.Class = function(superClass, prototype) {
        let a;
        if(prototype === undefined) {
            prototype = superClass;
        }
        else {
            if(superClass.prototype) {
                superClass = superClass.prototype;
            }
            let newPrototype = Object.create(superClass);
            for(a in prototype) {
                if(prototype.hasOwnProperty(a)) {
                    newPrototype[a] = prototype[a];
                }
            }
            prototype = newPrototype;
        }
        let ClassObject = function() {
            let obj = Object.create(prototype);
            obj.constructor.apply(obj, arguments);
            obj.constructor = ClassObject;
            return obj;
        };
        ClassObject.prototype = prototype;
        if(prototype.constructor.name) {
            ClassObject.className = prototype.constructor.name;
            ClassObject.toString = function() {
                return '[Class ' + this.className + ']';
            };
        }
        if(prototype.classMethods) {
            for(a in prototype.classMethods) {
                if(prototype.classMethods.hasOwnProperty(a)) {
                    ClassObject[a] = prototype.classMethods[a];
                }
            }
        }
        return ClassObject;
    };

    /* Extends obj with other, or copies obj if no other is given. */
    util.extend = TogetherJS._extend;

    util.forEachAttr = function(obj, callback, context) {
        context = context || obj;
        for(let a in obj) {
            if(obj.hasOwnProperty(a)) {
                callback.call(context, obj[a], a);
            }
        }
    };

    /* Trim whitespace from a string */
    util.trim = function trim(s) {
        return s.replace(/^\s+/, "").replace(/\s+$/, "");
    };

    /* Convert a string into something safe to use as an HTML class name */
    util.safeClassName = function safeClassName(name) {
        return name.replace(/[^a-zA-Z0-9_\-]/g, "_") || "class";
    };

    util.AssertionError = function(message) {
        if(!this instanceof util.AssertionError) {
            return new util.AssertionError(message);
        }
        this.message = message;
        this.name = "AssertionError";
    };
    util.AssertionError.prototype = Error.prototype;

    util.assert = function(cond) {
        if(!cond) {
            let args = ["Assertion error:"].concat(Array.prototype.slice.call(arguments, 1));
            console.error.apply(console, args);
            if(console.trace) {
                console.trace();
            }
            throw new util.AssertionError(args.join(" "));
        }
    };

    /* Generates a random ID */
    util.generateId = function(length) {
        length = length || 10;
        let letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV0123456789';
        let s = '';
        for(let i = 0; i < length; i++) {
            s += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        return s;
    };

    util.pickRandom = function(array) {
        return array[Math.floor(Math.random() * array.length)];
    };

    util.mixinEvents = TogetherJS._mixinEvents;

    util.Module = util.Class({
        constructor: function(name) {
            this._name = name;
        },
        toString: function() {
            return '[Module ' + this._name + ']';
        }
    });

    util.blobToBase64 = function(blob) {
        // Oh this is just terrible
        let binary = '';
        let bytes = new Uint8Array(blob);
        let len = bytes.byteLength;
        for(let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    };

    util.truncateCommonDomain = function(url, base) {
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
    };

    util.makeUrlAbsolute = function(url, base) {
        if(url.search(/^(http|https|ws|wss):/i) === 0) {
            // Absolute URL
            return url;
        }
        if(url.search(/^\/\/[^\/]/) === 0) {
            let scheme = (/^(http|https|ws|wss):/i).exec(base);
            util.assert(scheme, "No scheme on base URL", base);
            return scheme[1] + ":" + url;
        }
        if(url.search(/^\//) === 0) {
            let domain = (/^(http|https|ws|wss):\/\/[^\/]+/i).exec(base);
            util.assert(domain, "No scheme/domain on base URL", base);
            return domain[0] + url;
        }
        let last = (/[^\/]+$/).exec(base);
        util.assert(last, "Does not appear to be a URL?", base);
        let lastBase = base.substr(0, last.index);
        return lastBase + url;
    };

    util.assertValidUrl = function(url) {
        /* This does some simple assertions that the url is valid:
           - it must be a string
           - it must be http(s)://... or data:...
           - it must not contain a space, quotation, or close paren
        */
        util.assert(typeof url == "string", "URLs must be a string:", url);
        util.assert(url.search(/^(http:\/\/|https:\/\/|\/\/|data:)/i) === 0,
            "URL must have an http, https, data, or // scheme:", url);
        util.assert(url.search(/[\)\'\"\ ]/) === -1,
            "URLs cannot contain ), ', \", or spaces:", JSON.stringify(url));
    };

    util.resolver = function(deferred, func) {
        util.assert(deferred.then, "Bad deferred:", deferred);
        util.assert(typeof func == "function", "Not a function:", func);
        return function() {
            let result;
            try {
                result = func.apply(this, arguments);
            } catch(e) {
                deferred.reject(e);
                throw e;
            }
            if(result && result.then) {
                result.then(function() {
                    deferred.resolveWith(this, arguments);
                }, function() {
                    deferred.rejectWith(this, arguments);
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
    };

    /* Detects if a value is a promise.  Right now the presence of a
       `.then()` method is the best we can do.
    */
    util.isPromise = function(obj) {
        return typeof obj == "object" && obj.then;
    };

    /* Makes a value into a promise, by returning an already-resolved
       promise if a non-promise objectx is given.
    */
    util.makePromise = function(obj) {
        if(util.isPromise(obj)) {
            return obj;
        }
        else {
            return $.Deferred(function(def) {
                def.resolve(obj);
            });
        }
    };

    /* Resolves several promises (the promises are the arguments to the function)
       or the first argument may be an array of promises.
  
       Returns a promise that will resolve with the results of all the
       promises.  If any promise fails then the returned promise fails.
  
       FIXME: if a promise has more than one return value (like with
       promise.resolve(a, b)) then the latter arguments will be lost.
       */
    util.resolveMany = function() {
        let args;
        let oneArg = false;
        if(arguments.length == 1 && Array.isArray(arguments[0])) {
            oneArg = true;
            args = arguments[0];
        }
        else {
            args = Array.prototype.slice.call(arguments);
        }
        return util.Deferred(function(def) {
            let count = args.length;
            if(!count) {
                def.resolve();
                return;
            }
            let allResults = [];
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
                        if(oneArg) {
                            def.reject(allResults);
                        }
                        else {
                            def.reject.apply(def, allResults);
                        }
                    }
                    else {
                        if(oneArg) {
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

    util.readFileImage = function(el) {
        return util.Deferred(function(def) {
            let reader = new FileReader();
            reader.onload = function() {
                def.resolve("data:image/jpeg;base64," + util.blobToBase64(this.result));
            };
            reader.onerror = function() {
                def.reject(this.error);
            };
            reader.readAsArrayBuffer(el.files[0]);
        });
    };

    util.matchElement = function(el, selector) {
        let res = selector;
        if(selector === true || !selector) {
            return !!selector;
        }
        try {
            return $(el).is(selector);
        } catch(e) {
            console.warn("Bad selector:", selector, "error:", e);
            return false;
        }

    };

    util.testExpose = function(objs) {
        if(typeof TogetherJSTestSpy == "undefined") {
            return;
        }
        util.forEachAttr(objs, function(value, attr) {
            TogetherJSTestSpy[attr] = value;
        });
    };

    return util;
});
