/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["require", "util", "channels", "jquery"], function (require, util, channels, $) {

  var DEBUG = true;

  var DEFAULT_NICKNAMES = [
    "Friendly Fox",
    "Brilliant Beaver",
	"Observant Owl",
	"Gregarious Giraffe",
	"Wild Wolf",
	"Silent Seal",
	"Wacky Whale",
	"Curious Cat",
	"Intelligent Iguana"
  ];

  var session = util.mixinEvents(util.Module("session"));
  var assert = util.assert;

  // This is the hub we connect to:
  session.shareId = null;
  // This is the ID that identifies this client:
  session.clientId = null;
  session.router = channels.Router();

  // This is the key we use for localStorage:
  var localStoragePrefix = "towtruck.";
  // This is the channel to the hub:
  var channel = null;
  // For testing:
  session._getChannel = function () {
    return channel;
  };

  // Setting, essentially global:
  session.AVATAR_SIZE = 90;

  /****************************************
   * URLs
   */

  session.hubUrl = function () {
    assert(session.shareId, "URL cannot be resolved before TowTruck.shareId has been initialized");
    return TowTruck.getConfig("hubBase") + "/hub/" + session.shareId;
  };

  session.shareUrl = function () {
    assert(session.shareId, "Attempted to access shareUrl() before shareId is set");
    var hash = location.hash;
    var m = /\?[^#]*/.exec(location.href);
    var query = "";
    if (m) {
      query = m[0];
    }
    // FIXME: The "head-" part here is obsolete:
    hash = hash.replace(/&?towtruck-(head-)?[a-zA-Z0-9]+/, "");
    hash = hash || "#";
    return location.protocol + "//" + location.host + location.pathname + query +
           hash + "&towtruck=" + session.shareId;
  };

  session.recordUrl = function () {
    assert(session.shareId);
    var url = TowTruck.baseUrl.replace(/\/*$/, "") + "/recorder.html";
    url += "#&towtruck=" + session.shareId + "&hubBase=" + TowTruck.getConfig("hubBase");
    return url;
  };

  /* location.href without the hash */
  session.currentUrl = function () {
    return location.href.replace(/#.*/, "");
  };

  /****************************************
   * Storage
   */

  session.getStorage = function (key, defaultValue) {
    key = localStoragePrefix + key;
    var value = localStorage.getItem(key);
    if (! value) {
      return defaultValue;
    }
    value = JSON.parse(value);
    return value;
  };

  session.setStorage = function (key, value) {
    key = localStoragePrefix + key;
    if (value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };

  session.settings = util.mixinEvents({
    defaults: {
      nickname: "",
      defaultNickname: "",
      avatar: null,
      stickyShare: null,
      color: null,
      seenIntroDialog: false
    },

    get: function (name) {
      assert(this.defaults.hasOwnProperty(name), "Unknown setting:", name);
      var s = session.getStorage("settings");
      if ((! s) || s[name] === undefined) {
        return this.defaults[name];
      }
      return s[name];
    },

    set: function (name, value) {
      assert(this.defaults.hasOwnProperty(name), "Unknown setting:", name);
      var s = session.getStorage("settings") || {};
      var oldValue = s[name];
      s[name] = value;
      session.setStorage("settings", s);
      this.emit("change", name, oldValue, value);
    }
  });

  if (! session.settings.get("color")) {
    // FIXME: this isn't a great way to create a random color; it
    // might be better to pick a random hue, and make sure it is
    // saturated.
    session.settings.set("color", "#" + Math.floor(Math.random() * 0xffffff).toString(16));
  }

  if (! session.settings.get("defaultNickname")) {
    session.settings.set("defaultNickname", DEFAULT_NICKNAMES[Math.floor(Math.random() * DEFAULT_NICKNAMES.length)]);
  }

  if (! session.settings.get("avatar")) {
    require(["alien-avatar-generator"], function (Alien) {
      var c = new Alien({width: session.AVATAR_SIZE, height: session.AVATAR_SIZE});
      c.ctx.arc(session.AVATAR_SIZE/2, session.AVATAR_SIZE/2, session.AVATAR_SIZE/2, 0, Math.PI*2);
      c.ctx.closePath();
      c.ctx.clip();
      c.newAvatar();
      session.settings.set("avatar", c.toImgSrc());
    });
  }

  /****************************************
   * Peer tracking (names/avatars/etc)
   */

  // FIXME: should also remove peers on bye
  session.peers = util.mixinEvents({
    _peers: {},
    _statuses: {},
    get: function (id) {
      return util.extend(this._peers[id]);
    },
    getStatus: function (id) {
      // Unlike .get() we don't want or need to make a copy
      var status = this._statuses[id];
      if (! status) {
        status = this._statuses[id] = {};
        if (this._peers[id]) {
          this._peers[id].status = status;
        }
      }
      return status;
    },
    add: function (peer) {
      assert(peer && peer.clientId);
      var event = "add";
      if (peer.clientId in this._peers) {
        event = "update";
      }
      var old = this._peers[peer.clientId];
      peer.status = this.getStatus(peer.clientId);
      this._peers[peer.clientId] = peer;
      this.emit(event, peer, old);
    },
    forEach: function (callback, context) {
      for (var id in this._peers) {
        if (! this._peers.hasOwnProperty(id)) {
          continue;
        }
        callback.call(context || null, this.get(id));
      }
    }
  });


  /****************************************
   * Message handling/dispatching
   */

  session.hub = util.mixinEvents({});

  function openChannel() {
    assert(! channel);
    console.info("Connecting to", session.hubUrl(), location.href);
    var c = channels.WebSocketChannel(session.hubUrl());
    c.onmessage = function (msg) {
      if (DEBUG && msg.type != "cursor-update" && msg.type != "keydown") {
        console.info("In:", msg);
      }
      var status = session.peers.getStatus(msg.clientId);
      var peerMessage;
      if (msg.type == "hello" || msg.type == "hello-back") {
        // FIXME: I might want to emit a message here about the URL change
        var oldUrl = status.url;
        var oldTitle = status.title;
        status.url = msg.url;
        status.title = msg.title;
        if (status.url != oldUrl || status.title != oldTitle) {
          peerMessage = {
            clientId: msg.clientId,
            url: status.url,
            title: status.title,
            myUrl: currentUrl,
            oldUrl: oldUrl,
            oldTitle: oldTitle
          };
        }
      } else {
        msg.url = status.url;
      }
      msg.sameUrl = msg.url == currentUrl;
      status.lastMessage = Date.now();
      session.hub.emit(msg.type, msg);
      if (peerMessage) {
        session.peers.emit("peer-url-change", peerMessage);
      }
    };
    channel = c;
    session.router.bindChannel(channel);
  }

  // FIXME: once we start looking at window.history we need to update this:
  var currentUrl = (location.href + "").replace(/\#.*$/, "");

  session.send = function (msg) {
    if (DEBUG && msg.type != "cursor-update" && msg.type != "keydown") {
      console.info("Send:", msg);
    }
    msg.clientId = session.clientId;
    channel.send(msg);
  };

  /****************************************
   * Standard message responses
   */

  /* Always say hello back, and keep track of peers: */
  session.hub.on("hello hello-back", function (msg) {
    if (msg.type == "hello") {
      sendHello(true);
    }
    var peer = {
      clientId: msg.clientId,
      nickname: msg.nickname,
      avatar: msg.avatar,
      color: msg.color,
      rtcSupported: msg.rtcSupported
    };
    session.peers.add(peer);
  });

  function sendHello(helloBack) {
    var msg = {
      nickname: session.settings.get("nickname") || session.settings.get("defaultNickname"),
      avatar: session.settings.get("avatar"),
      color: session.settings.get("color"),
      url: session.currentUrl(),
      urlHash: location.hash,
      // FIXME: titles update, we should track those changes:
      title: document.title,
      rtcSupported: session.RTCSupported
    };
    if (helloBack) {
      msg.type = "hello-back";
    } else {
      msg.type = "hello";
      msg.clientVersion = TowTruck.version;
    }
    session.send(msg);
  }

  /* Updates to the nickname of peers: */
  session.hub.on("nickname-update", function (msg) {
    var peer = session.peers.get(msg.clientId);
    if (msg.nickname) {
      peer.nickname = msg.nickname;
    }
    if (msg.avatar) {
      peer.avatar = msg.avatar;
    }
    if (msg.color) {
      peer.color = msg.color;
    }
    session.peers.add(peer);
  });

  /****************************************
   * Lifecycle (start and end)
   */

  // These are Javascript files that implement features, and so must
  // be injected at runtime because they aren't pulled in naturally
  // via define().
  // ui must be the first item:
  var features = ["ui", "chat", "tracker", "webrtc", "cursor", "cobrowse"];

  // FIXME: should this be run at load time, instead of in start()?
  function initClientId() {
    if (session.clientId) {
      return;
    }
    var clientId = session.getStorage("clientId");
    if (! clientId) {
      clientId = util.generateId();
      session.setStorage("clientId", clientId);
    }
    session.clientId = clientId;
  }

  var autoOpenShare = false;

  function initShareId() {
    var hash = location.hash;
    var shareId = session.shareId;
    var isClient = true;
    var name = window.name;
    var set = true;
    if (! name) {
      name = window.name = "towtruck-" + util.generateId();
    }
    if (! shareId) {
      if (TowTruck._shareId) {
        shareId = TowTruck._shareId;
      }
    }
    if (! shareId) {
      var m = /&?towtruck(-head)?=([^&]*)/.exec(hash);
      if (m) {
        isClient = ! m[1];
        shareId = m[2];
        var newHash = hash.substr(0, m.index) + hash.substr(m.index + m[0].length);
        location.hash = newHash;
      }
      // FIXME: we should probably test at this time if the stored window.name-based
      // key already exists, because if it does we might have a second tab with the
      // same name running, and then there will be a conflict
    }
    if (! shareId) {
      var saved = session.getStorage("status." + name);
      assert(
        saved || TowTruck.startTowTruckImmediately,
        "No clientId could be found via location.hash or in localStorage; it is unclear why TowTruck was ever started");
      if ((! saved) && TowTruck.startTowTruckImmediately) {
        autoOpenShare = true;
        isClient = false;
        shareId = session.settings.get("stickyShare");
        if (! shareId) {
          shareId = util.generateId();
        }
      } else {
        isClient = saved.isClient;
        shareId = saved.shareId;
        // The only case when we don't need to set the storage status again is when
        // we're already set to be running
        set = ! saved.running;
      }
    }
    if (set) {
      session.setStorage("status." + name, {isClient: isClient, shareId: shareId, running: true});
    }
    session.isClient = isClient;
    session.shareId = shareId;
    session.emit("shareId");
  }

  session.start = function () {
    initClientId();
    initShareId();
    openChannel();
    require(["ui"], function (ui) {
      ui.prepareUI();
      require(features, function () {
      // FIXME: should be the overview screen sometimes:
        $(function () {
          var ui = require("ui");
          ui.activateUI();
          sendHello(false);
          if (autoOpenShare) {
            ui.displayWindow("#towtruck-about");
          }
        });
      });
    });
  };

  session.close = function () {
    session.send({type: "bye"});
    session.emit("close");
    var name = window.name;
    var saved = session.getStorage("status." + name);
    if (! saved) {
      console.warn("No session information saved in", "status." + name);
    } else {
      saved.running = false;
      saved.date = Date.now();
      // FIXME: these should be cleaned up sometime:
      session.setStorage("status." + name);
    }
    channel.close();
    channel = null;
    session.shareId = null;
    session.emit("shareId");
  };

  if (TowTruck.startTowTruckImmediately) {
    setTimeout(session.start);
  }

  return session;
});
