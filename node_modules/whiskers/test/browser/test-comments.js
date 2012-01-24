// test for comments in templates

test('comments', 9, function() {
  var template = '{!this won\'t show up!}';
  equal(whiskers.render(template, {}), '')

  var template = '{!!}';
  equal(whiskers.render(template, {}), '')

  var template = '{!this won\'t show up\neither!}';
  equal(whiskers.render(template, {}), '')

  var template = '{!this won\'t {show} up!}';
  equal(whiskers.render(template, {}), '')

  var template = '\\{!this will show up!}';
  equal(whiskers.render(template, {}), '{!this will show up!}')

  var template = '{!this will also show up}';
  equal(whiskers.render(template, {}), '{!this will also show up}')

  var template = '{!this won\'t, but!}this part will show up!}';
  equal(whiskers.render(template, {}), 'this part will show up!}')

  var template = '{also, {!this} part won\'t show up!}';
  equal(whiskers.render(template, {}), '{also, ')

  var template = '{!more than !}just one{!silly!} comment';
  equal(whiskers.render(template, {}), 'just one comment');
});
