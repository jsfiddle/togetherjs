"use strict";

defineTests([
  "jquery",
  "fc/ui/editor-panes",
  "fc/ui/editor-toolbar"
], function($, EditorPanes, EditorToolbar) {
  var parentDiv, panesDiv, toolbarDiv, panes, options;

  module("EditorToolbar", {
    setup: function() {
      parentDiv = $('<div></div>').appendTo("#qunit-fixture").hide();
      panesDiv = $('<div></div>').appendTo(parentDiv);
      toolbarDiv = $('<div></div>').appendTo(parentDiv);
      panes = EditorPanes({container: panesDiv});
      options = {panes: panes, container: toolbarDiv};
    },
    teardown: function() {
      parentDiv.remove();
    }
  });
  
  test("shows page title when <title> is present", function() {
    var toolbar = EditorToolbar(options);
    panes.codeMirror.setValue("<title>supdog</title>");
    panes.codeMirror.reparse();
    parentDiv.show();
    equal($(".preview-title:visible", toolbarDiv).length, 1,
          "navbar preview title is not hidden");
    equal($(".preview-title", toolbarDiv).text(), "supdog",
          "navbar preview title is 'supdog'");
  });
  
  test("doesn't show page title when <title> is absent", function() {
    var toolbar = EditorToolbar(options);
    panes.codeMirror.setValue("<p>hello</p>");
    panes.codeMirror.reparse();
    parentDiv.show();
    equal($(".preview-title:visible", toolbarDiv).length, 0,
          "navbar preview title is hidden");
  });
});
