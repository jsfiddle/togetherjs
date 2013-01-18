// =SECTION Modules

// First we test that we can load modules

startTowTruck();
wait(500);

// =>

var ui, chat, util, runner;
require(
  ["ui", "chat", "util", "runner"],
  Spy("loader", function (uiMod, chatMod, utilMod, runnerMod) {
    ui = uiMod;
    chat = chatMod;
    util = utilMod;
    runner = runnerMod;
    print("loaded");
  }, {writes: false, wait: true}));

// => loaded

print(ui.isChatEmpty());
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
true
true
false
*/

var oldSend = runner.channel.send;
runner.channel.send = Spy("send", function () {
  oldSend.apply(runner.channel, arguments);
}, {ignoreThis: true});
var oldOnMessage = runner.channel.onmessage;
runner.channel.onmessage = Spy("onmessage", function () {
  oldOnMessage.apply(runner.channel, arguments);
}, {ignoreThis: true});

chat.Chat.submit("next");
/* =>
send({
  clientId: "?",
  messageId: "?-?",
  text: "next",
  type: "chat"
})
*/
