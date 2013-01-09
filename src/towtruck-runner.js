(function () {
  var TowTruck = window.TowTruck;
  var $ = TowTruck.$;
  var _ = TowTruck._;

  /* This is used for dynamic components that want to get access to a stream, such
     as individual textareas */
  TowTruck.router = TowTruck.Router();

  /* This initializes TowTruck generally, setting up the ID if necessary,
     and opening the channel */
  TowTruck.init = function () {
    if (! TowTruck.shareId) {
      TowTruck.shareId = TowTruck.generateId();
      TowTruck.emit("shareId");
      // FIXME: this could wipe the app's hash state
      var hash = location.hash;
      hash = hash.replace(/&?towtruck-(head-)?[a-zA-Z0-9]+/, "");
      location.hash = "&towtruck-head-" + TowTruck.shareId;
    }
    if (! TowTruck.channel) {
      console.log("connecting to", TowTruck.hubUrl());
      TowTruck.channel = new TowTruck.WebSocketChannel(TowTruck.hubUrl());
      TowTruck.channel.onmessage = TowTruck.messageHandler.onmessage.bind(TowTruck.messageHandler);
      TowTruck.router.bindChannel(TowTruck.channel);
      send({
        type: "hello",
        nickname: TowTruck.settings("nickname"),
        avatar: TowTruck.settings("avatar"),
        rtcSupported: TowTruck.RTCSupported
      });
    }
  };

  /* Sends a message to all peers.  Sets the clientId so everyone knows where the
     message comes from */
  var send = TowTruck.send = function (msg) {
    console.log("Sending message:", msg);
    msg.clientId = TowTruck.clientId;
    TowTruck.channel.send(msg);
  };

  /* This of all peers.  The "system" peer is for internal messages. */
  TowTruck.peers = TowTruck.mixinEvents({
    _peers: {},
    get: function (id) {
      return TowTruck.extend(this._peers[id]);
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

  TowTruck.peers.add({
    clientId: "system",
    nickname: "system"
  });

  /* Handles all incoming messages.  Consumers who want to listen for certain
     kinds of messages should do:

       TowTruck.messagesHandler.on("message-type", handler);

     The message "self-bye" is sent when closing down, as a kind of
     fake message.
  */
  TowTruck.messageHandler = TowTruck.mixinEvents({
    onmessage: function (msg) {
      console.log("Incoming message:", msg);
      this.emit(msg.type, msg);
    }
  });

  /* Always say hello back, and keep track of peers: */
  TowTruck.messageHandler.on("hello hello-back", function (msg) {
    if (msg.type == "hello") {
      send({
        type: "hello-back",
        nickname: TowTruck.settings("nickname"),
        avatar: TowTruck.setting("avatar"),
        rtcSupported: TowTruck.RTCSupported
      });
    }
    var peer = {
      clientId: msg.clientId,
      nickname: msg.nickname,
      rtcSupported: msg.rtcSupported
    };
    TowTruck.peers.add(peer);
  });

  /* Updates to the nickname of peers: */
  TowTruck.messageHandler.on("nickname-update", function (msg) {
    var peer = TowTruck.peers.get(msg.clientId);
    if (msg.nickname) {
      peer.nickname = msg.nickname;
    }
    if (msg.avatar) {
      peer.avatar = msg.avatar;
    }
    TowTruck.peers.add(peer);
  });

  /* Starts TowTruck, when initiated by the user, showing the share link etc. */
  TowTruck.start = function () {
    TowTruck.activateUI();
  };

  TowTruck.messageHandler.on("self-bye", function () {
    if (TowTruck.intro) {
      TowTruck.intro.remove();
      TowTruck.intro = null;
    }
    var hash = location.hash.replace(/^#*/, "");
    if (hash) {
      if (hash.search(/^towtruck-/) === 0) {
        location.hash = "";
      }
    }
  });

  TowTruck.stop = function () {
    send({type: "bye"});
    // FIXME: should emit this on something else:
    TowTruck.messageHandler.emit("self-bye");
    TowTruck.channel.close();
    TowTruck.channel = null;
    var hash = location.hash;
    hash = hash.replace(/&?towtruck-(head-)?[a-zA-Z0-9]+/, "");
    if (hash != location.hash) {
      location.hash = hash;
    }
    TowTruck.shareId = null;
    TowTruck.emit("shareId");
  };

  TowTruck.hubUrl = function () {
    if (! TowTruck.shareId) {
      throw "URL cannot be resolved before TowTruck.shareId has been initialized";
    }
    return startTowTruck.hubBase + "/hub/" + TowTruck.shareId;
  };

  TowTruck.shareUrl = function () {
    var hash = location.hash;
    hash = hash.replace(/&?towtruck-(head-)?[a-zA-Z0-9]+/, "");
    hash = hash || "#";
    return location.protocol + "//" + location.host + location.pathname +
           hash + "&towtruck-" + TowTruck.shareId;
  };

  TowTruck.settings = TowTruck.mixinEvents(function (name, value) {
    var curSettings = localStorage.getItem(TowTruck.settings.localStorageName);
    if (curSettings) {
      curSettings = JSON.parse(curSettings);
    } else {
      curSettings = {};
    }
    for (var a in TowTruck.settings.defaults) {
      if (! curSettings.hasOwnProperty(a)) {
        curSettings[a] = TowTruck.settings.defaults[a];
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
      localStorage.setItem(TowTruck.settings.localStorageName, JSON.stringify(curSettings));
      TowTruck.settings.emit("change", name, value);
      return value;
    }
  });
  // FIXME: watch for "storage" event to track changes in another tab
  // cache?

  TowTruck.settings.defaults = {
    tabIndependent: false,
    nickname: "",
    avatar: null
  };

  TowTruck.settings.localStorageName = "TowTruck.settings";

  if (TowTruck.settings("tabIndependent")) {
    // FIXME: find some way when tab independent to use a local set of settings
    // (gets tricky because the tabIndependent name shouldn't be local)
    TowTruck.clientId = window.name;
    if (! TowTruck.clientId) {
      TowTruck.clientId = window.name = TowTruck.generateId();
    }
  } else {
    TowTruck.clientId = localStorage.getItem("TowTruck.clientId");
    if (! TowTruck.clientId) {
      TowTruck.clientId = TowTruck.generateId();
      localStorage.setItem("TowTruck.clientId", TowTruck.clientId);
    }
  }
  TowTruck.peers.add({
    clientId: TowTruck.clientId,
    nickname: "me"
  });

  function makeTemplate(name, source) {
    var tmpl;
    try {
      tmpl = _.template(source);
    } catch (e) {
      console.warn("Error compiling", name, ":", e, "\n", source);
      tmpl = function (vars) {
        var s = $("<div>");
        s.append($("<span>Error:</span>"), $("<span>").text(e));
        s.append($("<pre>").text(source));
        return s[0].outerHTML;
      };
    }
    return tmpl;
  }

  function boot() {
    var start = window._startTowTruckImmediately;
    /* Bootstrapping code, for use with startTowTruck: */
    if (start) {
      var activateOnStart = "towtruck-chat";
      if (typeof start == "string" && start.indexOf("head-") === 0) {
        TowTruck.shareId = start.substr(5);
        TowTruck.emit("shareId");
        TowTruck.isClient = false;
      } else if (typeof start == "string") {
        TowTruck.shareId = start;
        TowTruck.emit("shareId");
        TowTruck.isClient = true;
      } else {
        TowTruck.isClient = false;
        activateOnStart = "towtruck-intro";
      }
      TowTruck.init();
      TowTruck.start();
      TowTruck.activateTab(activateOnStart);
      delete window._startTowTruckImmediately;
    }
  }

  // Note that INCLUDE() isn't actually a function, it's something that is
  // substituted by the server into an actual string.
  TowTruck.templates = {
    intro: makeTemplate("intro", INCLUDE("intro.tmpl")),
    chat: makeTemplate("chat", INCLUDE("chat.tmpl")),
    chat_message: makeTemplate("chat_message", INCLUDE("chat_message.tmpl")),
    help: makeTemplate("help", INCLUDE("help.tmpl")),
    walkabout: makeTemplate("walkabout", INCLUDE("walkabout.tmpl")),
    end: makeTemplate("end", INCLUDE("end.tmpl"))
  };

  // For ShareJS setup:
  window.WEB = true;
  window.sharejs = {};

  if (window._TowTruckOnLoad) {
    window._TowTruckOnLoad(boot);
  } else {
    boot();
  }

})();
