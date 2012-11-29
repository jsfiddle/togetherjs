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
      key = random.pick(key);
    }
    console.log("Doing", this.matcher.type, "with which:", key);
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
  var els = $(this).find("*");
  els.push(this[0]);
  els.each(function () {
    // This is jQuery 1.8 specific:
    if (! $(this).is(":visible")) {
      return;
    }
    var e = $._data(this, "events");
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
          els = $(this).find(event.selector);
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
  var actions = new Actions();
  var clickEls = [];
  this.find("a[href^=#]").each(function () {
    clickEls.push(this);
    actions.push(LinkAction($(this)));
  });
  this.getAllEvents().forEach(function (event) {
    if (event.type == "click" && clickEls.indexOf(event.element) != -1) {
      // We already have this action from above block
      return;
    }
    actions.push(EventAction(event));
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
    options = eval(options);
  } else {
    options = random.letters;
  }
  if (Array.isArray(options)) {
    return random.pick(options);
  } else if (typeof options == "function") {
    return options(this);
  } else if (typeof options == "string") {
    return random.string(options, parseInt(this.attr("size") || 10, 10));
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
    self.findActions().pick().run();
  }
  setTimeout(runOnce, speed);
  return cancel;
};

function Actions() {
}
Actions.prototype = Object.create(Array.prototype);
Actions.prototype.pick = function () {
  return random.pick(this);
};
Actions.prototype.runAny = function () {
  var item = this.pick();
  item.run.apply(item, arguments);
};

function Class(prototype) {
  return function () {
    var obj = Object.create(prototype);
    prototype.constructor.apply(obj, arguments);
    return obj;
  };
}

var EventAction = Class({
  constructor: function (event) {
    this.event = event;
  },
  run: function () {
    console.log(
      "triggering", this.event.type, "on", this.event.element,
      this.event.handler.handler.runEvent ? "custom event" : "standard event");
    if (this.event.handler.handler.runEvent) {
      this.event.handler.handler.runEvent();
    } else {
      $(this.event.element).trigger(this.event.type);
    }
  }
});

var LinkAction = Class({
  constructor: function (element) {
    this.element = element;
  },
  run: function () {
    console.log("clicking", this.element);
    var event = jQuery.Event("click");
    this.element.trigger(event);
    if (! event.isDefaultPrevented()) {
      location.hash = this.element[0].getAttribute("href");
    }
  }
});

// Based on Python's whrandom
function RandomStream(newSeed) {
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
}

var random = RandomStream();
