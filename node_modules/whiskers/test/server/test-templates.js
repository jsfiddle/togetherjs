// test rendering of strange templates

var common = require('./common');
var assert = common.assert;
var whiskers = common.whiskers;

common.expected = 8;

assert.equal(whiskers.render(), '');
assert.equal(whiskers.render('3'), '3');
assert.equal(whiskers.render('{foo}'), '');
assert.equal(whiskers.render('{>bar}'), '');
assert.equal(whiskers.render(3), '3');
assert.equal(whiskers.render([1,2,3]), '1,2,3');
assert.equal(whiskers.render({p:3}), '[object Object]');
assert.equal(whiskers.render(function(){return 3}), 'function (){return 3}');
