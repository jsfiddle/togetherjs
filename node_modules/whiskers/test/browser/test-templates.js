// test rendering of strange templates

test('templates', 8, function() {
  equal(whiskers.render(), '');
  equal(whiskers.render('3'), '3');
  equal(whiskers.render('{foo}'), '');
  equal(whiskers.render('{>bar}'), '');
  equal(whiskers.render(3), '3');
  equal(whiskers.render([1,2,3]), '1,2,3');
  equal(whiskers.render({p:3}), '[object Object]');
  equal(whiskers.render(function(){return 3}), 'function (){return 3}');
});
