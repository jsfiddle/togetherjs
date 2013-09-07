// =SECTION Setup

Test.require("ui", "chat", "util", "session", "jquery", "storage", "peers", "cursor", "windowing", "elementFinder");
// => Loaded ...

printChained(
  Test.resetSettings(),
  storage.settings.set("seenIntroDialog", true),
  storage.settings.set("seenWalkthrough", true),
  storage.settings.set("dontShowRtcInfo", true),
  Test.startTogetherJS());

// => ...

function addPeer(id) {
  var name = "Faker";
  if (id) {
    name += " " + id;
  }
  id = id || 'faker';
  var color = "#" + Math.floor(Math.random() * 0xffffff).toString(16);
  Test.newPeer({
    name: name,
    color: color,
    clientId: id
  });
  var len = peers.getAllPeers().length;
  var pageHeight = $(document).height();
  var left = (len * 40) % $(window).width();
  var top = len % 2 ? (len * 10) : (pageHeight - 100 - len * 10);
  Test.incoming({
    type: "cursor-update",
    top: top,
    left: left,
    clientId: id
  });
}

function pick(seq) {
  if (! seq) {
    seq = peers.getAllPeers(true);
  }
  return seq[Math.floor(Math.random() * seq.length)];
}

addPeer();
// => ...

// =SECTION Controls


// =SECTION Helpers

Test.addControl(

  $("<button>Animate in cursor/box</button>").click(function () {
    //$(".togetherjs-cursor").fadeOut();
  }),

  $("<button>Animate out cursor/box</button>").click(function () {
    //$(".togetherjs-cursor").fadeOut();
  }),

  $("<button>Faker Join</button>").click(function () {
    addPeer();
  }),
  $("<button>Join Random</button>").click(function () {
    addPeer("faker-" + Math.floor(Math.random() * 1000));
  }),
  $('<button>Leave</button>').click(function () {
    var peer = pick();
    Test.incoming({
      type: "bye",
      clientId: peer.id
    });

  }),
  $('<button>Decline</button>').click(function () {
    var peer = pick();
    Test.incoming({
      type: "bye",
      clientId: peer.id,
      reason: "declined-join"
    });
  })
);

Test.addControl(
  $('<input placeholder="Change Faker URL">').keypress(function (ev) {
    if (ev.which == 13) {
      Test.newPeer({url: ev.target.value});
      ev.target.value = "";
    }
  }),
  $('<button>Other URL</button>').click(function () {
    Test.newPeer({url: "http://example.com/?" + Date.now()});
  }),
  $('<button>Same URL</button>').click(function () {
    var url = location.href.replace(/\#.*/, "");
    Test.newPeer({url: url});
  })
);

Test.addControl($('<button>Nudge Me</button>').click(function () {
  var peer = pick();
  Test.incoming({
    type: "url-change-nudge",
    clientId: peer.id,
    url: peer.url,
    to: peers.Self.id
  });
}));

var focused = {};
Test.addControl($('<button>Focus something</button>').click(function () {
  var peer = pick();
  if (focused[peer.id]) {
    Test.incoming({
      type: "form-focus",
      element: null,
      clientId: peer.id,
      url: peer.url
    });
    focused[peer.id] = null;
    return;
  }
  var els = $("#controls textarea:visible, #controls input:visible, #controls select:visible");

  var el = $(els[Math.floor(els.length * Math.random())]);
  focused[peer.id] = el;
  Test.incoming({
    type: "form-focus",
    element: elementFinder.elementLocation(el),
    clientId: peer.id,
    url: peer.url
  });
}));

Test.addControl($('<input placeholder="Incoming chat">').keypress(function (event) {
  var el = $(event.target);
  if (event.which == 13) {
    var peer = pick();
    Test.incoming({
      type: "chat",
      text: el.val(),
      messageId: 'message-' + Date.now(),
      clientId: peer.id
    });
    el.val("");
  }
}));

var el = $('<div><label for="idle-check">Quick idle <input type="checkbox" id="idle-check"></label>' +
           '<label for="expire-check">Quick expire <input type="checkbox" id="expire-check"></label></div>');
el.find("#idle-check").change(function (event) {
  if (event.target.checked) {
    TogetherJSTestSpy.setIdleTime(100);
  } else {
    TogetherJSTestSpy.setIdleTime(3*60*1000);
  }
});
el.find("#expire-check").change(function (event) {
  if (event.target.checked) {
    TogetherJSTestSpy.setByeTime(10*1000);
  } else {
    TogetherJSTestSpy.setIdleTime(10*60*1000);
  }
});
Test.addControl(el);

Test.addControl(
  $('<button>Inactive</button>').click(function () {
    Test.incoming({
      type: "idle-status",
      idle: "inactive",
      clientId: "faker"
    });
  }),
  $('<button>Active</button>').click(function () {
    Test.incoming({
      type: "idle-status",
      idle: "active",
      clientId: "faker"
    });
  }),
  $('<button>Keyboard</button>').click(function () {
    Test.incoming({
      type: "keydown",
      clientId: "faker"
    });
  })
);

Test.addControl($('<input placeholder="Tool name">').keypress(function (event) {
  var el = $(event.target);
  if (event.which == 13) {
    TogetherJS.config("toolName", el.val() || null);
    el.val("");
  }
}));
