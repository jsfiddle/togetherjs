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

asyncTest("works when template is found", function() {
  jQuery.loadErrors("../spec/", ["base"], function() {
    var div = $('<div></div>').fillError({
      "type": "UNEXPECTED_CLOSE_TAG",
      "closeTag": {
        "name": "i",
        "start": 2,
        "end": 5
      }
    });
    ok(div.html().match(/data-highlight="2,5"/),
       "result has data-highlight attr");
    start();
  });
});
