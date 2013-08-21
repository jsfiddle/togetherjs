/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["jquery", "util", "session", "elementFinder", "eventMaker", "templating", "ot"], function ($, util, session, elementFinder, eventMaker, templating, ot) {
  var forms = util.Module("forms");
  var assert = util.assert;

  // This is how much larger the focus element is than the element it surrounds
  // (this is padding on each side)
  var FOCUS_BUFFER = 5;

  var inRemoteUpdate = false;

  function maybeChange(event) {
    // Called when we get an event that may or may not indicate a real change
    // (like keyup in a textarea)
    var tag = event.target.tagName;
    if (tag == "TEXTAREA" || tag == "INPUT") {
      change(event);
    }
  }

  function change(event) {
    if (inRemoteUpdate) {
      return;
    }
    if (elementFinder.ignoreElement(event.target) || elementTracked(event.target)) {
      return;
    }
    var el = $(event.target);
    var location = elementFinder.elementLocation(el);
    var value = getValue(el);
    var msg = {
      type: "form-update",
      element: location
    };
    if (isText(el)) {
      var history = el.data("towtruckHistory");
      if (history.current == value) {
        return;
      }
      if (history) {
        var delta = makeDiff(history.current, value);
        assert(delta);
        history.add(delta);
        return maybeSendUpdate(msg.element, history);
      } else {
        if (typeof prev != "string") {
          console.warn("No previous known value on field", el[0]);
        }
        msg.value = value;
        msg.version = 1;
        el.data("towtruckHistory", ot.SimpleHistory(session.clientId, value, 1));
      }
    } else {
      msg.value = value;
    }
    session.send(msg);
  }

  function isCheckable(el) {
    el = $(el);
    var type = (el.prop("type") || "text").toLowerCase();
    if (el.prop("tagName") == "INPUT" && ["radio", "checkbox"].indexOf(type) != -1) {
      return true;
    }
    return false;
  }

  var editTrackers = {};
  var liveTrackers = [];

  var AceEditor = util.Class({

    trackerName: "AceEditor",

    constructor: function (el) {
      this.element = $(el);
      assert(this.element.hasClass("ace_editor"));
      this._change = this._change.bind(this);
      this._editor().document.on("change", this._change);
    },

    destroy: function (el) {
      this._editor().document.removeListener("change", this._change);
    },

    update: function (msg) {
      this._editor().document.getDocument().applyDeltas([msg.delta]);
    },

    init: function (update, msg) {
      this._editor().document.setValue(update.value);
    },

    makeInit: function () {
      return {
        element: elementFinder.elementLocation(this.element),
        tracker: this.trackerName,
        value: this._editor().document.getValue()
      };
    },

    _editor: function () {
      return this.element[0].env;
    },

    _change: function (e) {
      // FIXME: I should have an internal .send() function that automatically
      // asserts !inRemoteUpdate, among other things
      if (inRemoteUpdate) {
        return;
      }
      // FIXME: I want to use a more normalized version of replace instead of
      // ACE's native delta
      session.send({
        type: "form-update",
        tracker: this.trackerName,
        element: elementFinder.elementLocation(this.element),
        delta: JSON.parse(JSON.stringify(e.data))
      });
    }
  });

  AceEditor.scan = function () {
    return $(".ace_editor");
  };

  AceEditor.tracked = function (el) {
    return !! $(el).closest(".ace_editor").length;
  };

  editTrackers[AceEditor.prototype.trackerName] = AceEditor;

  var CodeMirrorEditor = util.Class({
    trackerName: "CodeMirrorEditor",

    constructor: function (el) {
      this.element = $(el);
      assert(this.element[0].CodeMirror);
      this._change = this._change.bind(this);
      this._editor().on("change", this._change);
    },

    destroy: function (el) {
      this._editor().off("change", this._change);
    },

    update: function (msg) {
      this._editor().replaceRange(
        msg.change.text,
        msg.change.from,
        msg.change.to);
    },

    init: function (update, msg) {
      this._editor().setValue(update.value);
    },

    makeInit: function () {
      return {
        element: elementFinder.elementLocation(this.element),
        tracker: this.trackerName,
        value: this._editor().getValue()
      };
    },

    _change: function (editor, change) {
      if (inRemoteUpdate) {
        return;
      }
      delete change.origin;
      var next = change.next;
      delete change.next;
      session.send({
        type: "form-update",
        tracker: this.trackerName,
        element: elementFinder.elementLocation(this.element),
        change: change
      });
      if (next) {
        this._change(editor, next);
      }
    },

    _editor: function () {
      return this.element[0].CodeMirror;
    }
  });

  CodeMirrorEditor.scan = function () {
    var result = [];
    var els = document.body.getElementsByTagName("*");
    var _len = els.length;
    for (var i=0; i<_len; i++) {
      var el = els[i];
      if (el.CodeMirror) {
        result.push(el);
      }
    }
    return $(result);
  };

  CodeMirrorEditor.tracked = function (el) {
    el = $(el)[0];
    while (el) {
      if (el.CodeMirror) {
        return true;
      }
      el = el.parentNode;
    }
    return false;
  };

  editTrackers[CodeMirrorEditor.prototype.trackerName] = CodeMirrorEditor;

  function buildTrackers() {
    assert(! liveTrackers.length);
    util.forEachAttr(editTrackers, function (TrackerClass) {
      var els = TrackerClass.scan();
      els.each(function () {
        liveTrackers.push(TrackerClass(this));
      });
    });
  }

  function destroyTrackers() {
    liveTrackers.forEach(function (tracker) {
      tracker.destroy();
    });
    liveTrackers = [];
  }

  function elementTracked(el) {
    var result = false;
    util.forEachAttr(editTrackers, function (TrackerClass) {
      if (TrackerClass.tracked(el)) {
        result = true;
      }
    });
    return result;
  }

  function getTracker(el, name) {
    el = $(el)[0];
    for (var i=0; i<liveTrackers.length; i++) {
      var tracker = liveTrackers[i];
      if (tracker.element[0] == el) {
        assert((! name) || name == tracker.trackerName, "Expected to map to a tracker type", name, "but got", tracker.trackerName);
        return tracker;
      }
    }
    return null;
  }

  var TEXT_TYPES = (
    "color date datetime datetime-local email " +
        "tel text time week").split(/ /g);

  function isText(el) {
    el = $(el);
    var tag = el.prop("tagName");
    var type = (el.prop("type") || "text").toLowerCase();
    if (tag == "TEXTAREA") {
      return true;
    }
    if (tag == "INPUT" && TEXT_TYPES.indexOf(type) != -1) {
      return true;
    }
    return false;
  }

  function getValue(el) {
    el = $(el);
    if (isCheckable(el)) {
      return el.prop("checked");
    } else {
      return el.val();
    }
  }

  function setValue(el, value) {
    el = $(el);
    if (isCheckable(el)) {
      el.prop("checked", value);
    } else {
      el.val(value);
    }
    eventMaker.fireChange(el);
  }

  function maybeSendUpdate(element, history) {
    var qdelta = history.queue[0];
    if (!qdelta) { return; /* nothing to send */ }
    if (qdelta.sent) { return; /* already sent */ }
    assert(qdelta.version);
    qdelta.sent = true;
    var msg = {
      type: "form-update",
      element: element,
      "server-echo": session.clientId,
      replace: {
        id: qdelta.id,
        version: qdelta.version,
        start: qdelta.start,
        del: qdelta.del,
        text: qdelta.text
      }
    };
    session.send(msg);
  }

  session.hub.on("form-update", function (msg) {
    if (! msg.sameUrl) {
      return;
    }
    var el = $(elementFinder.findElement(msg.element));
    if (msg.tracker) {
      var tracker = getTracker(el, msg.tracker);
      assert(tracker);
      inRemoteUpdate = true;
      try {
        tracker.update(msg);
      } finally {
        inRemoteUpdate = false;
      }
      return;
    }
    var text = isText(el);
    var selection;
    if (text) {
      selection = [el[0].selectionStart, el[0].selectionEnd];
    }
    var value;
    if (msg.replace) {
      var history = el.data("towtruckHistory");
      var changed = history.commit(msg.replace);
      maybeSendUpdate(msg.element, history);
      if (!changed) { return; }
      value = history.current;
    } else {
      value = msg.value;
    }
    inRemoteUpdate = true;
    try {
      setValue(el, value);
      if (text && typeof selection[0] == "number" && typeof selection[1] == "number" && msg.replace) {
        if (selection[0] > msg.replace.start) {
          if (selection[0] < msg.replace.start + msg.replace.del) {
            // selection start inside replacement
            selection[0] = msg.replace.start;
          } else {
            // selection start after replacement
            selection[0] += msg.replace.text.length - msg.replace.del;
          }
        } // otherwise selection start is before replacement (no change necessary)
        if (selection[1] > msg.replace.start) {
          if (selection[1] < msg.replace.start + msg.replace.del) {
            // end selection inside replacement
            if (selection[0] <= msg.replace.start) {
              // Since the start is before the selection, select the entire replacement
              selection[1] = msg.replace.start + msg.replace.del;
            } else {
              // Otherwise select nothing
              selection[1] = msg.replace.start;
            }
          } else {
            // end selection after replacement
            selection[1] += msg.replace.text.length - msg.replace.del;
          }
        } // otherwise selection end is before replacement
        el[0].selectionStart = selection[0];
        el[0].selectionEnd = selection[1];
      }
    } finally {
      inRemoteUpdate = false;
    }
  });

  var initSent = false;

  function sendInit() {
    initSent = true;
    var msg = {
      type: "form-init",
      pageAge: Date.now() - TowTruck.pageLoaded,
      updates: []
    };
    var els = $("textarea, input, select");
    els.each(function () {
      if (elementFinder.ignoreElement(this) || elementTracked(this)) {
        return;
      }
      var el = $(this);
      var value = getValue(el);
      var upd = {
        element: elementFinder.elementLocation(this),
        value: value
      };
      if (isText(el)) {
        var history = el.data("towtruckHistory");
        if (history) {
          upd.value = history.committed;
          upd.version = history.version;
        }
      }
      msg.updates.push(upd);
    });
    liveTrackers.forEach(function (tracker) {
      var init = tracker.makeInit();
      assert(elementFinder.findElement(init.element) == tracker.element[0]);
      msg.updates.push(init);
    });
    if (msg.updates.length) {
      session.send(msg);
    }
  }

  function setInit() {
    var els = $("textarea, input, select");
    els.each(function () {
      if (elementTracked(this)) {
        return;
      }
      if (elementFinder.ignoreElement(this)) {
        return;
      }
      var el = $(this);
      var value = getValue(el);
      el.data("towtruckHistory", ot.SimpleHistory(session.clientId, value, 1));
    });
    destroyTrackers();
    buildTrackers();
  }

  session.on("reinitialize", setInit);

  session.on("ui-ready", setInit);

  function makeDiff(oldValue, newValue) {
    assert(typeof oldValue == "string");
    assert(typeof newValue == "string");
    var commonStart = 0;
    while (commonStart < newValue.length &&
           newValue.charAt(commonStart) == oldValue.charAt(commonStart)) {
      commonStart++;
    }
    var commonEnd = 0;
    while (commonEnd < (newValue.length - commonStart) &&
           commonEnd < (oldValue.length - commonStart) &&
           newValue.charAt(newValue.length - commonEnd - 1) ==
             oldValue.charAt(oldValue.length - commonEnd - 1)) {
      commonEnd++;
    }
    var removed = oldValue.substr(commonStart, oldValue.length - commonStart - commonEnd);
    var inserted = newValue.substr(commonStart, newValue.length - commonStart - commonEnd);
    if (! (removed.length || inserted)) {
      return null;
    }
    return ot.TextReplace(commonStart, removed.length, inserted);
  }

  session.hub.on("form-init", function (msg) {
    if (! msg.sameUrl) {
      return;
    }
    if (initSent) {
      // In a 3+-peer situation more than one client may init; in this case
      // we're probably the other peer, and not the peer that needs the init
      // A quick check to see if we should init...
      var myAge = Date.now() - TowTruck.pageLoaded;
      if (msg.pageAge < myAge) {
        // We've been around longer than the other person...
        return;
      }
    }
    // FIXME: need to figure out when to ignore inits
    msg.updates.forEach(function (update) {
      var el = elementFinder.findElement(update.element);
      if (update.tracker) {
        var tracker = getTracker(el, update.tracker);
        assert(tracker);
        inRemoteUpdate = true;
        try {
          tracker.init(update, msg);
        } finally {
          inRemoteUpdate = false;
        }
      } else {
        inRemoteUpdate = true;
        try {
          setValue(el, update.value);
          if (update.version) {
            $(el).data("towtruckHistory", ot.SimpleHistory(session.clientId, update.value, update.version));
          }
        } finally {
          inRemoteUpdate = false;
        }
      }
    });
  });

  var lastFocus = null;

  function focus(event) {
    var target = event.target;
    if (target != lastFocus) {
      lastFocus = target;
      session.send({type: "form-focus", element: elementFinder.elementLocation(target)});
    }
  }

  function blur(event) {
    var target = event.target;
    if (lastFocus) {
      lastFocus = null;
      session.send({type: "form-focus", element: null});
    }
  }

  var focusElements = {};

  session.hub.on("form-focus", function (msg) {
    var current = focusElements[msg.peer.id];
    if (current) {
      current.remove();
      current = null;
    }
    if (! msg.element) {
      // A blur
      return;
    }
    var element = elementFinder.findElement(msg.element);
    focusElements[msg.peer.id] = createFocusElement(msg.peer, element);
  });

  session.hub.on("hello", function (msg) {
    if (lastFocus) {
      setTimeout(function () {
        session.send({type: "form-focus", element: elementFinder.elementLocation(lastFocus)});
      });
    }
  });

  function createFocusElement(peer, around) {
    around = $(around);
    var el = templating.sub("focus", {peer: peer});
    el = el.find(".towtruck-focus");
    var aroundOffset = around.offset();
    el.css({
      top: aroundOffset.top-FOCUS_BUFFER + "px",
      left: aroundOffset.left-FOCUS_BUFFER + "px",
      width: around.outerWidth() + (FOCUS_BUFFER*2) + "px",
      height: around.outerHeight() + (FOCUS_BUFFER*2) + "px"
    });
    $(document.body).append(el);
    return el;
  }

  session.on("ui-ready", function () {
    $(document).on("change", change);
    $(document).on("textInput keydown keyup cut paste", maybeChange);
    $(document).on("focusin", focus);
    $(document).on("focusout", blur);
  });

  session.on("close", function () {
    $(document).off("change", change);
    $(document).off("textInput keyup cut paste", maybeChange);
    $(document).off("focusin", focus);
    $(document).off("focusout", blur);
  });

  session.hub.on("hello", function (msg) {
    if (msg.sameUrl) {
      setTimeout(sendInit);
    }
  });

  return forms;
});
