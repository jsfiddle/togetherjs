// test calling of function in context

test('function', 1, function() {
  var context = {
    add2and2: function() {
      return 2+2;
    }()
  };

  equal(whiskers.render('{add2and2}', context), '4');
});
