(function () {

  var button;

  var styles = [
    "http://localhost:8080/towtruck.css"
  ];

  // FIXME: these should all get combined for a production release:
  var scripts = [
    "http://localhost:8080/libs/jquery-1.8.3.min.js",
    "http://localhost:8080/channels.js",
    "http://localhost:8080/towtruck-runner.js"
  ];

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
    script.src = url + "?" + Date.now();;
    document.head.appendChild(script);
  }

  var startTowTruck = window.startTowTruck = function () {
    if (typeof TowTruck !== "undefined") {
      TowTruck.start();
      return;
    }
    // A sort of signal to towtruck-runner.js to tell it to actually
    // start itself (i.e., put up a UI and try to activate)
    if (! window._startTowTruckImmediately) {
      window._startTowTruckImmediately = true;
    }
    styles.forEach(addStyle);
    scripts.forEach(addScript);
  };

  startTowTruck.hubBase = "http://localhost:8080";

  startTowTruck.bookmarklet = function () {
    var s = "window._startTowTruckImmediately=true;";
    styles.forEach(function (url) {
      s += "var link=document.createElement('link');";
      s += "link.setAttribute('rel', 'stylesheet');";
      s += "link.href='" + url + "';";
      s += "document.head.appendChild(link);";
    });
    scripts.forEach(function (url) {
      s += "var script=document.createElement('script');";
      s += "script.src='" + url + "';";
      s += "document.head.appendChild(script);";
    });
    s = "(function () {" + s + "})();void(0)";
    return "javascript:" + encodeURIComponent(s);
  };

  window.addEventListener("load", function () {
    var hash = location.hash.replace(/^#/, "");
    if (hash.search(/^towtruck-/) === 0) {
      var shareId = hash.substr(("towtruck-").length);
      window._startTowTruckImmediately = shareId;
      startTowTruck();
    }
  }, false);

})();
