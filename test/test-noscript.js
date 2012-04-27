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
  deepEqual(result.error, {
    type: "SCRIPT_ELEMENT_NOT_ALLOWED",
    start: 0,
    end: 7
  });
});

test("EVENT_HANDLER_ATTR_NOT_ALLOWED error is reported", function() {
  var ndb = new Slowparse.NoscriptDOMBuilder(document);
  var html = '<p onclick="alert(\'yo\');">hi</p>';
  var result = Slowparse.HTML(ndb, html);
  deepEqual(result.error, {
    type: "EVENT_HANDLER_ATTR_NOT_ALLOWED",
    name: {
      start: 3,
      end: 10
    },
    value: {
      start: 11,
      end: 25
    }
  });
});

test("JAVASCRIPT_URL_NOT_ALLOWED error is reported", function() {
  var ndb = new Slowparse.NoscriptDOMBuilder(document);
  var html = '<a href="javascript:alert(\'yo\');">hi</a>';
  var result = Slowparse.HTML(ndb, html);
  deepEqual(result.error, {
    type: "JAVASCRIPT_URL_NOT_ALLOWED",
    name: {
      start: 3,
      end: 7
    },
    value: {
      start: 8,
      end: 33
    }
  });
});
