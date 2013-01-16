defineTests([
  "jquery",
  "fc/ui/preview-to-editor-mapping",
  "test/lptest",
  "text!test/preview-to-editor-mapping/path-to.html"
], function($, PreviewToEditorMapping, lpTest, pathToHTML) {
  module("PreviewToEditorMapping");
  
  var nodeToCode = PreviewToEditorMapping._nodeToCode;
  var pathTo = PreviewToEditorMapping._pathTo;

  function spaces(n) {
    var s = [];
    for (var i = 0; i < n; i++) s.push(" ");
    return s.join("");
  }
  
  function domStructure(node, lines, indent) {
    if (!indent) indent = 0;
    if (!lines) lines = [];
    for (var i = 0; i < node.childNodes.length; i++) {
      var child = node.childNodes[i];
      lines.push(spaces(indent) + child.nodeName);
      if (child.nodeType == node.ELEMENT_NODE)
        domStructure(child, lines, indent + 2);
    }
    return lines.join('\n');
  }
  
  function n2cTest(options) {
    var desc = "in " + JSON.stringify(options.html) + ", selector " +
               JSON.stringify(options.selector) + " ";
    lpTest(options.name,
      options.html,
      function(previewArea, preview, cm, docFrag, html) {
        var originalDom = domStructure(docFrag);
        var wind = previewArea.contents()[0].defaultView;
        var p = wind.document.querySelector(options.selector);
        if (!p)
          throw new Error("selector doesn't map to anything");
        var interval = nodeToCode(p, docFrag);
        if (!options.expect)
          ok(interval === null, desc + "doesn't map to any code");
        else
          equal(html.slice(interval.start, interval.end), options.expect,
                desc + "maps to code " + JSON.stringify(options.expect));
        equal(domStructure(docFrag), originalDom,
              "DOM structure of document fragment is unchanged");
      });
  }

  n2cTest({
    name: "nodeToCode() works on HTML w/ explicit <html> and <body>",
    html: "<html><body><p>u</p></body></html>",
    selector: "p",
    expect: "<p>u</p>"
  });

  n2cTest({
    name: "nodeToCode() works on HTML w/ no <html> and <body>",
    html: "<p>u</p>",
    selector: "p",
    expect: "<p>u</p>"
  });

  n2cTest({
    name: "nodeToCode() works on HTML w/ <html> but no <body>",
    html: "<html><p>u</p></html>",
    selector: "p",
    expect: "<p>u</p>"
  });

  n2cTest({
    name: "nodeToCode() works on void element",
    html: '<html><img id="foo"></html>',
    selector: "img",
    expect: '<img id="foo">'
  });

  n2cTest({
    name: "nodeToCode() can't map to anything from implied <html>",
    html: "<p>hi</p>",
    selector: "html",
    expect: null
  });

  test("pathTo() works", function() {
    var div = $('<div></div>').html(pathToHTML);
    div.find(".test-case").each(function() {
      var root = this;

      var expect = $(root).attr("data-expect");
      var target = $(root).find('[data-target="true"]').get(0);
      var actual = pathTo(root, target);
      equal(actual, expect, "actual CSS path is same as expected");

      var matches = $(root).find(expect);
      if (matches.length != 1)
        throw new Error("expected path does not uniquely identify element!");
      if (matches.get(0) !== target)
        throw new Error("expected path is not actually valid!");
    });
  });
});
