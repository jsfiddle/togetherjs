// test logic tags

test('logic', 19, function() {
  var context = {foo:'bar', biz:['bot','bit']};

  equal(whiskers.render('{if foo}{for x in biz}{foo}{x}{/for}{/if}', context), 'barbotbarbit');
  equal(whiskers.render('{if biz}{for x in foo}{foo}{x}{/for}{/if}', context), 'barbbarabarr');
  equal(whiskers.render('{if biz}{for x in foo}{foo}{x}{/for}{/if}', context), 'barbbarabarr');
  equal(whiskers.render('{if foo}{foo}{else}blah{/if}', context), 'bar');
  equal(whiskers.render('{if not foo}blah{else}{foo}{/if}', context), 'bar');
  equal(whiskers.render('{for x in biz}{foo}{x}{else}blah{/for}', context), 'barbotbarbit');


  // stub out console.warn
  var temp = console.warn;
  var warnings = [];
  console.warn = function(message) {
    warnings.push(message);
  };

  equal(whiskers.render('{for x in biz}{x}{if foo}{/for}{foo}{/if}', context), 'botbarbitbar');
  equal(warnings.shift(), "extra {/for} ignored");
  equal(warnings.shift(), "extra {for} closed at end of template");

  equal(whiskers.render('{if foo}{for x in biz}{x}{/if}{foo}{/for}', context), 'botbarbitbar');
  equal(warnings.shift(), "extra {/if} ignored");
  equal(warnings.shift(), "extra {if} closed at end of template");

  equal(whiskers.render('{if foo}{for x in biz}{x}{else}blah{/if}', context), 'botbit');
  equal(warnings.shift(), "extra {/if} ignored");
  equal(warnings.shift(), "extra {for} closed at end of template");
  equal(warnings.shift(), "extra {if} closed at end of template");

  equal(whiskers.render('{else}{for x in biz}{x}{else}blah{else}bleh{/for}', context), 'botbit');
  equal(warnings.shift(), "extra {else} ignored");
  equal(warnings.shift(), "extra {else} ignored");

  // return to normal
  console.warn = temp;
});
