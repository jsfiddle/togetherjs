// test compiling

var common = require('./common');
var assert = common.assert;
var compile = common.whiskers.compile;

common.expected = 5;

assert.ok(compile());
assert.ok(compile('3'));
assert.ok(compile(3));
assert.ok(compile({p:3}));

var template = '{sue} and {sam} and {for x in nums}{x}{/for}';
var context = {
  sue: 'bob',
  sam: 'sal',
  nums: [1,2,3]
}
assert.equal(compile(template)(context), 'bob and sal and 123');
