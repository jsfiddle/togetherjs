(function () {

function RandomStream(seed) {
  if (! seed) {
    seed = Date.now();
  }
  if (typeof seed != "number") {
    seed = parseInt(seed, 10);
  }
  if ((! seed) || isNaN(seed)) {
    throw "Bad seed";
  }
  var x = (seed % 30268) + 1;
  seed = (seed - (seed % 30268)) / 30268;
  var y = (seed % 30306) + 1;
  seed = (seed - (seed % 30306)) / 30306;
  var z = (seed % 30322) + 1;
  seed = (seed - (seed % 30322)) / 30322;
  return function random() {
    x = (171 * x) % 30269;
    y = (172 * y) % 30307;
    z = (170 * z) % 30323;
    if (random.logState) {
      console.log('x', x, 'y', y, 'z', z);
    }
    return (x / 30269.0 + y / 30307.0 + z / 30323.0) % 1.0;
  };
}

// Support for AMD/requirejs, CommonJS/Node, and no module system:
if (typeof define != "undefined") {
  define([], function () {return RandomStream;});
} else if (typeof module != "undefined") {
  module.exports = RandomStream;
} else {
  window.WHRandomStream = RandomStream;
}

})();
