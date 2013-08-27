define([
  "jquery",
  "./editor-panes",
  "./editor-toolbar"
], function($, EditorPanes, EditorToolbar) {
  return function Editor(options) {
    var value = options.value,
        container = options.container.empty()
          .addClass("friendlycode-base"),
        toolbarDiv = $('<div class="friendlycode-toolbar"></div>')
          .appendTo(container),
        panesDiv = $('<div class="friendlycode-panes"></div>')
          .appendTo(container);
    
    var panes = EditorPanes({
      container: panesDiv,
      value: value,
      allowJS: options.allowJS
    });
    var toolbar = EditorToolbar({
      container: toolbarDiv,
      panes: panes
    });
    
    container.removeClass("friendlycode-loading");
    panes.codeMirror.refresh();
    
    return {
      container: container,
      panes: panes,
      toolbar: toolbar
    };
  };
});
