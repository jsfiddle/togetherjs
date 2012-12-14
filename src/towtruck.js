(function () {

  var button;

  var styles = [
    "http://localhost:8080/towtruck.css"
  ];

  // FIXME: these should all get combined for a production release:
  var scripts = [
    "http://localhost:8080/libs/jquery-1.8.3.min.js",
    "http://localhost:8080/libs/underscore-1.4.3.min.js",
    "http://localhost:8080/channels.js",
    "http://localhost:8080/towtruck-runner.js",
    "http://localhost:8080/libs/sharejs/src/client/microevent.js",
    "http://localhost:8080/libs/sharejs/src/types/helpers.js",
    "http://localhost:8080/libs/sharejs/src/client/doc.js",
    "http://localhost:8080/libs/sharejs/src/client/textarea.js",
    "http://localhost:8080/libs/sharejs/src/client/cm.js",
    "http://localhost:8080/libs/sharejs/src/types/text.js",
    "http://localhost:8080/libs/sharejs/src/types/text-api.js"
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
    var s = "window._startTowTruckImmediately=true;";
    styles.forEach(function (url) {
      s += "var link=document.createElement('link');";
      s += "link.setAttribute('rel', 'stylesheet');";
      s += "link.href='" + url + "';";
      s += "document.head.appendChild(link);";
    });
    s += "var scripts = " + JSON.stringify(scripts) + ";";
    s += "var start = window._TowTruck_notify_script = function (name) {";
    s += "var index = 0;";
    s += "if (name) {";
    s += "for (var i=0; i<scripts.length; i++) {";
    //s += "console.log('checking', scripts[i].replace(/.*\\//, ''), name);";
    s += "if (scripts[i].replace(/.*\\//, '') == name + '.js') {";
    s += "index = i+1;";
    s += "break;";
    s += "}"; // if
    s += "}"; // for
    s += "}\n"; // if
    s += "if (index >= scripts.length) {";
    s += "delete window._TowTruck_notify_script;";
    s += "} else {";
    s += "var tag = document.createElement('script');";
    s += "tag.src = scripts[index] + '?cache=' + Date.now();";
    //s += "console.log('script', index, scripts[index]);";
    s += "document.head.appendChild(tag);";
    s += "}"; // if/else
    s += "};"; // function
    s += "start();";
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
