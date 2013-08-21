"use strict";

defineTests([
  "jquery",
  "fc/ui/mark-tracker",
  "codemirror"
], function($, MarkTracker, CodeMirror) {
  module("MarkTracker");
  
  function mtTest(name, cb) {
    test(name, function() {
      var place = $("<div></div>").appendTo(document.body);
      var cm = CodeMirror(place[0], {mode: "text/plain"});
      var mt = MarkTracker(cm);
      try {
        cb(place, cm, mt);
      } finally {
        place.remove();
      }
    });
  }
  
  mtTest("codeMirror content mark/clear works", function(place, cm, mt) {
    cm.setValue("hello");
    mt.mark(2, 4, "blah");
    equal(place.find(".blah").text(), "ll", "source code is marked w/ class");
    mt.clear();
    equal(place.find(".blah").length, 0, "source code class is cleared");
  });
  
  mtTest("related element mark/clear works", function(place, cm, mt) {
    var thing = $("<div></div>");
    cm.setValue("hello");
    mt.mark(1, 4, "foo", thing[0]);
    ok(thing.hasClass("foo"), "related element is marked w/ class");
    mt.clear();
    ok(!thing.hasClass("foo"), "related element class is cleared");
  });
});
