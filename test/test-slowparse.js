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
      if (!(part in obj))
        return null;
      obj = obj[part];
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
