// =SECTION Setup

Test.require("ui", "chat", "util", "session", "jquery", "storage", "peers", "cursor", "windowing");
// => Loaded modules: ...

TowTruck.config("siteName", "this site");

printChained(
  Test.resetSettings(),
  Test.startTowTruck());

// => ...
