/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["util"], function (util) {
  var storage = util.Module("storage");
  var assert = util.assert;
  var Deferred = util.Deferred;
  var STORAGE_PREFIX = "towtruck.";
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
  var WINDOW_STORAGE_EXPIRES = 30*24*60*60*1000; // 30 days

  storage.get = function (key, defaultValue) {
    return Deferred(function (def) {
      // Strictly this isn't necessary, but eventually I want to move to something more
      // async for the storage, and this simulates that much better.
      setTimeout(util.resolver(def, function () {
        key = STORAGE_PREFIX + key;
        var value = localStorage.getItem(key);
        if (! value) {
          value = defaultValue;
        } else {
          value = JSON.parse(value);
        }
        return value;
      }));
    });
  };

  storage.set = function (key, value) {
    return Deferred(function (def) {
      setTimeout(util.resolver(def, function () {
        key = STORAGE_PREFIX + key;
        if (value === undefined) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, JSON.stringify(value));
        }
      }));
    });
  };

  storage.clear = function () {
    return storage.keys().then(function (keys) {
      keys.forEach(function (key) {
        // FIXME: technically we're ignoring the promise returned by all
        // these sets:
        storage.set(key, undefined);
      });
    });
  };

  storage.keys = function (prefix, excludePrefix) {
    // Returns a list of keys, potentially with the given prefix
    return Deferred(function (def) {
      setTimeout(util.resolver(def, function () {
        prefix = prefix || "";
        var result = [];
        for (var i=0; i<localStorage.length; i++) {
          var key = localStorage.key(i);
          if (key.indexOf(STORAGE_PREFIX + prefix) === 0) {
            var shortKey = key.substr(STORAGE_PREFIX.length);
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

  storage.settings = util.mixinEvents({
    defaults: DEFAULT_SETTINGS,

    get: function (name) {
      assert(storage.settings.defaults.hasOwnProperty(name), "Unknown setting:", name);
      return Deferred(function (def) {
        storage.get("settings").then(util.resolver(def, function (settings) {
          if ((! settings) || settings[name] === undefined) {
            return storage.settings.defaults[name];
          }
          return settings[name];
        }));
      });
    },

    set: function (name, value) {
      assert(storage.settings.defaults.hasOwnProperty(name), "Unknown setting:", name);
      return Deferred(function (def) {
        storage.get("settings", {}).then(function (settings) {
          var oldValue = settings[name];
          settings[name] = value;
          var def = storage.set("settings", settings);
          storage.settings.emit("change", name, oldValue, value);
          return def;
        });
      });
    }

  });

  storage.tab = {
    get: function (key, defaultValue) {
      return storage.get(this._makeKey(key), defaultValue);
    },
    set: function (key, value) {
      if (value !== undefined) {
        value.date = Date.now();
      }
      return storage.set(this._makeKey(key), value);
    },
    keys: function (prefix) {
      return storage.keys(this._makeKey(prefix || ""), true);
    },
    expire: function () {
      var expireTime = Date.now() + WINDOW_STORAGE_EXPIRES;
      return this.keys().then(function (keys) {
        keys.forEach(function (key) {
          storage.tab.get(key).then(function (value) {
            if ((! value) || (! value.date) ||
                value.date < expireTime) {
              storage.tab.set(key, undefined);
            }
          });
        });
      });
    },
    _makeKey: function (name) {
      return util.safeClassName(window.name) + "." + name;
    }
  };

  if (! window.name) {
    window.name = "towtruck-" + util.generateId();
  }

  return storage;
});
