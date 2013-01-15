module("Slowparse");

test("Stream.match()", function() {
  var stream = new Slowparse.Stream("blArgle");
  ok(stream.match("blArgle"));
  equal(stream.pos, 0);
  ok(!stream.match("blargle"));
  equal(stream.pos, 0);
  ok(stream.match("blargle", false, true));
  equal(stream.pos, 0);
  ok(stream.match("bla", true, true));
  equal(stream.pos, 3);
  ok(stream.match("rgle", true));
  equal(stream.pos, 7);
});

test("Stream.eat() works at EOF", function() {
  var stream = new Slowparse.Stream("");
  ok(!stream.eat(/blah/));
});

test("parsing of valid DOCTYPE", function() {
  var html = '<!DOCTYPE html><p>hi</p>';
  var doc = parseWithoutErrors(html);
  assertParseIntervals(html, doc, "document", {
    'parseInfo.doctype': '<!DOCTYPE html>'
  });
});

test("parsing of misplaced DOCTYPE", function() {
  var html = '<p>hi</p><!DOCTYPE html>';
  var result = Slowparse.HTML(document, html);
  deepEqual(result.error, {
    "openTag": {
      "end": 10,
      "name": "",
      "start": 9
    },
    "type": "INVALID_TAG_NAME"
  });
});

test("parsing of HTML comments", function() {
  var html = 'hi<!--testing-->there';
  var doc = parseWithoutErrors(html);
  assertParseIntervals(html, doc.childNodes[1], "comment", {
    'parseInfo': '<!--testing-->'
  });
});

test("UNQUOTED_ATTR_VALUE in <h2><span start=</h2>", function() {
  // https://github.com/mozilla/slowparse/issues/6
  var err = Slowparse.HTML(document, '<h2><span start=</h2>').error;
  equal(err.type, "UNQUOTED_ATTR_VALUE");
});

test("parsing of elements with boolean attributes", function() {
  var html = '<a href></a>';
  var doc = parseWithoutErrors(html);
  var attr = doc.childNodes[0].attributes[0];
  equal(attr.nodeName, 'href');
  equal(attr.nodeValue, '');
  assertParseIntervals(html, attr, "attr", {
    'parseInfo.name': 'href'
  });
  
  var error = Slowparse.HTML(document, '<a href+></a>').error;
  equal(error.type, 'UNTERMINATED_OPEN_TAG');

  html = '<a href class="foo"></a>';
  doc = parseWithoutErrors(html);
  var attr1 = doc.childNodes[0].attributes[0];
  var attr2 = doc.childNodes[0].attributes[1];
  
  // Apparently NamedNodeMap entries are not in any particular order:
  // https://developer.mozilla.org/en/DOM/NamedNodeMap
  // 
  // So, we'll swap these values if they're not in the order we expect
  // them to be in, which is the case in IE9, at the very least.
  if (attr1.nodeName == 'class') {
    var temp = attr1;
    attr1 = attr2;
    attr2 = temp;
  }
  
  equal(attr1.nodeName, 'href');
  equal(attr1.nodeValue, '');
  equal(attr2.nodeName, 'class');
  equal(attr2.nodeValue, 'foo');
  assertParseIntervals(html, attr1, "attr1", {
    'parseInfo.name': 'href'
  });
  ok(attr1.parseInfo.value === undefined);
  assertParseIntervals(html, attr2, "attr2", {
    'parseInfo.name': 'class',
    'parseInfo.value': '"foo"'
  });
});

test("parsing of <script> tags", function() {
  var html = '<script>x < 3;</script>';
  var doc = parseWithoutErrors(html);
  equal(doc.childNodes.length, 1, "document has one child");
  
  var script = doc.childNodes[0];
  equal(script.nodeName, "SCRIPT",
        "first child of generated DOM is <script>");
  equal(script.childNodes.length, 1, "<script> has one child");
  var textNode = script.childNodes[0];

  equal(textNode.nodeType, textNode.TEXT_NODE,
        "<script>'s child is a text node.");
  assertParseIntervals(html, textNode, "textNode", {
    'parseInfo': 'x < 3;',
  });
  equal(documentFragmentHTML(doc), html,
        "serialization of generated DOM matches original HTML");
});

