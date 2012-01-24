var assert = require('assert');
exports.whiskers = require('../../dist/whiskers.min');
// uncomment to test non-minified code
//exports.whiskers = require('../../lib/whiskers');

// in each test, declare `common.expected = n;` for n asserts expected
exports.expected = 0;

var count = 0;
var wrapAssert = function(fn) {
  return function() {
    assert[fn].apply(this, arguments);
    count++;
    process.stdout.write('.');
  };
};

// add all functions from the assert module
exports.assert = {};
for (var fn in assert) {
  if (assert.hasOwnProperty(fn)) {
    exports.assert[fn] = wrapAssert(fn);
  }
}

process.on('exit', function() {
  process.stdout.write(' ran ' + count + ' of ' + exports.expected + ' tests.\n');
});
