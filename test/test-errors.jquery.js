module("jQuery.fn.fillError()");

test("raises nice exception when template is not found", function() {
  try {
    var div = $('<div></div>').fillError({type: "BLARGY"});
  } catch (e) {
    equal(e.message, "Error template not found for BLARGY");
    return;
  }
  ok(false, "Exception not thrown!");
});

test("works when template is found", function() {
  var templates = $('<div class="error-msg BLARGY">' +
                    '<p>{{foo.bar}}</p></div>');
  var div = $('<div></div>').fillError({
    type: "BLARGY",
    foo: {bar: "hi"}
  }, templates);
  equal(div.html(), "<p>hi</p>");
});
