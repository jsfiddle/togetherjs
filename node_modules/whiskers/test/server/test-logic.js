// test logic tags

var common = require('./common');
var assert = common.assert;
var render = common.whiskers.render;

common.expected = 19;

var context = {foo:'bar', biz:['bot','bit']};

assert.equal(render('{if foo}{for x in biz}{foo}{x}{/for}{/if}', context), 'barbotbarbit');
assert.equal(render('{if biz}{for x in foo}{foo}{x}{/for}{/if}', context), 'barbbarabarr');
assert.equal(render('{if biz}{for x in foo}{foo}{x}{/for}{/if}', context), 'barbbarabarr');
assert.equal(render('{if foo}{foo}{else}blah{/if}', context), 'bar');
assert.equal(render('{if not foo}blah{else}{foo}{/if}', context), 'bar');
assert.equal(render('{for x in biz}{foo}{x}{else}blah{/for}', context), 'barbotbarbit');


// stub out console.warn
var temp = console.warn;
var warnings = [];
console.warn = function(message) {
  warnings.push(message);
};

assert.equal(render('{for x in biz}{x}{if foo}{/for}{foo}{/if}', context), 'botbarbitbar');
assert.equal(warnings.shift(), "extra {/for} ignored");
assert.equal(warnings.shift(), "extra {for} closed at end of template");

assert.equal(render('{if foo}{for x in biz}{x}{/if}{foo}{/for}', context), 'botbarbitbar');
assert.equal(warnings.shift(), "extra {/if} ignored");
assert.equal(warnings.shift(), "extra {if} closed at end of template");

assert.equal(render('{if foo}{for x in biz}{x}{else}blah{/if}', context), 'botbit');
assert.equal(warnings.shift(), "extra {/if} ignored");
assert.equal(warnings.shift(), "extra {for} closed at end of template");
assert.equal(warnings.shift(), "extra {if} closed at end of template");

assert.equal(render('{else}{for x in biz}{x}{else}blah{else}bleh{/for}', context), 'botbit');
assert.equal(warnings.shift(), "extra {else} ignored");
assert.equal(warnings.shift(), "extra {else} ignored");

// return to normal
console.warn = temp;
