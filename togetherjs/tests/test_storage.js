/*global storage */
Test.require("storage", "util");
// => Loaded modules: storage util

print(storage.storage);
// => [storage for localStorage]

printResolved(storage.storage.clear(), storage.storage.tab.clear());
// => (resolved) (resolved)

printResolved(storage.storage.keys(), storage.storage.tab.keys());
// => [] []

printResolved(storage.storage.tab.set("foo", "bar"));
// => (resolved)

printResolved(storage.storage.tab.keys());
// => ["foo"]
