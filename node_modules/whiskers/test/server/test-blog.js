// test basic blog template

var fs = require('fs');
var common = require('./common');
var assert = common.assert;
var whiskers = common.whiskers;

common.expected = 1;

var template = fs.readFileSync('test/server/templates/blog.html', 'utf8');
var context = JSON.parse(fs.readFileSync('test/server/contexts/blog.json', 'utf8'));
var partials = {
  comment: fs.readFileSync('test/server/templates/comment.html', 'utf8'),
  addcomment: fs.readFileSync('test/server/templates/addcomment.html', 'utf8')
};

var rendered = whiskers.render(template, context, partials);

// uncomment to update expected
//fs.writeFileSync('test/rendered/blog.html', rendered);

var expected = fs.readFileSync('test/server/rendered/blog.html', 'utf8');
assert.equal(rendered, expected, 'rendered and expected differ');
