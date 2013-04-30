/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["util"], function (util) {
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

  var Storage = util.Class({
    constructor: function (storage, prefix) {
      this.storage = storage;
      this.prefix = prefix;
    },

    get: function (key, defaultValue) {
      var self = this;
      return Deferred(function (def) {
        // Strictly this isn't necessary, but eventually I want to move to something more
        // async for the storage, and this simulates that much better.
        setTimeout(util.resolver(def, function () {
          key = self.prefix + key;
          var value = self.storage.getItem(key);
          if (! value) {
            value = defaultValue;
          } else {
            value = JSON.parse(value);
          }
          return value;
        }));
      });
    },

    set: function (key, value) {
      var self = this;
      return Deferred(function (def) {
        setTimeout(util.resolver(def, function () {
          key = self.prefix + key;
          if (value === undefined) {
            self.storage.removeItem(key);
          } else {
            self.storage.setItem(key, JSON.stringify(value));
          }
        }));
      });
    },

    clear: function () {
      var self = this;
      var promises = [];
      return this.keys().then(function (keys) {
        keys.forEach(function (key) {
          // FIXME: technically we're ignoring the promise returned by all
          // these sets:
          promises.push(self.set(key, undefined));
        });
        return util.resolveMany(promises);
      });
    },

    keys: function (prefix, excludePrefix) {
      // Returns a list of keys, potentially with the given prefix
      var self = this;
      return Deferred(function (def) {
        setTimeout(util.resolver(def, function () {
          prefix = prefix || "";
          var result = [];
          for (var i=0; i<self.storage.length; i++) {
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
    }

  });

  var storage = Storage(localStorage, "towtruck.");

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

  storage.tab = Storage(sessionStorage, "towtruck-session.");

  return storage;
});