test("parsing of valid HTML", function() {
  var html = '<p class="foo">hello there</p>';
  var doc = parseWithoutErrors(html);
  
  equal(doc.childNodes.length, 1, "document has one child");
  
  var p = doc.childNodes[0];

  equal(p.nodeName, "P", "first child of generated DOM is <p>");
  assertParseIntervals(html, p, "p", {
    'parseInfo.openTag': '<p class="foo">',
    'parseInfo.closeTag': '</p>'
  });
  equal(p.childNodes.length, 1, "<p> has one child");
  equal(p.attributes.length, 1, "<p> has one attribute");

  var textNode = p.childNodes[0];

  equal(textNode.nodeType, textNode.TEXT_NODE, "<p>'s child is a text node.");
  assertParseIntervals(html, textNode, "textNode", {
    'parseInfo': 'hello there',
  });
  assertParseIntervals(html, p.attributes[0], "attr", {
    'parseInfo.name': 'class',
    'parseInfo.value': '"foo"'
  });

  equal(documentFragmentHTML(doc), html,
        "serialization of generated DOM matches original HTML");
});

test("parsing of HTML comments with '--' in them", function() {
  var html = '<!-- allow\n--\nin comments plz -->';
  var doc = parseWithoutErrors(html);
  equal(documentFragmentHTML(doc), html,
        "serialization of generated DOM matches original HTML");
});

test("parsing of CDATA in <textarea> elements", function() {
  var text = "\nThis is CDATA with <p>, <i> and" +
             " <script> in it.\nThis should not trigger errors.";
  var html = "<textarea>" + text + "</textarea>";
  var doc = parseWithoutErrors(html);

  equal(doc.childNodes.length, 1, "doc has one child node");
  equal(doc.childNodes[0].nodeName, "TEXTAREA", "child node is <textarea>");
  equal(doc.childNodes[0].childNodes.length, 1, "textarea has one child");
  equal(doc.childNodes[0].childNodes[0].nodeValue, text,
        "textarea contents are ok");
});

testManySnippets("parsing of HTML is case-insensitive", [
  '<P CLASS="FOO">hi</P>',
  '<P class="FOO">hi</P>',
  '<p class="FOO">hi</P>',
  '<P class="FOO">hi</p>'
], function(html, doc) {
  equal(doc.childNodes[0].nodeName, 'P');
  equal(doc.childNodes[0].getAttribute('class'), 'FOO');
});

test("DOMBuilder is called with lowercased element/attrs", function() {
  var elements = [];
  var attributes = [];
  var fakeBuilder = {
    currentNode: {},
    pushElement: function(tagName, parseInfo) {
      this.currentNode.parseInfo = parseInfo;
      this.currentNode.nodeName = tagName.toUpperCase();
      elements.push(tagName);
    },
    popElement: function() {},
    attribute: function(name, value) {
      attributes.push(name);
    }
  };
  fakeBuilder.fragment = fakeBuilder.currentNode;
  var result = Slowparse.HTML(fakeBuilder, '<P CLASS="FOO"></P>');
  equal(result.error, null);
  deepEqual(elements, ['p'], "tag names are lowercased");
  deepEqual(attributes, ['class'], "attribute names are lowercased");
});

test("parsing of SVG elements", function() {
  var d = "M 0 0 L 100 0 L 100 100 L 0 100 Z";
  var html = "<svg width='100' height='100' viewbox='0 0 100 100'><path d='"+d+"'/></svg>";
  var doc = parseWithoutErrors(html);

  equal(doc.childNodes.length, 1, "doc has one child node");
  equal(doc.childNodes[0].nodeName, "svg", "child node is <svg>");
  equal(doc.childNodes[0].childNodes.length, 1, "svg element has one child");
  equal(doc.childNodes[0].childNodes[0].nodeName, "path", "svg child node is <path>");
  equal(doc.childNodes[0].childNodes[0].getAttribute('d'), d, "path outline data is correct");
});

