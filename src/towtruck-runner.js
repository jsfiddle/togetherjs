(function TowTruckModule() {

  if (window.jQuery === undefined ||
      ((! window.TowTruck) || (! window.TowTruck.WebSocketChannel))) {
    // Not everything has loaded yet...
    setTimeout(TowTruckModule, 100);
    return;
  }

  var TowTruck;

  if (window.TowTruck) {
    TowTruck = window.TowTruck;
  } else {
    window.TowTruck = TowTruck = {};
  }

  var $ = window.jQuery;
  $.noConflict();
  TowTruck.$ = $;
  var _ = window._;
  _.noConflict();
  TowTruck._ = _;

  TowTruck.init = function () {
    if (! TowTruck.shareId) {
      TowTruck.shareId = TowTruck.generateId();
      location.hash = "towtruck-" + TowTruck.shareId;
    }
    if (! TowTruck.channel) {
      console.log("connecting to", TowTruck.hubUrl());
      TowTruck.channel = new TowTruck.WebSocketChannel(TowTruck.hubUrl());
      TowTruck.channel.onmessage = TowTruck.onmessage;
      send({type: "hello"});
    }
  };

  var send = TowTruck.send = function (msg) {
    console.log("Sending message:", msg);
    msg.clientId = TowTruck.clientId;
    TowTruck.channel.send(msg);
  };

  TowTruck.peers = {
    system: {
      clientId: "system",
      nickname: "system"
    }
  };

  TowTruck.onmessage = function (msg) {
    console.log("Incoming message:", msg);
    if (msg.type == "hello") {
      send({type: "hello-back"});
    }
    if (msg.type == "hello" || msg.type == "hello-back") {
      var peer = {clientId: msg.clientId};
      TowTruck.peers[peer.clientId] = peer;
    }
    if (msg.type == "chat") {
      TowTruck.addChat(msg.text, msg.clientId);
    }
    if (msg.type == "bye") {
      TowTruck.addChat("left session", msg.clientId);
    }
  };

  TowTruck.start = function () {
    var tmpl = $(TowTruck.templates.intro({}));
    tmpl.find(".towtruck-close").click(function () {
      if (! TowTruck.chat) {
        TowTruck.createChat();
      }
      tmpl.remove();
    });
    tmpl.find(".towtruck-link").text(TowTruck.shareUrl());
    $("body").append(tmpl);
  };

  TowTruck.createChat = function () {
    var tmpl = $(TowTruck.templates.chat({}));
    console.log("result:", tmpl[0].outerHTML);
    tmpl.find(".towtruck-close").click(function () {
      tmpl.remove();
      send({type: "bye"});
      TowTruck.chat = null;
      TowTruck.channel.close();
      TowTruck.channel = null;
    });
    TowTruck.chat = tmpl;
    $("body").append(TowTruck.chat);
    TowTruck.chat.find(".towtruck-chat-input").bind("keyup", function (event) {
      var input = TowTruck.chat.find(".towtruck-chat-input");
      if (event.which == 13) {
        var val = input.val();
        if (! val) {
          return false;
        }
        send({type: "chat", text: val});
        TowTruck.localChatMessage(val);
        input.val("");
      }
      return false;
    });
  };

  TowTruck.addChat = function (text, personId) {
    var chat = $(TowTruck.templates.chat_message({
      nickname: TowTruck.peers[personId].nickname,
      personId: personId,
      personClass: "towtruck-chat-person-" + safeClassName(personId),
      message: text,
      remote: (personId != TowTruck.clientId)
    }));
    TowTruck.chat.find(".towtruck-chat-container").append(chat);
  };

  TowTruck.setPeerNickname = function (personId, name) {
    $(".towtruck-chat-person-" + safeClassName(personId)).text(name);
  };

  TowTruck.localChatMessage = function (text) {
    if (text.indexOf("/tab") == 0) {
      TowTruck.settings("tabIndependent", ! TowTruck.settings("tabIndependent"));
      TowTruck.addChat(
        (TowTruck.settings("tabIndependent") ? "Tab independence turned on" : "Tab independence turned off") +
        " reload needed", "system");
      return;
    }
    if (text.indexOf("/help") == 0) {
      var msg = trim(TowTruck.templates.help({
        tabIndependent: TowTruck.settings("tabIndependent")
      }));
      TowTruck.addChat(msg, "system");
      return;
    }
    TowTruck.addChat(text, TowTruck.clientId);
  };

  TowTruck.hubUrl = function () {
    if (! TowTruck.shareId) {
      throw "URL cannot be resolved before TowTruck.shareId has been initialized";
    }
    return startTowTruck.hubBase + "/hub/" + TowTruck.shareId;
  };

  TowTruck.shareUrl = function () {
    return location.protocol + "//" + location.host + location.pathname +
           "#towtruck-" + TowTruck.shareId;
  };

  TowTruck.generateId = function (length) {
    length = length || 10;
    var letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV0123456789';
    var s = '';
    for (var i=0; i<length; i++) {
      s += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return s;
  };

  TowTruck.settings = function settings(name, value) {
    var curSettings = localStorage.getItem("TowTruck.settings");
    if (curSettings) {
      curSettings = JSON.parse(curSettings);
    } else {
      curSettings = {};
    }
    for (var a in settings.defaults) {
      if (! curSettings.hasOwnProperty(a)) {
        curSettings[a] = settings.defaults[a];
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
      localStorage.setItem("TowTruck.settings", JSON.stringify(curSettings));
      return value;
    }
  };

  TowTruck.settings.defaults = {
    tabIndependent: false
  };

  function safeClassName(name) {
    return name.replace(/[^a-zA-Z0-9_\-]/g, "_") || "class";
  }

  function trim(s) {
    return s.replace(/^\s+/, "").replace(/\s+$/, "");
  }

  if (TowTruck.settings("tabIndependent")) {
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
  TowTruck.peers[TowTruck.clientId] = {
    clientId: TowTruck.clientId,
    nickname: "me"
  };

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

  TowTruck.templates = {
    intro: makeTemplate("intro", INCLUDE("intro.tmpl")),
    chat: makeTemplate("chat", INCLUDE("chat.tmpl")),
    chat_message: makeTemplate("chat_message", INCLUDE("chat_message.tmpl")),
    help: makeTemplate("help", INCLUDE("help.tmpl"))
  };

  // For ShareJS setup:
  window.WEB = true;

  window.sharejs = {};

  if (window._startTowTruckImmediately) {
    if (typeof window._startTowTruckImmediately == "string") {
      TowTruck.shareId = window._startTowTruckImmediately;
      TowTruck.isClient = true;
      TowTruck.init();
      TowTruck.createChat();
    } else {
      TowTruck.isClient = false;
      TowTruck.init();
      TowTruck.start();
    }
    delete window._startTowTruckImmediately;
  }

})();

var tmpl = INCLUDE("intro.tmpl");

WEB = true;
