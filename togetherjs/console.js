/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
define(["util"], function (util) {

  var console = window.console || {log: function () {}};

  var Console = util.Class({
    constructor: function () {
      this.messages = [];
      this.level = this.levels.log;
    },

    messageLimit: 100,

    levels: {
      debug: 1,
      // FIXME: I'm considering *not* wrapping console.log, and strictly keeping
      // it as a debugging tool; also line numbers would be preserved
      log: 2,
      info: 3,
      notify: 4,
      warn: 5,
      error: 6,
      fatal: 7
    },

    // Gets set below:
    maxLevel: 0,

    consoleLevels: [
      [],
      console.debug || [],
      console.log || [],
      console.info || [],
      console.notify || [],
      console.warn || [],
      console.error || [],
      console.fatal || []
    ],

    levelNames: {},

    setLevel: function (l) {
      var number;
      if (typeof l == "string") {
        number = this.levels[l];
        if (number === undefined) {
          throw new Error("Tried to set Console level to unknown level string: " + l);
        }
        l = number;
      }
      if (typeof l == "function") {
        number = this.consoleLevels.indexOf(l);
        if (number == -1) {
          throw new Error("Tried to set Console level based on unknown console function: " + l);
        }
        l = number;
      }
      if (typeof l == "number") {
        if (l < 0) {
          throw new Error("Console level must be 0 or larger: " + l);
        } else if (l > this.maxLevel) {
          throw new Error("Console level must be " + this.maxLevel + " or smaller: " + l);
        }
      }
      this.level = l;
    },

    write: function (level) {
      try {
        this.messages.push([
          Date.now(),
          level,
          this._stringify(Array.prototype.slice.call(arguments, 1))
        ]);
      } catch (e) {
        console.warn("Error stringifying argument:", e);
      }
      if (level != "suppress" && this.level <= level) {
        var method = console[this.levelNames[level]];
        if (! method) {
          method = console.log;
        }
        method.apply(console, Array.prototype.slice.call(arguments, 1));
      }
    },

    suppressedWrite: function () {
      this.write.apply(this, ["suppress"].concat(Array.prototype.slice.call(arguments)));
    },

    trace: function (level) {
      level = level || 'log';
      if (console.trace) {
        level = "suppressedWrite";
      }
      try {
        throw new Error();
      } catch (e) {
        // FIXME: trim this frame
        var stack = e.stack;
        stack = stack.replace(/^[^\n]*\n/, "");
        this[level](stack);
      }
      if (console.trace) {
        console.trace();
      }
    },

    _browserInfo: function () {
      // FIXME: add TogetherJS version and
      return [
        "TogetherJS base URL: " + TogetherJS.baseUrl,
        "User Agent: " + navigator.userAgent,
        "Page loaded: " + this._formatDate(TogetherJS.pageLoaded),
        "Age: " + this._formatMinutes(Date.now() - TogetherJS.pageLoaded) + " minutes",
        // FIXME: make this right:
        //"Window: height: " + window.screen.height + " width: " + window.screen.width
        "URL: " + location.href,
        "------+------+----------------------------------------------"
      ];
    },

    _stringify: function (args) {
      var s = "";
      for (var i=0; i<args.length; i++) {
        if (s) {
          s += " ";
        }
        s += this._stringifyItem(args[i]);
      }
      return s;
    },

    _stringifyItem: function (item) {
      if (typeof item == "string") {
        if (item === "") {
          return '""';
        }
        return item;
      }
      if (typeof item == "object" && item.repr) {
        try {
          return item.repr();
        } catch (e) {
          console.warn("Error getting object repr:", item, e);
        }
      }
      if (item !== null && typeof item == "object") {
        // FIXME: this can drop lots of kinds of values, like a function or undefined
        item = JSON.stringify(item);
      }
      return item.toString();
    },

    _formatDate: function (timestamp) {
      return (new Date(timestamp)).toISOString();
    },

    _formatTime: function (timestamp) {
      return ((timestamp - TogetherJS.pageLoaded) / 1000).toFixed(2);
    },

    _formatMinutes: function (milliseconds) {
      var m = Math.floor(milliseconds / 1000 / 60);
      var remaining = milliseconds - (m * 1000 * 60);
      if (m > 10) {
        // Over 10 minutes, just ignore the seconds
        return m;
      }
      var seconds = Math.floor(remaining / 1000) + "";
      m += ":";
      seconds = lpad(seconds, 2, "0");
      m += seconds;
      if (m == "0:00") {
        m += ((remaining / 1000).toFixed(3) + "").substr(1);
      }
      return m;
    },

    _formatLevel: function (l) {
      if (l === "suppress") {
        return "";
      }
      return this.levelNames[l];
    },

    toString: function () {
      try {
        var lines = this._browserInfo();
        this.messages.forEach(function (m) {
          lines.push(lpad(this._formatTime(m[0]), 6) + " " + rpad(this._formatLevel(m[1]), 6) + " " + lpadLines(m[2], 14));
        }, this);
        return lines.join("\n");
      } catch (e) {
        // toString errors can otherwise be swallowed:
        console.warn("Error running console.toString():", e);
        throw e;
      }
    },

    submit: function (options) {
      // FIXME: friendpaste is broken for this
      // (and other pastebin sites aren't really Browser-accessible)
      return util.Deferred(function (def) {
        options = options || {};
        var site = options.site || TogetherJS.config.get("pasteSite") || "https://www.friendpaste.com/";
        var req = new XMLHttpRequest();
        req.open("POST", site);
        req.setRequestHeader("Content-Type", "application/json");
        req.send(JSON.stringify({
          "title": options.title || "TogetherJS log file",
          "snippet": this.toString(),
          "language": "text"
        }));
        req.onreadystatechange = function () {
          if (req.readyState === 4) {
            var data = JSON.parse(req.responseText);
          }
        };
      });
    }

  });

  function rpad(s, len, pad) {
    s = s + "";
    pad = pad || " ";
    while (s.length < len) {
      s += pad;
    }
    return s;
  }

  function lpad(s, len, pad) {
    s = s + "";
    pad = pad || " ";
    while (s.length < len) {
      s = pad + s;
    }
    return s;
  }

  function lpadLines(s, len, pad) {
    var i;
    s = s + "";
    if (s.indexOf("\n") == -1) {
      return s;
    }
    pad = pad || " ";
    var fullPad = "";
    for (i=0; i<len; i++) {
      fullPad += pad;
    }
    s = s.split(/\n/g);
    for (i=1; i<s.length; i++) {
      s[i] = fullPad + s[i];
    }
    return s.join("\n");
  }



  // This is a factory that creates `Console.prototype.debug`, `.error` etc:
  function logFunction(name, level) {
    return function () {
      this.write.apply(this, [level].concat(Array.prototype.slice.call(arguments)));
    };
  }

  util.forEachAttr(Console.prototype.levels, function (value, name) {
    Console.prototype[name] = logFunction(name, value);
    Console.prototype.maxLevel = Math.max(Console.prototype.maxLevel, value);
  });

  util.forEachAttr(Console.prototype.levels, function (value, name) {
    Console.prototype.levelNames[value] = name;
  });

  var appConsole = Console();

  appConsole.ConsoleClass = Console;

  return appConsole;
});
