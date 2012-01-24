// test "if" tag

var common = require('./common');
var assert = common.assert;
var whiskers = common.whiskers;

common.expected = 5;

var context = {foo:'bar'};
assert.equal(whiskers.render('{if foo}{foo}{/if}', context), 'bar');
assert.equal(whiskers.render('{if biz}{foo}{/if}', context), '');
assert.equal(whiskers.render('{if not foo}{foo}{/if}', context), '');
assert.equal(whiskers.render('{if not biz}{foo}{/if}', context), 'bar');
assert.equal(whiskers.render('{if biz}blah{else}{foo}{/if}', context), 'bar');
