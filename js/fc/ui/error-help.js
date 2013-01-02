"use strict";

// Provides helpful Slowparse-based error suggestions for a
// ParsingCodeMirror.
define(["jquery-slowparse", "./mark-tracker"], function($, MarkTracker) {
  // Display an animated arrow pointing at a particular position in a
  // codeMirror instance. It disappears after a short delay.
  function pointAtPosition(codeMirror, pos) {
    var MOVE_TIME = 500;
    var PAUSE_TIME = 1000;
    var pointer = $('<div class="cursor-pointer"></div>');
    codeMirror.addWidget(pos, pointer[0], true);
    pointer.css({
      opacity: 0,
      paddingTop: '50px'
    });
    pointer.animate({
      opacity: 1,
      paddingTop: 0
    }, MOVE_TIME).delay(PAUSE_TIME).fadeOut(function() {
      pointer.remove();
    });
  }

  return function ErrorHelp(options) {
    var self = {};
    var codeMirror = options.codeMirror;
    var template = options.template;
    var errorArea = options.errorArea;
    var relocator = options.relocator;
    var timeout = null;
    var ERROR_DISPLAY_DELAY = 250;

    // The escape key should close error help 
    $(document).keyup(function(event) {
      if (event.keyCode == 27)
        clearError();
    });

    // Keep track of error highlighting.
    var errorHelpMarks = MarkTracker(codeMirror, relocator);
  
    // Report the given Slowparse error.
    function reportError(error) {
      var startMark = null;
      var errorHTML = $("<div></div>").fillError(error);
      errorArea.html(template({error: errorHTML.html()})).show();
      errorArea.eachErrorHighlight(function(start, end, i) {
        // Point the error message's arrow at the first occurrence of
        // the word "here" in the error message.
        if (startMark === null)
          startMark = start;
        errorHelpMarks.mark(start, end, "highlight-" + (i+1), this);
        $(this).click(function() {
          var pos = codeMirror.posFromIndex(start);
          codeMirror.setCursor(pos);
          pointAtPosition(codeMirror, pos);
        });
      });
      relocator.relocate(errorArea, startMark, "error");
      errorArea.hide();
    }
  
    function clearError() {
      clearTimeout(timeout);
      errorHelpMarks.clear();
      errorArea.hide();
      relocator.cleanup();
    }
    
    codeMirror.on("change", clearError);
    codeMirror.on("reparse", function(event) {
      clearError();
      // same as context-sensitive-help.js, "cursor-activity" handling
      if (event.error) {
        timeout = setTimeout(function() {
          reportError(event.error);
        }, ERROR_DISPLAY_DELAY);
      }
    });
    return self;
  };
});
