TowTruckTestSpy = {};

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
      print("Require loaded");
      done = true;
      return;
    }
    TowTruck.require(modules, function () {
      for (var i=0; i<modules.length; i++) {
        window[modules[i]] = arguments[i];
      }
      var msg = ["Loaded modules:"].concat(modules);
      print.apply(null, msg);
      TowTruck._loaded = true;
      done = true;
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

var IGNORE_MESSAGES = ["cursor-update", "scroll-update"];

function viewSend() {
  // Prints out all send() messages
  if (! TowTruck.running) {
    session.once("start", viewSend);
    return;
  }
  var channel = TowTruck.require("session")._getChannel();
  var oldSend = channel.send;
  channel.send = function (msg) {
    oldSend.apply(channel, arguments);
    viewSend.emit(msg.type, msg);
    if (viewSend.running && IGNORE_MESSAGES.indexOf(msg.type) == -1) {
      if (typeof print == "function") {
        print("send:", msg.type);
        var shortMsg = TowTruck._extend(msg);
        delete shortMsg.type;
        var r = repr(shortMsg);
        r = "  " + r.replace(/^\{\s+/, "");
        r = r.replace(/\s+\}$/, "");
        print(r);
      } else {
        console.log("send[out-of-test](", msg, ")");
      }
    }
  };
}

function newPeer(options) {
  options = options || {};
  var msg = {
    type: "hello",
    clientId: options.clientId || "faker",
    name: options.name || "Faker",
    avatar: options.avatar || TowTruck.baseUrl + "/images/robot-avatar.png",
    color: options.color || "#ff0000",
    url: location.href.replace(/#.*/, ""),
    urlHash: "",
    title: document.title,
    rtcSupported: false
  };
  TowTruck.require("session")._getChannel().onmessage(msg);
}


TowTruck._mixinEvents(viewSend);
viewSend.running = true;
// FIXME: this looks like events:
viewSend.activate = function () {
  viewSend.running = true;
};
viewSend.deactivate = function () {
  viewSend.running = false;
};

function waitEvent(context, event, options) {
  var ops = TowTruck._extend({wait: true, ignoreThis: true}, options);
  context.once(event, Spy(event, ops));
}

function waitMessage(messageType) {
  waitEvent(viewSend, messageType, {writes: false});
}
