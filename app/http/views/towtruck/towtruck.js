/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint scripturl:true */
(function () {

  var button;

  var styles = [
    "/towtruck.min.css"
  ];

  var baseUrl = "<%= process.env.PUBLIC_BASE_URL %>";
  // FIXME: we could/should use a version from the checkout, at least
  // for production
  var cacheBust = "<%= process.env.COMMIT_HASH || '' %>" || Date.now();

  // FIXME: I think there's an event that would be called before load?
  // DOMReady?
  window.addEventListener("load", function () {
    var control = document.getElementById("towtruck-starter");
    // FIXME: not sure where to put the control if the page doesn't have
    // a specific place in mind?
    if (! control) {
      return;
    }
    button = document.createElement("button");
    button.innerHTML = "Start TowTruck";
    button.addEventListener("click", TowTruck, false);
    control.appendChild(button);
  }, false);

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

  var oldTowTruck = window.TowTruck;

  var TowTruck = window.TowTruck = function TowTruck(event, doneCallback) {
    if (typeof event == "function") {
      if (doneCallback) {
        console.warn("TowTruck() first argument *and* second argument is a function");
      } else {
        doneCallback = event;
      }
    }
    TowTruck.startTarget = null;
    if (event && typeof event == "object") {
      if (event.target && typeof event) {
        TowTruck.startTarget = event.target;
      } else if (event.nodeType == 1) {
        TowTruck.startTarget = event;
      } else if (event[0] && event[0].nodeType == 1) {
        // Probably a jQuery element
        TowTruck.startTarget = event[0];
      }
    }
    if (window.TowTruckConfig && (! window.TowTruckConfig.loaded)) {
      TowTruck.config(window.TowTruckConfig);
      window.TowTruckConfig.loaded = true;
    }
    for (var attr in window) {
      if (attr.indexOf("TowTruckConfig_") === 0) {
        var attrName = attr.substr(("TowTruckConfig_").length);
        TowTruck.config(attrName, window[attr]);
      }
    }
    if (TowTruck._loaded) {
      var session = TowTruck.require("session");
      session.start();
      if (doneCallback && typeof doneCallback == "function") {
        doneCallback();
      }
      return;
    }
    // A sort of signal to session.js to tell it to actually
    // start itself (i.e., put up a UI and try to activate)
    TowTruck.startTowTruckImmediately = true;
    styles.forEach(addStyle);
    var requireConfig = {
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
    var deps = ["session", "jquery"];
    function callback(session, jquery) {
      jquery.noConflict();
      TowTruck._loaded = true;
      TowTruck.require = require.config({context: "towtruck"});
      if (doneCallback && typeof doneCallback == "function") {
        doneCallback();
      }
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

  var defaultHubBase = "<%= process.env.HUB_BASE %>";
  if (defaultHubBase.indexOf("<" + "%=") === 0) {
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
    hubBase: defaultHubBase
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

  /* TowTruck.config(configuration)
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
      if (attr == "loaded" || ! settings.hasOwnProperty(attr)) {
        continue;
      }
      if (! TowTruck._defaultConfiguration.hasOwnProperty(attr)) {
        console.warn("Unknown configuration value passed to TowTruck.config():", attr);
      }
      TowTruck._configuration[attr] = settings[attr];
    }
  };

  TowTruck.reinitialize = function () {
    if (typeof TowTruck.require == "function") {
      TowTruck.require(["session"], function (session) {
        session.emit("reinitialize");
      });
    }
    // If it's not set, TowTruck has not been loaded, and reinitialization is not needed
  };

  // If TowTruck previously existed, copy all its properties over to our new
  // TowTruck function:
  if (oldTowTruck !== undefined) {
    for (var a in oldTowTruck) {
      if (oldTowTruck.hasOwnProperty(a)) {
        TowTruck[a] = oldTowTruck[a];
      }
    }
  }

  // This should contain the output of "git describe --always --dirty"
  // FIXME: substitute this on the server (and update make-static-client)
  TowTruck.version = "unknown";
  TowTruck.baseUrl = baseUrl;

  // FIXME: this really doesn't need to be in this file:
  TowTruck.bookmarklet = function () {
    var s = "window._TowTruckBookmarklet = true;";
    s += "s=document.createElement('script');";
    s += "s.src=" + JSON.stringify(baseUrl + "/towtruck.js") + ";";
    s += "document.head.appendChild(s);";
    s = "(function () {" + s + "})();void(0)";
    return "javascript:" + encodeURIComponent(s);
  };

  // It's nice to replace this early, before the load event fires, so we conflict
  // as little as possible with the app we are embedded in:
  var hash = location.hash.replace(/^#/, "");
  var m = /&?towtruck=([^&]*)/.exec(hash);
  if (m) {
    TowTruck._shareId = m[1];
    TowTruck._sessionStarting = true;
    var newHash = hash.substr(0, m.index) + hash.substr(m.index + m[0].length);
    location.hash = newHash;
  }
  if (window._TowTruckShareId) {
    TowTruck._shareId = window._TowTruckShareId;
    delete window._TowTruckShareId;
  }

  function conditionalOnload() {
    // A page can define this function to defer TowTruck from starting
    if (window._TowTruckCallToStart) {
      // FIXME: need to document this:
      window._TowTruckCallToStart(onload);
    } else {
      onload();
    }
  }

  // FIXME: can we push this up before the load event?
  // Do we need to wait at all?
  function onload() {
    if (TowTruck._shareId) {
      TowTruck.startTowTruckImmediately = true;
      TowTruck();
    } else if (window._TowTruckBookmarklet) {
      delete window._TowTruckBookmarklet;
      TowTruck();
    } else {
      var name = window.name;
      var key = "towtruck.status." + name;
      var value = localStorage.getItem(key);
      if (value) {
        value = JSON.parse(value);
        if (value && value.running) {
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
