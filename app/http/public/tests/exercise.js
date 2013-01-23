// =SECTION Loading

// First we test that we can load modules

startTowTruck();
wait(500);

// =>

var ui, chat, util, runner, tracker, $;
require(
  ["ui", "chat", "util", "runner", "tracker", "jquery"],
  Spy("loader", function (uiMod, chatMod, utilMod, runnerMod, trackerMod, $mod) {
    ui = uiMod;
    chat = chatMod;
    util = utilMod;
    runner = runnerMod;
    tracker = trackerMod;
    $ = $mod;
    print("loaded");
  }, {writes: false, wait: true}));

// => loaded

var oldSend = runner.channel.send;
runner.channel.send = Spy("send", function () {
  oldSend.apply(runner.channel, arguments);
}, {ignoreThis: true});
var oldOnMessage = runner.channel.onmessage;
runner.channel.onmessage = Spy("onmessage", function () {
  oldOnMessage.apply(runner.channel, arguments);
}, {ignoreThis: true});

// Clear chat so we don't have old chat logs from previous tests:
chat.Chat.submit("/clear");

$("#other-client").attr("src", runner.shareUrl());
print(runner.shareUrl());
wait(1000);

/* =>
.../tests/?name=exercise.js#&towtruck-?
...
*/


// =SECTION Test chat

chat.Chat.submit("hey you");
print(ui.isChatEmpty());
runner.messageHandler.emit("chat", {
  type: "chat",
  clientId: "foo",
  text: "from other",
  messageId: "test-message"
});
print(ui.isChatEmpty());

/* =>
send({
  clientId: "?",
  messageId: "?-?",
  text: "hey you",
  type: "chat"
})
true
false
*/

chat.Chat.submit("next");
/* =>
send({
  clientId: "?",
  messageId: "?-?",
  text: "next",
  type: "chat"
})
*/

// =SECTION Test trackers

print(tracker.trackers._trackers);
/* =>
{
  CodeMirrorTracker: [Class CodeMirrorTracker],
  FormFieldTracker: [Class FormFieldTracker],
  TextTracker: [Class TextTracker]
}
*/

print(tracker.trackers.active);

/* =>
[
  [TextTracker channel: "tracker-textarea-textarea" element: #textarea],
  [FormFieldTracker channel: "tracker-formfield"]
]
*/

$("#yes").attr("checked", "checked");
$("#yes").change();
wait();

/* =>
send({
  message: {checked: true, elementLocation: "#yes", op: "change", value: "on"},
  routeId: "tracker-formfield",
  type: "route"
})
*/

$("#textarea").val("test");
$("#textarea").change();

/* =>
send({
  message: {
    end: 0,
    fullText: "test",
    newLength: 4,
    oldLength: 0,
    oldText: "",
    op: "change",
    removed: "",
    start: 0,
    text: "test"
  },
  routeId: "tracker-textarea-textarea",
  type: "route"
})
*/

$("#textarea").val("texxst");
$("#textarea").change();

/* =>
send({
  message: {
    end: 2,
    fullText: "texxst",
    newLength: 6,
    oldLength: 4,
    oldText: "test",
    op: "change",
    removed: "",
    start: 2,
    text: "xx"
  },
  routeId: "tracker-textarea-textarea",
  type: "route"
})
*/
