// test escaping of tags

test('escape', 9, function() {
  equal(whiskers.render('\\{bob}'), '{bob}');
  equal(whiskers.render('\\{bob.bloss}'), '{bob.bloss}');
  equal(whiskers.render('\\{>reindeer}'), '{>reindeer}');
  equal(whiskers.render('\\{for anger in mgmt}'), '{for anger in mgmt}');
  equal(whiskers.render('\\{/for}'), '{/for}');
  equal(whiskers.render('\\{if then}'), '{if then}');
  equal(whiskers.render('\\{if not now}'), '{if not now}');
  equal(whiskers.render('\\{else}'), '{else}');
  equal(whiskers.render('\\{/if}'), '{/if}');
});
