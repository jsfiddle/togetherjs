"use strict";

// This helper class keeps track of different kinds of highlighting in
// a CodeMirror instance.
define(["jquery"], function($) {
  return function MarkTracker(codeMirror) {
    var classNames = {};
    var marks = [];

    return {
      // Mark a given start/end interval in the CodeMirror, based on character
      // indices (not {line, ch} objects), with the given class name. If
      // an element is provided, give it the class name too.
      mark: function(start, end, className, element) {
        if (!(className in classNames))
          classNames[className] = [];
        if (element) {
          classNames[className].push(element);
          $(element).addClass(className);
        }
        start = codeMirror.posFromIndex(start);
        end = codeMirror.posFromIndex(end);
        marks.push(codeMirror.markText(start, end, className));
      },
      // Clear all marks made so far and remove the class from any elements
      // it was previously given to.
      clear: function() {
        marks.forEach(function(mark) {
          // Odd, from the CodeMirror docs you'd think this would remove
          // the class from the highlighted text, too, but it doesn't.
          // I guess we're just garbage collecting here.
          mark.clear();
        });
        var wrapper = codeMirror.getWrapperElement();
        for (var className in classNames) {
          classNames[className].forEach(function(element) {
            $(element).removeClass(className);
          });
          $("." + className, wrapper).removeClass(className);
        }

        marks = [];
        classNames = {};
      }
    };
  };
});
  