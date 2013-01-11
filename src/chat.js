(function () {
  var TowTruck = window.TowTruck;
  var $ = TowTruck.$;
  var assert = TowTruck.assert;

  TowTruck.messageHandler.on("chat", function (msg) {
    TowTruck.addChat({
      type: "text",
      clientId: msg.clientId,
      text: msg.text
    });
    if (! TowTruck.isClient) {
      TowTruck.Chat.addChat({
        type: "text",
        text: msg.text,
        clientId: msg.clientId,
        date: Date.now()
      });
    }
  });

  TowTruck.messageHandler.on("bye", function (msg) {
    TowTruck.addChat({
      type: "left-session",
      clientId: msg.clientId
    });
  });

  TowTruck.messageHandler.on("hello", function () {
    if (! TowTruck.isClient) {
      var log = TowTruck.Chat.loadChat();
      if (log.length) {
        TowTruck.send({
          type: "chat-catchup",
          log: log
        });
      }
    }
  });

  TowTruck.messageHandler.on("chat-catchup", function (msg) {
    assert(TowTruck.isClient);
    if (TowTruck.isChatEmpty()) {
      TowTruck.addChat({type: "clear"});
      for (var i=0; i<msg.log.length; i++) {
        var l = msg.log[i];
        TowTruck.addChat({
          type: "text",
          text: l.text,
          date: l.date,
          clientId: l.clientId,
          messageId: l.messageId
        });
      }
    }
  });

  // The number of milliseconds after which to put a break in the conversation
  // (if messages come faster than this, they will be kind of combined)
  var MESSAGE_BREAK_TIME = 20000;

  TowTruck.peers.on("update", function (peer) {
    TowTruck.updatePerson(peer.clientId);
  });

  // FIXME: this doesn't make sense any more, but I'm not sure what if anything
  // should be done on an avatar update
  TowTruck.peers.on("add update", function (peer, old) {
    if (peer.clientId == TowTruck.clientId) {
      return;
    }
    if (peer.avatar && peer.avatar != old.avatar) {
      var id = "towtuck-avatar-" + TowTruck.safeClassName(peer.clientId);
      var img = $("<img>").attr("src", peer.avatar).css({width: "8em"});
      $("#" + id).remove();
      img.attr("id", id);
      //TowTruck.addChatElement(img);
    }
  });

  TowTruck.Chat = {
    submit: function (message) {
      var parts = message.split(/ /);
      if (parts[0].charAt(0) == "/") {
        var name = parts[0].substr(1);
        var method = this["command_" + name];
        if (method) {
          method.call(this, parts[1]);
        }
        return;
      }
      var msg = {
        type: "text",
        text: message,
        clientId: TowTruck.clientId,
        messageId: TowTruck.clientId + "-" + Date.now(),
        date: Date.now()
      };
      TowTruck.send({
        type: "chat",
        text: message,
        messageId: msg.messageId
      });
      TowTruck.addChat(msg);
      if (! TowTruck.isClient) {
        this.addChat(msg);
      }
    },

    command_tab: function () {
      var newSetting = TowTruck.settings("tabIndependent");
      TowTruck.settings("tabIndependent", newSetting);
      TowTruck.addChat({
        type: "system",
        text: (newSetting ? "Tab independence turned on" : "Tab independence turned off") +
          " reload needed"
      });
    },

    command_help: function () {
      var msg = TowTruck.trim(TowTruck.templates.help({
        tabIndependent: TowTruck.settings("tabIndependent")
      }));
      TowTruck.addChat({
        type: "system",
        text: msg
      });
    },

    command_test: function (args) {
      args = TowTruck.trim(args).split(/\s+/g);
      if (args[0] === "" || ! args.length) {
        if (this._testCancel) {
          args = ["cancel"];
        } else {
          args = ["start"];
        }
      }
      if (args[0] == "cancel") {
        TowTruck.addChat({
          type: "system",
          text: "Aborting test"
        });
        this._testCancel();
        this._testCancel = null;
        return;
      }
      if (args[0] == "start") {
        var times = parseInt(args[1], 10);
        if (isNaN(times) || ! times) {
          times = 100;
        }
        TowTruck.addChat({
          type: "system",
          text: "Testing with walkabout.js"
        });
        var tmpl = $(TowTruck.templates.walkabout({}));
        var container = TowTruck.container.find(".towtruck-test-container");
        container.empty();
        container.append(tmpl);
        container.show();
        var statusContainer = container.find(".towtruck-status");
        statusContainer.text("starting...");
        this._testCancel = Walkabout.runManyActions({
          ondone: function () {
            statusContainer.text("done");
            statusContainer.one("click", function () {
              container.hide();
            });
            this._testCancel = null;
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
        if (this._testShow.length) {
          this._testShow.forEach(function (item) {
            if (item) {
              item.remove();
            }
          });
          this._testShow = [];
        } else {
          var actions = Walkabout.findActions();
          actions.forEach(function (action) {
            this._testShow.push(action.show());
          });
        }
      }
      if (args[0] == "describe") {
        Walkabout.findActions().forEach(function (action) {
          TowTruck.addChat({
            type: "system",
            text: action.description()
          });
        });
        return;
      }
      TowTruck.addChat({
        type: "system",
        text: "Did not understand: " + args.join(" ")
      });
    },

    _testCancel: null,
    _testShow: [],

    command_clear: function () {
      TowTruck.addChat({
        type: "clear"
      });
      this.clearHistory();
    },

    storageKey: "towtruck.chatlog",
    messageExpireTime: 1000 * 60 * 60 * 6, // 6 hours in milliseconds
    maxLogMessages: 100,

    addChat: function (obj) {
      assert(! TowTruck.isClient);
      var log = this.loadChat();
      log.push(obj);
      // Cull old entries:
      var earlies = -1;
      var now = Date.now();
      for (var i=0; i<log.length; i++) {
        if (now - log[i].date < this.messageExpireTime) {
          break;
        }
        earlies = i;
      }
      if (earlies > -1) {
        log.splice(0, earlies + 1);
      }
      if (log.length > this.maxLogMessages) {
        log.splice(0, log.length - this.maxLogMessages);
      }
      localStorage.setItem(this.storageKey, JSON.stringify(log));
    },

    loadChat: function () {
      var log = localStorage.getItem(this.storageKey);
      if (! log) {
        log = [];
      } else {
        log = JSON.parse(log);
      }
      return log;
    },

    clearHistory: function () {
      localStorage.removeItem(this.storageKey);
    }

  };

})();
