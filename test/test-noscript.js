module("NoscriptDOMBuilder");

test("works on script-less HTML", function() {
  var ndb = new Slowparse.NoscriptDOMBuilder(document);
  var html = '<p class="hi">hello</p><!-- hi -->';
  var result = Slowparse.HTML(ndb, html);
  equal(result.error, null);
  equal(documentFragmentHTML(result.document), html);
});

test("SCRIPT_ELEMENT_NOT_ALLOWED error is reported", function() {
  var ndb = new Slowparse.NoscriptDOMBuilder(document);
  var html = '<script>alert("yo");</script>';
  var result = Slowparse.HTML(ndb, html);
  equal(result.error.type, "SCRIPT_ELEMENT_NOT_ALLOWED");
  assertParseInfo(html, result, "result", {
    'error': '<script'
  });
});

test("EVENT_HANDLER_ATTR_NOT_ALLOWED error is reported", function() {
  var ndb = new Slowparse.NoscriptDOMBuilder(document);
  var html = '<p onclick="alert(\'yo\');">hi</p>';
  var result = Slowparse.HTML(ndb, html);
  equal(result.error.type, "EVENT_HANDLER_ATTR_NOT_ALLOWED");
  assertParseInfo(html, result.error, "error", {
    'name': 'onclick',
    'value': '"alert(\'yo\');"'
  });
});

test("JAVASCRIPT_URL_NOT_ALLOWED error is reported", function() {
  var ndb = new Slowparse.NoscriptDOMBuilder(document);
  var html = '<a href="javascript:alert(\'yo\');">hi</a>';
  var result = Slowparse.HTML(ndb, html);
  equal(result.error.type, "JAVASCRIPT_URL_NOT_ALLOWED");
  assertParseInfo(html, result.error, "error", {
    'name': 'href',
    'value': '"javascript:alert(\'yo\');"'
  });
});
