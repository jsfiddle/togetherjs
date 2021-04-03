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
define(["require", "exports", "./jqueryPlugins"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.util = void 0;
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
    // TODO remove
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
            this.Deferred = $.Deferred;
            tjs.$ = $;
            this.AssertionError = AssertionError;
        }
        Util.prototype.forEachAttr = function (obj, callback, context) {
            context = context || obj;
            var a;
            for (a in obj) {
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
        Util.prototype.blobToBase64 = function (blob) {
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
            /* Remove the scheme and domain from url, if it matches the scheme and domain of base */
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
        Util.prototype.resolveMany = function (defs) {
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
        };
        Util.prototype.readFileImage = function (file) {
            return this.Deferred(function (def) {
                var reader = new FileReader();
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
    exports.util = new Util($, window.TogetherJS);
    exports.util.Deferred = $.Deferred;
    window.TogetherJS.$ = $;
});