test("verifying SVG namespace", function() {
  var d = "M 0 0 L 100 0 100 100 0 100 Z";
  var html = "<html><body><p>test</p><svg width='100' height='100' viewbox='0 0 100 100'><path d='"+d+"'/></svg><p>test</p></body></html>";
  var doc = parseWithoutErrors(html);
  
  var htmlns = "http://www.w3.org/1999/xhtml",
      svgns = "http://www.w3.org/2000/svg";

  equal(doc.childNodes.length, 1, "doc has one child node");
  equal(doc.childNodes[0].nodeName, "HTML", "top element is <html>");
  equal(doc.childNodes[0].childNodes[0].nodeName, "BODY", "contained element is <body>");
  equal(doc.childNodes[0].childNodes[0].childNodes[0].nodeName, "P", "first content node is <p>");
  equal(doc.childNodes[0].childNodes[0].childNodes[0].namespaceURI.toLowerCase(), htmlns, "p element uses the correct namespace");
  equal(doc.childNodes[0].childNodes[0].childNodes[1].nodeName, "svg", "second content node is <svg>");
  equal(doc.childNodes[0].childNodes[0].childNodes[1].namespaceURI.toLowerCase(), svgns, "svg element uses the correct namespace");
  equal(doc.childNodes[0].childNodes[0].childNodes[2].nodeName, "P", "third content node is <p>");
  equal(doc.childNodes[0].childNodes[0].childNodes[2].namespaceURI.toLowerCase(), htmlns, "p element uses the correct namespace");
});

test("verifying out-of-svg error", function() {
  var html = "<html><body><svg><rect/></svg><path>error</path></body></html>";
  var error = Slowparse.HTML(document, html).error;
  equal(error.type, "INVALID_TAG_NAME");
});

testManySnippets("parsing of HTML with void elements:", [
  '<br>',
  '<img src="http://www.mozilla.org/favicon.ico">'
], function(html, doc) {
  equal(documentFragmentHTML(doc), html);
});

testManySnippets("parsing of text content w/ newlines", [
  '<p>hello\nthere</p>',
  '<p>\n  hello there</p>'
], function(html, doc) {
  equal(documentFragmentHTML(doc), html);
});

testManySnippets("parsing of valid HTML w/ whitespace", [
  '<p class = "foo">hello there</p><p>u</p>',
  '<p class="foo"  >hello there</p><p>u</p>',
  '<p \nclass="foo">hello there</p><p>u</p>',
  '<p class="foo">hello there</p ><p>u</p>'
], function(html, doc) {
  var canonicalHTML = '<p class="foo">hello there</p><p>u</p>';
  var p = doc.childNodes[0];
  assertParseIntervals(html, p.childNodes[0], "textNode", {
    'parseInfo': 'hello there'
  });
  assertParseIntervals(html, p.attributes[0], "attr", {
    'parseInfo.name': 'class',
    'parseInfo.value': '"foo"'
  });

  equal(documentFragmentHTML(doc), canonicalHTML,
        "Document fragment is correct.");
});

testStyleSheet("parsing of CSS rule w/ one decl, no semicolon",
               "body { color: pink }",
               function(html, css, styleContents) {
    equal(styleContents.parseInfo.rules.length, 1);
    equal(styleContents.parseInfo.rules[0].declarations.properties.length, 1);
    
    assertParseIntervals(html, styleContents, "style", {
      'parseInfo': 'body { color: pink }',
      'parseInfo.rules[0].selector': 'body',
      'parseInfo.rules[0].declarations': '{ color: pink }',
      'parseInfo.rules[0].declarations.properties[0].name': 'color',
      'parseInfo.rules[0].declarations.properties[0].value': 'pink'
    });
});

testStyleSheet("parsing of CSS rule w/ one decl and semicolon",
               "body { color: pink; }",
               function(html, css, styleContents) {
    equal(styleContents.parseInfo.rules.length, 1);
    equal(styleContents.parseInfo.rules[0].declarations.properties.length, 1);
    assertParseIntervals(html, styleContents, "style", {
      'parseInfo': 'body { color: pink; }',
      'parseInfo.rules[0].selector': 'body',
      'parseInfo.rules[0].declarations': '{ color: pink; }',
      'parseInfo.rules[0].declarations.properties[0].name': 'color',
      'parseInfo.rules[0].declarations.properties[0].value': 'pink'
    });
});

testStyleSheet("parsing of empty CSS rule",
               "body {}",
               function(html, css, styleContents) {
   equal(styleContents.parseInfo.rules.length, 1);
   equal(styleContents.parseInfo.rules[0].declarations.properties.length, 0);
    assertParseIntervals(html, styleContents, "style", {
      'parseInfo': 'body {}',
      'parseInfo.rules[0].selector': 'body',
      'parseInfo.rules[0].declarations': '{}'
    });
});

