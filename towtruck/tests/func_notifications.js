// =SECTION Setup

function visible() {
  Array.prototype.slice.call(arguments).forEach(function (s) {
    var el = $(s);
    var status;
    if (! el.length) {
      status = "does not exist";
    } else if (el.is(":visible")) {
      status = "visible";
    } else {
      status = "hidden";
    }
    print(s, ":", status);
  });
}

Test.require("ui", "chat", "util", "session", "jquery", "storage", "peers", "cursor", "windowing");
// => Loaded modules: ...

Test.normalStartup();

// => ...

Test.newPeer();

// => ...

visible("#towtruck-chat-notifier");

// => #towtruck-chat-notifier : visible

$("#towtruck-chat-notifier .towtruck-dismiss").click();

Test.incoming({
  type: "chat",
  clientId: "faker",
  text: "Test",
  messageId: "test-message"
});

// => ...

visible("#towtruck-chat-notifier", "#towtruck-chat");

/* =>
#towtruck-chat-notifier : visible
#towtruck-chat : hidden
*/

$("#towtruck-chat-button").click();
visible("#towtruck-chat-notifier", "#towtruck-chat");

/* =>
#towtruck-chat-notifier : hidden
#towtruck-chat : visible
*/

$("#towtruck-chat .towtruck-close").click();
visible("#towtruck-chat-notifier", "#towtruck-chat");

/* =>
#towtruck-chat-notifier : hidden
#towtruck-chat : hidden
*/

$("#towtruck-chat-button").click();

Test.incoming({
  type: "chat",
  clientId: "faker",
  text: "Test 2",
  messageId: "test-message"
});
visible("#towtruck-chat-notifier", "#towtruck-chat");

/* =>
#towtruck-chat-notifier : hidden
#towtruck-chat : visible
*/

$("#towtruck-chat .towtruck-close").click();
Test.incoming({
  type: "bye",
  clientId: "faker"
});

// =>

visible("#towtruck-chat-notifier", "#towtruck-chat");

/* =>
#towtruck-chat-notifier : visible
#towtruck-chat : hidden
*/

// Now we'll bring back the user:
Test.newPeer({url: "http://example.com/foo"});

// => ...

visible(".towtruck-follow");

/* =>
.towtruck-follow : visible
*/

$(".towtruck-nudge").click();

/* =>
send: url-change-nudge
  clientId: "me",
  to: "faker",
  url: "..."

 */

// =SECTION Helpers

Test.addControl('<div>Some perhaps helpful test buttons to trigger events (not all combos are valid):</div>');

Test.addControl($("<button>Faker Rejoin</button>").click(function () {
  Test.newPeer();
}));

Test.addControl($("<button>Join Random New Faker</button>").click(function () {
  var id = Math.floor(Math.random() * 1000);
  Test.newPeer({
    name: "Faker " + id,
    clientId: "random-" + id
  });
}));

Test.addControl($('<input placeholder="Change Faker URL">').keypress(function (ev) {
  if (ev.which == 13) {
    Test.newPeer({url: ev.target.value});
    ev.target.value = "";
  }
}));

Test.addControl($('<button>Faker Leave</button>').click(function () {
  Test.incoming({
    type: "bye",
    clientId: "faker"
  });
}));

Test.addControl($('<button>Faker decline</button>').click(function () {
  Test.incoming({
    type: "bye",
    clientId: "faker",
    reason: "declined-join"
  });
}));

Test.addControl($('<button>Nudge Me</button>').click(function () {
  Test.incoming({
    type: "url-change-nudge",
    clientId: "faker",
    url: peers.getPeer("faker").url,
    to: peers.Self.id
  });
}));

Test.addControl($('<button>Keyboard</button>').click(function () {
  Test.incoming({
    type: "keydown",
    clientId: "faker"
  });
}));
