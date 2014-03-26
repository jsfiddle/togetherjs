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

  function suppressSync(element) {
    var ignoreForms = TogetherJS.config.get("ignoreForms");
    if (ignoreForms === true) {
      return true;
    }
    else {
      return $(element).is(ignoreForms.join(",")); 
    }
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
    sendData({
      element: event.target,
      value: getValue(event.target)
    });
  }

  function sendData(attrs) {
    var el = $(attrs.element);
    assert(el);
    var tracker = attrs.tracker;
    var value = attrs.value;
    if (inRemoteUpdate) {
      return;
    }
    if (elementFinder.ignoreElement(el) ||
        (elementTracked(el) && !tracker) ||
        suppressSync(el)) {
      return;
    }
    var location = elementFinder.elementLocation(el);
    var msg = {
      type: "form-update",
      element: location
    };
    if (isText(el) || tracker) {
      var history = el.data("togetherjsHistory");
      if (history) {
        if (history.current == value) {
          return;
        }
        var delta = ot.TextReplace.fromChange(history.current, value);
        assert(delta);
        history.add(delta);
        maybeSendUpdate(msg.element, history, tracker);
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
      this.element = $(el)[0];
      assert($(this.element).hasClass("ace_editor"));
      this._change = this._change.bind(this);
      this._editor().document.on("change", this._change);
    },

    tracked: function (el) {
      return this.element === $(el)[0];
    },

    destroy: function (el) {
      this._editor().document.removeListener("change", this._change);
    },

    update: function (msg) {
      this._editor().document.setValue(msg.value);
    },

    init: function (update, msg) {
      this.update(update);
    },

    makeInit: function () {
      return {
        element: this.element,
        tracker: this.trackerName,
        value: this._editor().document.getValue()
      };
    },

    _editor: function () {
      return this.element.env;
    },

    _change: function (e) {
      // FIXME: I should have an internal .send() function that automatically
      // asserts !inRemoteUpdate, among other things
      if (inRemoteUpdate) {
        return;
      }
      sendData({
        tracker: this.trackerName,
        element: this.element,
        value: this.getContent()
      });
    },

    getContent: function() {
      return this._editor().document.getValue();
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
      this.element = $(el)[0];
      assert(this.element.CodeMirror);
      this._change = this._change.bind(this);
      this._editor().on("change", this._change);
    },

    tracked: function (el) {
      return this.element === $(el)[0];
    },

    destroy: function (el) {
      this._editor().off("change", this._change);
    },

    update: function (msg) {
      this._editor().setValue(msg.value);
    },

    init: function (msg) {
      if (msg.value) {
        this.update(msg);
      }
    },

    makeInit: function () {
      return {
        element: this.element,
        tracker: this.trackerName,
        value: this._editor().getValue()
      };
    },

    _change: function (editor, change) {
      if (inRemoteUpdate) {
        return;
      }
      sendData({
        tracker: this.trackerName,
        element: this.element,
        value: this.getContent()
      });
    },

    _editor: function () {
      return this.element.CodeMirror;
    },

    getContent: function() {
      return this._editor().getValue();
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

  var CKEditor = util.Class({
    trackerName: "CKEditor",

    constructor: function (el) {
      this.element = $(el)[0];
      assert(CKEDITOR);
      assert(CKEDITOR.dom.element.get(this.element));
      this._change = this._change.bind(this);
      // FIXME: change event is available since CKEditor 4.2
      this._editor().on("change", this._change);
    },
    tracked: function (el) {
      return this.element === $(el)[0];
    },
    destroy: function (el) {
      this._editor().removeListener("change", this._change);
    },

    update: function (msg) {
      //FIXME: use setHtml instead of setData to avoid frame reloading overhead
      this._editor().editable().setHtml(msg.value);
    },

    init: function (update, msg) {
      this.update(update);
    },

    makeInit: function () {
      return {
        element: this.element,
        tracker: this.trackerName,
        value: this.getContent()
      };
    },

    _change: function (e) {
      if (inRemoteUpdate) {
        return;
      }
      sendData({
        tracker: this.trackerName,
        element: this.element,
        value: this.getContent()
      });
    },

    _editor: function () {
      return CKEDITOR.dom.element.get(this.element).getEditor();
    },
    
    getContent: function () {
      return this._editor().getData();
    }
  });

  CKEditor.scan = function () {
    var result = [];
    if (typeof CKEDITOR == "undefined") {
      return;
    }
    var editorInstance;
    for (var instanceIdentifier in CKEDITOR.instances) {
      editorInstance = document.getElementById(instanceIdentifier) || document.getElementsByName(instanceIdentifier)[0];
      if (editorInstance) {
        result.push(editorInstance);
      }
    }
    return $(result);
  };

  CKEditor.tracked = function (el) {
    if (typeof CKEDITOR == "undefined") {
      return false;
    }
    el = $(el)[0];
    return !! (CKEDITOR.dom.element.get(el) && CKEDITOR.dom.element.get(el).getEditor());
  };

  TogetherJS.addTracker(CKEditor, true /* skip setInit */);

  //////////////////// BEGINNING OF TINYMCE ////////////////////////
  var tinymceEditor = util.Class({
    trackerName: "tinymceEditor",

    constructor: function (el) {
      this.element = $(el)[0];
      assert($(this.element).attr('id').indexOf('mce_') != -1);
      this._change = this._change.bind(this);
      this._editor().on("input keyup cut paste change", this._change);
    },

    tracked: function (el) {
      return this.element === $(el)[0];
    },

    destroy: function (el) {
      this._editor().destory();
    },

    update: function (msg) {
      this._editor().setContent(msg.value, {format: 'raw'});
    },

    init: function (update, msg) {
      this.update(update);
    },

    makeInit: function () {
      return {
        element: this.element,
        tracker: this.trackerName,
        value: this.getContent()
      };
    },

    _change: function (e) {
      if (inRemoteUpdate) {
        return;
      }  
      sendData({
        tracker: this.trackerName,
        element: this.element,
        value: this.getContent()
      });
    },

    _editor: function () {
      if (typeof tinymce == "undefined") {
        return;
      }
      return $(this.element).data("tinyEditor");
    },
    
    getContent: function () {
      return this._editor().getContent();
    }
  });

  tinymceEditor.scan = function () {
    //scan all the elements that contain tinyMCE editors
    if (typeof tinymce == "undefined") {
      return;
    }
    var result = [];
    $(window.tinymce.editors).each(function (i, ed) {
      result.push($('#'+ed.id));
      //its impossible to retrieve a single editor from a container, so lets store it
      $('#'+ed.id).data("tinyEditor", ed);
    });
    return $(result);
  };

  tinymceEditor.tracked = function (el) {
    if (typeof tinymce == "undefined") {
      return false;
    }
    el = $(el)[0];
    return !!$(el).data("tinyEditor");
    /*var flag = false;
    $(window.tinymce.editors).each(function (i, ed) {
      if (el.id == ed.id) {
        flag = true;
      }
    });
    return flag;*/
  };

  TogetherJS.addTracker(tinymceEditor, true);
  ///////////////// END OF TINYMCE ///////////////////////////////////

  function buildTrackers() {
    assert(! liveTrackers.length);
    util.forEachAttr(editTrackers, function (TrackerClass) {
      var els = TrackerClass.scan();
      if (els) {
        $.each(els, function () {
          var tracker = new TrackerClass(this);
          $(this).data("togetherjsHistory", ot.SimpleHistory(session.clientId, tracker.getContent(), 1));
          liveTrackers.push(tracker);
        });
      }
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
        //FIXME: assert statement below throws an exception when data is submitted to the hub too fast
        //in other words, name == tracker.trackerName instead of name == tracker when someone types too fast in the tracked editor
        //commenting out this assert statement solves the problem
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
  function maybeSendUpdate(element, history, tracker) {
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
    if (tracker) {
      msg.tracker = tracker;
    }
    session.send(msg);
  }

  session.hub.on("form-update", function (msg) {
    if (! msg.sameUrl) {
      return;
    }
    var el = $(elementFinder.findElement(msg.element));
    var tracker;
    if (msg.tracker) {
      tracker = getTracker(el, msg.tracker);
      assert(tracker);
    }
    var focusedEl = el[0].ownerDocument.activeElement;
    var focusedElSelection;
    if (isText(focusedEl)) {
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
      var trackerName = null;
      if (typeof tracker != "undefined") {
        trackerName = tracker.trackerName;
      }
      maybeSendUpdate(msg.element, history, trackerName);
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
      if(tracker) {
        tracker.update({value:value});
      } else {
        setValue(el, value);
      }
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
      assert(tracker.tracked(init.element));
      var history = $(init.element).data("togetherjsHistory");
      if (history) {
        init.value = history.committed;
        init.basis = history.basis;
      }
      init.element = elementFinder.elementLocation($(init.element));
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
        inRemoteUpdate = true;
        try {
          if (update.tracker) {
            var tracker = getTracker(el, update.tracker);
            assert(tracker);
            tracker.init(update, msg);
          } else {
            setValue(el, update.value);
          }
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
