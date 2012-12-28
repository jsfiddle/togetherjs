(function () {

  var TowTruck = window.TowTruck;
  var $ = TowTruck.$;

  TowTruck.initTrackers = function initTrackers() {
    if (! initTrackers.done) {
      TowTruck.TextareaTracker.createAll();
      initTrackers.done = true;
    }
    TowTruck.editTrackers.forEach(function (t) {
      t.introduce();
    });
  };

  TowTruck.messageHandler.on("hello hello-back", function () {
    if (! TowTruck.isClient) {
      TowTruck.initTrackers();
    }
  });

  TowTruck.messageHandler.on("connect-tracker", function (msg) {
    TowTruck.TextareaTracker.fromConnect(msg);
  });

  TowTruck.editTrackers = [];

  TowTruck.TextareaTracker = TowTruck.Class({

    constructor: function (options) {
      this.element = $(options.element);
      this.id = this.element.attr("id");
      this.isClient = options.isClient;
      this.channel = options.channel;
      this.curState = this.getState();
      if (! this.isClient) {
        this.sendInit();
      }
      this.change = this.change.bind(this);
      this.onmessage = this.onmessage.bind(this);
      this.channel.on("message", this.onmessage);
      this.bindChange();
    },

    textareaEvents: ["textInput", "keydown", "keyup", "select", "cut", "paste"],

    bindChange: function () {
      this.textareaEvents.forEach(function (e) {
        this.element.bind(e, this.change);
      }, this);
    },

    unbindChange: function () {
      this.textareaEvents.forEach(function (e) {
        this.textarea.unbind(e, this.change);
      }, this);
    },

    getState: function () {
      return this.element.val();
    },

    applyChange: function (value) {
      // FIXME: maybe find some intelligent way to keep the selection value?
      // especially when the position is after the changed position (e.g.,
      // delete or insert earlier in the doc)
      this.element.val(value);
      this.curState = value;
      return;
      var cur = this.textarea.val();
      if (cur == value) {
        return;
      }
      var commonStart = 0;
      while (commonStart < cur.length &&
             cur.charAt(commonStart) == value.charAt(commonStart)) {
        commonStart++;
      }
      var commonEnd = 0;
      while (commonEnd < (cur.length - commonStart) &&
             cur.charAt(cur.length - commonEnd - 1) ==
             value.charAt(value.length - commonEnd - 1)) {
        commonEnd++;
      }
      var posStart = this.textarea[0].selectionStart;
      var posEnd = this.textarea[0].selectionEnd;
    },

    introduce: function () {
      TowTruck.send({
        type: "connect-tracker",
        routeId: this.channel.id,
        elementId: this.id
      });
    },

    stop: function () {
      var index = TowTruck.editTrackers.indexOf(this);
      if (index != -1) {
        TowTruck.editTrackers.splice(index, 1);
      }
      this.channel.close();
    },

    change: function () {
      var newValue = this.getState();
      var old = this.curState;
      if (newValue == old) {
        return;
      }
      console.log("got change", newValue, old);
      var commonStart = 0;
      while (commonStart < newValue.length &&
             newValue.charAt(commonStart) == old.charAt(commonStart)) {
        commonStart++;
      }
      var commonEnd = 0;
      while (commonEnd < (newValue.length - commonStart) &&
             newValue.charAt(newValue.length - commonEnd - 1) ==
             old.charAt(old.length - commonEnd - 1)) {
        commonEnd++;
      }
      var removed = old.substr(commonStart, old.length - commonStart - commonEnd);
      this.channel.send({
        op: "change",
        start: commonStart,
        end: old.length-commonEnd,
        text: newValue.substr(commonStart, newValue.length - commonStart - commonEnd),
        oldLength: old.length,
        newLength: newValue.length,
        removed: removed,
        // FIXME: these are for debugging:
        oldText: old,
        fullText: newValue
      });
      this.curState = newValue;
    },

    sendInit: function () {
      this.channel.send({op: "init", value: this.curState});
    },

    onmessage: function (msg) {
      if (msg.op == "init") {
        this.curState = msg.text;
        this.applyChange(msg.text);
        return;
      }
      if (msg.op == "change") {
        if (msg.oldLength != this.curState.length) {
          throw "Length mismatch: is " + (this.curState.length) + " not " + msg.oldLength;
        }
        var removed = this.curState.substr(msg.start, msg.end - msg.start);
        if (removed != msg.removed) {
          throw "Removed text is " + JSON.stringify(removed) + " not " + JSON.stringify(msg.removed);
        }
        var newValue = (
          this.curState.substr(0, msg.start) +
          msg.text +
          this.curState.substr(msg.end));
        if (newValue.length != msg.newLength) {
          throw "New length is " + newValue.length + " not " + msg.newLength;
        }
        if (msg.oldText && this.curState != msg.oldText) {
          throw "Current value mismatch";
        }
        if (msg.newText && newValue != msg.newText) {
          throw "New value mismatch";
        }
        this.curState = newValue;
        this.applyChange(newValue);
        return;
      }
    }

  });

  TowTruck.TextareaTracker.createAll = function () {
    var els = $("textarea:visible[id]");
    els.each(function () {
      if (TowTruck.isClient) {
        throw "createAll should only be called by the master";
      }
      var route = TowTruck.router.makeRoute();
      var t = TowTruck.TextareaTracker({
        element: this,
        channel: route,
        isClient: false
      });
      TowTruck.editTrackers.push(t);
    });
  };

  TowTruck.TextareaTracker.fromConnect = function (msg) {
    if (! TowTruck.isClient) {
      throw "fromConnect should only be called by the client";
    }
    var id = msg.elementId;
    var el = $("#" + id);
    if (! el.length) {
      console.warn("Cannot find local element with id #" + id);
      return;
    }
    var route = TowTruck.router.makeRoute(msg.routeId);
    var t = TowTruck.TextareaTracker({
      element: el,
      channel: route,
      isClient: true
    });
    TowTruck.editTrackers.push(t);
  };

})();
