/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http:// mozilla.org/MPL/2.0/. */

define(["jquery", "util", "session", "elementFinder"],
function ($, util, session, elementFinder) {

  //TODO: check fog CONFIG

  // user must set his all tinymce div classes to "tinymce"
  // he MUST NOT set id's to tinymce divs
  // id's are automatically set as mce_i (ex: mce_0)

  $(function () {
    prepareTinymce();
  });
  
  function prepareTinymce() {
    // check for a tinymce instance
    if (tinymce !== undefined) {
      // tinymce editors are done initialized by the time togetherjs finishes loading
      // it is not necessary to listen to init or addEditor events
      //setupTinymceLocations();
      var editors = tinymce.editors;
      $(editors).each(function (i, editor) {
        // clean up the editor
        editor.setContent("");
        // record what the user is typing
        editor.on("keypress", function (event) {
          /*
          var keyCode = event.keyCode ? event.keyCode : event.charCode;
          // publish this keyCode
          publishKeyCode(editor, keyCode);
          */
          var content = editor.getContent({format: 'raw'});
          publishContent(editor, content);
        });
      });
    }
  }

  function publishContent(editor, content) {
    // FIXME: this will get very slow as the size of content becomes large
    var location = elementFinder.elementLocation(editor); // or just tinymce.get('mce_id')
    session.send({
      type: "contentChange",
      element: location,
      content: content
    });
  }

  function publishKeyCode(editor, keyCode) {
    var location = elementFinder.elementLocation(editor);
    session.send({
      type: "pressedKeyboard",
      element: location,
      keyCode: keyCode
    });
  }

  session.hub.on("contentChange", function (msg) {
    var element = elementFinder.findElement(msg.element);
    var editor = tinymce.get(element.id);
    editor.setContent(msg.content, {format: 'raw'});
  })

  session.hub.on("pressedKeyboard", function (msg) {
    var element = elementFinder.findElement(msg.element);
    var editor = tinymce.get(element.id);
    var letter = String.fromCharCode(msg.keyCode);
    if (letter === undefined) {
      // FIXME: trigger doesnt work in tinymce editor
      editor.trigger({
        type: 'keypress',
        which: msg.keyCode,
        keyCode: msg.keyCode
      });
    } else {
      var currentContent = editor.getContent({format: 'raw'});
      editor.setContent(currentContent + letter, {format: 'raw'});
    }

  });



}); // END OF MODULE
