if (typeof Walkabout == "undefined") {
  Walkabout = {};
}

Walkabout.jQueryAvailable = (typeof jQuery !== "undefined");

// These are events that we don't need to fire directly:
Walkabout.ignoreEvents = {
  hashchange: true
};

Walkabout.actionFinders = [];

Walkabout.findActions = function (el, actions) {
  el = el || document;
  actions = actions || new Walkabout.Actions();
  if (! (Array.isArray(el) ||
         (Walkabout.jQueryAvailable && el instanceof jQuery))) {
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
  var el = options.element || document;
  var speed = options.speed || 0;
  var whileTrue = options.whileTrue || null;
  var times = options.times;
  var cancelled = false;
  function cancel() {
    cancelled = true;
  }
  if ((! whileTrue) && ! times) {
    times = Walkabout.DEFAULT_TIMES;
    whileTrue = function () {
      return true;
    };
  }
  function runOnce() {
    if ((! cancelled) && whileTrue()) {
      setTimeout(runOnce, speed);
    }
    var actions = Walkabout.findActions(el);
    actions.pick().run();
  }
  setTimeout(runOnce, speed);
  return cancel;
};

Walkabout.actionFinders.push(function findAnchors(el, actions) {
  var els = el.querySelectorAll("a");
  for (var i=-1; i<els.length; i++) {
    var anchor = i == -1 ? el : els[i];
    if (anchor.tagName != "A" ||
        Walkabout.ignoreElement(anchor)) {
      continue;
    }
    var href = anchor.getAttribute("href");
    if (href.indexOf("#") === 0) {
      if (actions.matchingAction("click", anchor)) {
        continue;
      }
      actions.push(new Walkabout.LinkFollower({
        element: anchor,
        type: "click"
      }));
    }
  }
});

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
 * jQuery support:
 */

if (Walkabout.jQueryAvailable) {

  jQuery.fn.bindKey = function (matcher, arg1, arg2, arg3) {
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
      var event = jQuery.Event(matcher.type);
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
    var els = jQuery(el).find("*");
    els.push(el);
    els.each(function () {
      if ((! jQuery(this).is(":visible")) ||
          Walkabout.ignoreElement(this)) {
        return;
      }
      var events = jQuery._data(this, "events");
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
            els = jQuery(this).find(event.selector);
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

  jQuery.fn.val.patch = function () {
    jQuery.fn.val = jQuery.fn.val.mock;
  };

  jQuery.fn.val.mock = function () {
    if (this.attr("type") == "hidden") {
      return jQuery.fn.val.mock.orig.apply(this, arguments);
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
      return Walkabout.random.string(options, parseInt(this.attr("size") || 10, 10));
    } else {
      // FIXME: what then?  E.g., if it's an object
      return jQuery.fn.val.mock.orig.apply(this, arguments);
    }
  };

  jQuery.fn.val.mock.patch = function () {
    // Already patched
  };

  jQuery.fn.val.mock.unpatch = function () {
    jQuery.fn.val = jQuery.fn.val.mock.orig;
  };

  jQuery.fn.val.mock.orig = jQuery.fn.val;
  jQuery.fn.val.mock.mock = jQuery.fn.val.mock;

  jQuery.fn.findActions = function () {
    return Walkabout.findActions(this);
  };

}


/****************************************
 * Action implementations:
 */

Walkabout.EventAction = Walkabout.Class({

  constructor: function (event) {
    this.element = event.element;
    this.type = event.type;
    this.handler = event.handler;
    this.options = event.options || {};
    this.jQuery = !! event.jQuery;
  },

  run: function () {
    var event;
    console.log(
      "triggering", this.type, "on", this.element,
      (this.handler.runEvent) ?
      "custom event" : "standard event");
    if (this.handler && this.handler.runEvent) {
      this.handler.runEvent();
    } else if (Walkabout.jQueryAvailable) {
      event = jQuery.Event(this.type);
      Walkabout._extend(event, this.eventProperties());
      if ((this.type == "keyup" || this.type == "keydown" || this.type == "keypress") &&
          (! event.which)) {
        event.which = Math.floor(Walkabout.random() * 256);
      }
      jQuery(this.element).trigger(event);
    } else {
      var module = Walkabout._getEventModule(this.type);
      event = document.createEvent(module);
      var props = this.eventProperties();
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
  },

  eventProperties: function () {
    var attrs = this.element.attributes;
    var attrName = "data-walkabout-" + this.type;
    var result = Object.create(this._eventPropsPrototype);
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
  constructor: function (event) {
    this.element = event.element;
    this.type = event.type;
    if (this.type != "click") {
      throw "Unexpected event type: " + this.type;
    }
    this.options = event.options || {};
  },
  run: function () {
    var event;
    var cancelled;
    if (Walkabout.jQueryAvailable) {
      event = jQuery.Event("click");
      $(this.element).trigger(event);
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
    if (! cancelled) {
      location.hash = this.element.getAttribute("href");
    }
  }
});


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
      value = parseInt(value, 10);
    }
    if ((! value) || isNaN(value)) {
      throw "Bad seed";
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
    return (x / 30269.0 + y / 30307.0 + z / 30323.0) % 1.0;
  };
  result.setSeed = setSeed;
  result.pick = function (array) {
    return array[Math.floor(result() * array.length)];
  };
  result.lowerLetters = "abcdefghijklmnopqrstuvwxyz";
  result.upperLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  result.letters = result.lowerLetters + result.upperLetters;
  result.numbers = "0123456789";
  result.simplePunctuation = " _-+,./";
  result.extraPunctuation = "!@#$%^&*()=`~[]{};:'\"\\|<>?";
  result.string = function string(letters, length) {
    letters = letters || result.letters;
    length = length || 10;
    var s = "";
    for (var i=0; i<length; i++) {
      s += result.pick(letters);
    }
    return s;
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

Walkabout.Actions.replaceAction = function (action, newAction) {
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

Walkabout.actionFinders.push(function customEvents(el, actions) {
  var els = el.getElementsByTagName("*");
  for (var i=-1; i<els.length; i++) {
    var o = i == -1 ? el : els[i];
    var handlers = o._Walkabout_handlers;
    if (Walkabout.ignoreElement(o) || ! handlers) {
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
        node.callee.property.name == "addEventListener") {
      var args = [];
      node["arguments"].forEach(function (n) {
        args.push(n.source());
      });
      node.update(
        "Walkabout.addEventListener(" + node.callee.object.source() +
        ", " + args.join(", ") + ")");
    }
    if (node.type == "MemberExpression" &&
        (! node.computed) &&
        node.property && node.property.name == "value") {
      node.update(
        "Walkabout.value(" + node.object.source() + ")");
    }
  });
  return result;
};

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
