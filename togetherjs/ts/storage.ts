/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

interface Settings {
    name: string,
    defaultName: string,
    avatar: string | null,
    stickyShare: null,
    color: string | null,
    seenIntroDialog: boolean,
    seenWalkthrough: boolean,
    dontShowRtcInfo: boolean
}

function StorageMain(util: Util) {
    var assert: typeof util.assert = util.assert;
    var Deferred = util.Deferred;
    var DEFAULT_SETTINGS: Settings = {
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

        get<K extends keyof Settings>(name: K): JQueryDeferred<Settings[K]> {
            assert(this.storageInstance.settings.defaults.hasOwnProperty(name), "Unknown setting:", name);
            return storage.get("settings." + name, this.storageInstance.settings.defaults[name]);
        }

        set(name: string, value: string | boolean | undefined) {
            assert(this.storageInstance.settings.defaults.hasOwnProperty(name), "Unknown setting:", name);
            return storage.set("settings." + name, value);
        }
    }

    class TJSStorage {
        public readonly settings: StorageSettings;

        constructor(
            private name: string,
            private storage: Storage,
            private prefix: string,
            public readonly tab?: TJSStorage
        ) {
            this.settings = new StorageSettings(this);
        }

        get<T>(key: string, defaultValue: T | null = null) {
            var self = this;
            return Deferred(function(def: JQueryDeferred<T>) {
                // Strictly this isn't necessary, but eventually I want to move to something more
                // async for the storage, and this simulates that much better.
                setTimeout(util.resolver(def, function() {
                    key = self.prefix + key;
                    let value: T | null;
                    var valueAsString = self.storage.getItem(key);
                    if(!valueAsString) {
                        value = defaultValue;
                        if(DEBUG_STORAGE) {
                            console.debug("Get storage", key, "defaults to", value);
                        }
                    }
                    else {
                        value = JSON.parse(valueAsString);
                        if(DEBUG_STORAGE) {
                            console.debug("Get storage", key, "=", value);
                        }
                    }
                    return value;
                }));
            });
        }

        set(key: string, value?: unknown) {
            var self = this;
            let stringyfiedValue: string | undefined;
            if(value !== undefined) {
                stringyfiedValue = JSON.stringify(value);
            }
            return Deferred(def => {
                key = self.prefix + key;
                if(stringyfiedValue === undefined) {
                    self.storage.removeItem(key);
                    if(DEBUG_STORAGE) {
                        console.debug("Delete storage", key);
                    }
                }
                else {
                    self.storage.setItem(key, stringyfiedValue);
                    if(DEBUG_STORAGE) {
                        console.debug("Set storage", key, stringyfiedValue);
                    }
                }
                setTimeout(def.resolve);
            });
        }

        clear() {
            var self = this;
            var promises: JQueryDeferred<unknown>[] = [];
            return Deferred((function(def: JQueryDeferred<unknown>) {
                self.keys().then(function(keys) {
                    assert(keys !== undefined);
                    keys.forEach(function(key) {
                        // FIXME: technically we're ignoring the promise returned by all these sets:
                        promises.push(self.set(key, undefined));
                    });
                    util.resolveMany(promises).then(function() {
                        def.resolve();
                    });
                });
            }).bind(this));
        }

        keys(prefix?: string, excludePrefix: boolean = false) {
            // Returns a list of keys, potentially with the given prefix
            var self = this;
            return Deferred<string[]>(function(def) {
                setTimeout(util.resolver(def, function() {
                    prefix = prefix || "";
                    let result: string[] = [];
                    for(var i = 0; i < self.storage.length; i++) {
                        let key = self.storage.key(i)!; // TODO !
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
