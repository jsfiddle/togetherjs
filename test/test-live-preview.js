"use strict";

defineTests([
  "jquery",
  "backbone-events",
  "test/lptest",
  "fc/ui/live-preview"
], function($, BackboneEvents, lpTest, LivePreview) {
  module("LivePreview");
  
  test("does nothing if preview area isn't attached", function() {
    var div = $("<div></div>");
    var cm = BackboneEvents.mixin({});
    var lp = LivePreview({
      previewArea: div,
      codeMirror: cm
    });
    cm.trigger('reparse', {error: null});
    ok(true);
  });
  
  lpTest(
    "title property reflects document title",
    "<title>hello</title>",
    function(previewArea, preview) {
      equal(preview.title, "hello");
    }
  );

  lpTest(
    "change:title event is fired when page title changes",
    "<title>hello</title>",
    function(previewArea, preview, cm) {
      stop();
      preview.on('change:title', function(title) {
        equal(title, 'yo');
        equal(preview.title, title);
        start();
      });
      cm.trigger('reparse', {
        error: null,
        sourceCode: '<title>yo</title>'
      });
    }
  );

  lpTest(
    "change:title event is not fired when page title stays the same",
    "<title>hello</title>",
    function(previewArea, preview, cm) {
      var changed = 0;
      preview.on('change:title', function(title) { changed++; });
      cm.trigger('reparse', {
        error: null,
        sourceCode: '<title>hello</title><p>there</p>'
      });
      equal(changed, 0);
    }
  );
    
  lpTest("HTML is written into document", function(previewArea, preview, cm) {
    equal($("body", previewArea.contents()).html(),
          "<p>hi <em>there</em></p>",
          "HTML source code is written into preview area");
  });
  
  lpTest('<base target="_blank"> inserted', function(previewArea) {
    equal($('base[target="_blank"]', previewArea.contents()).length, 1);
  });
  
  lpTest("refresh event is triggered", function(previewArea, preview, cm) {
    var refreshTriggered = false;
    equal(preview.codeMirror, cm, "codeMirror property exists");
    preview.on("refresh", function(event) {
      equal(event.documentFragment, "blop", "documentFragment is passed");
      ok(event.window, "window is passed");
      refreshTriggered = true;
    });
    cm.trigger('reparse', {
      error: null,
      sourceCode: '',
      document: "blop"
    });
    ok(refreshTriggered, "refresh event is triggered");
  });
  
  lpTest('scrolling is preserved across refresh',
    function(previewArea, preview, cm) {
      var wind;
      preview.on('refresh', function(event) {
        wind = event.window;
      });
      
      cm.trigger('reparse', {
        error: null,
        sourceCode: '<p style="font-size: 400px">hi <em>there</em></p>'
      });
      wind.scroll(5, 6);
      var oldWind = wind;
      cm.trigger('reparse', {
        error: null,
        sourceCode: '<p style="font-size: 400px">hi <em>dood</em></p>'
      });
      ok(oldWind != wind, "window changes across reparse");
      equal(wind.pageXOffset, 5, "x scroll is preserved across refresh");
      equal(wind.pageYOffset, 6, "y scroll is preserved across refresh");
    });
  
  return {
    lpTest: lpTest
  };
});
