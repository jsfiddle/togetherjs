"use strict";

// This manages the UI for undo/redo.
define(function() {
  return function HistoryUI(options) {
    var undo = options.undo;
    var redo = options.redo;
    var codeMirror = options.codeMirror;

    function refreshButtons() {
      var history = codeMirror.historySize();
      undo.toggleClass("enabled", history.undo == 0 ? false : true);
      redo.toggleClass("enabled", history.redo == 0 ? false : true);
    }
  
    undo.click(function() {
      codeMirror.undo();
      codeMirror.reparse();
      refreshButtons();
    });
    redo.click(function() {
      codeMirror.redo();
      codeMirror.reparse();
      refreshButtons();
    });
    codeMirror.on("change", refreshButtons);
    refreshButtons();
    return {refresh: refreshButtons};
  };
});
