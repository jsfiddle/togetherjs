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
define(["require", "exports", "./init", "./util"], function (require, exports, init_1, util_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.storage = void 0;
    //function StorageMain(util: TogetherJSNS.Util) {
    var assert = util_1.util.assert.bind(util_1.util);
    var Deferred = util_1.util.Deferred;
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
            var key = "settings." + name; // as keyof TogetherJSNS.StorageGet.MapForSettings;
            var value = this.storageInstance.settings.defaults[name]; // TODO is it possible to avoid the as unknown?
            return exports.storage.get(key, value);
        };
        StorageSettings.prototype.set = function (name, value) {
            assert(this.storageInstance.settings.defaults.hasOwnProperty(name), "Unknown setting:", name);
            var key = "settings." + name;
            return exports.storage.set(key, value);
        };
        return StorageSettings;
    }(init_1.OnClass));
    var TJSStorage = /** @class */ (function () {
        function TJSStorage(name, storage, prefix) {
            this.name = name;
            this.storage = storage;
            this.prefix = prefix;
            this.settings = new StorageSettings(this);
        }
        TJSStorage.prototype.get = function (key, defaultValue) {
            if (defaultValue === void 0) { defaultValue = null; }
            var self = this;
            return Deferred(function (def) {
                // Strictly this isn't necessary, but eventually I want to move to something more async for the storage, and this simulates that much better.
                setTimeout(util_1.util.resolver(def, function () {
                    var prefixedKey = self.prefix + key;
                    var value;
                    var valueAsString = self.storage.getItem(prefixedKey);
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
        };
        TJSStorage.prototype.set = function (key, value) {
            var self = this;
            var stringyfiedValue;
            if (value !== undefined) {
                stringyfiedValue = JSON.stringify(value);
            }
            return Deferred(function (def) {
                var prefixedKey = self.prefix + key;
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
        };
        TJSStorage.prototype.clear = function () {
            var self = this;
            var promises = [];
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
        };
        TJSStorage.prototype.keys = function (prefix, excludePrefix) {
            if (excludePrefix === void 0) { excludePrefix = false; }
            // Returns a list of keys, potentially with the given prefix
            var self = this;
            return Deferred(function (def) {
                setTimeout(util_1.util.resolver(def, function () {
                    prefix = prefix || "";
                    var result = [];
                    for (var i = 0; i < self.storage.length; i++) {
                        var key = self.storage.key(i); // TODO !
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
    var TJSStorageWithTab = /** @class */ (function (_super) {
        __extends(TJSStorageWithTab, _super);
        function TJSStorageWithTab(name, storage, prefix, tab) {
            var _this = _super.call(this, name, storage, prefix) || this;
            _this.tab = tab;
            return _this;
        }
        return TJSStorageWithTab;
    }(TJSStorage));
    var namePrefix = TogetherJS.config.get("storagePrefix");
    TogetherJS.config.close("storagePrefix");
    var tab = new TJSStorage('sessionStorage', sessionStorage, namePrefix + "-session.");
    exports.storage = new TJSStorageWithTab('localStorage', localStorage, namePrefix + ".", tab);
});
//return storage;
//define(["util"], StorageMain);
