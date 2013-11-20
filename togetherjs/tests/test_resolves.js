Test.require("util");
// => Loaded modules: util

var def = util.Deferred();

setTimeout(util.resolver(def, function () {
  return 'ok';
}));

printResolved('item', def);

// => item ok

def = util.Deferred();
var chained = util.Deferred();
setTimeout(util.resolver(def, function () {
  return chained;
}));
setTimeout(function () {
  chained.resolve("second");
});

printResolved('item2', def);

// => item2 second

var defs = [util.Deferred(), util.Deferred(), util.Deferred()];
var result = util.resolveMany(defs);
setTimeout(function () {
  defs[0].resolve('first');
  defs[1].resolve('second');
  defs[2].resolve('last');
});

printResolved(result);
// => ["first", "second", "last"]
