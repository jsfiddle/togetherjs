module("errors.jquery.js");

test("$.fn.fillError() raises nice err when template not found", function() {
  try {
    var div = $('<div></div>').fillError({type: "BLARGY"});
  } catch (e) {
    equal(e.message, "Error template not found for BLARGY");
    return;
  }
  ok(false, "Exception not thrown!");
});

test("$.fn.fillError() works when template is found", function() {
  var templates = $('<div class="error-msg BLARGY">' +
                    '<p>{{foo.bar}}</p></div>');
  var div = $('<div></div>').fillError({
    type: "BLARGY",
    foo: {bar: "hi"}
  }, templates);
  equal(div.html(), "<p>hi</p>");
});

test("$.fn.errorHighlightInterval() works", function() {
  deepEqual($('<div data-highlight="1"></div>').errorHighlightInterval(),
            {start: 1, end: undefined}, "works w/ start only");
  deepEqual($('<div data-highlight="1,2"></div>').errorHighlightInterval(),
            {start: 1, end: 2}, "works w/ number pair");
});

test("$.fn.eachErrorHighlight() works", function() {
  var args = [];
  var div = $('<div><div data-highlight="1,2"></div>' + 
               '<em data-highlight="3"></em></div>');
  div.eachErrorHighlight(function(start, end, i) {
    args.push({
      node: this.nodeName,
      start: start,
      end: end,
      i: i
    });
  });
  deepEqual(args, [
    {
      "end": 2,
      "i": 0,
      "node": "DIV",
      "start": 1
    },
    {
      "end": undefined,
      "i": 1,
      "node": "EM",
      "start": 3
    }
  ]);
});
