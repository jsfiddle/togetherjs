if (typeof Walkabout == "undefined") {
  Walkabout = {};
}

if (typeof jQuery == "undefined") {
  // This is not so awesome...
  jQuery = {fn: {val: {}}, fake: true};
}

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

jQuery.fn.getAllEvents = function () {
  var events = [];
  // FIXME: does this only get children, not the element itself?
  var els = jQuery(this).find("*");
  els.push(this[0]);
  els.each(function () {
    if (! jQuery(this).is(":visible")) {
      return;
    }
    if (jQuery(this).attr("data-walkabout-disable")) {
      return;
    }
    // This is jQuery 1.8 specific:
    var e = jQuery._data(this, "events");
    if (! e) {
      return;
    }
    for (var i in e) {
      if ((! e.hasOwnProperty(i)) || jQuery.fn.getAllEvents.ignoreEvents[i]) {
        continue;
      }
      for (var j=0; j<e[i].length; j++) {
        var event = e[i][j];
        if (event.selector) {
          els = jQuery(this).find(event.selector);
        } else {
          els = [this];
        }
        for (var k=0; k<els.length; k++) {
          events.push({
            element: els[k],
            type: i,
            handler: e[i][j]
          });
        }
      }
    }
  });
  return events;
};

// These are events that we don't need to fire directly:
jQuery.fn.getAllEvents.ignoreEvents = {
  hashchange: true
};

jQuery.fn.findActions = function () {
  var actions = new Walkabout.Actions();
  var clickEls = [];
  this.find("a[href^=#]").each(function () {
    if (jQuery(this).attr("data-walkabout-disable")) {
      return;
    }
    clickEls.push(this);
    actions.push(Walkabout.LinkAction(jQuery(this)));
  });
  this.getAllEvents().forEach(function (event) {
    if (event.type == "click" && clickEls.indexOf(event.element) != -1) {
      // We already have this action from above block
      return;
    }
    actions.push(Walkabout.EventAction(event));
  });
  return actions;
};

jQuery.fn.val.patch = function () {
  jQuery.fn.val = jQuery.fn.val.mock;
};

jQuery.fn.val.mock = function () {
  if (this.attr("type") == "hidden") {
    return jQuery.fn.val.mock.orig.apply(this, arguments);
  }
  var options = this.attr("data-mock-options");
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

jQuery.fn.runManyActions = function runManyActions(whileTrue, speed) {
  var count;
  var self = this;
  speed = speed || 0;
  if (typeof whileTrue == "number") {
    count = whileTrue;
    whileTrue = function () {
      count--;
      return count >= 0;
    };
  }
  var cancelled = false;
  function cancel() {
    cancelled = true;
  }
  function runOnce() {
    if ((! cancelled) && whileTrue()) {
      setTimeout(runOnce, speed);
    }
    var actions = self.findActions();
    actions.pick().run();
  }
  setTimeout(runOnce, speed);
  return cancel;
};

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

Walkabout.Class = function Class(prototype) {
  return function () {
    var obj = Object.create(prototype);
    prototype.constructor.apply(obj, arguments);
    return obj;
  };
};

Walkabout.EventAction = Walkabout.Class({

  constructor: function (event) {
    this.event = event;
  },

  run: function () {
    var event;
    console.log(
      "triggering", this.event.type, "on", this.event.element,
      (this.event.handler.handler && this.event.handler.handler.runEvent) ?
      "custom event" : "standard event");
    if (this.event.handler.handler && this.event.handler.handler.runEvent) {
      this.event.handler.handler.runEvent();
    } else if (this.event.handler.runEvent) {
      this.event.handler.runEvent();
    } else if (! jQuery.fake) {
      event = jQuery.Event(this.event.type);
      Walkabout._extend(event, this.eventProperties());
      if ((event.type == "keyup" || event.type == "keydown" || event.type == "keypress") &&
          (! event.which)) {
        event.which = Math.floor(Walkabout.random() * 256);
      }
      jQuery(this.event.element).trigger(event);
    } else {
      var module = Walkabout._getEventModule(this.event.type);
      event = document.createEvent(module);
      var props = this.eventProperties();
      if (module == "UIEvents") {
        event.initUIEvent(
          this.event.type,
          props.get("canBubble", true), // canBubble
          props.get("cancelable", true), // cancelable
          window, // view
          props.get("detail", 0) // detail
        );
      } else if (module == "MouseEvents" || module == "MouseEvent") {
        event.initMouseEvent(
          this.event.type,
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
          this.event.type,
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
            this.event.type,
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
            type: this.event.type,
            target: this.event.element,
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
          this.event.handler(event);
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
        console.warn("Unknown method type/module:", module, this.event.type);
      }
      Walkabout._extend(event, props);
      this.event.element.dispatchEvent(event);
    }
  },

  eventProperties: function () {
    var attrs = this.event.element.attributes;
    var attrName = "data-walkabout-" + this.event.type;
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
        for (var a in data) {
          if (! data.hasOwnProperty(a)) {
            continue;
          }
          result[a] = data[a];
        }
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

Walkabout._extend = function (obj, props) {
  for (var a in props) {
    if (! props.hasOwnProperty(a)) {
      continue;
    }
    obj[a] = props[a];
  }
};

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

Walkabout.LinkAction = Walkabout.Class({
  constructor: function (element) {
    this.element = element;
  },
  run: function () {
    var event;
    var cancelled;
    if (! jQuery.fake) {
      event = jQuery.Event("click");
      this.element.trigger(event);
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
      var el = this.element;
      if (! jQuery.fake) {
        el = el[0];
      }
      location.hash = el.getAttribute("href");
    }
  }
});



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
  var options = obj.getAttribute("data-mock-options");
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

Walkabout.findActions = function (el) {
  var actions = new Walkabout.Actions();
  var clickEls = [];
  var els = el.querySelectorAll('a[href^="#"]');
  for (var i=0; i<els.length; i++) {
    if (els[i].getAttribute("data-walkabout-disable")) {
      continue;
    }
    clickEls.push(els[i]);
    actions.push(Walkabout.LinkAction(els[i]));
  }
  var events = Walkabout.getAllEvents(el);
  for (i=0; i<events.length; i++) {
    var event = events[i];
    if (event.type == "click" && clickEls.indexOf(event.element) != -1) {
      continue;
    }
    actions.push(Walkabout.EventAction(event));
  }
  return actions;
};

Walkabout.getAllEvents = function (element) {
  var sub = element.getElementsByTagName("*");
  var events = [];
  for (var i=-1; i<sub.length; i++) {
    var e = (i == -1) ? element : sub[i];
    var handlers = e._Walkabout_handlers;
    if (! handlers) {
      continue;
    }
    for (var type in handlers) {
      if ((! handlers.hasOwnProperty(type)) || jQuery.fn.getAllEvents.ignoreEvents[i]) {
        continue;
      }
      for (var j=0; j<handlers[type].length; j++) {
        var event = handlers[type][j];
        var subels = [e];
        if (event.options && event.options.selector) {
          subels = e.querySelectorAll(event.options.selector);
        }
        for (var k=0; k<subels.length; k++) {
          events.push({
            element: subels[k],
            type: type,
            handler: event.handler
          });
        }
      }
    }
  }
  return events;
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
