define(function(require) {
  var $ = require("jquery"),
      Preferences = require("fc/prefs"),
      Editor = require("fc/ui/editor"),
      Modals = require("fc/ui/modals"),
      Parachute = require("fc/parachute"),
      CurrentPageManager = require("fc/current-page-manager"),
      Publisher = require("fc/publisher"),
      PublishUI = require("fc/ui/publish"),
      DefaultContentTemplate = require("template!default-content");

  Preferences.fetch();

  return function FriendlycodeEditor(options) {
    var publishURL = options.publishURL,
        pageToLoad = options.pageToLoad,
        defaultContent = options.defaultContent || DefaultContentTemplate(),
        remixURLTemplate = options.remixURLTemplate ||
          location.protocol + "//" + location.host + 
          location.pathname + "#{{VIEW_URL}}",
        editor = Editor({
          container: options.container,
          allowJS: options.allowJS
        }),
        ready = $.Deferred();
    
    var modals = Modals({
      container: $('<div class="friendlycode-base"></div>')
        .appendTo(document.body)
    });
    var publisher = options.publisher || Publisher(publishURL);
    var publishUI = PublishUI({
      modals: modals,
      codeMirror: editor.panes.codeMirror,
      publisher: publisher,
      remixURLTemplate: remixURLTemplate
    });
    var parachute = Parachute(window, editor.panes.codeMirror);
    var pageManager = CurrentPageManager({
      window: window,
      currentPage: pageToLoad
    });
    
    function doneLoading() {
      editor.container.removeClass("friendlycode-loading");
      editor.panes.codeMirror.clearHistory();
      editor.toolbar.refresh();
      if (parachute.restore()) {
        editor.toolbar.showDataRestoreHelp();
      } else {
        // Only save data on page unload if it's different from
        // the URL we just (hopefully) loaded.
        parachute.refresh();
      }
      editor.panes.codeMirror.reparse();
      editor.panes.codeMirror.focus();
      editor.panes.codeMirror.refresh();
      ready.resolve();
    }

    editor.toolbar.setStartPublish(publishUI.start);
    editor.container.addClass("friendlycode-loading");
    publishUI.on("publish", function(info) {
      // If the user clicks their back button, we don't want to show
      // them the page they just published--we want to show them the
      // page the current page is based on.
      parachute.clearCurrentPage();
      parachute.changePage(info.path);
      // It's possible that the server sanitized some stuff that the
      // user will be confused by, so save the new state of the page
      // to be what they expect it to be, just in case.
      parachute.save();
      // Set the URL to be the new URL to remix the page the user just
      // published, so they can share/bookmark the URL and it'll be what 
      // they expect it to be.
      pageManager.changePage(info.path, info.remixURL);
    });
    
    parachute.changePage(pageManager.currentPage());

    if (!pageManager.currentPage()) {
      setTimeout(function() {
        editor.panes.codeMirror.setValue(defaultContent);
        doneLoading();
      }, 0);
    } else
      publisher.loadCode(pageManager.currentPage(), function(err, data, url) {
        if (err) {
          modals.showErrorDialog({
            text: 'Sorry, an error occurred while trying to get the page.'
          });
        } else {
          editor.panes.codeMirror.setValue(data);
          publishUI.setCurrentURL(url);
          doneLoading();
        }
      });
    
    return {
      editor: editor,
      codeMirror: editor.panes.codeMirror,
      publishUI: publishUI,
      parachute: parachute,
      ready: ready
    };
  };
});
