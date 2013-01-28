/*jshint scripturl:true */
(function () {

  var button;

  var styles = [
    "/towtruck.css"
  ];

  var baseUrl = "<%= process.env.PUBLIC_BASE_URL %>";
  // FIXME: we could/should use a version from the checkout, at least
  // for production
  var cacheBust = Date.now();

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
    button.addEventListener("click", startTowTruck, false);
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

  var startTowTruck = window.startTowTruck = function (doneCallback) {
    if (startTowTruck.loaded) {
      var session = startTowTruck.require("session");
      session.start();
      if (doneCallback) {
        doneCallback();
      }
      return;
    }
    // A sort of signal to session.js to tell it to actually
    // start itself (i.e., put up a UI and try to activate)
    if (! window._startTowTruckImmediately) {
      window._startTowTruckImmediately = true;
    }
    styles.forEach(addStyle);
    var callbacks = [];
    window._TowTruckOnLoad = function (callback) {
      callbacks.push(callback);
    };
    var oldRequire = window.require;
    var oldDefine = window.define;
    var config = {
      baseUrl: baseUrl + "/towtruck",
      urlArgs: "bust=" + cacheBust,
      paths: {
        jquery: "libs/jquery-1.8.3.min",
        walkabout: "libs/walkabout.js/walkabout"
      }
    };
    var deps = ["session"];
    function callback() {
      startTowTruck.loaded = true;
      startTowTruck.require = require;
      startTowTruck.define = define;
      callbacks.forEach(function (c) {
        c();
      });
      if (doneCallback) {
        doneCallback();
      }
    }
    if (typeof require == "function") {
      // FIXME: we should really be worried about overwriting config options
      // of the app itself
      require.config(config);
      require(deps, callback);
    } else {
      config.deps = deps;
      config.callback = callback;
      require = config;
    }
    // FIXME: we should namespace require.js to avoid conflicts.  See:
    //   https://github.com/jrburke/r.js/blob/master/build/example.build.js#L267
    //   http://requirejs.org/docs/faq-advanced.html#rename
    addScript("/towtruck/libs/require.js");
  };

  startTowTruck.hubBase = "<%= process.env.HUB_BASE %>";
  startTowTruck.baseUrl = baseUrl;

  startTowTruck.bookmarklet = function () {
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
    startTowTruck._shareId = m[1];
    var newHash = hash.substr(0, m.index) + hash.substr(m.index + m[0].length);
    location.hash = newHash;
  }

  function onload() {
    if (startTowTruck._shareId) {
      window._startTowTruckImmediately = true;
      startTowTruck();
    } else if (window._TowTruckBookmarklet) {
      delete window._TowTruckBookmarklet;
      startTowTruck();
    } else {
      var name = window.name;
      var key = "towtruck.status." + name;
      var value = localStorage.getItem(key);
      if (value) {
        value = JSON.parse(value);
        if (value && value.running) {
          startTowTruck();
        }
      }
    }
  }

  if (document.readyState == "complete") {
    onload();
  } else {
    window.addEventListener("load", onload, false);
  }

})();
