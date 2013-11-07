/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http:// mozilla.org/MPL/2.0/. */

define(["jquery", "util", "session", "elementFinder", "ot"],
function ($, util, session, elementFinder, ot) {
  var assert = util.assert;

  // id's are automatically set as mce_i (ex: mce_0) by tinymce
  // no need to scan manually because tinymce.editors is sufficient

  // TODO: a lot of style changes are probably needed before it can be merged
  // It might be necessary to follow the styles of AceEditor or CodeMirror

  session.on("reinitialize", function () {
    if (TogetherJS.config.get("tinymce")) {
      prepareTinymce();
    }
  });

  TogetherJS.config.track("tinymce", function (track, previous) {
    if (track && ! previous) {
      prepareTinymce();
      // You can enable tinymce dynamically, but can't turn it off:
      TogetherJS.config.close("tinymce");
    }
  });
  
  function prepareTinymce() {
    // check for a tinymce instance
    if (tinymce !== undefined) {
      // tinymce editors are done initialized by the time togetherjs finishes loading
      // it is not necessary to listen to init or addEditor events on init
      var editors = tinymce.editors;
      setEventListeners(editors); // those with events listeners will be ignored
    }
  }

  function setEventListeners(editors) {
    $(editors).each(function (i, editor) {
      // record what the user is typing
      editor.on("keypress", function (event) {
        var content = editor.getContent();
        publishContent(editor, content);
      });
      // this event is fired when the content is changed("bold, italicized, delete or paste")
      // however, it is not invoked for every new character so we must have both event handlers
      editor.on("change", function (event) {
        var content = editor.getContent();
        publishContent(editor, content);
      });
    });
  }

  function publishContent(editor, content) {
    // FIXME: what if two people type at the same time?
    // it seems necessary to use ot.SimpleHistory to solve such problem
    // because SimpleHistory serializes the order of updates
    var location = elementFinder.elementLocation(editor); // passing ('mce_id') is sufficient
    session.send({
      type: "contentChange",
      element: location,
      content: content
    });
  }

  session.hub.on('hello', function () {
    var editors = tinymce.editors;
    editors.forEach(function (editor) {
      var content = editor.getContent();
      publishContent(editor, content);
    });
  });

  /*
  function getChangedContent() {
    currentContent = editor.getContent();
    var delta = ot.TextReplace.fromChange(history.current, editor.getContent());
  }
  */

  // "replace" my content with the latest content
  session.hub.on("contentChange", function (msg) {
    var element = elementFinder.findElement(msg.element);
    var editor = tinymce.get(element.id);
    // I could compare currentContent and msg.content, but calling the api function would
    // be as much costly as just doing setContent everytime I receive a contentChange event
    editor.setContent(msg.content, {format: 'raw'});
  })

  // get rid of event listeners upon closing togetherjs
  session.on("close", function () {
    var editors = tinymce.editors;
    editors.off("keypress");
    editors.off("change");
  });
}); // END OF MODULE

/*
var history = $(editor).data("togetherjsHistory");
var delta = ot.TextReplace.fromChange(history.current, content);
assert(delta);
history.add(delta);
*/
