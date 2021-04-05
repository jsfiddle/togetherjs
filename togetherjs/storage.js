/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
define(["require", "exports", "./util"], function (require, exports, util_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.storage = exports.TJSStorageWithTab = void 0;
    //function StorageMain(util: TogetherJSNS.Util) {
    const assert = util_1.util.assert.bind(util_1.util);
    const Deferred = util_1.util.Deferred;
    const DEFAULT_SETTINGS = {
        name: "",
        defaultName: "",
        avatar: null,
        stickyShare: null,
        color: null,
        seenIntroDialog: false,
        seenWalkthrough: false,
        dontShowRtcInfo: false
    };
    const DEBUG_STORAGE = false;
    class StorageSettings extends OnClass {
        constructor(storageInstance) {
            super();
            this.storageInstance = storageInstance;
            this.defaults = DEFAULT_SETTINGS;
        }
        get(name) {
            assert(this.storageInstance.settings.defaults.hasOwnProperty(name), "Unknown setting:", name);
            const key = `settings.${name}`; // as keyof TogetherJSNS.StorageGet.MapForSettings;
            const value = this.storageInstance.settings.defaults[name]; // TODO is it possible to avoid the as unknown?
            return exports.storage.get(key, value);
        }
        set(name, value) {
            assert(this.storageInstance.settings.defaults.hasOwnProperty(name), "Unknown setting:", name);
            const key = `settings.${name}`;
            return exports.storage.set(key, value);
        }
    }
    class TJSStorage {
        constructor(name, storage, prefix) {
            this.name = name;
            this.storage = storage;
            this.prefix = prefix;
            this.settings = new StorageSettings(this);
        }
        get(key, defaultValue = null) {
            const self = this;
            return Deferred(function (def) {
                // Strictly this isn't necessary, but eventually I want to move to something more async for the storage, and this simulates that much better.
                setTimeout(util_1.util.resolver(def, function () {
                    const prefixedKey = self.prefix + key;
                    let value;
                    const valueAsString = self.storage.getItem(prefixedKey);
                    if (!valueAsString) {
                        value = defaultValue;
                        if (DEBUG_STORAGE) {
                            console.debug("Get storage", prefixedKey, "defaults to", value);
                        }
                    }
                    else {
                        value = JSON.parse(valueAsString); // the storage apparently contains a string that has been stringified so parsing it is still a string
                        if (DEBUG_STORAGE) {
                            console.debug("Get storage", prefixedKey, "=", value);
                        }
                    }
                    return value;
                }));
            });
        }
        set(key, value) {
            const self = this;
            let stringyfiedValue;
            if (value !== undefined) {
                stringyfiedValue = JSON.stringify(value);
            }
            return Deferred(def => {
                const prefixedKey = self.prefix + key;
                if (stringyfiedValue === undefined) {
                    self.storage.removeItem(prefixedKey);
                    if (DEBUG_STORAGE) {
                        console.debug("Delete storage", prefixedKey);
                    }
                }
                else {
                    self.storage.setItem(prefixedKey, stringyfiedValue);
                    if (DEBUG_STORAGE) {
                        console.debug("Set storage", prefixedKey, stringyfiedValue);
                    }
                }
                setTimeout(def.resolve);
            });
        }
        clear() {
            const self = this;
            const promises = [];
            return Deferred((function (def) {
                self.keys().then(function (keys) {
                    assert(keys !== undefined);
                    keys.forEach(function (key) {
                        // FIXME: technically we're ignoring the promise returned by all these sets:
                        promises.push(self.set(key, undefined));
                    });
                    util_1.util.resolveMany(promises).then(function () {
                        def.resolve();
                    });
                });
            }).bind(this));
        }
        keys(prefix, excludePrefix = false) {
            // Returns a list of keys, potentially with the given prefix
            const self = this;
            return Deferred(function (def) {
                setTimeout(util_1.util.resolver(def, function () {
                    prefix = prefix || "";
                    const result = [];
                    for (let i = 0; i < self.storage.length; i++) {
                        const key = self.storage.key(i); // TODO !
                        if (key.indexOf(self.prefix + prefix) === 0) {
                            let shortKey = key.substr(self.prefix.length);
                            if (excludePrefix) {
                                shortKey = shortKey.substr(prefix.length);
                            }
                            result.push(shortKey);
                        }
                    }
                    return result;
                }));
            });
        }
        toString() {
            return '[storage for ' + this.name + ']';
        }
    }
    class TJSStorageWithTab extends TJSStorage {
        constructor(name, storage, prefix, tab) {
            super(name, storage, prefix);
            this.tab = tab;
        }
    }
    exports.TJSStorageWithTab = TJSStorageWithTab;
    const namePrefix = TogetherJS.config.get("storagePrefix");
    TogetherJS.config.close("storagePrefix");
    const tab = new TJSStorage('sessionStorage', sessionStorage, namePrefix + "-session.");
    exports.storage = new TJSStorageWithTab('localStorage', localStorage, namePrefix + ".", tab);
});
//return storage;
//define(["util"], StorageMain);
