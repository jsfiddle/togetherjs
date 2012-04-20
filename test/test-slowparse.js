module("Slowparse");

// Get the innerHTML of a document fragment.
function documentFragmentHTML(doc) {
  var div = document.createElement("div");
  for (var i = 0; i < doc.childNodes.length; i++) {
    div.appendChild(doc.childNodes[i].cloneNode(true));
  }
  return div.innerHTML;
}

// Ensure that an object containing {start,end} keys correspond
// to a particular substring of HTML source code.
function assertParseInfo(html, node, name, map) {
  function getDottedProperty(obj, property) {
    var parts = property.split('.');
    parts.forEach(function(part) {
      var arrayIndexMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayIndexMatch)
        part = arrayIndexMatch[1];
      if (!(part in obj))
        return null;
      obj = obj[part];
      if (arrayIndexMatch)
        obj = obj[parseInt(arrayIndexMatch[2])];
    });
    return obj;
  }

  for (var dottedName in map) {
    var baseName = name + "." + dottedName;
    var interval = getDottedProperty(node, dottedName);
    ok(interval, baseName + " exists");
    if (interval) {
      equal(html.slice(interval.start, interval.end), map[dottedName],
            baseName + " start/end positions are correct");
    }
  }
}

// Parse the given HTML, ensure it has no errors, and return the
// parsed document.
function parseWithoutErrors(html) {
  var result = Slowparse.HTML(document, html);
  
  ok(result.document, "document is returned");
  equal(result.error, null, "no errors are reported");
  
  return result.document;
}

// Test many snippets of valid HTML, passing the HTML and its document
// to a callback function that does the actual testing. Useful for 
// testing that many different inputs result in the same output.
function testManySnippets(name, htmlStrings, cb) {
  htmlStrings.forEach(function(html) {
    test(name + ": " + JSON.stringify(html), function() {
      cb(html, parseWithoutErrors(html));
    });
  });
}

// Test one or more snippets of CSS.
function testStyleSheet(name, cssList, cb) {
  if (typeof(cssList) == "string")
    cssList = [cssList];
  
  cssList.forEach(function(css) {
    test(name + ": " + JSON.stringify(css), function() {
      var html = '<style>' + css + '</style>';
      var doc = parseWithoutErrors(html);
      var styleContents = doc.childNodes[0].childNodes[0];
      equal(styleContents.nodeValue, css);
      cb(html, css, styleContents);
    });
  });
}

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

test("parsing of valid DOCTYPE", function() {
  var html = '<!DOCTYPE html><p>hi</p>';
  var doc = parseWithoutErrors(html);
  assertParseInfo(html, doc, "document", {
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
  assertParseInfo(html, doc.childNodes[1], "comment", {
    'parseInfo': '<!--testing-->'
  });
});

test("UNQUOTED_ATTR_VALUE in <h2><span start=</h2>", function() {
  // https://github.com/toolness/slowparse/issues/6
  var err = Slowparse.HTML(document, '<h2><span start=</h2>').error;
  equal(err.type, "UNQUOTED_ATTR_VALUE");
});

test("parsing of elements with boolean attributes", function() {
  var html = '<a href></a>';
  var doc = parseWithoutErrors(html);
  var attr = doc.childNodes[0].attributes[0];
  equal(attr.nodeName, 'href');
  equal(attr.nodeValue, '');
  assertParseInfo(html, attr, "attr", {
    'parseInfo.name': 'href'
  });
  
  var error = Slowparse.HTML(document, '<a href+></a>').error;
  equal(error.type, 'UNTERMINATED_OPEN_TAG');

  html = '<a href class="foo"></a>';
  doc = parseWithoutErrors(html);
  var attr1 = doc.childNodes[0].attributes[0];
  var attr2 = doc.childNodes[0].attributes[1];
  equal(attr1.nodeName, 'href');
  equal(attr1.nodeValue, '');
  equal(attr2.nodeName, 'class');
  equal(attr2.nodeValue, 'foo');
  assertParseInfo(html, attr1, "attr1", {
    'parseInfo.name': 'href'
  });
  ok(attr1.parseInfo.value === undefined);
  assertParseInfo(html, attr2, "attr2", {
    'parseInfo.name': 'class',
    'parseInfo.value': '"foo"'
  });
});

test("parsing of valid HTML", function() {
  var html = '<p class="foo">hello there</p>';
  var doc = parseWithoutErrors(html);
  
  equal(doc.childNodes.length, 1, "document has one child");
  
  var p = doc.childNodes[0];

  equal(p.nodeName, "P", "first child of generated DOM is <p>");
  assertParseInfo(html, p, "p", {
    'parseInfo.openTag': '<p class="foo">',
    'parseInfo.closeTag': '</p>'
  });
  equal(p.childNodes.length, 1, "<p> has one child");
  equal(p.attributes.length, 1, "<p> has one attribute");

  var textNode = p.childNodes[0];

  equal(textNode.nodeType, textNode.TEXT_NODE, "<p>'s child is a text node.");
  assertParseInfo(html, textNode, "textNode", {
    'parseInfo': 'hello there',
  });
  assertParseInfo(html, p.attributes[0], "attr", {
    'parseInfo.name': 'class',
    'parseInfo.value': '"foo"'
  });

  equal(documentFragmentHTML(doc), html,
        "serialization of generated DOM matches original HTML");
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
  assertParseInfo(html, p.childNodes[0], "textNode", {
    'parseInfo': 'hello there'
  });
  assertParseInfo(html, p.attributes[0], "attr", {
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
    
    window.console.log(html.substring(7,12));
    window.console.log(styleContents.parseInfo);
    
    assertParseInfo(html, styleContents, "style", {
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
    assertParseInfo(html, styleContents, "style", {
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
    assertParseInfo(html, styleContents, "style", {
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
    assertParseInfo(html, styleContents, "style", {
      'parseInfo.rules[0].selector': 'body',
      'parseInfo.rules[0].declarations.properties[0].name': 'color',
      'parseInfo.rules[0].declarations.properties[0].value': 'pink'
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

test("parsing of text content w/ HTML entities", function() {
  var html = '<p>&lt;p&gt;</p>';
  var doc = parseWithoutErrors(html);
  var textNode = doc.childNodes[0].childNodes[0];
  equal(textNode.nodeValue, '<p>');
  assertParseInfo(html, textNode, "textNode", {
    'parseInfo': '&lt;p&gt;',
  });
});

test("parsing of attr content w/ HTML entities", function() {
  var html = '<p class="1 &lt; 2 &LT; 3"></p>';
  var doc = parseWithoutErrors(html);
  var attrNode = doc.childNodes[0].attributes[0];
  equal(attrNode.nodeValue, '1 < 2 < 3');
  assertParseInfo(html, attrNode, "attr", {
    'parseInfo.value': '"1 &lt; 2 &LT; 3"',
  });
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
