(function () {function init(Walkabout) {

Walkabout = Walkabout || {};

// FIXME: this shouldn't be established so early, in case jquery
// is loaded after walkabout.js
Walkabout.jQueryAvailable = (typeof jQuery !== "undefined");
Walkabout.$ = window.jQuery;

// Actions must turn this on in order to patch .value/.val():
Walkabout.inTesting = false;

// These are events that we don't need to fire directly:
Walkabout.ignoreEvents = {
  hashchange: true
};

Walkabout.options = {
  anyLocalLinks: false,
  loadPersistent: false
};

Walkabout.setInTesting = function setInTesting(func, time) {
  return function run() {
    time = time || 0;
    var id = setInTesting.count++;
    Walkabout.inTesting = id;
    var result;
    try {
      result = func.apply(this, arguments);
    } catch (e) {
      if (Walkabout.inTesting == id) {
        Walkabout.inTesting = false;
      }
      throw e;
    }
    if (time == -1) {
      if (Walkabout.inTesting == id) {
        Walkabout.inTesting = false;
      }
    } else {
      setTimeout(function () {
        if (Walkabout.inTesting == id) {
          Walkabout.inTesting = false;
        }
      }, time);
    }
    return result;
  };
};

Walkabout.setInTesting.count = 1;

/****************************************
 * Utility functions:
 */

Walkabout._extend = function (obj, props) {
  for (var a in props) {
    if (! props.hasOwnProperty(a)) {
      continue;
    }
    obj[a] = props[a];
  }
};

Walkabout.Class = function Class(prototype) {
  return function () {
    var obj = Object.create(prototype);
    prototype.constructor.apply(obj, arguments);
    return obj;
  };
};

/****************************************
 * Actions
 */

Walkabout.actionFinders = [];

Walkabout.findActions = function (el, actions) {
  el = el || document;
  actions = actions || new Walkabout.Actions();
  if (! (Array.isArray(el) ||
         (Walkabout.jQueryAvailable && el instanceof Walkabout.$))) {
    el = [el];
  }
  for (var i=0; i<el.length; i++) {
    for (var j=0; j<Walkabout.actionFinders.length; j++) {
      var finder = Walkabout.actionFinders[j];
      finder(el[i], actions);
    }
  }
  return actions;
};

Walkabout.ignoreElement = function (el) {
  // FIXME: should probably make this pluggable as well
  // Also, I should unjQueryfy .is(":visible") and put it here
  while (el) {
    if (el.getAttribute && el.getAttribute("data-walkabout-disable")) {
      return true;
    }
    el = el.parentNode;
  }
  return false;
};

Walkabout.DEFAULT_TIMES = 100;

Walkabout.runManyActions = function runManyActions(options) {
  options = options || {};
  var el = options.element || document;
  var speed = options.speed || 100;
  var whileTrue = options.whileTrue || null;
  var ondone = options.ondone;
  var onstatus = options.onstatus;
  var cancelled = false;
  var totalTimes = options.times;
  var remaining;
  function cancel() {
    cancelled = true;
  }
  if ((! whileTrue) && ! totalTimes) {
    totalTimes = Walkabout.DEFAULT_TIMES;
  }
  if (options.startAtRemaining) {
    remaining = options.startAtRemaining;
  } else {
    remaining = totalTimes;
  }
  function runOnce() {
    var doAgain = ! cancelled;
    if (whileTrue && (! whileTrue())) {
      doAgain = false;
    }
    if (totalTimes !== undefined && remaining <= 0) {
      doAgain = false;
    }
    if (doAgain) {
      setTimeout(runOnce, speed);
    }
    if (totalTimes !== undefined) {
      remaining--;
    }
    var actions = Walkabout.findActions(el);
    var action = actions.pick();
    if (onstatus) {
      onstatus({
        actions: actions,
        action: action,
        times: totalTimes,
        remaining: remaining
      });
    }
    if ((! doAgain) && ondone) {
      ondone();
      return;
    }
    if (action) {
      action.run();
    }
  }
  setTimeout(runOnce, speed);
  return cancel;
};

Walkabout.persistentData = function (value) {
  var key = "walkabout.runstate";
  if (value === undefined) {
    value = localStorage.getItem(key);
    if (value) {
      value = JSON.parse(value);
    } else {
      value = {};
    }
    return value;
  }
  if (value === null) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
  return value;
};

Walkabout.actionFinders.push(function findAnchors(el, actions) {
  var els = el.querySelectorAll("a");
  for (var i=-1; i<els.length; i++) {
    var anchor = i == -1 ? el : els[i];
    if (anchor.tagName != "A" ||
        Walkabout.ignoreElement(anchor)) {
      continue;
    }
    if (actions.matchingAction("click", anchor)) {
      continue;
    }
    if (! Walkabout.clickable(anchor)) {
      continue;
    }
    var href;
    if (Walkabout.options.anyLocalLinks) {
      href = anchor.href;
      var here = location.protocol + "//" + location.host;
      if (typeof Walkabout.options.anyLocalLinks == "string") {
        if (Walkabout.options.anyLocalLinks.indexOf("/") !== 0) {
          here += "/";
        }
        here += Walkabout.options.anyLocalLinks;
      }
      if (href.indexOf(here) !== 0) {
        continue;
      }
    } else {
      href = anchor.getAttribute("href");
      if ((! href) || href.indexOf("#") !== 0) {
        continue;
      }
    }
    actions.push(Walkabout.LinkFollower({
      element: anchor,
      type: "click"
    }));
  }
});

Walkabout.actionFinders.push(function findEdits(el, actions) {
  var children = el.getElementsByTagName("*");
  for (var i=-1; i<children.length; i++) {
    var e = i == -1 ? el : children[i];
    var attr = e.getAttribute && e.getAttribute("data-walkabout-edit-value");
    if (attr) {
      var types = attr.split(/ /g);
      for (var j=0; j<types.length; j++) {
        var type = types[j];
        if (type == "type") {
          actions.push(Walkabout.Typer(e, "type"));
        } else if (type == "paste") {
          actions.push(Walkabout.Typer(e, "paste"));
        } else if (type == "delete") {
          if (e.value) {
            actions.push(Walkabout.Deleter(e));
          }
        } else if (type == "move") {
          if (e.value) {
            actions.push(Walkabout.Mover(e));
          }
        //} else if (type == "change") {
        //  actions.push(Walkabout.Changer(e));
        } else if (type) {
          console.warn('Unexpected data-walkabout-edit-value="' + type + '"');
        }
      }
    }
  }
});

Walkabout.Typer = Walkabout.Class({
  constructor: function Typer(element, kind) {
    this.element = element;
    this.kind = kind;
  },

  show: function () {
    return Walkabout.Highlighter(this.element, "type");
  },

  description: function () {
    return (this.kind == "type" ? "Type" : "Paste") +
      " into " + Walkabout.elementDescription(this.element);
  },

  run: Walkabout.setInTesting(function () {
    var e = this.element;
    var value = e.value;
    // First we save the location of the cursor:
    e.focus();
    var startPos = e.selectionStart;
    var endPos = e.selectionEnd;
    var r = Walkabout.random;
    var length = 1;
    if (this.kind == "paste") {
      length = Math.floor(r() * 20);
    }
    var key = r.string(r.letters + r.numbers + r.punctuation + r.whitespace, length);
    var start = value.substr(0, startPos);
    var end = value.substr(endPos);
    e.value = start + key + end;
    // If we had a selection, we lost when typing:
    e.selectionStart = e.selectionEnd = startPos + key.length;
    // FIXME: should probably also do keydown, keypress, in sequence
    // FIXME: should set the right keyCode/etc value
    var keyup = Walkabout.EventAction({
      element: e,
      type: this.kind == "type" ? "keyup" : "paste",
      handler: null, // FIXME: figure out if there's a handler?
      jQuery: Walkabout.jQueryAvailable
    });
    keyup.run();
  })

});

Walkabout.Deleter = Walkabout.Class({
  constructor: function Deleter(element) {
    this.element = element;
  },

  show: function () {
    return Walkabout.Highlighter(this.element, "delete from");
  },

  description: function () {
    return "Delete from " + Walkabout.elementDescription(this.element);
  },

  run: Walkabout.setInTesting(function () {
    var length;
    var e = this.element;
    var value = e.value;
    e.focus();
    var startPos = e.selectionStart;
    var endPos = e.selectionEnd;
    if (startPos != endPos) {
      // If there's a selection, delete that...
      e.value = value.substr(0, startPos) + value.substr(endPos);
      e.selectionStart = e.selectionEnd = startPos;
    } else {
      // We can delete after or before...
      var canStart = startPos > 0;
      // FIXME: I'm off by one here I think:
      var canEnd = startPos < value.length;
      if (canStart && canEnd && Walkabout.random() < 0.5) {
        canStart = false;
      }
      if (canStart) {
        length = Math.floor(Walkabout.random() * startPos);
        e.value = value.substr(0, startPos - length) + value.substr(startPos);
        e.selectionStart = e.selectionEnd = startPos - length;
      } else {
        length = Math.floor(Walkabout.random() * (value.length - startPos));
        e.value = value.substr(0, startPos) + value.substr(startPos + length);
        e.selectionStart = e.selectionEnd = startPos;
      }
    }
    // FIXME: should set the right keyCode/etc value:
    // FIXME: also keydown?  Or keypress?
    var keyup = Walkabout.EventAction({
      element: e,
      type: "keyup",
      handler: null, // FIXME: figure out if there's a handler?
      jQuery: Walkabout.jQuerySupported
    });
    keyup.run();
  })
});

Walkabout.Mover = Walkabout.Class({
  constructor: function Mover(element) {
    this.element = element;
  },

  show: function () {
    return Walkabout.Highlighter(this.element, "move cursor");
  },

  description: function () {
    return "Move cursor in " + Walkabout.elementDescription(this.element);
  },

  run: Walkabout.setInTesting(function () {
    var e = this.element;
    var value = e.value;
    e.focus();
    var pos = Math.floor(Walkabout.random() * value.length);
    e.selectionStart = e.selectionEnd = pos;
  })
});


/****************************************
 * jQuery support:
 */

if (Walkabout.jQueryAvailable) {

  Walkabout.$.fn.bindKey = function (matcher, arg1, arg2, arg3) {
    var callback = arg3 || arg2 || arg1;
    function handler(event) {
      if (matcher.which) {
        if (typeof matcher.which == "number" && event.which != matcher.which) {
          return;
        }
        if (typeof matcher.which == "object" && typeof matcher.which.length == "number") {
          if (matcher.which.indexOf(event.which) == -1) {
            return;
          }
        }
      }
      // FIXME: I think this only makes sense for keypress
      if ((matcher.shiftKey && ! event.shiftKey) ||
          (matcher.ctrlKey && ! event.ctrlKey) ||
          (matcher.altKey && ! event.altKey)) {
        return;
      }
      callback.call(this, event);
    }
    matcher.type = matcher.type || "keypress";
    handler.matcher = matcher;
    handler.element = this;
    handler.runEvent = function () {
      var key = this.matcher.which;
      if (typeof key == "object" && typeof key.length == "number") {
        key = Walkabout.random.pick(key);
      }
      var event = Walkabout.$.Event(matcher.type);
      event.which = key;
      this.element.trigger(event);
    };
    var args = [matcher.type];
    if (arg2) {
      args.push(arg1);
    }
    if (arg3) {
      args.push(arg2);
    }
    args.push(handler);
    this.on.apply(this, args);
  };

  Walkabout.actionFinders.push(function jQueryHandlers(el, actions) {
    var els = Walkabout.$(el).find("*");
    els.push(el);
    els.each(function () {
      if (Walkabout.ignoreElement(this)) {
        return;
      }
      if (! Walkabout.clickable(this)) {
        // FIXME: not sure if this is right for all kinds of events, or just click?
        return;
      }
      var events;
      if (Walkabout.$._data) {
        // This is for jQuery 1.8+
        events = Walkabout.$._data(this, "events");
      } else {
        // For older versions
        events = Walkabout.$(this).data("events");
      }
      if (! events) {
        return;
      }
      for (var eventName in events) {
        if ((! events.hasOwnProperty(eventName)) || Walkabout.ignoreEvents[eventName]) {
          continue;
        }
        for (var i=0; i<events[eventName].length; i++) {
          var event = events[eventName][i];
          var els = [this];
          if (event.selector) {
            els = Walkabout.$(this).find(event.selector);
          }
          for (var j=0; j<els.length; j++) {
            var action = Walkabout.EventAction({
              element: els[j],
              type: eventName,
              handler: event.handler,
              jQuery: true
            });
            // Prefer the jQuery form of the action
            var existing = actions.matchingAction(eventName, els[j]);
            if (existing) {
              actions.replaceAction(existing, action);
            } else {
              actions.push(action);
            }
          }
        }
      }
    });
  });

  Walkabout.$.fn.val.patch = function () {
    Walkabout.$.fn.val = Walkabout.$.fn.val.mock;
  };

  Walkabout.$.fn.val.mock = function () {
    if ((! Walkabout.inTesting) || this.attr("type") == "hidden") {
      return Walkabout.$.fn.val.mock.orig.apply(this, arguments);
    }
    var options = this.attr("data-walkabout-options");
    if (options) {
      options = eval("(" + options + ")");
    } else {
      options = Walkabout.random.letters;
    }
    if (Array.isArray(options)) {
      return Walkabout.random.pick(options);
    } else if (typeof options == "function") {
      return options(this);
    } else if (typeof options == "string") {
      var size = parseInt(this.attr("size") || 10, 10);
      size = Math.floor(Walkabout.random() * size);
      return Walkabout.random.string(options, size);
    } else {
      // FIXME: what then?  E.g., if it's an object
      return Walkabout.$.fn.val.mock.orig.apply(this, arguments);
    }
  };

  Walkabout.$.fn.val.mock.patch = function () {
    // Already patched
  };

  Walkabout.$.fn.val.mock.unpatch = function () {
    Walkabout.$.fn.val = jQuery.fn.val.mock.orig;
  };

  Walkabout.$.fn.val.mock.orig = Walkabout.$.fn.val;
  Walkabout.$.fn.val.mock.mock = Walkabout.$.fn.val.mock;

  Walkabout.$.fn.findActions = function () {
    return Walkabout.findActions(this);
  };

}


/****************************************
 * Action implementations:
 */

Walkabout.Highlighter = Walkabout.Class({
  constructor: function (element, text) {
    this.element = element;
    this.text = text;
    this.show();
  },

  OUTER: 8,

  sizeOffsets: [-2, 0, 2],
  sizeOffsetIndex: 0,

  show: function () {
    var box = this.element.getBoundingClientRect();
    var middleX = Math.floor((box.left + box.right) / 2);
    var middleY = Math.floor((box.top + box.bottom) / 2);
    var h = document.createElement("div");
    // This is an attempt to make
    outer = this.OUTER + this.sizeOffsets[this.sizeOffsetIndex];
    var newSize = this.sizeOffsetIndex++;
    if (newSize >= this.sizeOffsets.length) {
      newSize = 0;
    }
    Walkabout.Highlighter.prototype.sizeOffsetIndex = newSize;
    var outer = this.OUTER + Math.floor(Math.random() * 4);
    h.style.position = "absolute";
    h.style.zIndex = 1000;
    h.style.border = "2px dotted #f00";
    h.style.borderRadius = outer + "px";
    h.style.left = middleX + "px";
    h.style.top = middleY + "px";
    h.style.marginTop = (-box.height/2 - (outer/2)) + "px";
    h.style.marginLeft = (-box.width/2 - (outer/2)) + "px";
    h.style.width = (box.width + outer) + "px";
    h.style.height = (box.height + outer) + "px";
    h.style.textAlign = "center";
    //h.style.verticalAlign = "center";
    h.setAttribute("data-walkabout-disable", "1");
    h.appendChild(document.createTextNode(this.text));
    h.addEventListener("click", this.remove.bind(this), false);
    document.body.appendChild(h);
    this.highlightElement = h;
  },

  remove: function () {
    var h = this.highlightElement;
    if (h) {
      h.parentNode.removeChild(h);
      this.highlightElement = null;
    }
  }

});

Walkabout.Notifier = Walkabout.Class({

  constructor: function (message) {
    this.message = message;
    this.show();
  },

  container: function () {
    var id = "walkabout-notifier-container";
    var el = document.getElementById(id);
    if (el) {
      return el;
    }
    el = document.createElement("div");
    el.id = id;
    el.setAttribute("style", Walkabout.UI.prototype.styles.panel);
    el.style.right = "";
    el.style.left = "10px";
    el.setAttribute("data-walkabout-disable", "1");
    document.body.append(el);
    return el;
  },

  show: function () {
    var c = this.container();
    var el = document.createElement("div");
    el.appendChild(document.createTextNode(this.message));
    el.addEventListener("click", (function () {
      this.remove();
    }).bind(this));
    c.appendChild(el);
    this._element = el;
  },

  remove: function () {
    var el = this._element;
    if (! el) {
      return;
    }
    var parent = el.parentNode;
    parent.removeChild(el);
    if (! parent.childNodes.length) {
      parent.parentNode.removeChild(parent);
    }
  }

});

Walkabout.elementDescription = function (el, isJQuery) {
  var name;
  if (el.id) {
    name = el.tagName.toLowerCase() + "#" + el.id;
  } else {
    name = el.tagName.toLowerCase();
    var all = document.getElementsByTagName(name);
    for (var i=0; i<all.length; i++) {
      if (all[i] == el) {
        name += "[" + i + "]";
        break;
      }
    }
    if (el.className) {
      name += "." + el.className.replace(/\s+/, ".");
    }
  }
  if (isJQuery) {
    name = '$("' + name + '")';
  }
  return name;
};

Walkabout.EventAction = Walkabout.Class({

  constructor: function EventAction(event) {
    this.element = event.element;
    this.type = event.type;
    this.handler = event.handler;
    this.options = event.options || {};
    this.jQuery = !! event.jQuery;
  },

  show: function () {
    var name = this.type;
    if (this.jQuery) {
      name = '$.' + this.type + '()';
    }
    return Walkabout.Highlighter(this.element, name);
  },

  description: function () {
    var s;
    var elName = Walkabout.elementDescription(this.element, this.jQuery);
    if (this.jQuery) {
      s = elName + "." + this.type + "()";
    } else {
      s = "Fire " + this.type + " on " + elName;
    }
    return s;
  },

  run: Walkabout.setInTesting(function run() {
    var event;
    var props = this.eventProperties();
    if (props.before == "randomValue") {
      if (Walkabout.jQueryAvailable) {
        Walkabout.$(this.element).val(Walkabout.value(this.element));
      } else {
        this.element.value = Walkabout.value(this.element);
      }
    }
    if (this.handler && this.handler.runEvent) {
      this.handler.runEvent();
    } else if (Walkabout.jQueryAvailable) {
      event = Walkabout.$.Event(this.type);
      Walkabout._extend(event, props);
      if ((this.type == "keyup" || this.type == "keydown" || this.type == "keypress") &&
          (! event.which)) {
        var normalKeys = [13, 9, 32];
        if (Walkabout.random() > 0.4) {
          event.which = Walkabout.random.pick(normalKeys);
        } else {
          event.which = Math.floor(Walkabout.random() * 256);
        }
        event.keyCode = event.which;
      }
      Walkabout.$(this.element).trigger(event);
    } else {
      var module = Walkabout._getEventModule(this.type);
      event = document.createEvent(module);
      if (module == "UIEvents") {
        event.initUIEvent(
          this.type,
          props.get("canBubble", true), // canBubble
          props.get("cancelable", true), // cancelable
          window, // view
          props.get("detail", 0) // detail
        );
      } else if (module == "MouseEvents" || module == "MouseEvent") {
        event.initMouseEvent(
          this.type,
          props.get("canBubble", true), // canBubble
          props.get("cancelable", true), // cancelable
          window, // view
          props.get("detail", 0), // detail
          props.get("screenX", 0), // screenX
          props.get("screenY", 0), // screenY
          props.get("clientX", 0), // clientX
          props.get("clientY", 0), // clientY
          props.get("ctrlKey", false), // ctrlKey
          props.get("altKey", false), // altKey
          props.get("shiftKey", false), // shiftKey
          props.get("metaKey", false), // metaKey
          props.get("button", 0), // button
          props.get("relatedTarget", null) // relatedTarget
        );
      } else if (module == "HTMLEvents") {
        event.initEvent(
          this.type,
          props.get("canBubble", false), // canBubble
          props.get("cancelable", false) // cancelable
        );
      } else if (module == "KeyboardEvents" || module == "KeyboardEvent") {
        var keyCode = props.get("keyCode", props.get("which", props.get("charCode", null)));
        var charCode = null;
        if (typeof keyCode == "string") {
          charCode = keyCode;
          keyCode = charCode.charCodeAt(0);
        }
        if (! keyCode) {
          keyCode = Math.floor(Walkabout.random() * 256);
        }
        if (! charCode) {
          charCode = String.fromCharCode(keyCode);
        }
        if (event.initKeyEvent) {
          event.initKeyEvent(
            this.type,
            props.get("canBubble", true), // canBubble
            props.get("cancelable", true), // cancelable
            window, // window
            props.get("ctrlKey", false), // ctrlKey
            props.get("altKey", false), // altKey
            props.get("shiftKey", false), // shiftKey
            props.get("metaKey", false), // metaKey
            keyCode, // keyCode/which
            charCode // charCode
          );
        } else {
          // initKeyboardEvent seems pretty broken
          event = {
            type: this.type,
            target: this.element,
            altKey: props.get("altKey", false),
            "char": charCode,
            ctrlKey: props.get("ctrlKey", false),
            keyCode: keyCode,
            locale: "",
            location: props.get("location", 0),
            metaKey: props.get("metaKey", false),
            repeat: props.get("repeat", false),
            shiftKey: props.get("shiftKey", false),
            which: keyCode,
            isDefaultPrevented: false,
            preventDefault: function () {
              this.isDefaultPrevented = true;
            },
            stopPropagation: function () {
              // FIXME: not sure what to do here
            }
          };
          this.handler(event);
          // FIXME: pay attention to isDefaultPrevented?
          // FIXME: do default?
          return;
          /*
          FIXME: this is broken on Chrome:

          var mods = [];
          if (props.ctrlKey) {
            mods.push("Control");
          }
          if (props.altKey) {
            mods.push("Alt");
          }
          if (props.shiftKey) {
            mods.push("Shift");
          }
          if (props.metaKey) {
            mods.push("Meta");
          }
          mods = mods.join(" ") || null;
          event.initKeyboardEvent(
            this.event.type,
            props.get("canBubble", true), // canBubble
            props.get("cancelable", true), // cancelable
            window,
            'Enter',
            0, // location? http://msdn.microsoft.com/en-us/library/ie/ff974894(v=vs.85).aspx
            mods, // modifer keys
            props.get("repeat", false), // repeat
            null // locale
          );
          */
        }
      } else {
        console.warn("Unknown method type/module:", module, this.type);
      }
      Walkabout._extend(event, props);
      this.element.dispatchEvent(event);
    }
  }),

  eventProperties: function () {
    var attrs = this.element.attributes;
    var attrName = "data-walkabout-" + this.type;
    var result = Object.create(this._eventPropsPrototype);
    if (! attrs) {
      return result;
    }
    for (var i=0; i<attrs.length; i++) {
      if (attrs[i].name == attrName) {
        var data;
        try {
          data = JSON.parse(attrs[i].value);
        } catch (e) {
        }
        if (data === undefined) {
          try {
            data = eval("(" + attrs[i].value + ")");
          } catch (e) {
            console.warn("Bad attribute", attrs[i].name, JSON.stringify(attrs[i].value));
            continue;
          }
        }
        Walkabout._extend(result, data);
      }
    }
    return result;
  },

  _eventPropsPrototype: {
    get: function (name, default_) {
      if (this.hasOwnProperty(name)) {
        return this[name];
      } else {
        return default_;
      }
    }
  }

});

Walkabout._getEventModule = function (type) {
  var modules = {
    click: "MouseEvent",
    dblclick: "MouseEvent",
    mousedown: "MouseEvent",
    mouseenter: "MouseEvent",
    mouseleave: "MouseEvent",
    mouseup: "MouseEvent",
    mouseover: "MouseEvent",
    mousemove: "MouseEvent",
    mouseout: "MouseEvent",
    load: "HTMLEvents",
    unload: "HTMLEvents",
    abort: "HTMLEvents",
    error: "HTMLEvents",
    select: "HTMLEvents",
    change: "HTMLEvents",
    submit: "HTMLEvents",
    reset: "HTMLEvents",
    focus: "HTMLEvents",
    blur: "HTMLEvents",
    resize: "HTMLEvents",
    scroll: "HTMLEvents",
    DOMFocusIn: "UIEvents",
    DOMFocusOut: "UIEvents",
    DOMActivate: "UIEvents",
    keydown: "KeyboardEvent",
    keyup: "KeyboardEvent",
    keypress: "KeyboardEvent"
  };
  // Where should these go?
  //   http://www.w3.org/TR/DOM-Level-3-Events/#events-wheelevents
  // This claims HTMLEvents should be UIEvents
  //   http://www.w3.org/TR/DOM-Level-3-Events/#events-uievents
  return modules[type] || "UIEvents";
};

Walkabout.LinkFollower = Walkabout.Class({
  constructor: function LinkFollower(event) {
    this.element = event.element;
    this.type = event.type;
    if (this.type != "click") {
      throw "Unexpected event type: " + this.type;
    }
    this.options = event.options || {};
  },

  show: function () {
    return Walkabout.Highlighter(this.element, "follow");
  },

  run: Walkabout.setInTesting(function () {
    var event;
    var cancelled;
    if (Walkabout.jQueryAvailable) {
      event = Walkabout.$.Event("click");
      Walkabout.$(this.element).trigger(event);
      cancelled = event.isDefaultPrevented();
    } else {
      event = document.createEvent("MouseEvents");
      event.initMouseEvent(
        "click", // type
        true, // canBubble
        true, // cancelable
        window, // view
        0, // detail
        0, // screenX
        0, // screenY
        0, // clientX
        0, // clientY
        false, // ctrlKey
        false, // altKey
        false, // shiftKey
        false, // metaKey
        0, // button
        null // relatedTarget
      );
      cancelled = this.element.dispatchEvent(event);
    }
    if ((! cancelled) && ! (event.defaultPrevented)) {
      location.href = this.element.getAttribute("href");
    }
  })
});

Walkabout.hidden = function (el) {
  return (el.offsetWidth === 0 &&
          el.offsetHeight === 0);
  // FIXME: jQuery also uses a display: none test on some browsers,
  // but this seems to be the only check for modern browsers?
};

Walkabout.visible = function (el) {
  return ! Walkabout.hidden(el);
};

Walkabout.clickable = function (el) {
  if (Walkabout.hidden(el)) {
    return false;
  }
  if (Walkabout.anyOverlap(el)) {
    return false;
  }
  return true;
};

Walkabout.anyOverlap = function (overElement) {
  try {
    var overStyle = getComputedStyle(overElement);
  } catch (e) {
    // FIXME: this is being called for the HTMLDocument element and other
    // things that can't be used with getComputedStyle
    return false;
  }
  if (! overStyle) {
    return false;
  }
  var overZIndex = parseInt(overStyle.getPropertyValue("z-index"), 10);
  var overBox = overElement.getBoundingClientRect();
  var overHeight = overElement.offsetHeight;
  var overWidth = overElement.offsetWidth;
  var els = document.getElementsByTagName("*");
  var len = els.length;
  var result = [];
  var parents = [];
  var parent = overElement.parentNode;
  while (parent) {
    parents.push(parent);
    parent = parent.parentNode;
  }
  for (var i=0; i<len; i++) {
    var el = els[i];
    if (el == overElement || parents.indexOf(el) != -1) {
      continue;
    }
    var style = getComputedStyle(el);
    var position = style.getPropertyValue("position");
    if (position != "relative" && position != "fixed" && position != "absolute") {
      continue;
    }
    var zIndex = parseInt(style.getPropertyValue("z-index"), 10);
    if (zIndex <= overZIndex) {
      continue;
    }
    var box = el.getBoundingClientRect();
    if (box.left <= overBox.left &&
        box.right >= overBox.right &&
        box.top <= overBox.top &&
        box.bottom >= overBox.bottom) {
      return true;
    }
  }
  return false;
};

/****************************************
 * Random numbers:
 */


// Based on Python's whrandom
Walkabout.RandomStream = function RandomStream(newSeed) {
  var seed, x, y, z;
  function setSeed(value) {
    if (! value) {
      value = Date.now();
    }
    if (typeof value != "number") {
      if (value.getTime) {
        value = value.getTime();
      }
      value = parseInt(value, 10);
    }
    if ((! value) || isNaN(value)) {
      throw "Bad seed: " + value;
    }
    seed = value;
    x = (seed % 30268) + 1;
    seed = (seed - (seed % 30268)) / 30268;
    y = (seed % 30306) + 1;
    seed = (seed - (seed % 30306)) / 30306;
    z = (seed % 30322) + 1;
    seed = (seed - (seed % 30322)) / 30322;
  }
  setSeed(newSeed);
  var result = function random() {
    x = (171 * x) % 30269;
    y = (172 * y) % 30307;
    z = (170 * z) % 30323;
    if (random.logState) {
      console.log('x', x, 'y', y, 'z', z);
    }
    if (random.storeState) {
      localStorage.setItem(random.storeState, JSON.stringify([x, y, z]));
    }
    return (x / 30269.0 + y / 30307.0 + z / 30323.0) % 1.0;
  };
  result.storeState = null;
  result.setSeed = setSeed;
  result.pick = function (array) {
    var index = Math.floor(result() * array.length);
    return array[index];
  };
  result.lowerLetters = "abcdefghijklmnopqrstuvwxyz";
  result.upperLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  result.letters = result.lowerLetters + result.upperLetters;
  result.numbers = "0123456789";
  result.simplePunctuation = " _-+,./";
  result.extraPunctuation = "!@#$%^&*()=`~[]{};:'\"\\|<>?";
  result.punctuation = result.simplePunctuation + result.extraPunctuation;
  result.whitespace = " \n";
  result.string = function string(letters, length) {
    letters = letters || result.letters;
    length = length || 10;
    var s = "";
    for (var i=0; i<length; i++) {
      s += result.pick(letters);
    }
    return s;
  };
  result.loadState = function (state) {
    if (state === undefined && ! result.storeState) {
      return;
    }
    if (state === undefined) {
      state = localStorage.getItem(result.storeState);
      if (state) {
        state = JSON.parse(state);
      } else {
        return;
      }
    }
    x = state[0];
    y = state[1];
    z = state[2];
  };
  result.clearState = function () {
    if (! result.storeState) {
      return;
    }
    localStorage.removeItem(result.storeState);
  };
  return result;
};

Walkabout.random = Walkabout.RandomStream();

/****************************************
 * Action container:
 */

Walkabout.Actions = function Actions() {
};

Walkabout.Actions.prototype = Object.create(Array.prototype);

Walkabout.Actions.prototype.pick = function () {
  return Walkabout.random.pick(this);
};

Walkabout.Actions.prototype.runAny = function () {
  var item = this.pick();
  item.run.apply(item, arguments);
};

Walkabout.Actions.prototype.matchingAction = function (eventName, element) {
  for (var i=0; i<this.length; i++) {
    var action = this[i];
    if (action.type == eventName && action.element == element) {
      return action;
    }
  }
  return null;
};

Walkabout.Actions.prototype.replaceAction = function (action, newAction) {
  var found = false;
  for (var i=0; i<this.length; i++) {
    if (this[i] === action) {
      this[i] = newAction;
      found = true;
      break;
    }
  }
  if (! found) {
    throw "Action not found: " + action;
  }
};

Walkabout.Actions.prototype.toSource = function () {
  var items = [];
  for (var i=0; i<this.length; i++) {
    items.push(this[i].toSource().replace(/^\(/, "").replace(/\)$/, ""));
  }
  return "new Walkabout.Actions(" + items.join(", ") + ")";
};


/****************************************
 * Replacements for standard methods, to track or mock values:
 */

Walkabout.addEventListener = function (obj, type, handler, bubbles, options) {
  obj.addEventListener(type, handler, bubbles || false);
  if (! obj._Walkabout_handlers) {
    obj._Walkabout_handlers = {};
  }
  if (! obj._Walkabout_handlers[type]) {
    obj._Walkabout_handlers[type] = [];
  }
  obj._Walkabout_handlers[type].push({
    handler: handler,
    bubbles: bubbles,
    type: type,
    options: options
  });
};

Walkabout.removeEventListener = function (obj, type, handler, bubbles) {
  obj.removeEventListener(type, handler, bubbles || false);
  var handlers = obj._Walkabout_handlers;
  if ((! handlers) || ! handlers[type]) {
    return;
  }
  handlers = handlers[type];
  for (var i=0; i<handlers.length; i++) {
    if (handlers[i].handler === handler &&
        handlers[i].type === type &&
        handlers[i].bubbles === bubbles) {
      handlers.splice(i, 1);
      break;
    }
  }
};

Walkabout.actionFinders.push(function customEvents(el, actions) {
  var els = el.getElementsByTagName("*");
  for (var i=-1; i<els.length; i++) {
    var o = i == -1 ? el : els[i];
    var handlers = o._Walkabout_handlers;
    if (Walkabout.ignoreElement(o) || ! handlers) {
      continue;
    }
    if (! Walkabout.clickable(o)) {
      // FIXME: not sure if this is a good general rule
      continue;
    }
    for (var eventName in handlers) {
      if (! handlers.hasOwnProperty(eventName)) {
        continue;
      }
      for (var j=0; j<handlers[eventName].length; j++) {
        var handler = handlers[eventName][j];
        var specific = [o];
        if (handler.options && handler.options.selector) {
          specific = o.querySelectorAll(handler.options.selector);
        }
        for (var k=0; k<specific.length; k++) {
          actions.push(Walkabout.EventAction({
            element: specific[k],
            type: eventName,
            handler: handler.handler,
            options: handler.options
          }));
        }
      }
    }
  }
});

Walkabout.value = function (obj) {
  var curValue = obj.value;
  if (! Walkabout.inTesting) {
    return curValue;
  }
  if (! obj || (! obj.tagName)) {
    return curValue;
  }
  if (obj.getAttribute && obj.getAttribute("data-walkabout-disable")) {
    return curValue;
  }
  if ((! obj.tagName) ||
      (obj.tagName != "INPUT" && obj.tagName == "TEXTAREA" && obj.tagName == "SELECT")) {
    return curValue;
  }
  if (obj.tagName == "INPUT" && Walkabout._getType(obj) == "hidden") {
    return curValue;
  }
  var options = obj.getAttribute("data-walkabout-options");
  if (options) {
    options = eval("(" + options + ")");
  }
  if ((! options) && obj.tagName == "INPUT" && Walkabout._getType(obj) == "checkbox") {
    // FIXME: need to override .checked
    return curValue;
  }
  if ((! options) && obj.tagName == "SELECT") {
    var els = obj.querySelectorAll("option");
    options = [];
    for (var i=0; i<els.length; i++) {
      var option = els[i];
      if (option.disabled) {
        continue;
      }
      options.push(option.value);
    }
  }
  // FIXME: Should check other types too
  if (! options) {
    options = Walkabout.random.letters;
  }
  if (Array.isArray(options)) {
    return Walkabout.random.pick(options);
  } else if (typeof options == "function") {
    return options(obj);
  } else if (typeof options == "string") {
    var length = obj.getAttribute("size") || 10;
    length = parseInt(length, 10);
    return Walkabout.random.string(options, length);
  } else {
    return curValue;
  }
};

Walkabout._getType = function (obj) {
  if ((! obj) || (! obj.getAttribute)) {
    return null;
  }
  var value = obj.getAttribute("type");
  if (value) {
    value = value.toLowerCase();
  }
  return value;
};

Walkabout.injectModules = function (modules) {
  if (modules.esprima) {
    esprima = modules.esprima;
  }
  if (modules.falafel) {
    falafel = modules.falafel;
  }
};

Walkabout.rewriteListeners = function (code) {
  if (typeof esprima == "undefined") {
    if (typeof require != "undefined") {
      exprima = require("esprima");
    } else {
      throw "You must install or include esprima.js";
    }
  }
  if (typeof falafel == "undefined") {
    if (typeof require != "undefined") {
      falafel = require("falafel");
    } else {
      throw "You must install or include falafel.js";
    }
  }
  var result = falafel(code, function (node) {
    if (node.type == "CallExpression" &&
        node.callee && node.callee.property &&
        (node.callee.property.name == "addEventListener" ||
         node.callee.property.name == "removeEventListener")) {
      if (node.callee.object.source() == "Walkabout") {
        // Already fixed source
        return;
      }
      var args = [];
      node["arguments"].forEach(function (n) {
        args.push(n.source());
      });
      node.update(
        "Walkabout." + node.callee.property.name +
        "(" + node.callee.object.source() +
        ", " + args.join(", ") + ")");
    }
    if (node.type == "MemberExpression" &&
        (! node.computed) &&
        node.property && node.property.name == "value" &&
        node.parent && node.parent.type != "AssignmentExpression") {
      if (node.object.source() == "Walkabout") {
        // Already fixed
        return;
      }
      node.update(
        "Walkabout.value(" + node.object.source() + ")");
    }
  });
  return result.toString();
};

Walkabout.rewriteHtml = function (code, scriptLocation, extra) {
  var start, rest;
  extra = extra || "";
  if (scriptLocation.search(/[<>"]/) != -1) {
    throw "Bad scriptLocation: " + scriptLocation;
  }
  var header = '<!--WALKABOUT--><scr' + 'ipt src="' + scriptLocation + '"></scr' + 'ipt>' +
    extra + '<!--/WALKABOUT-->';
  var match = (/<!--WALKABOUT-->[^]*<!--\/WALKABOUT-->/).exec(code);
  if (match) {
    start = code.substr(0, match.index);
    rest = code.substr(match.index + match[0].length);
    code = start + rest;
  }
  match = (/<head[^>]*>/i).exec(code);
  if (! match) {
    return code;
  }
  var endPos = match.index + match[0].length;
  start = code.substr(0, endPos);
  rest = code.substr(endPos);
  return start + header + rest;
};

/****************************************
 * UI
 */

Walkabout.UI = Walkabout.Class({

  constructor: function UI() {
    this.panel = this.make("div", {
      style: this.styles.panel,
      "data-walkabout-disable": 1
    }, [

      this.closeButton = this.make(
        "span",
        {
          style: this.styles.close
        },
        ["\xd7"]
      ),

      this.make("div", {style: this.styles.header}, ["Walkabout"]),

      this.make(
        "div",
        {},
        ["Actions: ",
         this.actionsField = this.make(
           "span",
           {style: this.styles.actions},
           ["?"]),
         " Runs: ",
         this.runField = this.make(
           "span",
           {style: this.styles.actions},
           ["- / -"])
        ]),

      this.issues = this.make(
        "div",
        {style: this.styles.issues},
        [
          this.make("div", {"data-issues-header": 1, style: this.styles.issuesHeader}, ["Issues:"])
        ]),

      this.startButton = this.make(
        "button",
        {style: this.styles.start}, ["start"]
      ),

      this.onceButton = this.make(
        "button",
        {style: this.styles.start}, ["run once"]
      ),

      this.showButton = this.make(
        "button",
        {style: this.styles.start}, ["show"]
      )

    ]);
    document.body.appendChild(this.panel);
    this.close = this.close.bind(this);
    this.start = this.start.bind(this);
    this.show = this.show.bind(this);
    this.updateActions = this.updateActions.bind(this);
    this.addIssue = this.addIssue.bind(this);
    this.closeButton.addEventListener("click", this.close, false);
    this.startButton.addEventListener("click", this.start, false);
    this.startButton.disabled = false;
    this.onceButton.addEventListener("click", (function (event) {
      this.start(event, 1);
    }).bind(this), false);
    this.showButton.addEventListener("click", this.show, false);
    this.onceButton.disabled = false;
    this.updateActionsId = setInterval(this.updateActions, 5000);
    this.updateActions();
    this.catchIssues();
    if (Walkabout.options.loadPersistent) {
      var data = Walkabout.persistentData();
      // Ignore data older than 30 minutes:
      // FIXME: should probably still load up the console even if it's old
      if (data.startAtRemaining) {
        if ((Date.now() - data.savedAt) < 30*60*1000 ) {
          this.start();
        } else if (data.console) {
          this.issueSerialization(data.console);
          this.addIssue("Not continuing (out of date session)");
        }
      } else if (data.console) {
        this.issueSerialization(data.console);
        this.addIssue("done.");
      }
    }
  },

  styles: {
    panel: "color: #000; background-color: #ffc; border: 3px outset #aa9; border-radius: 4px; position: fixed; top: 0.3em; right: 0.3em; padding: 0.7em; width: 20%; z-index: 10000; font-family: sans-serif;",
    start: "color: #000; background-color: #eee; border: 2px outset #999; border-radius: 2px; padding: 4px; margin-right: 2px;",
    close: "cursor: pointer; float: right;",
    header: "font-size: 110%; font-weight: bold; border-bottom: 1px solid #aa9; margin-bottom: 6px;",
    actions: "border: 2px solid #000; padding: 0 0.5em 0 0.5em;",
    issues: "max-height: 5em; overflow-y: auto; overflow: auto; border: 2px solid #000; margin: 4px 0 4px 0; font-size: 80%; padding-bottom: 8px;",
    issuesHeader: "font-weight: bold"
  },

  make: function (name, attrs, children) {
    var el = document.createElement(name);
    if (attrs) {
      for (var a in attrs) {
        if (attrs.hasOwnProperty(a)) {
          el.setAttribute(a, attrs[a]);
        }
      }
    }
    if (children) {
      for (var i=0; i<children.length; i++) {
        var child = children[i];
        if (typeof child == "string") {
          child = document.createTextNode(child);
        }
        el.appendChild(child);
      }
    }
    return el;
  },

  close: function () {
    if (this.canceler) {
      this.canceler();
    }
    clearTimeout(this.updateActionsId);
    this.updateActionsId = null;
    this.panel.parentNode.removeChild(this.panel);
    if (Walkabout.options.loadPersistent) {
      Walkabout.persistentData(null);
    }
  },

  start: function (event, times) {
    this.startButton.innerHTML = "running";
    this.startButton.disabled = true;
    if (Walkabout.jQueryAvailable) {
      Walkabout.$.fn.val.patch();
    }
    this._lastCount = -1;
    var startAtRemaining;
    var persist = Walkabout.options.loadPersistent;
    var seeded = false;
    if (persist) {
      var data = Walkabout.persistentData();
      startAtRemaining = data.startAtRemaining;
      if (data.console) {
        this.issueSerialization(data.console);
      }
      if (data.seeded) {
        seeded = true;
      }
      Walkabout.random.storeState = "walkabout.randomstate";
    }
    if ((! seeded) && times > 1) {
      var seed = Date.now();
      Walkabout.random.setSeed(seed);
      this.addIssue("Starting run with seed: " + seed);
    }
    this.canceler = Walkabout.runManyActions({
      ondone: (function () {
        this.startButton.innerHTML = "start";
        this.startButton.disabled = false;
        this.runField.innerHTML = "- / -";
        if (Walkabout.jQueryAvailable) {
          Walkabout.$.fn.val.unpatch();
        }
        if (persist) {
          Walkabout.persistentData({
            console: this.issueSerialization(),
            savedAt: Date.now()
          });
        }
      }).bind(this),
      onstatus: (function (status) {
        if (status.actions.length != this._lastCount) {
          this._lastCount = status.actions.length;
          this.updateActions(status.actions);
        }
        this.runField.textContent = (status.times - status.remaining) + " / " + status.times;
        if (persist) {
          var data = {
            startAtRemaining: status.remaining,
            console: this.issueSerialization(),
            savedAt: Date.now(),
            seeded: true
          };
          Walkabout.persistentData(data);
        }
      }).bind(this),
      times: times,
      startAtRemaining: startAtRemaining
    });
  },

  show: function () {
    if (this._showing) {
      this.showButton.innerHTML = "show";
      this._showing.forEach(function (item) {
        if (item) {
          item.remove();
        }
      });
      this._showing = null;
      return;
    }
    this.showButton.innerHTML = "hide";
    var showing = this._showing = [];
    var actions = Walkabout.findActions();
    actions.forEach(function (a) {
      showing.push(a.show());
    });
  },

  updateActions: function (actions) {
    actions = actions || Walkabout.findActions();
    this.actionsField.innerHTML = "";
    this.actionsField.appendChild(document.createTextNode(actions.length));
  },

  addIssue: function () {
    var div = this.make("div", {}, arguments);
    this.issues.appendChild(div);
    this.issues.childNodes[this.issues.childNodes.length - 1].scrollIntoView();
  },

  issueSerialization: function (value) {
    var i;
    if (value === undefined) {
      var result = [];
      for (i=0; i<this.issues.childNodes.length; i++) {
        var child = this.issues.childNodes[i];
        if (child.getAttribute("data-issues-header")) {
          continue;
        }
        result.push(this.issues.childNodes[i].textContent);
      }
      return result;
    } else {
      for (i=0; i<value.length; i++) {
        if (value[i] == "Issues:") throw "Issues in serialization :(";
        this.addIssue(value[i]);
      }
      return value;
    }
  },

  catchIssues: function () {
    var oldOnError = window.onerror;
    window.onerror = (function (errorMessage, url, lineNumber) {
      this.addIssue(errorMessage + " in " + url + ":" + lineNumber);
      if (oldOnError) {
        return oldOnError(errorMessage, url, lineNumber);
      }
      return false;
    }).bind(this);
    function bind(context, obj, prop, message) {
      var orig = obj[prop];
      obj[prop] = function () {
        var args = [message].concat(Array.prototype.slice.call(arguments, 0));
        context.addIssue.apply(context, args);
        orig.apply(obj, arguments);
      };
      obj[prop].orig = orig;
    }
    bind(this, console, "warn", "WARN: ");
    bind(this, console, "error", "ERROR: ");
  }

});

Walkabout.makeBookmarklet = function () {
  var scripts = document.querySelectorAll("script");
  var walkaboutSrc;
  for (var i=0; i<scripts.length; i++) {
    var src = scripts[i].src;
    if (src.indexOf("walkabout.js") != -1) {
      walkaboutSrc = src;
      break;
    }
  }
  if (! walkaboutSrc) {
    return "javascript:alert('Could not find script.')";
  }
  // Cache bust on localhost
  var cacheBust = walkaboutSrc.indexOf("localhost") != -1;
  var s = [
    "(function () {",
    "var _s = document.getElementById('walkabout_script');",
    "if (_s) _s.parentNode.removeChild(_s);",
    "_s = document.createElement('script');",
    "_s.src = '" + walkaboutSrc + "'",
    (cacheBust ? " + '?cachebust=' + Date.now()" : ""),
    ";",
    "_Walkabout_start_UI = true;",
    "document.head.appendChild(_s);",
    "})();void(0);"
  ];
  s = s.join("");
  s = "javascript:" + encodeURIComponent(s);
  return s;
};

/****************************************
 * History handling
 */

if (typeof location != "undefined") {
  Walkabout.hashHistory = [location.hash];
}

if (typeof window != "undefined") {
  window.addEventListener("hashchange", function () {
    var hash = location.hash;
    if (Walkabout.hashHistory.length > 1 &&
        Walkabout.hashHistory[Walkabout.hashHistory.length - 2] == hash) {
      // Someone just hit back (or at least that's what we'll pretend it is)
      Walkabout.hashHistory.splice(Walkabout.hashHistory.length - 1, 1);
    } else {
      Walkabout.hashHistory.push(hash);
    }
  }, false);
}

Walkabout.actionFinders.push(function backFromHash(el, actions) {
  if (el !== document && el !== window) {
    return;
  }
  if (Walkabout.hashHistory.length > 1) {
    // FIXME: there should be a way to suppress this from happening
    actions.push(Walkabout.Back());
  }
});

Walkabout.Back = Walkabout.Class({
  constructor: function Back() {
  },

  show: function () {
    return Walkabout.Notifier("Go back");
  },

  description: function () {
    return "Go back";
  },

  run: Walkabout.setInTesting(function () {
    window.history.back();
  })
});

/****************************************
 * Secret activation!
 */

Walkabout.activationSequence = "walkabout";

Walkabout.activationSequenceIndex = 0;

if (typeof document != "undefined") {
  document.addEventListener("keypress", function (event) {
    var index = Walkabout.activationSequenceIndex;
    var seq = Walkabout.activationSequence;
    var expected = seq.charCodeAt(index);
    if (event.keyCode == expected) {
      index++;
    } else if (event.keyCode == seq.charCodeAt(0)) {
      index = 1;
    } else {
      index = 0;
    }
    if (index >= seq.length) {
      index = 0;
      Walkabout.UI();
    }
    Walkabout.activationSequenceIndex = index;
  }, false);
}

/****************************************
 * Mock APIs:
 */

var mockTelephony = {

  muted: false,
  speakerEnabled: true,
  active: null,
  calls: [],
  conferenceGroup: null,
  startTone: function (tone) {
  },
  stopTone: function () {
  },
  onincoming: null,
  oncallschanged: null

};

var mockCall = {
  number: null, // string
  // "dialing", "alerting", "busy", "connecting", "connected", "disconnecting",
  // "disconnected", "incoming", "holding", "held", "resuming"
  state: null,
  group: null,
  answer: function () {
  },
  hangUp: function () {
  },
  hold: function () {
  },
  resume: function () {
  },
  onstatechange: null,
  onalerting: null,
  onbusy: null,
  onconnecting: null,
  onconnected: null,
  ondisconnecting: null,
  ondisconnected: null,
  onincoming: null,
  onholding: null,
  onheld: null,
  onresuming: null,
  ongroupchange: null
};

var mockCallGroup = {
  // Array of all calls that are currently in this group. The length
  // of this array is never 1.
  calls: [],

  // Add a call to the callgroup. call2 must not be specified if the
  // callgroup isn't empty.
  // If the callgroup is empty both call and call2 must be specified,
  // and one of them must be in 'held' state and the other in
  // 'connected' state.
  // Neither call or call2 can be in 'disconnected' state.
  add: function (call, call2) {
  },

  // Removes a call from the callgroup. If this leaves the callgroup with
  // just one call, then that last call is also removed from the callgroup.
  remove: function (call) {
  },

  hold: function () {
  },
  // Resuming a group automatically holds any other groups/calls
  resume: function () {
  },

  // When this changes, the state of all contained calls changes at the same time
  state: null,

  onstatechange: null,
  onconnected: null,
  onholding: null,
  onheld: null,
  onresuming: null,
  // Fires when the array in the 'calls' property changes.
  oncallschanged: null
};

if (typeof exports != "undefined") {
  // Expect that we are in a node environment
  Walkabout._extend(exports, Walkabout);
}

if (typeof _Walkabout_start_UI != "undefined") {
  if (document.readyState == "complete") {
    Walkabout.UI();
  } else {
    window.addEventListener("load", Walkabout.UI, false);
  }
}

if (typeof _Walkabout_sitewide != "undefined") {
  Walkabout.options.anyLocalLinks = location.pathname.replace(/\/[^\/]*$/, "/");
  Walkabout.options.loadPersistent = true;
}

return Walkabout;

}

// Wherein we support a variety of module systems:
//   exports for CommonJS/Node
//   define for RequireJS
//   nothing to export Walkabout
if (typeof exports != "undefined") {
  init(exports);
} else if (typeof define != "undefined") {
  define(init);
} else {
  Walkabout = {};
  init(Walkabout);
}

})();
