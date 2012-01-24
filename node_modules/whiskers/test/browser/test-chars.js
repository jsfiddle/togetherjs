// test for troubling characters

test('chars', 7, function() {
  equal(whiskers.render('\\'), '\\');
  equal(whiskers.render('\''), '\'');
  equal(whiskers.render('\\\''), '\\\'');
  equal(whiskers.render('\\\'{vehicle}', {vehicle: 'truck'}), '\\\'truck');
  equal(whiskers.render('bob\nsue'), 'bob\nsue');
  equal(whiskers.render('bob\r\nsue'), 'bob\nsue');
  equal(whiskers.render('{under_score}', {under_score: 'truck'}), 'truck');
});
