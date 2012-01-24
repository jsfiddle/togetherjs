// test "if" tag

test('if', 5, function() {
  var context = {foo:'bar'};
  equal(whiskers.render('{if foo}{foo}{/if}', context), 'bar');
  equal(whiskers.render('{if biz}{foo}{/if}', context), '');
  equal(whiskers.render('{if not foo}{foo}{/if}', context), '');
  equal(whiskers.render('{if not biz}{foo}{/if}', context), 'bar');
  equal(whiskers.render('{if biz}blah{else}{foo}{/if}', context), 'bar');
});
