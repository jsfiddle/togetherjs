// test for comments in templates

var common = require('./common');
var assert = common.assert;
var render = common.whiskers.render;

common.expected = 9;

var template = '{!this won\'t show up!}';
assert.equal(render(template, {}), '');

var template = '{!!}';
assert.equal(render(template, {}), '');

var template = '{!this won\'t show up\neither!}';
assert.equal(render(template, {}), '');

var template = '{!this won\'t {show} up!}';
assert.equal(render(template, {}), '');

var template = '\\{!this will show up!}';
assert.equal(render(template, {}), '{!this will show up!}');

var template = '{!this will also show up}';
assert.equal(render(template, {}), '{!this will also show up}');

var template = '{!this won\'t, but!}this part will show up!}';
assert.equal(render(template, {}), 'this part will show up!}');

var template = '{also, {!this} part won\'t show up!}';
assert.equal(render(template, {}), '{also, ');

var template = '{!more than !}just one{!silly!} comment';
assert.equal(render(template, {}), 'just one comment');
