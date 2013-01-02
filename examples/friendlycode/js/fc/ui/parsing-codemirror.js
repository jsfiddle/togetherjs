"use strict";

// A subclass of IndexableCodeMirror which continuously re-parses
// the code in its editor. Also adds a Backbone.Events interface
// for extension points to hook into.
define([
  "backbone-events",
  "./indexable-codemirror"
], function(BackboneEvents, IndexableCodeMirror) {
  return function ParsingCodeMirror(place, givenOptions) {
    // Called whenever content of the editor area changes.
    function reparse() {
      var sourceCode = codeMirror.getValue();
      var result = givenOptions.parse(sourceCode);
      codeMirror.trigger("reparse", {
        error: result.error,
        sourceCode: sourceCode,
        document: result.document
      });
      // Cursor activity would've been fired before us, so call it again
      // to make sure it displays the right context-sensitive help based
      // on the new state of the document.
      onCursorActivity();
    }

    // Called whenever the user moves their cursor in the editor area.
    function onCursorActivity() {
      codeMirror.trigger("cursor-activity");
    }

    // The number of milliseconds to wait before re-parsing the editor
    // content.
    var parseDelay = givenOptions.parseDelay || 300;
    var time = givenOptions.time || window;
    var reparseTimeout;

    givenOptions.onChange = function() {
      codeMirror.trigger("change");
      if (reparseTimeout !== undefined)
        time.clearTimeout(reparseTimeout);
      if (codeMirror.reparseEnabled)
        reparseTimeout = time.setTimeout(reparse, parseDelay);
    };
    givenOptions.onCursorActivity = onCursorActivity;

    var codeMirror = IndexableCodeMirror(place, givenOptions);
    BackboneEvents.mixin(codeMirror);
    codeMirror.reparse = reparse;
    codeMirror.reparseEnabled = true;
    return codeMirror;
  };
});
