/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["util", "session", "storage", "require", "templates"], function (util, session, storage, require, templates) {
  var peers = util.Module("peers");
  var assert = util.assert;
  var CHECK_ACTIVITY_INTERVAL = 10*1000; // Every 10 seconds see if someone has gone idle
  var IDLE_TIME = 3*60*1000; // Idle time is 3 minutes
  var TAB_IDLE_TIME = 2*60*1000; // When you tab away, after two minutes you'll say you are idle
  var BYE_TIME = 10*60*1000; // After 10 minutes of inactivity the person is considered to be "gone"

  var ui;
  require(["ui"], function (uiModule) {
    ui = uiModule;
  });

  var DEFAULT_NICKNAMES = templates("names").split(/,\s*/g);
  var Peer = util.Class({

    isSelf: false,

    constructor: function (id, attrs) {
      attrs = attrs || {};
      assert(id);
      assert(! Peer.peers[id]);
      this.id = id;
      this.identityId = attrs.identityId || null;
      this.status = attrs.status || "live";
      this.idle = attrs.status || "active";
      this.name = attrs.name || null;
      this.avatar = attrs.avatar || null;
      this.color = attrs.color || "#00FF00";
      this.view = ui.PeerView(this);
      this.lastMessageDate = 0;
      this.following = attrs.following || false;
      Peer.peers[id] = this;
      var joined = attrs.joined || false;
      if (attrs.fromHelloMessage) {
        this.updateFromHello(attrs.fromHelloMessage);
        if (attrs.fromHelloMessage.type == "hello") {
          joined = true;
        }
      }
      peers.emit("new-peer", this);
      if (joined) {
        this.view.notifyJoined();
      }
      this.view.update();
    },

    repr: function () {
      return "Peer(" + JSON.stringify(this.id) + ")";
    },

    serialize: function () {
      return {
        id: this.id,
        status: this.status,
        idle: this.idle,
        url: this.url,
        hash: this.hash,
        title: this.title,
        identityId: this.identityId,
        rtcSupported: this.rtcSupported,
        name: this.name,
        avatar: this.avatar,
        color: this.color,
        following: this.following
      };
    },

    destroy: function () {
      this.view.destroy();
      delete Peer.peers[this.id];
    },

    updateMessageDate: function (msg) {
      if (this.idle == "inactive") {
        this.update({idle: "active"});
      }
      if (this.status == "bye") {
        this.unbye();
      }
      this.lastMessageDate = Date.now();
    },

    updateFromHello: function (msg) {
      var urlUpdated = false;
      var activeRTC = false;
      var identityUpdated = false;
      if (msg.url && msg.url != this.url) {
        this.url = msg.url;
        this.hash = null;
        this.title = null;
        urlUpdated = true;
      }
      if (msg.hash != this.hash) {
        this.hash = msg.urlHash;
        urlUpdated = true;
      }
      if (msg.title != this.title) {
        this.title = msg.title;
        urlUpdated = true;
      }
      if (msg.rtcSupported !== undefined) {
        this.rtcSupported = msg.rtcSupported;
      }
      if (msg.identityId !== undefined) {
        this.identityId = msg.identityId;
      }
      if (msg.name && msg.name != this.name) {
        this.name = msg.name;
        identityUpdated = true;
      }
      if (msg.avatar && msg.avatar != this.avatar) {
        util.assertValidUrl(msg.avatar);
        this.avatar = msg.avatar;
        identityUpdated = true;
      }
      if (msg.color && msg.color != this.color) {
        this.color = msg.color;
        identityUpdated = true;
      }
      if (msg.isClient !== undefined) {
        this.isCreator = ! msg.isClient;
      }
      if (this.status != "live") {
        this.status = "live";
        peers.emit("status-updated", this);
      }
      if (this.idle != "active") {
        this.idle = "active";
        peers.emit("idle-updated", this);
      }
      if (msg.rtcSupported) {
        peers.emit("rtc-supported", this);
      }
      if (urlUpdated) {
        peers.emit("url-updated", this);
      }
      if (identityUpdated) {
        peers.emit("identity-updated", this);
      }
      // FIXME: I can't decide if this is the only time we need to emit
      // this message (and not .update() or other methods)
      if (this.following) {
        session.emit("follow-peer", this);
      }
    },

    update: function (attrs) {
      // FIXME: should probably test that only a couple attributes are settable
      // particularly status and idle
      if (attrs.idle) {
        this.idle = attrs.idle;
      }
      if (attrs.status) {
        this.status = attrs.status;
      }
      this.view.update();
    },

    className: function (prefix) {
      prefix = prefix || "";
      return prefix + util.safeClassName(this.id);
    },

    bye: function () {
      if (this.status != "bye") {
        this.status = "bye";
        peers.emit("status-updated", this);
      }
      this.view.update();
    },

    unbye: function () {
      if (this.status == "bye") {
        this.status = "live";
        peers.emit("status-updated", this);
      }
      this.view.update();
    },

    nudge: function () {
      session.send({
        type: "url-change-nudge",
        url: location.href,
        to: this.id
      });
    },

    follow: function () {
      if (this.following) {
        return;
      }
      peers.getAllPeers().forEach(function (p) {
        if (p.following) {
          p.unfollow();
        }
      });
      this.following = true;
      // We have to make sure we remember this, even if we change URLs:
      storeSerialization();
      this.view.update();
      session.emit("follow-peer", this);
    },

    unfollow: function () {
      this.following = false;
      storeSerialization();
      this.view.update();
    }

  });

  // FIXME: I can't decide where this should actually go, seems weird
  // that it is emitted and handled in the same module
  session.on("follow-peer", function (peer) {
    if (peer.url != session.currentUrl()) {
      var url = peer.url;
      if (peer.urlHash) {
        url += peer.urlHash;
      }
      location.href = url;
    }
  });

  Peer.peers = {};

  Peer.deserialize = function (obj) {
    obj.fromStorage = true;
    var peer = Peer(obj.id, obj);
  };

  peers.Self = undefined;

  session.on("start", function () {
    if (peers.Self) {
      return;
    }
    /* Same interface as Peer, represents oneself (local user): */
    peers.Self = util.mixinEvents({
      isSelf: true,
      id: session.clientId,
      identityId: session.identityId,
      status: "live",
      idle: "active",
      name: null,
      avatar: null,
      color: null,
      defaultName: null,
      loaded: false,
      isCreator: ! session.isClient,

      update: function (attrs) {
        var updatePeers = false;
        var updateIdle = false;
        var updateMsg = {type: "peer-update"};
        if (typeof attrs.name == "string" && attrs.name != this.name) {
          this.name = attrs.name;
          updateMsg.name = this.name;
          if (! attrs.fromLoad) {
            storage.settings.set("name", this.name);
            updatePeers = true;
          }
        }
        if (attrs.avatar && attrs.avatar != this.avatar) {
          util.assertValidUrl(attrs.avatar);
          this.avatar = attrs.avatar;
          updateMsg.avatar = this.avatar;
          if (! attrs.fromLoad) {
            storage.settings.set("avatar", this.avatar);
            updatePeers = true;
          }
        }
        if (attrs.color && attrs.color != this.color) {
          this.color = attrs.color;
          updateMsg.color = this.color;
          if (! attrs.fromLoad) {
            storage.settings.set("color", this.color);
            updatePeers = true;
          }
        }
        if (attrs.defaultName && attrs.defaultName != this.defaultName) {
          this.defaultName = attrs.defaultName;
          if (! attrs.fromLoad) {
            storage.settings.set("defaultName", this.defaultName);
            updatePeers = true;
          }
        }
        if (attrs.status && attrs.status != this.status) {
          this.status = attrs.status;
          peers.emit("status-updated", this);
        }
        if (attrs.idle && attrs.idle != this.idle) {
          this.idle = attrs.idle;
          updateIdle = true;
          peers.emit("idle-updated", this);
        }
        this.view.update();
        if (updatePeers && ! attrs.fromLoad) {
          session.emit("self-updated");
          session.send(updateMsg);
        }
        if (updateIdle && ! attrs.fromLoad) {
          session.send({
            type: "idle-status",
            idle: this.idle
          });
        }
      },

      className: function (prefix) {
        prefix = prefix || "";
        return prefix + "self";
      },

      _loadFromSettings: function () {
        return util.resolveMany(
          storage.settings.get("name"),
          storage.settings.get("avatar"),
          storage.settings.get("defaultName"),
          storage.settings.get("color")).then((function (name, avatar, defaultName, color) {
            if (! defaultName) {
              defaultName = util.pickRandom(DEFAULT_NICKNAMES);

              storage.settings.set("defaultName", defaultName);
            }
            if (! color) {
              color = Math.floor(Math.random() * 0xffffff).toString(16);
              while (color.length < 6) {
                color = "0" + color;
              }
              color = "#" + color;
              storage.settings.set("color", color);
            }
            if (! avatar) {
              avatar = TogetherJS.baseUrl + "/togetherjs/images/default-avatar.png";
            }
            this.update({
              name: name,
              avatar: avatar,
              defaultName: defaultName,
              color: color,
              fromLoad: true
            });
            peers._SelfLoaded.resolve();
          }).bind(this)); // FIXME: ignoring error
      },

      _loadFromApp: function () {
        // FIXME: I wonder if these should be optionally functions?
        // We could test typeof==function to distinguish between a getter and a concrete value
        var getUserName = TogetherJS.config.get("getUserName");
        var getUserColor = TogetherJS.config.get("getUserColor");
        var getUserAvatar = TogetherJS.config.get("getUserAvatar");
        var name, color, avatar;
        if (getUserName) {
          if (typeof getUserName == "string") {
            name = getUserName;
          } else {
            name = getUserName();
          }
          if (name && typeof name != "string") {
            // FIXME: test for HTML safe?  Not that we require it, but
            // <>'s are probably a sign something is wrong.
            console.warn("Error in getUserName(): should return a string (got", name, ")");
            name = null;
          }
        }
        if (getUserColor) {
          if (typeof getUserColor == "string") {
            color = getUserColor;
          } else {
            color = getUserColor();
          }
          if (color && typeof color != "string") {
            // FIXME: would be nice to test for color-ness here.
            console.warn("Error in getUserColor(): should return a string (got", color, ")");
            color = null;
          }
        }
        if (getUserAvatar) {
          if (typeof getUserAvatar == "string") {
            avatar = getUserAvatar;
          } else {
            avatar = getUserAvatar();
          }
          if (avatar && typeof avatar != "string") {
            console.warn("Error in getUserAvatar(): should return a string (got", avatar, ")");
            avatar = null;
          }
        }
        if (name || color || avatar) {
          this.update({
            name: name,
            color: color,
            avatar: avatar
          });
        }
      }
    });

    peers.Self.view = ui.PeerView(peers.Self);
    storage.tab.get("peerCache").then(deserialize);
    peers.Self._loadFromSettings().then(function() {
      peers.Self._loadFromApp();
      peers.Self.view.update();
      session.emit("self-updated");
    });
  });

  session.on("refresh-user-data", function () {
    if (peers.Self) {
      peers.Self._loadFromApp();
    }
  });

  TogetherJS.config.track(
    "getUserName",
    TogetherJS.config.track(
      "getUserColor",
      TogetherJS.config.track(
        "getUserAvatar",
        function () {
          if (peers.Self) {
            peers.Self._loadFromApp();
          }
        }
      )
    )
  );

  peers._SelfLoaded = util.Deferred();

  function serialize() {
    var peers = [];
    util.forEachAttr(Peer.peers, function (peer) {
      peers.push(peer.serialize());
    });
    return {
      peers: peers
    };
  }

  function deserialize(obj) {
    if (! obj) {
      return;
    }
    obj.peers.forEach(function (peer) {
      Peer.deserialize(peer);
    });
  }

  peers.getPeer = function getPeer(id, message) {
    assert(id);
    var peer = Peer.peers[id];
    if (id === session.clientId) {
      return peers.Self;
    }
    if (message && ! peer) {
      peer = Peer(id, {fromHelloMessage: message});
      return peer;
    }
    assert(peer, "No peer with id:", id);
    if (message &&
        (message.type == "hello" || message.type == "hello-back" ||
         message.type == "peer-update")) {
      peer.updateFromHello(message);
      peer.view.update();
    }
    return Peer.peers[id];
  };

  peers.getAllPeers = function (liveOnly) {
    var result = [];
    util.forEachAttr(Peer.peers, function (peer) {
      if (liveOnly && peer.status != "live") {
        return;
      }
      result.push(peer);
    });
    return result;
  };

  function checkActivity() {
    var ps = peers.getAllPeers();
    var now = Date.now();
    ps.forEach(function (p) {
      if (p.idle == "active" && now - p.lastMessageDate > IDLE_TIME) {
        p.update({idle: "inactive"});
      }
      if (p.status != "bye" && now - p.lastMessageDate > BYE_TIME) {
        p.bye();
      }
    });
  }

  session.hub.on("bye", function (msg) {
    var peer = peers.getPeer(msg.clientId);
    peer.bye();
  });

  var checkActivityTask = null;

  session.on("start", function () {
    if (checkActivityTask) {
      console.warn("Old peers checkActivityTask left over?");
      clearTimeout(checkActivityTask);
    }
    checkActivityTask = setInterval(checkActivity, CHECK_ACTIVITY_INTERVAL);
  });

  session.on("close", function () {
    util.forEachAttr(Peer.peers, function (peer) {
      peer.destroy();
    });
    storage.tab.set("peerCache", undefined);
    clearTimeout(checkActivityTask);
    checkActivityTask = null;
  });

  var tabIdleTimeout = null;

  session.on("visibility-change", function (hidden) {
    if (hidden) {
      if (tabIdleTimeout) {
        clearTimeout(tabIdleTimeout);
      }
      tabIdleTimeout = setTimeout(function () {
        peers.Self.update({idle: "inactive"});
      }, TAB_IDLE_TIME);
    } else {
      if (tabIdleTimeout) {
        clearTimeout(tabIdleTimeout);
      }
      if (peers.Self.idle == "inactive") {
        peers.Self.update({idle: "active"});
      }
    }
  });

  session.hub.on("idle-status", function (msg) {
    msg.peer.update({idle: msg.idle});
  });

  // Pings are a straight alive check, and contain no more information:
  session.hub.on("ping", function () {
    session.send({type: "ping-back"});
  });

  window.addEventListener("pagehide", function () {
    // FIXME: not certain if this should be tab local or not:
    storeSerialization();
  }, false);

  function storeSerialization() {
    storage.tab.set("peerCache", serialize());
  }

  util.mixinEvents(peers);

  util.testExpose({
    setIdleTime: function (time) {
      IDLE_TIME = time;
      CHECK_ACTIVITY_INTERVAL = time / 2;
      if (TogetherJS.running) {
        clearTimeout(checkActivityTask);
        checkActivityTask = setInterval(checkActivity, CHECK_ACTIVITY_INTERVAL);
      }
    }
  });

  util.testExpose({
    setByeTime: function (time) {
      BYE_TIME = time;
      CHECK_ACTIVITY_INTERVAL = Math.min(CHECK_ACTIVITY_INTERVAL, time / 2);
      if (TogetherJS.running) {
        clearTimeout(checkActivityTask);
        checkActivityTask = setInterval(checkActivity, CHECK_ACTIVITY_INTERVAL);
      }
    }
  });

  return peers;
});
