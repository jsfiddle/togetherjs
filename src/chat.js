(function () {
  var TowTruck = window.TowTruck;
  var $ = TowTruck.$;

  // FIXME: make this all a class?

  TowTruck.createChat = function () {
    var tmpl = $(TowTruck.templates.chat({}));
    tmpl.find(".towtruck-close").click(TowTruck.chatStop.bind(TowTruck));
    tmpl.find(".towtruck-info").click(function () {
      TowTruck.showIntro(true);
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
        TowTruck.localChatMessage(val);
        input.val("");
      }
      return false;
    });
  };

  TowTruck.chatStop = function () {
    var confirm = $(TowTruck.templates.end({}));
    confirm.find(".towtruck-yes").click(function () {
      confirm.remove();
      TowTruck.stop();
    });
    confirm.find(".towtruck-no").click(function () {
      confirm.remove();
    });
    TowTruck.chat.prepend(confirm);
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

  // The number of milliseconds after which to put a break in the conversation
  // (if messages come faster than this, they will be kind of combined)
  var MESSAGE_BREAK_TIME = 20000;

  TowTruck.addChat = function (text, personId) {
    var nick = TowTruck.peers.get(personId).nickname;
    if (personId == TowTruck.clientId) {
      nick = "me";
    }
    var container = TowTruck.chat.find(".towtruck-chat-container");
    var lastChat = container.find(".towtruck-chat-message");
    if (lastChat.length) {
      lastChat = $(lastChat[lastChat.length-1]);
    } else {
      lastChat = null;
    }
    var combine = false;
    if (lastChat && lastChat.attr("data-person") == personId &&
        Date.now() - parseInt(lastChat.attr("data-date"), 10) < MESSAGE_BREAK_TIME) {
      combine = true;
    }
    var chat = $(TowTruck.templates.chat_message({
      nickname: nick,
      date: Date.now(),
      personId: personId,
      personClass: "towtruck-chat-person-" + TowTruck.safeClassName(personId),
      message: text,
      remote: (personId != TowTruck.clientId),
      combine: combine
    }));
    if (lastChat && ! combine) {
      chat.addClass("towtruck-chat-new-message");
    }
    container.append(chat);
    chat[0].scrollIntoView();
  };

  TowTruck.addChatElement = function (element) {
    // FIXME: this method should be combined with addChat, where that method
    // takes structured updates, not just text
    var container = TowTruck.chat.find(".towtruck-chat-container");
    container.append(element);
    $(element)[0].scrollIntoView();
  };

  TowTruck.peers.on("update", function (peer) {
    if (peer.nickname) {
      $(".towtruck-chat-person-" + TowTruck.safeClassName(peer.clientId)).text(peer.nickname);
    }
  });

  TowTruck.peers.on("add update", function (peer, old) {
    if (peer.clientId == TowTruck.clientId) {
      return;
    }
    if (peer.avatar && peer.avatar != old.avatar) {
      var id = "towtuck-avatar-" + TowTruck.safeClassName(peer.clientId);
      var img = $("<img>").attr("src", peer.avatar).css({width: "8em"});
      $("#" + id).remove();
      img.attr("id", id);
      TowTruck.addChatElement(img);
    }
  });

  TowTruck._testCancel = null;
  TowTruck._testShow = [];

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
    if (text.indexOf("/test") == 0) {
      var args = TowTruck.trim(text.substr(5)).split(/\s+/g);
      if (args[0] === "" || ! args.length) {
        if (TowTruck._testCancel) {
          args = ["cancel"];
        } else {
          args = ["start"];
        }
      }
      if (args[0] == "cancel") {
        TowTruck.addChat("Aborting test", "system");
        TowTruck._testCancel();
        TowTruck._testCancel = null;
        return;
      }
      if (args[0] == "start") {
        var times = parseInt(args[1], 10);
        if (isNaN(times) || ! times) {
          times = 100;
        }
        TowTruck.addChat("Testing with walkabout.js", "system");
        var tmpl = $(TowTruck.templates.walkabout({}));
        var container = TowTruck.chat.find(".towtruck-test-container");
        container.empty();
        container.append(tmpl);
        container.show();
        var statusContainer = container.find(".towtruck-status");
        statusContainer.text("starting...");
        TowTruck._testCancel = Walkabout.runManyActions({
          ondone: function () {
            statusContainer.text("done");
            statusContainer.one("click", function () {
              container.hide();
            });
            TowTruck._testCancel = null;
          },
          onstatus: function (status) {
            var note = "actions: " + status.actions.length + " running: " +
              (status.times - status.remaining) + " / " + status.times;
            statusContainer.text(note);
          }
        });
        return;
      }
      if (args[0] == "show") {
        if (TowTruck._testShow.length) {
          TowTruck._testShow.forEach(function (item) {
            if (item) {
              item.remove();
            }
          });
          TowTruck._testShow = [];
        } else {
          var actions = Walkabout.findActions();
          actions.forEach(function (action) {
            TowTruck._testShow.push(action.show());
          });
        }
      }
      if (args[0] == "describe") {
        Walkabout.findActions().forEach(function (action) {
          TowTruck.addChat(action.description(), "system");
        });
        return;
      }
      TowTruck.addChat("Did not understand: " + text, "system");
      return;
    }
    if (text.indexOf("/clear") === 0) {
      TowTruck.chat.find(".towtruck-chat-container").empty();
      return;
    }
    TowTruck.send({type: "chat", text: text});
    TowTruck.addChat(text, TowTruck.clientId);
  };

})();
