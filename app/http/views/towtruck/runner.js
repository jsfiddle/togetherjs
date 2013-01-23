define(["jquery", "util", "channels"], function ($, util, channels) {
  var runner = util.Module("runner");
  /* This is used for dynamic components that want to get access to a stream, such
     as individual textareas */
  runner.router = channels.Router();
  var assert = util.assert;

  /* This initializes TowTruck generally, setting up the ID if necessary,
     and opening the channel */
  runner.init = function () {
    assert(! runner.init.started, "Called init twice");
    if (! runner.shareId) {
      runner.shareId = util.generateId();
      util.emit("shareId");
      // FIXME: this could wipe the app's hash state
      var hash = location.hash;
      hash = hash.replace(/&?towtruck-(head-)?[a-zA-Z0-9]+/, "");
      location.hash = "&towtruck-head-" + runner.shareId;
    }
    if (! runner.channel) {
      console.log("connecting to", runner.hubUrl(), 'client:', runner.isClient);
      runner.channel = channels.WebSocketChannel(runner.hubUrl());
      runner.channel.onmessage = runner.messageHandler.onmessage.bind(runner.messageHandler);
      runner.router.bindChannel(runner.channel);
      send({
        type: "hello",
        nickname: runner.settings("nickname"),
        avatar: runner.settings("avatar"),
        rtcSupported: runner.RTCSupported
      });
    }
    runner.init.started = true;
  };

  /* Sends a message to all peers.  Sets the clientId so everyone knows where the
     message comes from */
  var send = runner.send = function (msg) {
    console.log("Sending message:", msg);
    msg.clientId = runner.clientId;
    runner.channel.send(msg);
  };

  /* This of all peers.  The "system" peer is for internal messages. */
  runner.peers = util.mixinEvents({
    _peers: {},
    get: function (id) {
      return util.extend(this._peers[id]);
    },
    add: function (peer) {
      var event = "add";
      if (peer.clientId in this._peers) {
        event = "update";
      }
      var old = this._peers[peer.clientId];
      this._peers[peer.clientId] = peer;
      this.emit(event, peer, old);
    },
    forEach: function (callback, context) {
      for (var id in this._peers) {
        if (! this._peers.hasOwnProperty(id)) {
          continue;
        }
        callback.call(context || null, this._peers[id]);
      }
    }
  });

  runner.peers.add({
    clientId: "system",
    nickname: "system"
  });

  /* Handles all incoming messages.  Consumers who want to listen for certain
     kinds of messages should do:

       runner.messagesHandler.on("message-type", handler);
  */
  runner.messageHandler = util.mixinEvents({
    onmessage: function (msg) {
      console.log("Incoming message:", msg);
      this.emit(msg.type, msg);
    }
  });

  /* Always say hello back, and keep track of peers: */
  runner.messageHandler.on("hello hello-back", function (msg) {
    if (msg.type == "hello") {
      send({
        type: "hello-back",
        nickname: runner.settings("nickname"),
        avatar: runner.settings("avatar"),
        rtcSupported: runner.RTCSupported
      });
    }
    var peer = {
      clientId: msg.clientId,
      nickname: msg.nickname,
      rtcSupported: msg.rtcSupported
    };
    runner.peers.add(peer);
  });

  /* Updates to the nickname of peers: */
  runner.messageHandler.on("nickname-update", function (msg) {
    var peer = runner.peers.get(msg.clientId);
    if (msg.nickname) {
      peer.nickname = msg.nickname;
    }
    if (msg.avatar) {
      peer.avatar = msg.avatar;
    }
    runner.peers.add(peer);
  });

  /* Starts TowTruck, when initiated by the user, showing the share link etc. */
  runner.start = function () {
    require(["ui"], function (ui) {
      ui.activateUI();
    });
  };

  util.on("close", function () {
    var hash = location.hash.replace(/^#*/, "");
    if (hash) {
      if (hash.search(/^towtruck-/) === 0) {
        location.hash = "";
      }
    }
  });

  runner.stop = function () {
    send({type: "bye"});
    // FIXME: should emit this on something else:
    util.emit("close");
    runner.channel.close();
    runner.channel = null;
    var hash = location.hash;
    hash = hash.replace(/&?towtruck-(head-)?[a-zA-Z0-9]+/, "");
    if (hash != location.hash) {
      location.hash = hash;
    }
    runner.shareId = null;
    util.emit("shareId");
    runner.init.started = false;
  };

  runner.hubUrl = function () {
    if (! runner.shareId) {
      throw "URL cannot be resolved before TowTruck.shareId has been initialized";
    }
    return startTowTruck.hubBase + "/hub/" + runner.shareId;
  };

  runner.shareUrl = function () {
    var hash = location.hash;
    var m = /\?[^#]*/.exec(location.href);
    var query = "";
    if (m) {
      query = m[0];
    }
    hash = hash.replace(/&?towtruck-(head-)?[a-zA-Z0-9]+/, "");
    hash = hash || "#";
    return location.protocol + "//" + location.host + location.pathname + query +
           hash + "&towtruck-" + runner.shareId;
  };

  runner.settings = util.mixinEvents(function (name, value) {
    var curSettings = localStorage.getItem(runner.settings.localStorageName);
    if (curSettings) {
      curSettings = JSON.parse(curSettings);
    } else {
      curSettings = {};
    }
    for (var a in runner.settings.defaults) {
      if (! curSettings.hasOwnProperty(a)) {
        curSettings[a] = runner.settings.defaults[a];
      }
    }
    if (name === undefined) {
      return curSettings;
    }
    if (! curSettings.hasOwnProperty(name)) {
      throw "Unknown setting: " + name;
    }
    if (arguments.length < 2) {
      return curSettings[name];
    } else {
      curSettings[name] = value;
      localStorage.setItem(runner.settings.localStorageName, JSON.stringify(curSettings));
      runner.settings.emit("change", name, value);
      return value;
    }
  });
  // FIXME: watch for "storage" event to track changes in another tab
  // cache?

  runner.settings.defaults = {
    tabIndependent: false,
    nickname: "",
    avatar: null
  };

  runner.settings.localStorageName = "TowTruck.settings";

  if (runner.settings("tabIndependent")) {
    // FIXME: find some way when tab independent to use a local set of settings
    // (gets tricky because the tabIndependent name shouldn't be local)
    runner.clientId = window.name;
    if (! runner.clientId) {
      runner.clientId = window.name = runner.generateId();
    }
  } else {
    runner.clientId = localStorage.getItem("TowTruck.clientId");
    if (! runner.clientId) {
      runner.clientId = runner.generateId();
      localStorage.setItem("TowTruck.clientId", runner.clientId);
    }
  }

  runner.peers.add({
    clientId: runner.clientId,
    nickname: "me"
  });

  // FIXME: this is a fake version of a template, since we don't care about
  // _.template anymore:
  function makeTemplate(name, source) {
    var tmpl;
    return function () {
      return source;
    };
  }

  function boot() {
    var start = window._startTowTruckImmediately;
    /* Bootstrapping code, for use with startTowTruck: */
    if (start) {
      console.log("starting with", start);
      var activateOnStart = "towtruck-chat";
      if (typeof start == "string" && start.indexOf("head-") === 0) {
        runner.shareId = start.substr(5);
        util.emit("shareId");
        runner.isClient = false;
      } else if (typeof start == "string") {
        runner.shareId = start;
        util.emit("shareId");
        runner.isClient = true;
      } else {
        runner.isClient = false;
        activateOnStart = "towtruck-info";
      }
      util.on("ui-ready", function () {
        require(["ui"], function (ui) {
          ui.activateTab(activateOnStart);
        });
      });
      runner.init();
      runner.start();
      delete window._startTowTruckImmediately;
    }
  }

  runner.templates = {
    chat: makeTemplate("chat", "<%- read('chat.tmpl')%>"),
    help: makeTemplate("help", "<%- read('help.tmpl')%>"),
    walkabout: makeTemplate("walkabout", "<%- read('walkabout.tmpl')%>")
  };

  if (window._TowTruckOnLoad) {
    window._TowTruckOnLoad(boot);
  } else {
    boot();
  }

  // These inject extra features just during loading:
  require(["ui", "chat", "pointer", "tracker", "webrtc"]);

  return runner;

});
