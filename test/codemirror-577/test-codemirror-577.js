"use strict";

defineTests([
  "jquery",
  "codemirror",
  "text!test/codemirror-577/original.html",
  "text!test/codemirror-577/replacer.html"
], function($, CodeMirror, original, replacer) {
  module("Codemirror issue 577");
  
  // Test to ensure that this bug is fixed or worked around:
  // https://github.com/marijnh/CodeMirror2/issues/577
  test("undo() doesn't throw", function() {
    var div = $("<div></div>").appendTo("body");
    var editor = CodeMirror(div[0], {
      mode: 'text/plain',
      tabMode: 'indent'
    });
    try {
      editor.setValue(original);
      editor.clearHistory();
      editor.setValue(replacer);
      editor.undo();
      ok(true, "undo() didn't throw!");
    } finally {
      div.remove();
    }
  });
});