testStyleSheet("parsing of CSS rule w/ funky whitespace",
               ["body\n { color: pink; }",
                "body\n {\n color: pink; }",
                "body\n {\n color: \npink; }",
                "body\n {\n color: \npink\n\n }",
                "body\n {\n color : \npink\n\n }",
                "body\n {\n color: \npink \n; }",
                "body\n {\n color: \npink; }\n"],
               function(html, css, styleContents) {
    equal(styleContents.parseInfo.rules.length, 1);
    equal(styleContents.parseInfo.rules[0].declarations.properties.length, 1);
    assertParseIntervals(html, styleContents, "style", {
      'parseInfo.rules[0].selector': 'body',
      'parseInfo.rules[0].declarations.properties[0].name': 'color',
      'parseInfo.rules[0].declarations.properties[0].value': 'pink'
    });
});

testStyleSheet("parsing of empty CSS sheet w/ comment",
               "/* nothing to see here. */",
               function(html, css, styleContents) {
    equal(styleContents.parseInfo.rules.length, 0);
});

testStyleSheet("parsing of empty CSS rule w/ comment",
               "p { /* nothing to see here. */ }",
               function(html, css, styleContents) {
    equal(styleContents.parseInfo.rules.length, 1);
});

testStyleSheet("parsing of CSS rule w/ comments",
               "/** comment 1 **/ bo/* comment 2 */dy /*comment 3*/{ /* c4 */ co/*c5*/lor/*c6*/: /*c7*/pi/*c8*/nk/*c9****** c9 *****/}",
               function(html, css, styleContents) {
    equal(styleContents.parseInfo.rules.length, 1);
    equal(styleContents.parseInfo.rules[0].declarations.properties.length, 1);
    assertParseIntervals(html, styleContents, "style", {
      'parseInfo': '/** comment 1 **/ bo/* comment 2 */dy /*comment 3*/{ /* c4 */ co/*c5*/lor/*c6*/: /*c7*/pi/*c8*/nk/*c9****** c9 *****/}',
      'parseInfo.rules[0].selector': 'bo/* comment 2 */dy',
      'parseInfo.rules[0].declarations': '{ /* c4 */ co/*c5*/lor/*c6*/: /*c7*/pi/*c8*/nk/*c9****** c9 *****/}',
      'parseInfo.rules[0].declarations.properties[0].name': 'co/*c5*/lor',
      'parseInfo.rules[0].declarations.properties[0].value': 'pi/*c8*/nk',
    });
    
    equal(styleContents.parseInfo.rules[0].selector.value, "body");
    equal(styleContents.parseInfo.rules[0].declarations.properties[0].name.value, "color");
    equal(styleContents.parseInfo.rules[0].declarations.properties[0].value.value, "pink");

    equal(styleContents.parseInfo.comments.length, 9);
    assertParseIntervals(html, styleContents, "style", {
      'parseInfo.comments[0]': '/** comment 1 **/',
      'parseInfo.comments[1]': '/* comment 2 */',
      'parseInfo.comments[2]': '/*comment 3*/',
      'parseInfo.comments[3]': '/* c4 */',
      'parseInfo.comments[4]': '/*c5*/',
      'parseInfo.comments[5]': '/*c6*/',
      'parseInfo.comments[6]': '/*c7*/',
      'parseInfo.comments[7]': '/*c8*/',
      'parseInfo.comments[8]': '/*c9****** c9 *****/'
    });
});

testStyleSheet("parsing of CSS rule w/ vendor prefixes",
               ".vendors { -o-border-radius: 5px; -moz-border-radius: 5px; -webkit-border-radius: 5px; -ms-border-radius: 5px; border-radius: 5px; }",
               function(html, css, styleContents) {
    equal(styleContents.parseInfo.rules.length, 1);
    equal(styleContents.parseInfo.rules[0].declarations.properties.length, 5);
    assertParseIntervals(html, styleContents, "style", {
      'parseInfo': '.vendors { -o-border-radius: 5px; -moz-border-radius: 5px; -webkit-border-radius: 5px; -ms-border-radius: 5px; border-radius: 5px; }',
      'parseInfo.rules[0].selector': '.vendors',
      'parseInfo.rules[0].declarations': '{ -o-border-radius: 5px; -moz-border-radius: 5px; -webkit-border-radius: 5px; -ms-border-radius: 5px; border-radius: 5px; }',
      'parseInfo.rules[0].declarations.properties[0].name': '-o-border-radius',
      'parseInfo.rules[0].declarations.properties[0].value': '5px',
      'parseInfo.rules[0].declarations.properties[1].name': '-moz-border-radius',
      'parseInfo.rules[0].declarations.properties[1].value': '5px',
      'parseInfo.rules[0].declarations.properties[2].name': '-webkit-border-radius',
      'parseInfo.rules[0].declarations.properties[2].value': '5px',
      'parseInfo.rules[0].declarations.properties[3].name': '-ms-border-radius',
      'parseInfo.rules[0].declarations.properties[3].value': '5px',
      'parseInfo.rules[0].declarations.properties[4].name': 'border-radius',
      'parseInfo.rules[0].declarations.properties[4].value': '5px',
    });
});

