"use strict";
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
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
function StorageMain(util) {
    var assert = util.assert;
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
    var TJSStorage = /** @class */ (function () {
        function TJSStorage(name, storage, prefix, tab) {
            this.name = name;
            this.storage = storage;
            this.prefix = prefix;
            this.tab = tab;
            //this.settings = new StorageSettings(this);
        }
        TJSStorage.prototype.get = function (key, defaultValue) {
            var self = this;
            return Deferred(function (def) {
                // Strictly this isn't necessary, but eventually I want to move to something more
                // async for the storage, and this simulates that much better.
                setTimeout(util.resolver(def, function () {
                    key = self.prefix + key;
                    var value = self.storage.getItem(key);
                    if (!value) {
                        value = defaultValue;
                        if (DEBUG_STORAGE) {
                            console.debug("Get storage", key, "defaults to", value);
                        }
                    }
                    else {
                        value = JSON.parse(value);
                        if (DEBUG_STORAGE) {
                            console.debug("Get storage", key, "=", value);
                        }
                    }
                    return value;
                }));
            });
        };
        TJSStorage.prototype.set = function (key, value) {
            var self = this;
            if (value !== undefined) {
                value = JSON.stringify(value);
            }
            return Deferred(function (def) {
                key = self.prefix + key;
                if (value === undefined) {
                    self.storage.removeItem(key);
                    if (DEBUG_STORAGE) {
                        console.debug("Delete storage", key);
                    }
                }
                else {
                    self.storage.setItem(key, value);
                    if (DEBUG_STORAGE) {
                        console.debug("Set storage", key, value);
                    }
                }
                setTimeout(def.resolve);
            });
        };
        TJSStorage.prototype.clear = function () {
            var _this = this;
            var self = this;
            var promises = [];
            return Deferred((function (def) {
                _this.keys().then(function (keys) {
                    assert(keys !== undefined);
                    keys.forEach(function (key) {
                        // FIXME: technically we're ignoring the promise returned by all these sets:
                        promises.push(self.set(key, undefined));
                    });
                    util.resolveMany(promises).then(function () {
                        def.resolve();
                    });
                });
            }));
        };
        TJSStorage.prototype.keys = function (prefix, excludePrefix) {
            if (excludePrefix === void 0) { excludePrefix = false; }
            // Returns a list of keys, potentially with the given prefix
            var self = this;
            return Deferred(function (def) {
                setTimeout(util.resolver(def, function () {
                    prefix = prefix || "";
                    var result = [];
                    for (var i = 0; i < self.storage.length; i++) {
                        var key = self.storage.key(i);
                        if (key.indexOf(self.prefix + prefix) === 0) {
                            var shortKey = key.substr(self.prefix.length);
                            if (excludePrefix) {
                                shortKey = shortKey.substr(prefix.length);
                            }
                            result.push(shortKey);
                        }
                    }
                    return result;
                }));
            });
        };
        TJSStorage.prototype.toString = function () {
            return '[storage for ' + this.name + ']';
        };
        return TJSStorage;
    }());
    var namePrefix = TogetherJS.config.get("storagePrefix");
    TogetherJS.config.close("storagePrefix");
    var tab = new TJSStorage('sessionStorage', sessionStorage, namePrefix + "-session.");
    var storage = new TJSStorage('localStorage', localStorage, namePrefix + ".", tab);
    var StorageSettings = /** @class */ (function (_super) {
        __extends(StorageSettings, _super);
        function StorageSettings(storageInstance) {
            var _this = _super.call(this) || this;
            _this.storageInstance = storageInstance;
            _this.defaults = DEFAULT_SETTINGS;
            return _this;
        }
        StorageSettings.prototype.get = function (name) {
            assert(this.storageInstance.settings.defaults.hasOwnProperty(name), "Unknown setting:", name);
            return storage.get("settings." + name, "" + this.storageInstance.settings.defaults[name]);
        };
        StorageSettings.prototype.set = function (name, value) {
            assert(this.storageInstance.settings.defaults.hasOwnProperty(name), "Unknown setting:", name);
            return storage.set("settings." + name, value);
        };
        return StorageSettings;
    }(OnClass));
    storage.settings2 = new StorageSettings(storage);
    storage.settings = util.mixinEvents({
        defaults: DEFAULT_SETTINGS,
        get: function (name) {
            assert(storage.settings.defaults.hasOwnProperty(name), "Unknown setting:", name);
            return storage.get("settings." + name, storage.settings.defaults[name]);
        },
        set: function (name, value) {
            assert(storage.settings.defaults.hasOwnProperty(name), "Unknown setting:", name);
            return storage.set("settings." + name, value);
        }
    });
    return storage;
}
define(["util"], StorageMain);
