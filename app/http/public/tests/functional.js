// =SECTION Setup

$("#other").remove();

getRequire("ui", "chat", "util", "session", "jquery", "storage", "peers", "cursor");
// => Loaded modules: ...

printResolved(
  storage.settings.set("name", ""),
  storage.settings.set("defaultName", "Jane Doe"),
  storage.settings.set("avatar", undefined),
  storage.settings.set("stickyShare", null),
  storage.settings.set("color", "#00ff00"),
  storage.settings.set("seenIntroDialog", true),
  storage.settings.set("seenWalkthrough", true),
  storage.settings.set("dontShowRtcInfo", true),
  "done."
  );
// => (resolved) ... done.

viewSend();
waitEvent(session, "ui-ready");
TowTruck.startup._launch = true;
TowTruck();

/* =>
ui-ready([Module ui])
send: hello
  avatar: "...",
  clientId: "...",
  clientVersion: "unknown",
  color: "#00ff00",
  name: "Jane Doe",
  rtcSupported: true,
  starting: true,
  title: "TowTruck tests",
  url: ".../tests/?name=functional.js",
  urlHash: ""
*/

session.clientId = "me";

// =SECTION Peer handling

// We'll be faking the existence of a peer here by sending messages in:

var incoming = session._getChannel().onmessage;
print(incoming);
// => function (msg) {...}

viewSend.deactivate();
newPeer();
wait(500);

// =>

incoming({
  type: "cursor-update",
  clientId: "faker",
  top: 100,
  left: 100
});

wait(300);

// =>

var fakeCursor = TowTruckTestSpy.Cursor.getClient("faker");
print(fakeCursor.element && fakeCursor.element.is(":visible"));

// => true

var faker = peers.getPeer("faker");
print(faker);

// => Peer("faker")

print(faker.status, faker.idle, faker.view.dockElement && faker.view.dockElement.is(":visible"));

// => live active true
/*
incoming({
  type: "bye",
  clientId: "faker"
});

wait(100);

// =>

print(faker.status, faker.idle, faker.dockElement && faker.dockElement.is(":visible"));

// => bye active undefined

print(fakeCursor.element && fakeCursor.element.is(":visible"));

// => false
*/
