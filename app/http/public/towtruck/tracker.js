define(["jquery", "util", "session", "element-finder"], function ($, util, session, elementFinder) {

  var tracker = util.Module("tracker");
  var assert = util.assert;

  function ignoreElement(el) {
    while (el) {
      if (el.className && (""+el.className).indexOf("towtruck-container") != -1) {
        return true;
      }
      el = el.parentNode;
    }
    return false;
  }

  function initTrackers() {
    if (! initTrackers.done) {
      tracker.trackers.createAll();
      initTrackers.done = true;
    }
    session.send({type: "reset-trackers"});
    tracker.trackers.introduceAll();
  }

  session.hub.on("hello hello-back", function () {
    if (! session.isClient) {
      initTrackers();
    }
  });

  session.hub.on("reset-trackers", function () {
    tracker.trackers.reset();
  });

  session.hub.on("connect-tracker", function (msg) {
    tracker.trackers.connect(msg);
  });

  // This is a kind of registry for trackers.
  // Each item here is a class, with the following methods:
  // * .createAll(): a class method, that finds and instantiates
  //   all trackers.  This will only be called on the master browser, not
  //   the client.
  // * All trackers classes have a .className property (if you give the
  //    constructor a name that will be used)
  // * On instantiation all trackers get added to tracker.trackers.active
  //   array
  // * Trackers have a .introduce() method.  This should send an introduction
  //   message, with type: "connect-tracker", and trackerType: Tracker.name
  // * Tracker.fromConnect(msg) creates a tracker, using the message sent
  //   from .introduce()
  tracker.trackers = {
    _trackers: {},
    active: [],
    get: function (name) {
      return this._trackers[name];
    },
    register: function (Tracker) {
      var name = Tracker.className;
      if (! name) {
        throw 'Bad Tracker, has no name: ' + Tracker;
      }
      if ((! Tracker.createAll) || (! Tracker.fromConnect) ||
          (! Tracker.prototype.introduce) ||
          (! Tracker.prototype.destroy)) {
        throw 'Bad Tracker: does not implement interface (' + name + ')';
      }
      if (this._trackers[name]) {
        throw "Tracker already registered under " + name;
      }
      this._trackers[name] = Tracker;
    },
    introduceAll: function () {
      for (var i=0; i<this.active.length; i++) {
        this.active[i].introduce();
      }
    },
    createAll: function () {
      for (var name in this._trackers) {
        this._trackers[name].createAll();
      }
    },
    reset: function () {
      assert(session.isClient);
      while (this.active.length) {
        this.active[0].destroy();
      }
    },
    connect: function (msg) {
      var name = msg.trackerType;
      var Tracker = this.get(name);
      if (! Tracker) {
        console.warn("Got a connect for a tracker type I don't understand: " + name);
        return;
      }
      Tracker.fromConnect(msg);
    }
  };

  tracker.TextTracker = util.Class({

    constructor: function TextTracker(options) {
      this.element = $(options.element);
      this.isClient = options.isClient;
      this.channel = options.channel;
      this.curState = this.getState();
      this.change = this.change.bind(this);
      this.onmessage = this.onmessage.bind(this);
      this.channel.on("message", this.onmessage);
      this.bindChange();
    },

    repr: function () {
      return '[TextTracker channel: ' + repr(this.channel.id) + ' element: ' + elementFinder.elementLocation(this.element) + ']';
    },

    textareaEvents: ["textInput", "keydown", "keyup", "select", "cut", "paste", "change"],

    bindChange: function () {
      this.textareaEvents.forEach(function (e) {
        this.element.bind(e, this.change);
      }, this);
    },

    unbindChange: function () {
      this.textareaEvents.forEach(function (e) {
        this.element.unbind(e, this.change);
      }, this);
    },

    getState: function () {
      return this.element.val();
    },

    applyChange: function (value) {
      this.element.val(value);
      assert(typeof value == "string");
      this.curState = value;
    },

    introduce: function () {
      session.send({
        type: "connect-tracker",
        trackerType: this.constructor.name,
        routeId: this.channel.id,
        elementLocation: elementFinder.elementLocation(this.element),
        value: this.element.val()
      });
      if (! this.isClient) {
        this.sendInit();
      }
    },

    destroy: function () {
      this.unbindChange();
      var index = tracker.trackers.active.indexOf(this);
      if (index != -1) {
        tracker.trackers.active.splice(index, 1);
      }
      this.channel.close();
    },

    change: function () {
      console.log("Got change in element", this.element);
      var newValue = this.getState();
      var old = this.curState;
      if (newValue == old) {
        return;
      }
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
      assert(typeof newValue == "string");
      this.curState = newValue;
    },

    sendInit: function () {
      this.channel.send({op: "init", text: this.curState});
    },

    onmessage: function (msg) {
      if (msg.op == "init") {
        assert(typeof msg.text == "string");
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
        assert(typeof newValue == "string");
        this.curState = newValue;
        var startPos = this.element[0].selectionStart;
        var endPos = this.element[0].selectionEnd;
        this.applyChange(newValue);
        if (startPos > msg.start) {
          if (startPos < msg.end) {
            // it was in a deleted/changed portion:
            this.element[0].selectionStart = msg.start;
          } else {
            // it was after the change:
            this.element[0].selectionStart = startPos + (msg.text.length - removed.length);
          }
        }
        if (endPos > msg.start) {
          if (endPos < msg.end) {
            this.element[0].selectionEnd = msg.start;
          } else {
            this.element[0].selectionEnd = endPos + (msg.text.length - removed.length);
          }
        }
        return;
      }
    }

  });

  tracker.TextTracker.createAll = function () {
    // These are all the text-like inputs we control in a granular manner
    // (as opposed to fields that we just overwrite, like type=checkbox)
    assert(! session.isClient);
    var els = $(
      'textarea:visible, ' +
        'input:visible[type="text"], ' +
        'input:visible[type="search"], ' +
        'input:visible[type="url"]');
    els.each(function () {
      if (ignoreElement(this)) {
        return;
      }
      var routeId = "tracker-textarea-" + util.safeClassName(this.id || util.generateId());
      var route = session.router.makeRoute(routeId);
      var t = tracker.TextTracker({
        element: this,
        channel: route,
        isClient: false
      });
      tracker.trackers.active.push(t);
    });
  };

  tracker.TextTracker.fromConnect = function (msg) {
    assert(session.isClient, "fromConnect should only be called by the client");
    var el = elementFinder.findElement(msg.elementLocation);
    var route = session.router.makeRoute(msg.routeId);
    var t = tracker.TextTracker({
      element: el,
      channel: route,
      isClient: true
    });
    tracker.trackers.active.push(t);
    if (msg.value) {
      t.onmessage({op: "init", text: msg.value});
    }
  };

  tracker.trackers.register(tracker.TextTracker);

  tracker.FormFieldTracker = util.Class({
    constructor: function FormFieldTracker(options) {
      this.channel = options.channel;
      this.isClient = options.isClient;
      this.change = this.change.bind(this);
      this.onmessage = this.onmessage.bind(this);
      this.channel.on("message", this.onmessage);
      // Not file, hidden, button, image, password, reset, submit
      // Not text types (we want collision handling):
      //   text, search, url
      var types = (
        "checkbox color date datetime datetime-local email " +
          "month number radio range tel time week").split(/ /g);
      var selectors = [];
      types.forEach(function (t) {
        selectors.push('input[type="' + t + '"]');
      });
      selectors.push("select");
      this._selector = selectors.join(", ");
      $(document).on("change", this._selector, this.change);
    },

    repr: function() {
      return '[FormFieldTracker channel: ' + repr(this.channel.id) + ']';
    },

    destroy: function () {
      $(document).off("change", this._selector, this.change);
      var index = tracker.trackers.active.indexOf(this);
      if (index != -1) {
        tracker.trackers.active.splice(index, 1);
      }
      this.channel.close();
    },

    introduce: function () {
      assert(! this.isClient);
      session.send({
        type: "connect-tracker",
        trackerType: this.constructor.name,
        routeId: this.channel.id
      });
      // FIXME: should send all form states as an init
    },

    _checkedFields: ["radio", "checkbox"],

    change: function (event) {
      var el = $(event.target);
      var loc = elementFinder.elementLocation(el);
      // FIXME: should check for case issues:
      var isChecked = this._checkedFields.indexOf(el.attr("type")) != -1;
      var msg = {
        op: "change",
        elementLocation: loc,
        value: el.val()
      };
      if (isChecked) {
        msg.checked = el[0].checked;
      }
      this.channel.send(msg);
    },

    onmessage: function (msg) {
      assert(msg.op == "change", msg);
      var element = $(elementFinder.findElement(msg.elementLocation));
      element.val(msg.value);
      if (msg.checked !== undefined) {
        element[0].checked = msg.checked;
      }
    }
  });

  tracker.FormFieldTracker.createAll = function () {
    assert(! session.isClient, "shouldn't be client");
    var route = session.router.makeRoute("tracker-formfield");
    var t = tracker.FormFieldTracker({
      channel: route,
      isClient: false
    });
    tracker.trackers.active.push(t);
  };

  tracker.FormFieldTracker.fromConnect = function (msg) {
    assert(session.isClient, "should be client");
    var route = session.router.makeRoute(msg.routeId);
    var t = tracker.FormFieldTracker({
      channel: route,
      isClient: true
    });
    tracker.trackers.active.push(t);
  };

  tracker.trackers.register(tracker.FormFieldTracker);

  tracker.CodeMirrorTracker = util.Class({
    constructor: function CodeMirrorTracker(options) {
      this.editor = options.editor;
      this.channel = options.channel;
      this.isClient = options.isClient;
      this.change = this.change.bind(this);
      this.onmessage = this.onmessage.bind(this);
      //this.editor.on("change", this.change);
      var oldOnChange = this.editor.getOption("onChange");
      this.editor.setOption("onChange", (function (instance, delta) {
        this.change(instance, delta);
        if (oldOnChange) {
          oldOnChange(instance, delta);
        }
      }).bind(this));
      this.channel.on("message", this.onmessage);
      // CodeMirror emits events for our own updates, so we set this
      // to true when we expect to ignore those events:
      this.ignoreEvents = false;
    },

    repr: function () {
      return '[CodeMirrorTracker channel: ' + repr(this.channel.id) + 'element: ' + elementFinder.elementLocation(this.editor.getWrapperElement()) + ']';
    },

    introduce: function () {
      assert(! this.isClient);
      session.send({
        type: "connect-tracker",
        trackerType: this.constructor.name,
        routeId: this.channel.id,
        elementLocation: elementFinder.elementLocation(this.editor.getWrapperElement()),
        value: this.editor.getValue()
      });
      if (! this.isClient) {
        this.channel.send({
          op: "init",
          value: this.editor.getValue()
        });
      }
    },

    destroy: function () {
      var index = tracker.trackers.active.indexOf(this);
      if (index != -1) {
        tracker.trackers.active.splice(index, 1);
      }
      this.channel.close();
    },

    change: function (editor, delta) {
      if (this._ignoreEvents) {
        return;
      }
      var fullText = this.editor.getValue();
      if (fullText != this._lastValue) {
        // FIXME: I should be sending a lot more confirmation stuff
        // to check everything went well.
        this.channel.send({
          op: "replace",
          delta: delta,
          fullText: fullText
        });
        this._lastValue = fullText;
      }
    },

    onmessage: function (msg) {
      if (msg.op == "replace") {
        // Note: text will be a list of strings, not a single string
        this._ignoreEvents = true;
        try {
          var delta = msg.delta;
          while (delta) {
            var text = delta.text;
            if (Array.isArray(text)) {
              text = text.join("\n");
            }
            this.editor.replaceRange(text, delta.from, delta.to);
            delta = delta.next;
          }
        } finally {
          this._ignoreEvents = false;
        }
        if (msg.fullText && this.editor.getValue() != msg.fullText) {
          console.warn("Text mismatch after applying message", msg);
        }
      } else if (msg.op == "init") {
        this.editor.setValue(msg.value);
      } else {
        console.warn("Bad op:", msg);
      }
    }
  });

  tracker.CodeMirrorTracker.createAll = function () {
    assert(! session.isClient);
    var els = document.getElementsByTagName("*");
    var len = els.length;
    for (var i=0; i<len; i++) {
      var el = els[i];
      if (ignoreElement(el)) {
        continue;
      }
      var editor = el.CodeMirror;
      if (! editor) {
        continue;
      }
      var route = session.router.makeRoute("tracker-codemirror-" + util.safeClassName(el.id || util.generateId()));
      var t = tracker.CodeMirrorTracker({
        editor: editor,
        channel: route,
        isClient: false
      });
      tracker.trackers.active.push(t);
    }
  };

  tracker.CodeMirrorTracker.fromConnect = function (msg) {
    var route = session.router.makeRoute(msg.routeId);
    var el = elementFinder.findElement(msg.elementLocation);
    var editor = el.CodeMirror;
    if (! editor) {
      console.warn("CodeMirror has not been activated on element", el);
      return;
    }
    var t = tracker.CodeMirrorTracker({
      editor: editor,
      channel: route,
      isClient: true
    });
    tracker.trackers.active.push(t);
    if (msg.value) {
      t.onmessage({op: "init", value: msg.value});
    }
  };

  tracker.trackers.register(tracker.CodeMirrorTracker);

  return tracker;

});
