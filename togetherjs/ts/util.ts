/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this file,
You can obtain one at http://mozilla.org/MPL/2.0/.
*/

import $ from "jquery";
import "./jqueryPlugins"; // for side effect

class AssertionError extends Error {
    public constructor(message?: string) {
        super();
        this.message = message || "";
        this.name = "AssertionError";
    }
}

export class Util {
    public Deferred;
    AssertionError: typeof AssertionError;

    public constructor() {
        this.Deferred = $.Deferred;
        this.AssertionError = AssertionError;
    }

    // TODO uses of forEachAttr could often be replaced by a loop
    // eslint-disable-next-line @typescript-eslint/ban-types
    public forEachAttr<T extends object>(obj: T, callback: (o: T[keyof T], k: keyof T) => void, context?: unknown): void {
        context = context || obj;
        let a: keyof typeof obj;
        for(a in obj) {
            if(Object.prototype.hasOwnProperty.call(obj, a)) {
                callback.call(context, obj[a], a);
            }
        }
    }

    public trim(s: string): string {
        return s.replace(/^\s+/, "").replace(/\s+$/, "");
    }

    public safeClassName(name: string): string {
        return name.replace(/[^a-zA-Z0-9_-]/g, "_") || "class";
    }

    public assert(nullable: unknown, ...args: any[]): asserts nullable;
    public assert(cond: boolean, ...args: any[]): asserts cond is true {
        if(!cond) {
            const args2 = ["Assertion error:"].concat(args);
            console.error.apply(console, args2);
            if(console.trace) {
                console.trace();
            }
            throw new this.AssertionError(args2.join(" "));
        }
    }

    /** Generates a random ID */
    public generateId(length = 10): string {
        const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV0123456789';
        let s = '';
        for(let i = 0; i < length; i++) {
            s += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        return s;
    }

    public pickRandom<T>(array: T[]): T {
        return array[Math.floor(Math.random() * array.length)];
    }

    public blobToBase64(blob: ArrayLike<number> | ArrayBufferLike | string): string {
        // TODO
        // Oh this is just terrible
        let binary = '';
        let bytes;
        if(typeof blob === "string") {
            const enc = new TextEncoder();
            bytes = enc.encode(blob);
        }
        else {
            bytes = new Uint8Array(blob);
        }
        const len = bytes.byteLength;
        for(let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    public truncateCommonDomain(url: string, base?: string): string {
        /* Remove the scheme and domain from url, if it matches the scheme and domain of base */
        if(!base) {
            return url;
        }
        const regex = /^https?:\/\/[^/]*/i;
        const match = regex.exec(url);
        const matchBase = regex.exec(base);
        if(match && matchBase && match[0] == matchBase[0]) {
            // There is a common scheme and domain
            return url.substr(match[0].length);
        }
        return url;
    }

    public makeUrlAbsolute(url: string, base: string): string {
        if(url.search(/^(http|https|ws|wss):/i) === 0) {
            // Absolute URL
            return url;
        }
        if(url.search(/^\/\/[^/]/) === 0) {
            const scheme = (/^(http|https|ws|wss):/i).exec(base);
            this.assert(scheme, "No scheme on base URL", base);
            return scheme[1] + ":" + url;
        }
        if(url.search(/^\//) === 0) {
            const domain = (/^(http|https|ws|wss):\/\/[^/]+/i).exec(base);
            this.assert(domain, "No scheme/domain on base URL", base);
            return domain[0] + url;
        }
        const last = (/[^/]+$/).exec(base);
        this.assert(last, "Does not appear to be a URL?", base);
        const lastBase = base.substr(0, last.index);
        return lastBase + url;
    }

    public assertValidUrl(url: string): void {
        /* This does some simple assertions that the url is valid:
        - it must be a string
        - it must be http(s)://... or data:...
        - it must not contain a space, quotation, or close paren
        */
        this.assert(typeof url == "string", "URLs must be a string:", url);
        this.assert(url.search(/^(http:\/\/|https:\/\/|\/\/|data:)/i) === 0,
            "URL must have an http, https, data, or // scheme:", url);
        this.assert(url.search(/[)'" ]/) === -1,
            "URLs cannot contain ), ', \", or spaces:", JSON.stringify(url));
    }

    public resolver<T, This>(deferred: JQueryDeferred<T>, func: (this: This, ...args: any[]) => (Promise<T> | T)): (this: This, ...args: any[]) => void {
        this.assert(deferred.then, "Bad deferred:", deferred);
        this.assert(typeof func == "function", "Not a function:", func);
        return function(this: This, ...args: any[]) {
            let result;
            try {
                result = func.apply(this, args);
            }
            catch(e) {
                deferred.reject(e);
                throw e;
            }
            if(result && "then" in result) {
                result.then(function(this: This) {
                    deferred.resolveWith(this, args);
                }, function(this: This) {
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

    // TODO this function accepts null value but it shouldn't
    /** Detects if a value is a promise. Right now the presence of a `.then()` method is the best we can do. */
    public isPromise<T>(obj: unknown): obj is Promise<T> {
        return typeof obj == "object" && obj != null && "then" in obj;
    }

    // TODO this function seems to never been used (even in tests)
    /** Makes a value into a promise, by returning an already-resolved promise if a non-promise objectx is given. */
    public makePromise<T>(obj: T): (T & Promise<unknown>) | JQueryDeferred<unknown> {
        if(this.isPromise(obj)) {
            return obj;
        }
        else {
            return $.Deferred(function(def) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public resolveMany<T extends readonly any[]>(defs: { [I in keyof T]: JQueryDeferred<T[I]> }): JQueryDeferred<T> {
        return this.Deferred<T>(function(def) {
            let count = defs.length;
            if(!count) {
                def.resolve();
                return;
            }
            // eslint-disable-next-line no-use-before-define
            const allResults = [] as unknown as { -readonly [K in keyof T]: T[K] };
            let anyError = false;
            defs.forEach(function(arg, index) {
                arg.then(function(result) {
                    if(result) {
                        allResults[index] = result;
                    }
                    count--;
                    check();
                },
                    function(error) {
                        allResults[index] = error;
                        anyError = true;
                        count--;
                        check();
                    });
            });
            function check() {
                if(!count) {
                    if(anyError) {
                        def.reject(allResults);
                    }
                    else {
                        def.resolve(allResults);
                    }
                }
            }
        });
    }

    public readFileImage(file: File): JQueryDeferred<string> {
        return this.Deferred(function(def: JQueryDeferred<string>) {
            const reader = new FileReader();
            reader.onload = function() {
                if(this.result) {
                    def.resolve("data:image/jpeg;base64," + Util.prototype.blobToBase64(this.result));
                }
            };
            reader.onerror = function() {
                def.reject(this.error);
            };
            reader.readAsArrayBuffer(file);
        });
    }

    public matchElement(el: HTMLElement | JQuery, selector?: string | boolean): boolean {
        if(selector === true || !selector) {
            return !!selector;
        }
        try {
            return $(el).is(selector);
        }
        catch(e) {
            console.warn("Bad selector:", selector, "error:", e);
            return false;
        }

    }

    // TODO what ???
    public testExpose(objs: Record<string, unknown>): void {
        const tsjTestSpy = window.TogetherJSTestSpy;
        if(!tsjTestSpy) {
            return;
        }
        this.forEachAttr(objs, function(value, attr) {
            tsjTestSpy[attr] = value;
        });
    }
}

export const util = new Util();
