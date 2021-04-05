/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this file,
You can obtain one at http://mozilla.org/MPL/2.0/.
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "jquery", "./jqueryPlugins"], function (require, exports, jquery_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.util = exports.Util = void 0;
    jquery_1 = __importDefault(jquery_1);
    class AssertionError extends Error {
        constructor(message) {
            super();
            this.message = message || "";
            this.name = "AssertionError";
        }
    }
    // TODO remove
    class Module {
        constructor(_name) {
            this._name = _name;
        }
        toString() {
            return '[Module ' + this._name + ']';
        }
    }
    class Util {
        constructor($) {
            this.Module = (name) => new Module(name);
            this.Deferred = $.Deferred;
            this.AssertionError = AssertionError;
        }
        forEachAttr(obj, callback, context) {
            context = context || obj;
            let a;
            for (a in obj) {
                if (obj.hasOwnProperty(a)) {
                    callback.call(context, obj[a], a);
                }
            }
        }
        trim(s) {
            return s.replace(/^\s+/, "").replace(/\s+$/, "");
        }
        ;
        safeClassName(name) {
            return name.replace(/[^a-zA-Z0-9_\-]/g, "_") || "class";
        }
        ;
        assert(cond, ...args) {
            if (!cond) {
                let args2 = ["Assertion error:"].concat(args);
                console.error.apply(console, args2);
                if (console.trace) {
                    console.trace();
                }
                throw new this.AssertionError(args2.join(" "));
            }
        }
        /** Generates a random ID */
        generateId(length = 10) {
            let letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV0123456789';
            let s = '';
            for (let i = 0; i < length; i++) {
                s += letters.charAt(Math.floor(Math.random() * letters.length));
            }
            return s;
        }
        pickRandom(array) {
            return array[Math.floor(Math.random() * array.length)];
        }
        blobToBase64(blob) {
            // TODO
            // Oh this is just terrible
            let binary = '';
            let bytes;
            if (typeof blob === "string") {
                var enc = new TextEncoder();
                bytes = enc.encode(blob);
            }
            else {
                bytes = new Uint8Array(blob);
            }
            let len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        }
        truncateCommonDomain(url, base) {
            /* Remove the scheme and domain from url, if it matches the scheme and domain of base */
            if (!base) {
                return url;
            }
            let regex = /^https?:\/\/[^\/]*/i;
            let match = regex.exec(url);
            let matchBase = regex.exec(base);
            if (match && matchBase && match[0] == matchBase[0]) {
                // There is a common scheme and domain
                return url.substr(match[0].length);
            }
            return url;
        }
        makeUrlAbsolute(url, base) {
            if (url.search(/^(http|https|ws|wss):/i) === 0) {
                // Absolute URL
                return url;
            }
            if (url.search(/^\/\/[^\/]/) === 0) {
                let scheme = (/^(http|https|ws|wss):/i).exec(base);
                this.assert(scheme, "No scheme on base URL", base);
                return scheme[1] + ":" + url;
            }
            if (url.search(/^\//) === 0) {
                let domain = (/^(http|https|ws|wss):\/\/[^\/]+/i).exec(base);
                this.assert(domain, "No scheme/domain on base URL", base);
                return domain[0] + url;
            }
            let last = (/[^\/]+$/).exec(base);
            this.assert(last, "Does not appear to be a URL?", base);
            let lastBase = base.substr(0, last.index);
            return lastBase + url;
        }
        assertValidUrl(url) {
            /* This does some simple assertions that the url is valid:
            - it must be a string
            - it must be http(s)://... or data:...
            - it must not contain a space, quotation, or close paren
            */
            this.assert(typeof url == "string", "URLs must be a string:", url);
            this.assert(url.search(/^(http:\/\/|https:\/\/|\/\/|data:)/i) === 0, "URL must have an http, https, data, or // scheme:", url);
            this.assert(url.search(/[\)\'\"\ ]/) === -1, "URLs cannot contain ), ', \", or spaces:", JSON.stringify(url));
        }
        resolver(deferred, func) {
            this.assert(deferred.then, "Bad deferred:", deferred);
            this.assert(typeof func == "function", "Not a function:", func);
            return function (...args) {
                let result;
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
        }
        /** Detects if a value is a promise. Right now the presence of a `.then()` method is the best we can do. */
        isPromise(obj) {
            return typeof obj == "object" && "then" in obj;
        }
        /** Makes a value into a promise, by returning an already-resolved promise if a non-promise objectx is given. */
        makePromise(obj) {
            if (this.isPromise(obj)) {
                return obj;
            }
            else {
                return jquery_1.default.Deferred(function (def) {
                    def.resolve(obj);
                });
            }
        }
        // TODO should we just replace resolveMany with promises and promise.all?
        /** Resolves several promises givent as one argument as an array of promises.
            Returns a promise that will resolve with the results of all the promises.  If any promise fails then the returned promise fails.
            FIXME: if a promise has more than one return value (like with promise.resolve(a, b)) then the latter arguments will be lost.
            Use like this:
            const s = storage.settings;
            util.resolveMany([s.get("name"), s.get("avatar"), s.get("defaultName"), s.get("color")] as const).then(args => {
                let [name, avatar, defaultName, color] = args!; // for this example "!" is used because args can be undefined
                // ...
            }
        */
        resolveMany(defs) {
            return this.Deferred(function (def) {
                var count = defs.length;
                if (!count) {
                    def.resolve();
                    return;
                }
                var allResults = [];
                var anyError = false;
                defs.forEach(function (arg, index) {
                    arg.then(function (result) {
                        if (result) {
                            allResults[index] = result;
                        }
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
                            def.reject(allResults);
                        }
                        else {
                            def.resolve(allResults);
                        }
                    }
                }
            });
        }
        readFileImage(file) {
            return this.Deferred(function (def) {
                let reader = new FileReader();
                reader.onload = function () {
                    if (this.result) {
                        def.resolve("data:image/jpeg;base64," + Util.prototype.blobToBase64(this.result));
                    }
                };
                reader.onerror = function () {
                    def.reject(this.error);
                };
                reader.readAsArrayBuffer(file);
            });
        }
        matchElement(el, selector) {
            if (selector === true || !selector) {
                return !!selector;
            }
            try {
                return jquery_1.default(el).is(selector);
            }
            catch (e) {
                console.warn("Bad selector:", selector, "error:", e);
                return false;
            }
        }
        // TODO what ???
        testExpose(objs) {
            const tsjTestSpy = window.TogetherJSTestSpy;
            if (!tsjTestSpy) {
                return;
            }
            this.forEachAttr(objs, function (value, attr) {
                tsjTestSpy[attr] = value;
            });
        }
    }
    exports.Util = Util;
    exports.util = new Util(jquery_1.default);
});
