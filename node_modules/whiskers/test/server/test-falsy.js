// test for falsy values

var common = require('./common');
var assert = common.assert;
var whiskers = common.whiskers;

common.expected = 15;

var context = {
  'false': false,
  empty: '',
  'null': null,
  zero: 0
};

assert.equal(whiskers.render('{false}', context), '');
assert.equal(whiskers.render('{empty}', context), '');
assert.equal(whiskers.render('{null}', context), '');
assert.equal(whiskers.render('{undefined}', context), '');
assert.equal(whiskers.render('{zero}', context), '');

assert.equal(whiskers.render('{if false}x{/if}', context), '');
assert.equal(whiskers.render('{if empty}x{/if}', context), '');
assert.equal(whiskers.render('{if null}x{/if}', context), '');
assert.equal(whiskers.render('{if undefined}x{/if}', context), '');
assert.equal(whiskers.render('{if zero}x{/if}', context), '');

assert.equal(whiskers.render('{if not false}x{/if}', context), 'x');
assert.equal(whiskers.render('{if not empty}x{/if}', context), 'x');
assert.equal(whiskers.render('{if not null}x{/if}', context), 'x');
assert.equal(whiskers.render('{if not undefined}x{/if}', context), 'x');
assert.equal(whiskers.render('{if not zero}x{/if}', context), 'x');
