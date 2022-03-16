/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { util } from "./util";

//function StorageMain(util: TogetherJSNS.Util) {
const assert: typeof util.assert = util.assert.bind(util);
const Deferred = util.Deferred;
const DEFAULT_SETTINGS: TogetherJSNS.StorageGet.Settings = {
    dockConfig: null,
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

class StorageSettings extends OnClass<TogetherJSNS.On.Map> {
    defaults = DEFAULT_SETTINGS;

    constructor(private storageInstance: TJSStorage) {
        super();
    }

    get<K extends keyof TogetherJSNS.StorageGet.Settings>(name: K): JQueryDeferred<TogetherJSNS.StorageGet.StorageValue<`settings.${K}`>> {
        assert(Object.prototype.hasOwnProperty.call(this.storageInstance.settings.defaults, name), "Unknown setting:", name);
        const key = `settings.${name}` as const; // as keyof TogetherJSNS.StorageGet.MapForSettings;
        const value = this.storageInstance.settings.defaults[name] as unknown as TogetherJSNS.StorageGet.StorageValue<`settings.${K}`>; // TODO TS-IMPROVMENT // TODO is it possible to avoid the as unknown?
        return this.storageInstance.get(key, value);
    }

    set<K extends keyof TogetherJSNS.StorageGet.Settings>(name: K, value: TogetherJSNS.StorageGet.StorageValue<`settings.${K}`>) {
        assert(Object.prototype.hasOwnProperty.call(this.storageInstance.settings.defaults, name), "Unknown setting:", name);
        const key = `settings.${name}` as const;
        return this.storageInstance.set(key, value);
    }
}

class TJSStorage {
    public readonly settings: StorageSettings;

    constructor(
        private name: string,
        private storage: Storage,
        private prefix: string,
    ) {
        this.settings = new StorageSettings(this);
    }

    get<T extends TogetherJSNS.StorageGet.StorageKey>(key: T, defaultValue: TogetherJSNS.StorageGet.StorageValue<T> | null = null): JQueryDeferred<TogetherJSNS.StorageGet.StorageValue<T>> {
        const self = this;
        return Deferred<TogetherJSNS.StorageGet.StorageValue<T>>(function(def) {
            // Strictly this isn't necessary, but eventually I want to move to something more async for the storage, and this simulates that much better.
            setTimeout(util.resolver(def, function() {
                const prefixedKey = self.prefix + key;
                let value: TogetherJSNS.StorageGet.StorageValue<T> | null;
                const valueAsString = self.storage.getItem(prefixedKey);
                if(!valueAsString) {
                    value = defaultValue;
                    if(DEBUG_STORAGE) {
                        console.debug("Get storage", prefixedKey, "defaults to", value);
                    }
                }
                else {
                    value = JSON.parse(valueAsString); // the storage apparently contains a string that has been stringified so parsing it is still a string
                    if(DEBUG_STORAGE) {
                        console.debug("Get storage", prefixedKey, "=", value);
                    }
                }
                return value;
            }));
        });
    }

    set<T extends TogetherJSNS.StorageGet.StorageKey>(key: T, value?: TogetherJSNS.StorageGet.StorageValue<T>) {
        const self = this;
        let stringyfiedValue: string | undefined;
        if(value !== undefined) {
            stringyfiedValue = JSON.stringify(value);
        }
        return Deferred<TogetherJSNS.StorageGet.StorageValue<T>>(def => {
            const prefixedKey = self.prefix + key;
            if(stringyfiedValue === undefined) {
                self.storage.removeItem(prefixedKey);
                if(DEBUG_STORAGE) {
                    console.debug("Delete storage", prefixedKey);
                }
            }
            else {
                self.storage.setItem(prefixedKey, stringyfiedValue);
                if(DEBUG_STORAGE) {
                    console.debug("Set storage", prefixedKey, stringyfiedValue);
                }
            }
            setTimeout(def.resolve);
        });
    }

    clear() {
        const self = this;
        const promises: JQueryDeferred<unknown>[] = [];
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

    keys(prefix?: string, excludePrefix = false) {
        // Returns a list of keys, potentially with the given prefix
        const self = this;
        return Deferred<TogetherJSNS.StorageGet.StorageKey[]>(function(def) {
            setTimeout(util.resolver(def, function() {
                prefix = prefix || "";
                const result: string[] = [];
                for(let i = 0; i < self.storage.length; i++) {
                    const key = self.storage.key(i)!; // TODO !
                    if(key.indexOf(self.prefix + prefix) === 0) {
                        let shortKey = key.substr(self.prefix.length);
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

export class TJSStorageWithTab extends TJSStorage {
    constructor(
        name: string,
        storage: Storage,
        prefix: string,
        public readonly tab: TJSStorage
    ) {
        super(name, storage, prefix);
    }
}

const namePrefix = TogetherJS.config.get("storagePrefix");
TogetherJS.config.close("storagePrefix");

const tab = new TJSStorage('sessionStorage', sessionStorage, namePrefix + "-session.");
export const storage = new TJSStorageWithTab('localStorage', localStorage, namePrefix + ".", tab);

//return storage;


//define(["util"], StorageMain);
