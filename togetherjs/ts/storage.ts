/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

function StorageMain(util: Util) {
    var assert: typeof util.assert = util.assert;
    var Deferred = util.Deferred;
    var DEFAULT_SETTINGS = {
        name: "",
        defaultName: "",
        avatar: null,
        stickyShare: null,
        color: null,
        seenIntroDialog: false,
        seenWalkthrough: false,
        dontShowRtcInfo: false
    };

    var DEBUG_STORAGE = false;

    class StorageSettings extends OnClass {
        defaults = DEFAULT_SETTINGS;

        constructor(private storageInstance: TJSStorage) {
            super();
        }

        get(name: keyof typeof DEFAULT_SETTINGS) {
            console.log("get_settings_class", name, this.storageInstance.settings.defaults[name]);
            assert(this.storageInstance.settings.defaults.hasOwnProperty(name), "Unknown setting:", name);
            return storage.get("settings." + name, this.storageInstance.settings.defaults[name]);
        }

        set(name: string, value: string | undefined) {
            assert(this.storageInstance.settings.defaults.hasOwnProperty(name), "Unknown setting:", name);
            return storage.set("settings." + name, value);
        }
    }

    class TJSStorage {
        public readonly settings: StorageSettings = new StorageSettings(this);;

        constructor(
            private name: string,
            private storage: Storage,
            private prefix: string,
            public readonly tab?: TJSStorage
        ) {
            //this.settings = new StorageSettings(this);
        }

        get(key: string, defaultValue: string) {
            var self = this;
            return Deferred(function(def: JQueryDeferred<unknown>) {
                // Strictly this isn't necessary, but eventually I want to move to something more
                // async for the storage, and this simulates that much better.
                setTimeout(util.resolver(def, function() {
                    key = self.prefix + key;
                    var value = self.storage.getItem(key);
                    if(!value) {
                        value = defaultValue;
                        if(DEBUG_STORAGE) {
                            console.debug("Get storage", key, "defaults to", value);
                        }
                    } else {
                        value = JSON.parse(value);
                        if(DEBUG_STORAGE) {
                            console.debug("Get storage", key, "=", value);
                        }
                    }
                    return value;
                }));
            });
        }

        set(key: string, value: string | undefined) {
            var self = this;
            if(value !== undefined) {
                value = JSON.stringify(value);
            }
            return Deferred(def => {
                key = self.prefix + key;
                if(value === undefined) {
                    self.storage.removeItem(key);
                    if(DEBUG_STORAGE) {
                        console.debug("Delete storage", key);
                    }
                }
                else {
                    self.storage.setItem(key, value);
                    if(DEBUG_STORAGE) {
                        console.debug("Set storage", key, value);
                    }
                }
                setTimeout(def.resolve);
            });
        }

        clear() {
            var self = this;
            var promises: JQueryDeferred<unknown>[] = [];
            return Deferred((def => {
                this.keys().then(function(keys) {
                    assert(keys !== undefined);
                    keys.forEach(function(key) {
                        // FIXME: technically we're ignoring the promise returned by all these sets:
                        promises.push(self.set(key, undefined));
                    });
                    util.resolveMany(promises).then(function() {
                        def.resolve();
                    });
                });
            }));
        }

        keys(prefix: string, excludePrefix: boolean = false) {
            // Returns a list of keys, potentially with the given prefix
            var self = this;
            return Deferred<string[]>(function(def) {
                setTimeout(util.resolver(def, function() {
                    prefix = prefix || "";
                    let result: string[] = [];
                    for(var i = 0; i < self.storage.length; i++) {
                        let key = self.storage.key(i);
                        if(key.indexOf(self.prefix + prefix) === 0) {
                            var shortKey = key.substr(self.prefix.length);
                            if(excludePrefix) {
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

    var namePrefix = TogetherJS.config.get("storagePrefix");
    TogetherJS.config.close("storagePrefix");

    const tab = new TJSStorage('sessionStorage', sessionStorage, namePrefix + "-session.");
    const storage = new TJSStorage('localStorage', localStorage, namePrefix + ".", tab);

    return storage;
}

define(["util"], StorageMain);
