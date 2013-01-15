"use strict";

defineTests([
  "jquery",
  "fc/ui/indexable-codemirror"
], function($, IndexableCodeMirror) {
  module("IndexableCodeMirror");
  
  function icmTest(name, cb) {
    test(name, function() {
      var place = $("<div></div>").appendTo(document.body);
      var cm = IndexableCodeMirror(place[0], {mode: "text/plain"});
      var content = "hello\nthere";
      cm.setValue(content);
      try {
        cb(cm, content);
      } finally {
        place.remove();
      }
    });
  }
  
  icmTest("indexFromPos() works", function(cm, content) {
    equal(cm.indexFromPos({line: 0, ch: 0}), 0,
          "index of line 0, char 0 is 0");
    equal(cm.indexFromPos({line: 1, ch: 0}), content.indexOf("there"),
          "index of line 1, char 0 works");
  });
  
  icmTest("getCursorIndex() works", function(cm, content) {
    cm.setCursor({line: 1, ch: 0});
    equal(cm.getCursorIndex(), content.indexOf("there"));
  });
});
