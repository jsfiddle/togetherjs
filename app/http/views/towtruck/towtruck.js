/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint scripturl:true */
(function () {

  var styles = [
    "/towtruck.min.css"
  ];

  var baseUrl = "<%= process.env.PUBLIC_BASE_URL || '' %>";
  if (baseUrl && typeof baseUrl == "string" && baseUrl.indexOf("<" + "%") === 0) {
    // Reset the variable if it doesn't get substituted
    baseUrl = "";
  }
  // FIXME: we could/should use a version from the checkout, at least
  // for production
  var cacheBust = "<%= process.env.GIT_LAST_COMMIT || '' %>" || (Date.now() + "");
  if (typeof cacheBust == "string" && cacheBust.indexOf("<" + "%") === 0) {
    cacheBust = Date.now() + "";
  }

  // Make sure we have all of the console.* methods:
  if (typeof console == "undefined") {
    console = {};
  }
  if (! console.log) {
    console.log = function () {};
  }
  ["debug", "info", "warn", "error"].forEach(function (method) {
    if (! console[method]) {
      console[method] = console.log;
    }
  });

  if (! baseUrl) {
    var scripts = document.getElementsByTagName("script");
    for (var i=0; i<scripts.length; i++) {
      var src = scripts[i].src;
      if (src && src.search(/towtruck.js(\?.*)?$/) !== -1) {
        baseUrl = src.replace(/towtruck.js(\?.*)?$/, "");
        break;
      }
    }
  }
  if (! baseUrl) {
    console.warn("Could not determine TowTruck's baseUrl (looked for a <script> with towtruck.js)");
  }

  function addStyle(url) {
    var link = document.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.href = baseUrl + url + "?bust=" + cacheBust;
    document.head.appendChild(link);
  }

  function addScript(url) {
    var script = document.createElement("script");
    script.src = baseUrl + url + "?bust=" + cacheBust;
    document.head.appendChild(script);
  }

  var TowTruck = window.TowTruck = function TowTruck(event) {
    TowTruck.startup.button = null;
    if (event && typeof event == "object") {
      if (event.target && typeof event) {
        TowTruck.startup.button = event.target;
      } else if (event.nodeType == 1) {
        TowTruck.startup.button = event;
      } else if (event[0] && event[0].nodeType == 1) {
        // Probably a jQuery element
        TowTruck.startup.button = event[0];
      }
    }
    if (window.TowTruckConfig && (! window.TowTruckConfig.loaded)) {
      TowTruck.config(window.TowTruckConfig);
      window.TowTruckConfig.loaded = true;
    }

    // This handles loading configuration from global variables.  This
    // includes TowTruckConfig_on_*, which are attributes folded into
    // the "on" configuration value.
    var attr;
    var attrName;
    var globalOns = {};
    for (attr in window) {
      if (attr.indexOf("TowTruckConfig_on_") === 0) {
        attrName = attr.substr(("TowTruckConfig_on_").length);
        globalOns[attrName] = window[attr];
      } else if (attr.indexOf("TowTruckConfig_") === 0) {
        attrName = attr.substr(("TowTruckConfig_").length);
        TowTruck.config(attrName, window[attr]);
      }
    }
    // FIXME: copy existing config?
    var ons = TowTruck.getConfig("on");
    for (attr in globalOns) {
      if (globalOns.hasOwnProperty(attr)) {
        // FIXME: should we avoid overwriting?  Maybe use arrays?
        ons[attr] = globalOns[attr];
      }
    }
    TowTruck.config("on", ons);
    for (attr in ons) {
      TowTruck.on(attr, ons[attr]);
    }

    if (! TowTruck.startup.reason) {
      // Then a call to TowTruck() from a button must be started TowTruck
      TowTruck.startup.reason = "started";
    }

    if (TowTruck._loaded) {
      var session = TowTruck.require("session");
      if (session.running) {
        session.close();
      } else {
        session.start();
      }
      return;
    }
    // A sort of signal to session.js to tell it to actually
    // start itself (i.e., put up a UI and try to activate)
    TowTruck.startup._launch = true;

    styles.forEach(addStyle);
    var requireConfig = TowTruck._extend(TowTruck.requireConfig);
    var deps = ["session", "jquery"];
    function callback(session, jquery) {
      // Though jquery uses requirejs, it also always also defines a
      // global, so we have to keep it from conflicting with any
      // previous jquery:
      jquery.noConflict();
      TowTruck._loaded = true;
      TowTruck.require = require.config({context: "towtruck"});
    }
    if (typeof require == "function") {
      TowTruck.require = require.config(requireConfig);
    }
    if (typeof TowTruck.require == "function") {
      // This is an already-configured version of require
      TowTruck.require(deps, callback);
    } else {
      requireConfig.deps = deps;
      requireConfig.callback = callback;
      window.require = requireConfig;
    }
    // FIXME: we should namespace require.js to avoid conflicts.  See:
    //   https://github.com/jrburke/r.js/blob/master/build/example.build.js#L267
    //   http://requirejs.org/docs/faq-advanced.html#rename
    addScript("/towtruck/libs/require.js");
  };

  TowTruck.startup = {
    // What element, if any, was used to start the session:
    button: null,
    // The startReason is the reason TowTruck was started.  One of:
    //   null: not started
    //   started: hit the start button (first page view)
    //   joined: joined the session (first page view)
    reason: null,
    // Also, the session may have started on "this" page, or maybe is continued
    // from a past page.  TowTruck.continued indicates the difference (false the
    // first time TowTruck is started or joined, true on later page loads).
    continued: false,
    // This is set to tell the session what shareId to use, if the boot
    // code knows (mostly because the URL indicates the id).
    _joinShareId: null,
    // This tells session to start up immediately (otherwise it would wait
    // for session.start() to be run)
    _launch: false
  };
  TowTruck.running = false;

  TowTruck.requireConfig = {
    context: "towtruck",
    baseUrl: baseUrl + "/towtruck",
    urlArgs: "bust=" + cacheBust,
    paths: {
      jquery: "libs/jquery-1.8.3.min",
      walkabout: "libs/walkabout.js/walkabout",
      esprima: "libs/walkabout.js/lib/esprima",
      falafel: "libs/walkabout.js/lib/falafel",
      tinycolor: "libs/tinycolor",
      "alien-avatar-generator": "libs/alien-avatar-generator",
      guiders: "libs/Guider-JS/guiders-1.3.0"
    }
  };

  TowTruck._extend = function (base, extensions) {
    if (! extensions) {
      extensions = base;
      base = {};
    }
    for (var a in extensions) {
      if (extensions.hasOwnProperty(a)) {
        base[a] = extensions[a];
      }
    }
    return base;
  };

  TowTruck._mixinEvents = function (proto) {
    proto.on = function on(name, callback) {
      if (name.search(" ") != -1) {
        var names = name.split(/ +/g);
        names.forEach(function (n) {
          this.on(n, callback);
        }, this);
        return;
      }
      if (this._knownEvents && this._knownEvents.indexOf(name) == -1) {
        var thisString = "" + this;
        if (thisString.length > 20) {
          thisString = thisString.substr(0, 20) + "...";
        }
        console.warn(thisString + ".on('" + name + "', ...): unknown event");
        if (console.trace) {
          console.trace();
        }
      }
      if (! this._listeners) {
        this._listeners = {};
      }
      if (! this._listeners[name]) {
        this._listeners[name] = [];
      }
      if (this._listeners[name].indexOf(callback) == -1) {
        this._listeners[name].push(callback);
      }
    };
    proto.once = function once(name, callback) {
      if (! callback.once) {
        callback.once = function onceCallback() {
          callback.apply(this, arguments);
          this.off(name, onceCallback);
          delete callback.once;
        };
      }
      this.on(name, callback.once);
    };
    proto.off = proto.removeListener = function off(name, callback) {
      if (name.search(" ") != -1) {
        var names = name.split(/ +/g);
        names.forEach(function (n) {
          this.off(n, callback);
        }, this);
        return;
      }
      if ((! this._listeners) || ! this._listeners[name]) {
        return;
      }
      var l = this._listeners[name], _len = l.length;
      for (var i=0; i<_len; i++) {
        if (l[i] == callback) {
          l.splice(i, 1);
          break;
        }
      }
    };
    proto.emit = function emit(name) {
      if ((! this._listeners) || ! this._listeners[name]) {
        return;
      }
      var args = Array.prototype.slice.call(arguments, 1);
      var l = this._listeners[name], _len = l.length;
      for (var i=0; i<_len; i++) {
        l[i].apply(this, args);
      }
    };
    return proto;
  };

  TowTruck._mixinEvents(TowTruck);
  TowTruck._knownEvents = ["ready", "close"];
  TowTruck.toString = function () {
    return "TowTruck";
  };

  var defaultHubBase = "<%= process.env.HUB_BASE %>";
  if (defaultHubBase.indexOf("<" + "%") === 0) {
    // Substitution wasn't made
    defaultHubBase = "https://hub.towtruck.mozillalabs.com";
  }

  TowTruck._configuration = {};
  TowTruck._defaultConfiguration = {
    // Experimental feature to echo clicks to certain elements across clients:
    cloneClicks: false,
    // Enable Mozilla or Google analytics on the page when TowTruck is activated:
    enableAnalytics: false,
    // The code to enable (this is defaulting to a Mozilla code):
    analyticsCode: "UA-35433268-28",
    // The base URL of the hub
    hubBase: defaultHubBase,
    // A function that will return the name of the user:
    getUserName: null,
    // A function that will return the color of the user:
    getUserColor: null,
    // A function that will return the avatar of the user:
    getUserAvatar: null,
    // Any events to bind to
    on: {}
  };
  // FIXME: there's a point at which configuration can't be updated
  // (e.g., hubBase after the TowTruck has loaded).  We should keep
  // track of these and signal an error if someone attempts to
  // reconfigure too late

  TowTruck.getConfig = function (name) {
    var value = TowTruck._configuration[name];
    if (value === undefined) {
      if (! TowTruck._defaultConfiguration.hasOwnProperty(name)) {
        console.error("Tried to load unknown configuration value:", name);
      }
      value = TowTruck._defaultConfiguration[name];
    }
    return value;
  };

  /* TowTruck.config(configurationObject)
     or: TowTruck.config(configName, value)

     Adds configuration to TowTruck.  You may also set the global variable TowTruckConfig
     and when TowTruck is started that configuration will be loaded.

     Unknown configuration values will lead to console error messages.
     */
  TowTruck.config = function (name, value) {
    var settings;
    if (arguments.length == 1) {
      if (typeof name != "object") {
        throw 'TowTruck.config(value) must have an object value (not: ' + name + ')';
      }
      settings = name;
    } else {
      settings = {};
      settings[name] = value;
    }
    for (var attr in settings) {
      if (attr == "loaded" || attr == "callToStart" || ! settings.hasOwnProperty(attr)) {
        continue;
      }
      if (! TowTruck._defaultConfiguration.hasOwnProperty(attr)) {
        console.warn("Unknown configuration value passed to TowTruck.config():", attr);
      }
      TowTruck._configuration[attr] = settings[attr];
    }
  };

  TowTruck.reinitialize = function () {
    if (TowTruck.running && typeof TowTruck.require == "function") {
      TowTruck.require(["session"], function (session) {
        session.emit("reinitialize");
      });
    }
    // If it's not set, TowTruck has not been loaded, and reinitialization is not needed
  };

  TowTruck.refreshUserData = function () {
    if (TowTruck.running && typeof TowTruck.require ==  "function") {
      TowTruck.require(["session"], function (session) {
        session.emit("refresh-user-data");
      });
    }
  };

  // This should contain the output of "git describe --always --dirty"
  // FIXME: substitute this on the server (and update make-static-client)
  TowTruck.version = "unknown";
  TowTruck.baseUrl = baseUrl;

  TowTruck.hub = TowTruck._mixinEvents({});
  var session = null;

  TowTruck._onmessage = function (msg) {
    var type = msg.type;
    if (type.search(/^app\./) === 0) {
      type = type.substr("app.".length);
    } else {
      type = "towtruck." + type;
    }
    msg.type = type;
    TowTruck.hub.emit(msg.type, msg);
  };

  TowTruck.send = function (msg) {
    if (session === null) {
      if (! TowTruck.require) {
        throw "You cannot use TowTruck.send() when TowTruck is not running";
      }
      session = TowTruck.require("session");
    }
    session.appSend(msg);
  };

  // It's nice to replace this early, before the load event fires, so we conflict
  // as little as possible with the app we are embedded in:
  var hash = location.hash.replace(/^#/, "");
  var m = /&?towtruck=([^&]*)/.exec(hash);
  if (m) {
    TowTruck.startup._joinShareId = m[1];
    TowTruck.startup.reason = "joined";
    var newHash = hash.substr(0, m.index) + hash.substr(m.index + m[0].length);
    location.hash = newHash;
  }
  if (window._TowTruckShareId) {
    // A weird hack for something the addon does, to force a shareId.
    // FIXME: probably should remove, it's a wonky feature.
    TowTruck.startup._joinShareId = window._TowTruckShareId;
    delete window._TowTruckShareId;
  }

  function conditionalOnload() {
    // A page can define this function to defer TowTruck from starting
    var callToStart = window.TowTruckConfig_callToStart;
    if (window.TowTruckConfig && window.TowTruckConfig.callToStart) {
      callToStart = window.TowTruckConfig.callToStart;
    }
    if (callToStart) {
      // FIXME: need to document this:
      callToStart(onload);
    } else {
      onload();
    }
  }

  // FIXME: can we push this up before the load event?
  // Do we need to wait at all?
  function onload() {
    if (TowTruck.startup._joinShareId) {
      TowTruck();
    } else if (window._TowTruckBookmarklet) {
      delete window._TowTruckBookmarklet;
      TowTruck();
    } else {
      var key = "towtruck-session.status";
      var value = sessionStorage.getItem(key);
      if (value) {
        value = JSON.parse(value);
        if (value && value.running) {
          TowTruck.startup.continued = true;
          TowTruck.startup.reason = value.startupReason;
          TowTruck();
        }
      }
    }
  }

  if (document.readyState == "complete") {
    conditionalOnload();
  } else {
    window.addEventListener("load", conditionalOnload, false);
  }

})();
