// =SECTION Setup

Test.require("ui", "chat", "util", "session", "jquery", "storage", "peers", "cursor", "windowing", "templates-en-US");
// => Loaded modules: ...

TogetherJS.config("siteName", "this site");

printChained(
  Test.resetSettings,
  Test.startTogetherJS);

// => ...
