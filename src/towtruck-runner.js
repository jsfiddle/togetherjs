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
    TowTruck.channel.send(msg);
  };

  TowTruck.onmessage = function (msg) {
    console.log("Incoming message:", msg);
    if (msg.type == "hello") {
      send({type: "hello-back"});
    }
    if (msg.type == "chat") {
      TowTruck.addChat(msg.text);
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
      closer = $('<div class="towtruck-close">&times;</div>'),
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
        TowTruck.chatInput.val("");
      }
    });
  };

  TowTruck.addChat = function (text) {
    var chat = $('<div class="towtruck-chat-message">');
    chat.text(text);
    TowTruck.chatContainer.append(chat);
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
