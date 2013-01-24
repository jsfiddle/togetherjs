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

  var startTowTruck = window.startTowTruck = function () {
    if (startTowTruck.loaded) {
      var runner = startTowTruck.require("runner");
      runner.boot();
      return;
    }
    // A sort of signal to towtruck-runner.js to tell it to actually
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
    require = {
      baseUrl: baseUrl + "/towtruck",
      urlArgs: "bust=" + cacheBust,
      deps: ["runner", "ui", "chat", "pointer", "tracker", "webrtc"],
      callback: function () {
        startTowTruck.loaded = true;
        startTowTruck.require = require;
        startTowTruck.define = define;
        callbacks.forEach(function (c) {
          c();
        });
      }
    };
    addScript("/towtruck/require.js");
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

  function onload() {
    var hash = location.hash.replace(/^#/, "");
    if (hash.search(/&towtruck-/) === 0) {
      var shareId = hash.substr(hash.search(/&towtruck-/));
      shareId = shareId.substr(("&towtruck-").length);
      shareId = shareId.replace(/&.*/, "");
      window._startTowTruckImmediately = shareId;
      console.log("starting", shareId);
      startTowTruck();
    } else if (window._TowTruckBookmarklet) {
      delete window._TowTruckBookmarklet;
      startTowTruck();
    }
  }

  if (document.readyState == "complete") {
    onload();
  } else {
    window.addEventListener("load", onload, false);
  }

})();
