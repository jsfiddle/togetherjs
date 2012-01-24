// test for falsy values

test('falsy', 15, function() {
  var context = {
    'false': false,
    empty: '',
    'null': null,
    zero: 0
  };

  equal(whiskers.render('{false}', context), '');
  equal(whiskers.render('{empty}', context), '');
  equal(whiskers.render('{null}', context), '');
  equal(whiskers.render('{undefined}', context), '');
  equal(whiskers.render('{zero}', context), '');

  equal(whiskers.render('{if false}x{/if}', context), '');
  equal(whiskers.render('{if empty}x{/if}', context), '');
  equal(whiskers.render('{if null}x{/if}', context), '');
  equal(whiskers.render('{if undefined}x{/if}', context), '');
  equal(whiskers.render('{if zero}x{/if}', context), '');

  equal(whiskers.render('{if not false}x{/if}', context), 'x');
  equal(whiskers.render('{if not empty}x{/if}', context), 'x');
  equal(whiskers.render('{if not null}x{/if}', context), 'x');
  equal(whiskers.render('{if not undefined}x{/if}', context), 'x');
  equal(whiskers.render('{if not zero}x{/if}', context), 'x');
});
