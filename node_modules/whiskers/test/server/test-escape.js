// test escaping of tags

var common = require('./common');
var assert = common.assert;
var render = common.whiskers.render;

common.expected = 9;

assert.equal(render('\\{bob}'), '{bob}');
assert.equal(render('\\{bob.bloss}'), '{bob.bloss}');
assert.equal(render('\\{>reindeer}'), '{>reindeer}');
assert.equal(render('\\{for anger in mgmt}'), '{for anger in mgmt}');
assert.equal(render('\\{/for}'), '{/for}');
assert.equal(render('\\{if then}'), '{if then}');
assert.equal(render('\\{if not now}'), '{if not now}');
assert.equal(render('\\{else}'), '{else}');
assert.equal(render('\\{/if}'), '{/if}');
