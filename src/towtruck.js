(function () {

  var button;

  var styles = [
    "http://localhost:8080/towtruck.css"
  ];

  // FIXME: these should all get combined for a production release:
  var scripts = [
    "http://localhost:8080/libs/jquery-1.8.3.min.js",
    "http://localhost:8080/libs/underscore-1.4.3.min.js",
    "http://localhost:8080/util.js",
    "http://localhost:8080/element-finder.js",
    "http://localhost:8080/channels.js",
    "http://localhost:8080/towtruck-runner.js",
    "http://localhost:8080/chat.js",
    "http://localhost:8080/webrtc.js",
    "http://localhost:8080/tracker.js",
    "http://localhost:8080/ui.js",
    "http://localhost:8080/pointer.js",
    "http://localhost:8080/libs/walkabout.js/walkabout.js"
    //"http://localhost:8080/libs/sharejs/src/client/microevent.js",
    //"http://localhost:8080/libs/sharejs/src/types/helpers.js",
    //"http://localhost:8080/libs/sharejs/src/client/textarea.js",
    //"http://localhost:8080/libs/sharejs/src/client/cm.js",
    //"http://localhost:8080/libs/sharejs/src/types/text.js",
    //"http://localhost:8080/libs/sharejs/src/types/text-api.js"
  ];

  var selfScript = "http://localhost:8080/towtruck.js";

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
    link.href = url + "?" + Date.now();
    document.head.appendChild(link);
  }

  function addScript(url) {
    var script = document.createElement("script");
    // FIXME: remove cache buster:
    script.src = url + "?" + Date.now();
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
    var start = window._TowTruck_notify_script = function (name) {
      var index = 0;
      if (name) {
        for (var i=0; i<scripts.length; i++) {
          if (scripts[i].replace(/.*\//, "") == name + ".js") {
            index = i + 1;
            break;
          }
        }
      }
      if (index >= scripts.length) {
        delete window._TowTruck_notify_script;
        callbacks.forEach(function (c) {
          c();
        });
        delete window._TowTruckOnLoad;
      } else {
        var tag = document.createElement("script");
        tag.src = scripts[index] + "?cache=" + Date.now();
        document.head.appendChild(tag);
      }
    };
    start();
  };

  startTowTruck.hubBase = "http://localhost:8080";

  startTowTruck.bookmarklet = function () {
    var s = "window._TowTruckBookmarklet = true;";
    s += "s=document.createElement('script');";
    s += "s.src=" + JSON.stringify(selfScript) + ";";
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
    }
    if (window._TowTruckBookmarklet) {
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
