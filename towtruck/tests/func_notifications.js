// =SECTION Setup

Test.require("ui", "chat", "util", "session", "jquery", "storage", "peers", "cursor", "windowing");
// => Loaded modules: ...

Test.normalStartup();

// => ...

Test.newPeer();

// => ...

Test.incoming({
  type: "chat",
  clientId: "faker",
  text: "Test",
  messageId: "test-message"
});

// => ...

print("towtruck-chat-notifier:", $("#towtruck-chat-notifier").is(":visible"));
print("towtruck-chat:", $("#towtruck-chat").is(":visible"));

/* =>
towtruck-chat-notifier: true
towtruck-chat: false
*/

$("#towtruck-chat-button").click();
print("towtruck-chat-notifier:", $("#towtruck-chat-notifier").is(":visible"));
print("towtruck-chat:", $("#towtruck-chat").is(":visible"));

/* =>
towtruck-chat-notifier: false
towtruck-chat: true
*/

$("#towtruck-chat .towtruck-close").click();
print("towtruck-chat-notifier:", $("#towtruck-chat-notifier").is(":visible"));
print("towtruck-chat:", $("#towtruck-chat").is(":visible"));

/* =>
towtruck-chat-notifier: false
towtruck-chat: false
*/

$("#towtruck-chat-button").click();

Test.incoming({
  type: "chat",
  clientId: "faker",
  text: "Test 2",
  messageId: "test-message"
});
print("towtruck-chat-notifier:", $("#towtruck-chat-notifier").is(":visible"));
print("towtruck-chat:", $("#towtruck-chat").is(":visible"));

/* =>
towtruck-chat-notifier: false
towtruck-chat: true
*/

$("#towtruck-chat .towtruck-close").click();
Test.incoming({
  type: "bye",
  clientId: "faker"
});

// =>

print("towtruck-chat-notifier:", $("#towtruck-chat-notifier").is(":visible"));
print("towtruck-chat:", $("#towtruck-chat").is(":visible"));

/* =>
towtruck-chat-notifier: true
towtruck-chat: false
*/
