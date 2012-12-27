(function () {
  var TowTruck = window.TowTruck;
  var $ = TowTruck.$;

  // FIXME: make this all a class?

  TowTruck.createChat = function () {
    var tmpl = $(TowTruck.templates.chat({}));
    tmpl.find(".towtruck-close").click(TowTruck.stop.bind(TowTruck));
    TowTruck.chat = tmpl;
    $("body").append(TowTruck.chat);
    TowTruck.chat.find(".towtruck-chat-input").bind("keyup", function (event) {
      var input = TowTruck.chat.find(".towtruck-chat-input");
      if (event.which == 13) {
        var val = input.val();
        if (! val) {
          return false;
        }
        TowTruck.send({type: "chat", text: val});
        TowTruck.localChatMessage(val);
        input.val("");
      }
      return false;
    });
  };

  TowTruck.messageHandler.on("chat", function (msg) {
    TowTruck.addChat(msg.text, msg.clientId);
  });

  TowTruck.messageHandler.on("bye", function (msg) {
    TowTruck.addChat("left session", msg.clientId);
  });

  TowTruck.messageHandler.on("self-bye", function (msg) {
    if (TowTruck.chat) {
      TowTruck.chat.remove();
      TowTruck.chat = null;
    }
  });

  TowTruck.addChat = function (text, personId) {
    var chat = $(TowTruck.templates.chat_message({
      nickname: TowTruck.peers.get(personId).nickname,
      personId: personId,
      personClass: "towtruck-chat-person-" + TowTruck.safeClassName(personId),
      message: text,
      remote: (personId != TowTruck.clientId)
    }));
    TowTruck.chat.find(".towtruck-chat-container").append(chat);
  };

  TowTruck.peers.on("update", function (peer) {
    $(".towtruck-chat-person-" + TowTruck.safeClassName(peer.clientId)).text(peer.nickname);
  });

  TowTruck.localChatMessage = function (text) {
    if (text.indexOf("/tab") == 0) {
      TowTruck.settings("tabIndependent", ! TowTruck.settings("tabIndependent"));
      TowTruck.addChat(
        (TowTruck.settings("tabIndependent") ? "Tab independence turned on" : "Tab independence turned off") +
        " reload needed", "system");
      return;
    }
    if (text.indexOf("/help") == 0) {
      var msg = TowTruck.trim(TowTruck.templates.help({
        tabIndependent: TowTruck.settings("tabIndependent")
      }));
      TowTruck.addChat(msg, "system");
      return;
    }
    TowTruck.addChat(text, TowTruck.clientId);
  };

})();
