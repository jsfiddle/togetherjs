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
    var closer;
    TowTruck.intro = $('<div class="towtruck-container towtruck-intro">');
    TowTruck.intro.append(
      closer = $('<div class="towtruck-close">&times;</div>'),
      $('<div class="towtruck-header">TowTruck</div>'),
      TowTruck.shareLink = $('<div class="towtruck-link"></div>')
    );
    closer.click(function () {
      if (! TowTruck.chat) {
        TowTruck.createChat();
      }
      TowTruck.intro.remove();
      TowTruck.intro = TowTruck.shareLink = null;
    });
    TowTruck.shareLink.text(TowTruck.shareUrl());
    $("body").append(TowTruck.intro);
  };

  TowTruck.createChat = function () {
    var closer;
    TowTruck.chat = $('<div class="towtruck-container towtruck-chat">');
    TowTruck.chat.append(
      closer = $('<div class="towtruck-close" data-walkabout-disable="1">&times;</div>'),
      $('<div class="towtruck-header">Chat</div>'),
      TowTruck.chatContainer = $('<div class="towtruck-chat-container"></div>'),
      TowTruck.chatInput = $('<input type="text" class="towtruck-chat-input">')
    );
    $("body").append(TowTruck.chat);
    closer.click(function () {
      TowTruck.chat.remove();
      TowTruck.chat = TowTruck.chatContainer = null;
      send({type: "bye"});
      TowTruck.channel.close();
      TowTruck.channel = null;
    });
    TowTruck.chatInput.bind("keyup", function (event) {
      if (event.which == 13) {
        var val = TowTruck.chatInput.val();
        if (! val) {
          return;
        }
        send({type: "chat", text: val});
        TowTruck.localChatMessage(val);
        TowTruck.chatInput.val("");
      }
    });
  };

  TowTruck.addChat = function (text, personId) {
    var chat = $('<div class="towtruck-chat-message">');
    var nickname = TowTruck.peers[personId].nickname || "?";
    chat.append(
      $('<span class="towtruck-chat-name">')
        .addClass("towtruck-chat-person-" + personId)
        .text(nickname + ": "));
    chat.append($('<span class="towtruck-chat-content">').text(text));
    TowTruck.chatContainer.append(chat);
  };

  TowTruck.setPeerNickname = function (personId, name) {
    $(".towtruck-chat-person-" + personId).text(name + ": ");
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
      var msg = (
        "\n" +
        "/help : this message\n" +
        "/tab : turn tab independence on/off (allows two tabs to have different identities)\n" +
        "  " + (TowTruck.settings("tabIndependent") ? "tab independence on" : "tab independence off (the default)")
      );
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
