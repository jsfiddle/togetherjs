(function () {

  var button;

  var styles = [
    "/towtruck.css"
  ];

  // FIXME: these should all get combined for a production release:
  var scripts = [
    "/towtruck/libs.js",
    "/towtruck/util.js",
    "/towtruck/element-finder.js",
    "/towtruck/channels.js",
    "/towtruck/runner.js",
    "/towtruck/chat.js",
    "/towtruck/webrtc.js",
    "/towtruck/tracker.js",
    "/towtruck/ui.js",
    "/towtruck/pointer.js"
  ];

  var baseUrl = "<%= process.env.PUBLIC_BASE_URL %>";

  // FIXME: I think there's an event that would be called before load?
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
    // FIXME: remove cache buster:
    link.href = baseUrl + url + "?" + Date.now();
    document.head.appendChild(link);
  }

  function addScript(url) {
    var script = document.createElement("script");
    // FIXME: remove cache buster:
    script.src = "<%= process.env.PUBLIC_BASE_URL%>" + url + "?" + Date.now();
    document.head.appendChild(script);
  }

  var startTowTruck = window.startTowTruck = function () {
    if (typeof TowTruck !== "undefined") {
      TowTruck.isClient = false;
      TowTruck.init();
      TowTruck.start();
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
    var start = window._TowTruck_notify_script = function(name) {
      console.log("_TowTruck_notify_script called: " + name);
      var index = scripts.indexOf(name) + 1;
      
      if (index >= scripts.length) {
        delete window._TowTruck_notify_script;
        callbacks.forEach(function (c) {
          c();
        });
        delete window._TowTruckOnLoad;
      } else {
        var tag = document.createElement("script");
        tag.src = baseUrl + scripts[index] + "?cache=" + Date.now();
        console.log({"appending": tag.src});
        document.head.appendChild(tag);
      }
    };
    start();
  };

  startTowTruck.hubBase = "<%= process.env.HUB_BASE %>";

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
