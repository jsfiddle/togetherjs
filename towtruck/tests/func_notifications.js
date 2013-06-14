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

visible(".towtruck-url-change-notification");

/* =>
.towtruck-url-change-notification : visible
*/

$(".towtruck-url-change-notification .towtruck-nudge").click();

/* =>
send: url-change-nudge
  clientId: "me",
  to: "faker",
  url: "..."

 */

// =SECTION Helpers

var el = $('<p>Some perhaps helpful test buttons to trigger events (not all combos are valid):<br></p>').prependTo(document.body);

$("<button>Faker Rejoin</button>").appendTo(el).click(function () {
  Test.newPeer();
});

$("<button>Join Random New Faker</button>").appendTo(el).click(function () {
  var id = Math.floor(Math.random() * 1000);
  Test.newPeer({
    name: "Faker " + id,
    clientId: "random-" + id
  });
});

$('<input placeholder="Change Faker URL">').appendTo(el).keypress(function (ev) {
  if (ev.which == 13) {
    Test.newPeer({url: ev.target.value});
    ev.target.value = "";
  }
});

$('<button>Faker Leave</button>').appendTo(el).click(function () {
  Test.incoming({
    type: "bye",
    clientId: "faker"
  });
});

$('<button>Faker decline</button>').appendTo(el).click(function () {
  Test.incoming({
    type: "bye",
    clientId: "faker",
    reason: "declined-join"
  });
});

$('<button>Nudge Me</button>').appendTo(el).click(function () {
  Test.incoming({
    type: "url-change-nudge",
    clientId: "faker",
    url: peers.getPeer("faker").url,
    to: peers.Self.id
  });
});

$('<button>Keyboard</button>').appendTo(el).click(function () {
  Test.incoming({
    type: "keydown",
    clientId: "faker"
  })
})