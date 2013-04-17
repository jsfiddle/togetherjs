/*global storage */
$("#fixture, #other").hide();
getRequire("storage", "util");
// => Loaded modules: storage util

print(storage);
// => [Module storage]

printResolved(storage.clear());
// => (resolved)

printResolved(storage.keys(), storage.tab.keys());
// => [] []

printResolved(storage.tab.set("foo", "bar"));
// => (resolved)

printResolved(storage.keys());
// => ["towtruck-?.foo"]

printResolved(storage.keys().then(function (keys) {
  var value = storage.get(keys[0]);
  return value.then(function (val) {
    // Very old:
    val.date = 1;
    return storage.set(keys[0], val);
  });
}));
// => (resolved)

printResolved(storage.tab.expire());
// => (resolved)
printResolved(storage.keys());
// => []
