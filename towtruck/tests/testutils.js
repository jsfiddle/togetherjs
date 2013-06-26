TowTruckTestSpy = {};

var Test = {};

/* Loads the modules that are listed as individual arguments, and adds
   them to the global scope.  Blocks on the loading.  Use like:

   Test.require("foo", "bar");
   // => ...
   foo.someFunction()...
*/
Test.require = function () {
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
    loadModules();
  } else if (typeof require == "function") {
    console.log("require.js already loaded; configuring");
    loadModules();
  } else {
    window.require = TowTruck._extend(TowTruck.requireConfig);
    window.require.callback = function () {
      TowTruck.require = require.config({context: "towtruck"});
      loadModules();
    };
    var url = "../libs/require.js";
    var script = document.createElement("script");
    script.src = url;
    console.log("Loading require.js from", url);
    document.head.appendChild(script);
  }
  wait(function () {return done;});
};

Test.IGNORE_MESSAGES = ["cursor-update", "scroll-update", "keypress"];

Test.viewSend = function () {
  // Prints out all send() messages
  var session = TowTruck.require("session");
  if (! TowTruck.running) {
    session.once("start", Test.viewSend);
    return;
  }
  var channel = TowTruckTestSpy.getChannel();
  var oldSend = channel.send;
  channel.send = function (msg) {
    oldSend.apply(channel, arguments);
    Test.viewSend.emit(msg.type, msg);
    if (Test.viewSend.running && Test.IGNORE_MESSAGES.indexOf(msg.type) == -1) {
      if (typeof print == "function") {
        print("send:", msg.type);
        var shortMsg = TowTruck._extend(msg);
        delete shortMsg.type;
        var r = repr(shortMsg, undefined, 10);
        r = "  " + r.replace(/^\{\s+/, "");
        r = r.replace(/\s+\}$/, "");
        print(r);
      } else {
        console.log("send[out-of-test](", msg, ")");
      }
    }
  };
};

TowTruck._mixinEvents(Test.viewSend);
Test.viewSend.running = true;
Test.viewSend.activate = function () {
  Test.viewSend.running = true;
};
Test.viewSend.deactivate = function () {
  Test.viewSend.running = false;
};


Test.newPeer = function (options) {
  options = options || {};
  var msg = {
    type: "hello",
    isClient: false,
    clientId: options.clientId || "faker",
    name: options.name || "Faker",
    avatar: options.avatar || TowTruck.baseUrl + "/images/robot-avatar.png",
    color: options.color || "#ff0000",
    url: options.url || location.href.replace(/#.*/, ""),
    urlHash: options.urlHash || "",
    title: document.title,
    rtcSupported: false
  };
  Test.incoming(msg);
};

Test.waitEvent = function (context, event, options) {
  var ops = TowTruck._extend({wait: true, ignoreThis: true}, options);
  context.once(event, Spy(event, ops));
};

Test.waitMessage = function (messageType) {
  Test.waitEvent(Test.viewSend, messageType, {writes: false});
};

Test.resetSettings = function () {
  var util = TowTruck.require("util");
  var storage = TowTruck.require("storage");
  return $.Deferred(function (def) {
    util.resolveMany(
      storage.settings.set("name", ""),
      storage.settings.set("defaultName", "Jane Doe"),
      storage.settings.set("avatar", undefined),
      storage.settings.set("stickyShare", null),
      storage.settings.set("color", "#00ff00"),
      storage.settings.set("seenIntroDialog", undefined),
      storage.settings.set("seenWalkthrough", undefined),
      storage.settings.set("dontShowRtcInfo", undefined)
    ).then(function () {
      def.resolve("Settings reset");
    });
  });
};

Test.startTowTruck = function () {
  return $.Deferred(function (def) {
    var session = TowTruck.require("session");
    Test.viewSend();
    session.once("ui-ready", function () {
      session.clientId = "me";
      def.resolve("TowTruck started");
    });
    TowTruck.startup._launch = true;
    TowTruck();
  });
};

Test.closeWalkthrough = function () {
  return $.Deferred(function (def) {
    var buttonSelector = "#towtruck-walkthrough .towtruck-dismiss:visible";
    var seenButton = false;
    var id = setInterval(function () {
      var button = $(buttonSelector);
      if (seenButton && ! button.length) {
        // The walkthrough popped up, and then disappeared
        clearTimeout(id);
        def.resolve("Walkthrough closed");
      }
      if ((! seenButton) && button.length) {
        seenButton = true;
        button.click();
      }
    }, 100);
  });
};

Test.normalStartup = function () {
  printChained(
    Test.resetSettings(),
    Test.startTowTruck(),
    Test.closeWalkthrough());
};

function printChained() {
  var args = Array.prototype.slice.call(arguments);
  var index = 0;
  var done = false;
  function run() {
    if (index >= args.length) {
      done = true;
      return;
    }
    args[index].then(function () {
      if (! arguments.length) {
        print("(done)");
      } else {
        print.apply(null, arguments);
      }
      check(1);
    }, function () {
      if (! arguments.length) {
        print("(error)");
      } else {
        print.apply(null, ["Error:"].concat(arguments));
      }
      check(1);
    });
    function check(increment) {
      index += increment;
      setTimeout(run);
    }
  }
  wait(function () {return done;});
  run();
}

Test.incoming = function (msg) {
  TowTruckTestSpy.getChannel().onmessage(msg);
};

Test.addControl = function () {
  var div = $("<div />");
  var el;
  for (var i=0; i<arguments.length; i++) {
    el = $(arguments[i]);
    div.append(el);
  }
  $("#controls").append(div);
  return el;
};
