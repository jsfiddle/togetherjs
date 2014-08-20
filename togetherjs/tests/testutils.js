TogetherJSTestSpy = {};

var Test = {};

/* Loads the modules that are listed as individual arguments, and adds
   them to the global scope.  Blocks on the loading.  Use like:

       Test.require("foo", "bar");
       // => ...
       foo.someFunction()...

   If you want to alias something, do:

       Test.require({myConsole: "console"})
       // => ...
       myConsole.log()
*/
Test.require = function () {
  var done = false;
  var args = Array.prototype.slice.call(arguments);
  var modules = [];
  var aliases = {};
  args.forEach(function (m) {
    if (typeof m == "object") {
      for (var alias in m) {
        if (m.hasOwnProperty(alias)) {
          modules.push(m[alias]);
          aliases[m[alias]] = alias;
        }
      }
    } else {
      modules.push(m);
    }
  });

  function loadModules() {
    if (! modules.length) {
      print("Require loaded");
      done = true;
      return;
    }
    TogetherJS.require(modules, function () {
      for (var i=0; i<modules.length; i++) {
        var localName = aliases[modules[i]] || modules[i];
        window[localName] = arguments[i];
      }
      var msg = ["Loaded modules:"].concat(modules);
      print.apply(null, msg);
      TogetherJS._loaded = true;
      done = true;
    });
  }

  if (TogetherJS.require) {
    console.log("TogetherJS already initialized");
    loadModules();
  } else if (typeof require == "function") {
    console.log("require.js already loaded; configuring");
    loadModules();
  } else {
    window.require = TogetherJS._extend(TogetherJS.requireConfig);
    window.require.callback = function () {
      TogetherJS.require = require.config({context: "togetherjs"});
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
  var session = TogetherJS.require("session");
  if (! TogetherJS.running) {
    session.once("start", Test.viewSend);
    return;
  }
  var channel = TogetherJSTestSpy.getChannel();
  var oldSend = channel.send;
  channel.send = function (msg) {
    oldSend.apply(channel, arguments);
    Test.viewSend.emit(msg.type, msg);
    if (Test.viewSend.running && Test.IGNORE_MESSAGES.indexOf(msg.type) == -1) {
      if (typeof print == "function") {
        print("send:", msg.type);
        var shortMsg = TogetherJS._extend(msg);
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

TogetherJS._mixinEvents(Test.viewSend);
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
    avatar: options.avatar || TogetherJS.baseUrl + "/togetherjs/images/robot-avatar.png",
    color: options.color || "#ff0000",
    url: options.url || location.href.replace(/#.*/, ""),
    urlHash: options.urlHash || "",
    title: document.title,
    rtcSupported: false
  };
  Test.incoming(msg);
};

Test.waitEvent = function (context, event, options) {
  var ops = TogetherJS._extend({wait: true, ignoreThis: true}, options);
  context.once(event, Spy(event, ops));
};

Test.waitMessage = function (messageType) {
  Test.waitEvent(Test.viewSend, messageType, {writes: false});
};

Test.resetSettings = function () {
  var util = TogetherJS.require("util");
  var storage = TogetherJS.require("storage");
  return $.Deferred(function (def) {
    util.resolveMany(
      storage.settings.set("name", ""),
      storage.settings.set("defaultName", "Jane Doe"),
      storage.settings.set("avatar", undefined),
      storage.settings.set("stickyShare", null),
      storage.settings.set("color", "#00ff00"),
      storage.settings.set("seenIntroDialog", undefined),
      storage.settings.set("seenWalkthrough", undefined),
      storage.settings.set("dontShowRtcInfo", undefined),
      storage.tab.set("chatlog", undefined)
    ).then(function () {
      def.resolve("Settings reset");
    });
  });
};

Test.startTogetherJS = function () {
  return $.Deferred(function (def) {
    var session = TogetherJS.require("session");
    Test.viewSend();
    session.once("ui-ready", function () {
      session.clientId = "me";
      def.resolve("TogetherJS started");
    });
    TogetherJS.startup._launch = true;
    TogetherJS();
  });
};

Test.closeWalkthrough = function () {
  return $.Deferred(function (def) {
    var buttonSelector = "#togetherjs-walkthrough .togetherjs-dismiss:visible";
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
    Test.resetSettings,
    Test.startTogetherJS,
    Test.closeWalkthrough);
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
    var f = args[index];
    if (!f.then) { f = f(); }
    f.then(function () {
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
  TogetherJSTestSpy.getChannel().onmessage(msg);
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
