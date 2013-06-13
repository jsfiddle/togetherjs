// =SECTION Setup

Test.require("peers");
// => Loaded modules: ...

TowTruckTestSpy.setIdleTime(100);

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
TowTruckTestSpy.setIdleTime(3000);

var el = $('<p>Trigger activity states:<br></p>').prependTo(document.body);

$('<input type="text" placeholder="Idle time (milliseconds)">').appendTo(el).keyup(function (event) {
  var el = $(event.target);
  if (event.which == 13) {
    var value = parseInt(el.val(), 10);
    TowTruckTestSpy.setIdleTime(value);
    el.val("");
  }
});

$('<button>Faker inactive</button>').appendTo(el).click(function () {
  Test.incoming({
    type: "idle-status",
    idle: "inactive",
    clientId: "faker"
  });
});

$('<button>Faker active</button>').appendTo(el).click(function () {
  Test.incoming({
    type: "idle-status",
    idle: "active",
    clientId: "faker"
  });
});
