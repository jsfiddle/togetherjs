/*global storage */
Test.require("storage", "util");
// => Loaded modules: storage util

print(storage);
// => [storage for localStorage]

printResolved(storage.clear(), storage.tab.clear());
// => (resolved) (resolved)

printResolved(storage.keys(), storage.tab.keys());
// => [] []

printResolved(storage.tab.set("foo", "bar"));
// => (resolved)

printResolved(storage.tab.keys());
// => ["foo"]
