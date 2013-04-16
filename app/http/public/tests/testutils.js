/* Adds a global trequire which is the TowTruck-local require() function.
   May be async, so use like:

   getRequire();
   // => Require loaded
   session = trequire("session");
   ...

   Optional variable arguments are modules to pre-load.  These modules
   will each be added to the global scope.
   */
function getRequire() {
  var done = false;
  var modules = Array.prototype.slice.call(arguments);

  function loadModules() {
    if (! modules.length) {
      done = true;
      print("Require loaded");
      return;
    }
    TowTruck.require(modules, function () {
      for (var i=0; i<modules.length; i++) {
        window[modules[i]] = arguments[i];
      }
      done = true;
      var msg = ["Loaded modules:"].concat(modules);
      print.apply(null, msg);
    });
  }

  if (TowTruck.require) {
    console.log("TowTruck already initialized");
    window.trequire = TowTruck.require;
    loadModules();
  } else if (typeof require == "function") {
    console.log("require.js already loaded; configuring");
    window.trequire = TowTruck.require = require.config(TowTruck.requireConfig);
    loadModules();
  } else {
    window.require = TowTruck._extend(TowTruck.requireConfig);
    window.require.callback = function () {
      done = true;
      window.trequire = TowTruck.require = require.config({context: "towtruck"});
      loadModules();
    };
    var url = "../towtruck/libs/require.js";
    var script = document.createElement("script");
    script.src = url;
    console.log("Loading require.js from", url);
    document.head.appendChild(script);
  }
  wait(function () {return done;});
}
