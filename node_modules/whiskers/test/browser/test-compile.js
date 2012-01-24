// test compiling

test('compile', 5, function() {
  ok(whiskers.compile());
  ok(whiskers.compile('3'));
  ok(whiskers.compile(3));
  ok(whiskers.compile({p:3}));

  var template = '{sue} and {sam} and {for x in nums}{x}{/for}';
  var context = {
    sue: 'bob',
    sam: 'sal',
    nums: [1,2,3]
  }
  equal(whiskers.compile(template)(context), 'bob and sal and 123');
});
