// =SECTION Setup

Test.require("peers", "templates-en-US");
// => Loaded modules: ...

TogetherJSTestSpy.setIdleTime(100);

Test.normalStartup();

// => ...

Test.newPeer();

// => ...

// =SECTION Test

var peer = peers.getPeer("faker");
print(peer.status, peer.idle);

// => live active

wait(200);
// =>

print(peer.status, peer.idle);

// => live inactive

// =SECTION Manual test code

// 3 second idle time:
TogetherJSTestSpy.setIdleTime(3000);

Test.addControl('<div>Trigger activity states:</div>');

Test.addControl($('<input type="text" placeholder="Idle time (milliseconds)">').keyup(function (event) {
  var el = $(event.target);
  if (event.which == 13) {
    var value = parseInt(el.val(), 10);
    TogetherJSTestSpy.setIdleTime(value);
    el.val("");
  }
}));

Test.addControl($('<button>Faker inactive</button>').click(function () {
  Test.incoming({
    type: "idle-status",
    idle: "inactive",
    clientId: "faker"
  });
}));

Test.addControl($('<button>Faker active</button>').click(function () {
  Test.incoming({
    type: "idle-status",
    idle: "active",
    clientId: "faker"
  });
}));
