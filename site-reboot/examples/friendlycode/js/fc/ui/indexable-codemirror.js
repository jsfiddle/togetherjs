"use strict";

// A subclass of CodeMirror which adds a few methods that make it easier
// to work with character indexes rather than {line, ch} objects.
define(["codemirror"], function(CodeMirror) {
  return function IndexableCodeMirror(place, givenOptions) {
    var codeMirror = CodeMirror(place, givenOptions);
  
    // Returns the character index of the cursor position.
    codeMirror.getCursorIndex = function() {
      return codeMirror.indexFromPos(codeMirror.getCursor());
    };
  
    return codeMirror;
  };
});
