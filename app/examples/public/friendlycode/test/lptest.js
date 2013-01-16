define([
  "jquery",
  "backbone-events",
  "fc/ui/live-preview",
  "slowparse/slowparse"
], function($, BackboneEvents, LivePreview, Slowparse) {
  return function lpTest(name, html, cb) {
    if (typeof(html) == 'function') {
      cb = html;
      html = '<p>hi <em>there</em></p>';
    }
    test(name, function() {
      var div = $('<div></div>').appendTo('body').css({visibility: "hidden"});
      var cm = BackboneEvents.mixin({});
      var preview = LivePreview({
        codeMirror: cm,
        previewArea: div
      });
      var result = Slowparse.HTML(document, html);
      cm.trigger('reparse', {
        error: null,
        sourceCode: html,
        document: result.document
      });
      try {
        var iframe = div.find("iframe");
        if (iframe.length != 1)
          ok(false, "preview area should contain 1 iframe");
        if (!iframe[0].contentWindow)
          ok(false, "iframe contentWindow should be non-null");
        cb(iframe, preview, cm, result.document, html);
      } finally {
        div.remove();
      }
    });
  };
});
