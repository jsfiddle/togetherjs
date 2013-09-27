/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
define(["util", "session"], function (util, session) {
  var appsync = util.Module("appsync");
  var assert = util.assert;

  var activeSyncers = [];

  appsync.Syncer = util.Class({
    constructor: function (name, methods) {
      this.name = name;
      this.methods = methods;
      this.initMessage = this.initMessage.bind(this);
      this.updateMessage = this.updateMessage.bind(this);
      this.helloMessage = this.helloMessage.bind(this);
    },
    register: function () {
      TogetherJS.hub.on(this.name + "-init", this.initMessage);
      TogetherJS.hub.on(this.name + "-update", this.updateMessage);
      TogetherJS.hub.on("towtruck.hello", this.helloMessage);
      this.methods.init.call(this);
      activeSyncers.push(this);
    },
    unregister: function () {
      this.methods.uninit.call(this);
      var pos = activeSyncers.indexOf(this);
      assert(pos != -1);
      activeSyncers.splice(pos, 1);
    },

    helloMessage: function (msg) {
      if (! msg.sameUrl) {
        return;
      }
      var idUpdates = {};
      var anonUpdates = [];
      var promises = [];
      util.forEachAttr(this.methods.getters || {}, function (getter, type) {
        var updates = getter();
        updates = util.makePromise(updates);
        var typeUpdate = updates.then(function (value) {
          if (! Array.isArray(value)) {
            value = [value];
          }
          value.forEach(function (v) {
            if (! v.type) {
              v.type = type;
            }
          });
          return value;
        });
        promises.push(typeUpdate);
      });
      util.resolveMany(promises, function (results) {
        var values = [];
        results.forEach(function (result) {
          result.forEach(function (o) {
            // FIXME: check for required properties
            values.push(o);
          });
          TogetherJS.send({
            type: this.name + "-init",
            updates: values
          });
        });
      });
    },

    initMessage: function (msg, noClear) {
      if (! msg.sameUrl) {
        return;
      }
      var initTypes = {};
      for (var i=0; i<msg.updates.length; i++) {
        var item = msg.updates[i];
        if (item.type && ! this.methods['update_' + item.type]) {
          console.warn("Received an update with a type", item.type, "and no update_" + item.type + " method");
        } else if (item.type) {
          if ((! noClear) && ! initTypes.hasOwnProperty(item.type)) {
            this.methods['clear_' + item.type].call(this);
            initTypes[item.type] = null;
          }
          var method = this.methods['update_' + item.type];
          method.call(this, item);
        } else {
          this.methods.incoming.call(this, item);
        }
      }
    },

    updateMessage: function (msg) {
      this.initMessage(msg);
    },

    update: function (item) {
      if (! Array.isArray(item)) {
        item = [item];
      }
      TogetherJS.send({
        type: this.name + "-update",
        updates: item
      });
    }
  });

  session.on("close", function () {
    activeSyncers.slice().forEach(function (syncer) {
      syncer.unregister();
    });
  });

  session.on("ui-ready", function () {
    util.forEachAttr(TogetherJS.getConfig("appsyncers"), function (methods, name) {
      var s = appsync.Syncer(name, methods);
      s.register();
    });
  });

  return appsync;
});
