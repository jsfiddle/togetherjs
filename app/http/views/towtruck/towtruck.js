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

  var TowTruck = window.TowTruck = function (doneCallback) {
    if (TowTruck._loaded) {
      var session = TowTruck.require("session");
      session.start();
      // Note if this is an event handler, doneCallback will be an
      // event object and not a function
      if (doneCallback && typeof doneCallback == "function") {
        doneCallback();
      }
      return;
    }
    // A sort of signal to session.js to tell it to actually
    // start itself (i.e., put up a UI and try to activate)
    TowTruck.startTowTruckImmediately = true;
    styles.forEach(addStyle);
    var config = {
      context: "towtruck",
      baseUrl: baseUrl + "/towtruck",
      urlArgs: "bust=" + cacheBust,
      paths: {
        jquery: "libs/jquery-1.8.3.min",
        walkabout: "libs/walkabout.js/walkabout"
      }
    };
    var deps = ["session"];
    function callback() {
      TowTruck._loaded = true;
      TowTruck.require = require.config({context: "towtruck"});
      if (doneCallback && typeof doneCallback == "function") {
        doneCallback();
      }
    }
    if (typeof require == "function") {
      TowTruck.require = require.config(config);
    }
    if (typeof TowTruck.require == "function") {
      // This is an already-configured version of require
      TowTruck.require(deps, callback);
    } else {
      config.deps = deps;
      config.callback = callback;
      window.require = config;
    }
    // FIXME: we should namespace require.js to avoid conflicts.  See:
    //   https://github.com/jrburke/r.js/blob/master/build/example.build.js#L267
    //   http://requirejs.org/docs/faq-advanced.html#rename
    addScript("/towtruck/libs/require.js");
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

  TowTruck.hubBase = "<%= process.env.HUB_BASE %>";
  TowTruck.baseUrl = baseUrl;

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
    var newHash = hash.substr(0, m.index) + hash.substr(m.index + m[0].length);
    location.hash = newHash;
  }

  function conditionalOnload() {
    // A page can define this function to defer TowTruck from starting
    if (window._TowTruckCallToStart) {
      window._TowTruckCallToStart(onload);
    } else {
      onload();
    }
  }

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
