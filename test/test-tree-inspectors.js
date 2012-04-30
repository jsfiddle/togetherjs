module("TreeInspectors.forbidJS()");

test("works on script-less HTML", function() {
  var html = '<p class="hi">hello</p><!-- hi -->';
  var result = Slowparse.HTML(document, html, [TreeInspectors.forbidJS]);
  equal(result.error, null);
  equal(documentFragmentHTML(result.document), html);
});

(function() {
  module("TreeInspectors.findJS()");
  
  function findJS(html) {
    var doc = Slowparse.HTML(document, html).document;
    return TreeInspectors.findJS(doc);
  }
  
  test("works on script-less HTML", function() {
    deepEqual(findJS('<p class="hi">hello</p><!-- hi -->'), []);
  });

  test("SCRIPT_ELEMENT is reported", function() {
    var html = '<script>alert("yo");</script>';
    var js = findJS(html);
    equal(js.length, 1);
    equal(js[0].type, "SCRIPT_ELEMENT");
    assertParseIntervals(html, js[0].node, "elementNode", {
      'parseInfo.openTag': '<script>'
    });
  });
  
  test("EVENT_HANDLER_ATTR is reported", function() {
    var html = '<p onclick="alert(\'yo\');">hi</p>';
    var js = findJS(html);
    equal(js.length, 1);
    equal(js[0].type, "EVENT_HANDLER_ATTR");
    assertParseIntervals(html, js[0].node, "attributeNode", {
      'parseInfo.name': 'onclick',
      'parseInfo.value': '"alert(\'yo\');"'
    });
  });
  
  test("JAVASCRIPT_URL is reported", function() {
    var html = '<a href="javascript:alert(\'yo\');">hi</a>';
    var js = findJS(html);
    equal(js.length, 1);
    equal(js[0].type, "JAVASCRIPT_URL");
    assertParseIntervals(html, js[0].node, "attributeNode", {
      'parseInfo.name': 'href',
      'parseInfo.value': '"javascript:alert(\'yo\');"'
    });
  });
})();
