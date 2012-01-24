// test calling of function in context

var common = require('./common');
var assert = common.assert;
var render = common.whiskers.render;

common.expected = 1;

var context = {
  add2and2: function() {
    return 2+2;
  }()
};

assert.equal(render('{add2and2}', context), '4');
