/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["jquery", "util", "session", "elementFinder", "eventMaker", "templating", "ot", "peers"], function ($, util, session, elementFinder, eventMaker, templating, ot, peers) {
  var forms = util.Module("forms");
  var assert = util.assert;

  // This is how much larger the focus element is than the element it surrounds
  // (this is padding on each side)
  var FOCUS_BUFFER = 5;

  var inRemoteUpdate = false;

  function suppressSync(element) {
    return $(element).is(":password");
  }

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
    if (elementFinder.ignoreElement(event.target) || elementTracked(event.target) ||
        suppressSync(event.target)) {
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
      var history = el.data("togetherjsHistory");
      if (history) {
        if (history.current == value) {
          return;
        }
        var delta = ot.TextReplace.fromChange(history.current, value);
        assert(delta);
        history.add(delta);
        maybeSendUpdate(msg.element, history);
        return;
      } else {
        msg.value = value;
        msg.basis = 1;
        el.data("togetherjsHistory", ot.SimpleHistory(session.clientId, value, 1));
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

  TogetherJS.addTracker = function (TrackerClass, skipSetInit) {
    assert(typeof TrackerClass === "function", "You must pass in a class");
    assert(typeof TrackerClass.prototype.trackerName === "string",
           "Needs a .prototype.trackerName string");
    // Test for required instance methods.
    "destroy update init makeInit tracked".split(/ /).forEach(function(m) {
      assert(typeof TrackerClass.prototype[m] === "function",
             "Missing required tracker method: "+m);
    });
    // Test for required class methods.
    "scan tracked".split(/ /).forEach(function(m) {
      assert(typeof TrackerClass[m] === "function",
             "Missing required tracker class method: "+m);
    });
    editTrackers[TrackerClass.prototype.trackerName] = TrackerClass;
    if (!skipSetInit) {
      setInit();
    }
  };

  var AceEditor = util.Class({

    trackerName: "AceEditor",

    constructor: function (el) {
      this.element = $(el);
      assert(this.element.hasClass("ace_editor"));
      this.cursorMarkers= {};
      this._change = this._change.bind(this);
      this._editor().document.on("change", this._change);
      this._changeSelection = this._changeSelection.bind(this);
      this._syncCursor = ace.require("ace/lib/lang").delayedCall(this._changeSelection);
      this._delayedChangeSelection = this._delayedChangeSelection.bind(this);
      this._editor().editor.on("changeSelection", this._delayedChangeSelection);
      //changeSelection doesn't fire when a user presses Esc to leave the multi-select
      //mode, so we need this extra event listener
      this._editor().editor.selection.on("singleSelect", this._delayedChangeSelection);
      
      this.peerUpdate = this.peerUpdate.bind(this);
      peers.on("new-peer identity-updated status-updated url-updated idle-updated", this.peerUpdate);
    },

    tracked: function (el) {
      return this.element[0] === el;
    },

    destroy: function (el) {
      this._editor().document.removeListener("change", this._change);
      this._editor().editor.off("changeSelection", this._changeSelection);
      peers.off("new-peer identity-updated status-updated url-updated idle-updated", this.peerUpdate);
    },

    update: function (msg) {
      if (msg.value) {
        this.init(msg);
        return;
      }
      if(msg.hasOwnProperty('delta')) {
        this._editor().document.getDocument().applyDeltas([msg.delta]);
      }
      if(msg.hasOwnProperty('cursors')) {
        this.updateCursorMarker(msg);
      }
    },

    peerUpdate: function (peer) {
      //status-updated
      if (peer.status=='bye') {
        this.peerBye(peer);
        return;
      }
      //new-peer, identity-updated, url-updated, idle-updated
      if( this.cursorMarkers.hasOwnProperty(peer.id)) {
        var msg = {
          peer: peer,
          cursors: this.cursorMarkers[peer.id].cursors
        };
        this.updateCursorMarker(msg);
      }
    },

    peerBye: function (peer) {
      if ( this.cursorMarkers.hasOwnProperty(peer.id)) {
        var oldMarkers = this.cursorMarkers[peer.id].markers;
        oldMarkers.forEach(function(markerId){
          this._editor()
            .document
            .removeMarker(markerId);
        }, this);
        delete this.cursorMarkers[peer.id];
      }
    },

    updateCursorMarker: function (msg) {
      if (msg === undefined) {
        return;
      }
      if ( this.cursorMarkers.hasOwnProperty(msg.peer.id)) {
        var oldMarkers = this.cursorMarkers[msg.peer.id].markers;
        oldMarkers.forEach(function(markerId){
          this._editor()
            .document
            .removeMarker(markerId);
        }, this);
      }
      var markers = msg.cursors.map(function(cursor) {
        var Range = ace.require('ace/range').Range;
        var range = new Range(cursor.row, cursor.column,
                              cursor.row, cursor.column + 1);

        var markerId = this._editor()
          .document
          .addMarker(range, "ace_selection", drawMarker, false);
        return markerId;
      }, this);
      this.cursorMarkers[msg.peer.id] = {
        markers:markers,
        cursors:msg.cursors
      };
      function drawMarker(stringBuilder, range, left, top, config) {
        var color = "background-color:"+ msg.peer.color;
        var opacity = (msg.peer.url != session.currentUrl() || msg.peer.idle=="inactive") ? 0.5 : 1;
        stringBuilder.push("<div class='ace_selection' style='", "opacity:", opacity, ";", "left:", left, "px;", "top:", top + 5, "px;", "height:", config.lineHeight - 5, "px;", "width:", 2, "px;", color || "", "'></div>", "<div class='ace_selection' style='", "opacity:", opacity, ";", "left:", left - 2, "px;", "top:", top, "px;", "height:", 5, "px;", "width:", 6, "px;", color || "", "'></div>");
      }
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

    _change: function (e, document) {
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
    },

    _changeSelection: function () {
      // FIXME: I should have an internal .send() function that automatically
      // asserts !inRemoteUpdate, among other things
      if (inRemoteUpdate) {
        return;
      }
      var selection = this._editor().document.getSelection();
      var cursors = [];
      if (selection.inMultiSelectMode) {
        cursors = selection.getAllRanges().map(function(range) {return range.cursor; }); 
      } else {
        cursors.push(selection.getCursor());
      }
      session.send({
        type: "form-update",
        tracker: this.trackerName,
        element: elementFinder.elementLocation(this.element),
        cursors: cursors
      });
    },

    _delayedChangeSelection: function(){
      this._syncCursor.delay(50);
    }
  });

  AceEditor.scan = function () {
    return $(".ace_editor");
  };

  AceEditor.tracked = function (el) {
    return !! $(el).closest(".ace_editor").length;
  };

  TogetherJS.addTracker(AceEditor, true /* skip setInit */);

  var CodeMirrorEditor = util.Class({
    trackerName: "CodeMirrorEditor",

    constructor: function (el) {
      this.element = $(el);
      assert(this.element[0].CodeMirror);
      this._change = this._change.bind(this);
      this._editor().on("change", this._change);
    },

    tracked: function (el) {
      return this.element[0] === el;
    },

    destroy: function (el) {
      this._editor().off("change", this._change);
    },

    update: function (msg) {
      if (msg.value) {
        this.init(msg);
        return;
      }
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
      if (Array.isArray(change.text)) {
        // This seems to be version-specific with CodeMirror, but sometimes
        // the text is an array of lines.
        change.text = change.text.join("\n");
      }
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

  TogetherJS.addTracker(CodeMirrorEditor, true /* skip setInit */);

  function buildTrackers() {
    assert(! liveTrackers.length);
    util.forEachAttr(editTrackers, function (TrackerClass) {
      var els = TrackerClass.scan();
      $.each(els, function () {
        liveTrackers.push(new TrackerClass(this));
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
      if (tracker.tracked(el)) {
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

  function getElementType(el) {
    el = $(el)[0];
    if (el.tagName == "TEXTAREA") {
      return "textarea";
    }
    if (el.tagName == "SELECT") {
      return "select";
    }
    if (el.tagName == "INPUT") {
      return (el.getAttribute("type") || "text").toLowerCase();
    }
    return "?";
  }

  function setValue(el, value) {
    el = $(el);
    var changed = false;
    if (isCheckable(el)) {
      var checked = !! el.prop("checked");
      value = !! value;
      if (checked != value) {
        changed = true;
        el.prop("checked", value);
      }
    } else {
      if (el.val() != value) {
        changed = true;
        el.val(value);
      }
    }
    if (changed) {
      eventMaker.fireChange(el);
    }
  }

  /* Send the top of this history queue, if it hasn't been already sent. */
  function maybeSendUpdate(element, history) {
    var change = history.getNextToSend();
    if (! change) {
      /* nothing to send */
      return;
    }
    var msg = {
      type: "form-update",
      element: element,
      "server-echo": true,
      replace: {
        id: change.id,
        basis: change.basis,
        delta: {
          start: change.delta.start,
          del: change.delta.del,
          text: change.delta.text
        }
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
    var focusedEl = el[0].ownerDocument.activeElement;
    var focusedElSelection;
    if(isText(focusedEl)) {
      focusedElSelection = [focusedEl.selectionStart, focusedEl.selectionEnd];
    }
    var selection;
    if (isText(el)) {
      selection = [el[0].selectionStart, el[0].selectionEnd];
    }
    var value;
    if (msg.replace) {
      var history = el.data("togetherjsHistory");
      if (!history) {
        console.warn("form update received for uninitialized form element");
        return;
      }
      history.setSelection(selection);
      // make a real TextReplace object.
      msg.replace.delta = ot.TextReplace(msg.replace.delta.start,
                                         msg.replace.delta.del,
                                         msg.replace.delta.text);
      // apply this change to the history
      var changed = history.commit(msg.replace);
      maybeSendUpdate(msg.element, history);
      if (! changed) {
        return;
      }
      value = history.current;
      selection = history.getSelection();
    } else {
      value = msg.value;
    }
    inRemoteUpdate = true;
    try {
      setValue(el, value);
      if (isText(el)) {
        el[0].selectionStart = selection[0];
        el[0].selectionEnd = selection[1];
      }
      // return focus to original input:
      if (focusedEl != el[0]) {
        focusedEl.focus();
        if (isText(focusedEl)) {
          focusedEl.selectionStart = focusedElSelection[0];
          focusedEl.selectionEnd = focusedElSelection[1];
        }
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
      pageAge: Date.now() - TogetherJS.pageLoaded,
      updates: []
    };
    var els = $("textarea, input, select");
    els.each(function () {
      if (elementFinder.ignoreElement(this) || elementTracked(this) ||
          suppressSync(this)) {
        return;
      }
      var el = $(this);
      var value = getValue(el);
      var upd = {
        element: elementFinder.elementLocation(this),
        value: value,
        elementType: getElementType(el)
      };
      if (isText(el)) {
        var history = el.data("togetherjsHistory");
        if (history) {
          upd.value = history.committed;
          upd.basis = history.basis;
        }
      }
      msg.updates.push(upd);
    });
    liveTrackers.forEach(function (tracker) {
      var init = tracker.makeInit();
      assert(tracker.tracked(elementFinder.findElement(init.element)));
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
      el.data("togetherjsHistory", ot.SimpleHistory(session.clientId, value, 1));
    });
    destroyTrackers();
    buildTrackers();
  }

  session.on("reinitialize", setInit);

  session.on("ui-ready", setInit);

  session.on("close", destroyTrackers);

  session.hub.on("form-init", function (msg) {
    if (! msg.sameUrl) {
      return;
    }
    if (initSent) {
      // In a 3+-peer situation more than one client may init; in this case
      // we're probably the other peer, and not the peer that needs the init
      // A quick check to see if we should init...
      var myAge = Date.now() - TogetherJS.pageLoaded;
      if (msg.pageAge < myAge) {
        // We've been around longer than the other person...
        return;
      }
    }
    // FIXME: need to figure out when to ignore inits
    msg.updates.forEach(function (update) {
      var el;
      try {
        el = elementFinder.findElement(update.element);
      } catch (e) {
        /* skip missing element */
        console.warn(e);
        return;
      }
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
          if (update.basis) {
            var history = $(el).data("togetherjsHistory");
            // don't overwrite history if we're already up to date
            // (we might have outstanding queued changes we don't want to lose)
            if (!(history && history.basis === update.basis &&
                  // if history.basis is 1, the form could have lingering
                  // edits from before togetherjs was launched.  that's too bad,
                  // we need to erase them to resynchronize with the peer
                  // we just asked to join.
                  history.basis !== 1)) {
              $(el).data("togetherjsHistory", ot.SimpleHistory(session.clientId, update.value, update.basis));
            }
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
    if (elementFinder.ignoreElement(target) || elementTracked(target)) {
      blur(event);
      return;
    }
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
    var el = createFocusElement(msg.peer, element);
    if (el) {
      focusElements[msg.peer.id] = el;
    }
  });

  session.hub.on("hello", function (msg) {
    if (lastFocus) {
      setTimeout(function () {
        if (lastFocus) {
          session.send({type: "form-focus", element: elementFinder.elementLocation(lastFocus)});
        }
      });
    }
  });

  function createFocusElement(peer, around) {
    around = $(around);
    var aroundOffset = around.offset();
    if (! aroundOffset) {
      console.warn("Could not get offset of element:", around[0]);
      return null;
    }
    var el = templating.sub("focus", {peer: peer});
    el = el.find(".togetherjs-focus");
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
    // note that textInput, keydown, and keypress aren't appropriate events
    // to watch, since they fire *before* the element's value changes.
    $(document).on("input keyup cut paste", maybeChange);
    $(document).on("focusin", focus);
    $(document).on("focusout", blur);
  });

  session.on("close", function () {
    $(document).off("change", change);
    $(document).off("input keyup cut paste", maybeChange);
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