test("replaceEntityRefs", function() {
  [
    ["&lt;", "<"],
    ["&gt;", ">"],
    ["&amp;", "&"],
    ["&quot;", '"'],
    ["&QUOT;", '"', "matches are case-insensitive"],
    ["&lt;p&gt; tag", "<p> tag", "multiple refs are replaced"],
    ["hello &garbage;", "hello &garbage;", "replacer is forgiving"]
  ].forEach(function(arg) {
    equal(Slowparse.replaceEntityRefs(arg[0]), arg[1],
          "replaceEntityRefs(" + JSON.stringify(arg[0]) + ") == " +
          JSON.stringify(arg[1]) + (arg[2] ? " (" + arg[2] + ")" : ""));
  });
});

test("parsing of self-closing void elements works", function() {
  var html = 'hello<br/>';
  var doc = parseWithoutErrors(html);
  assertParseIntervals(html, doc.childNodes[1], "brNode", {
    'parseInfo.openTag': '<br/>',
  });
});

test("parsing of self-closing void elements w/ spaces works", function() {
  var html = 'hello<br />';
  var doc = parseWithoutErrors(html);
  assertParseIntervals(html, doc.childNodes[1], "brNode", {
    'parseInfo.openTag': '<br />',
  });
});

test("parsing of text content w/ HTML entities", function() {
  var html = '<p>&lt;p&gt;</p>';
  var doc = parseWithoutErrors(html);
  var textNode = doc.childNodes[0].childNodes[0];
  equal(textNode.nodeValue, '<p>');
  assertParseIntervals(html, textNode, "textNode", {
    'parseInfo': '&lt;p&gt;',
  });
});

asyncTest("parsing of <script> tags doesn't execute the code", function() {
  var html = '<script>alert("PWNED"); window.PWNED = true;</script>';
  var doc = parseWithoutErrors(html);
  setTimeout(function() {
    equal(window.PWNED, undefined);
    start();
  }, 100);
});

test("parsing of attr content w/ HTML entities", function() {
  var html = '<p class="1 &lt; 2 &LT; 3"></p>';
  var doc = parseWithoutErrors(html);
  var attrNode = doc.childNodes[0].attributes[0];
  equal(attrNode.nodeValue, '1 < 2 < 3');
  assertParseIntervals(html, attrNode, "attr", {
    'parseInfo.value': '"1 &lt; 2 &LT; 3"',
  });
});

test("INVALID_TAG_NAME raised by < at EOF", function() {
  var error = Slowparse.HTML(document, '<').error;
  equal(error.type, "INVALID_TAG_NAME");
});

test("MISSING_CSS_SELECTOR works after comment", function() {
  var html = '<style>/* hello */ {</style>';
  var error = Slowparse.HTML(document, html).error;
  equal(error.type, "MISSING_CSS_SELECTOR");
});

test("UNTERMINATED_ATTR_VALUE works at end of stream", function() {
  var html = '<a href="';
  var error = Slowparse.HTML(document, html).error;
  equal(error.type, "UNTERMINATED_ATTR_VALUE");
  equal(error.attribute.value.start, html.length-1);
});

test("UNQUOTED_ATTR_VALUE works at end of stream", function() {
  var html = '<a href=';
  var error = Slowparse.HTML(document, html).error;
  equal(error.type, "UNQUOTED_ATTR_VALUE");
  equal(error.start, html.length);
});

test("UNTERMINATED_CLOSE_TAG works at end of stream", function() {
  var html = "<span>test</span";
  var error = Slowparse.HTML(document, html).error;
  equal(error.type, "UNTERMINATED_CLOSE_TAG");
  equal(error.closeTag.end, html.length);
});

test("Slowparse.HTML_ELEMENT_NAMES", function() {
  ok(Slowparse.HTML_ELEMENT_NAMES.indexOf("p") != -1);
});

test("Slowparse.CSS_PROPERTY_NAMES", function() {
  ok(Slowparse.CSS_PROPERTY_NAMES.indexOf("color") != -1);
});

