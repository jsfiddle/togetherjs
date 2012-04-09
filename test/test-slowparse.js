module("Slowparse");

// Get the innerHTML of a document fragment.
function documentFragmentHTML(doc) {
  var div = document.createElement("div");
  for (var i = 0; i < doc.childNodes.length; i++) {
    div.appendChild(doc.childNodes[i].cloneNode(true));
  }
  return div.innerHTML;
}

// Return a string's substring based on an object with {start, end} keys.
function substring(string, interval) {
  return string.slice(interval.start, interval.end);
}

test("parsing of valid HTML", function() {
  var html = '<p class="foo">hello there</p>';
  var result = Slowparse.HTML(document, html);
  
  ok(result.document, "document is returned");
  equal(result.error, null, "no errors are reported");
  
  var doc = result.document;
  
  equal(doc.childNodes.length, 1, "document has one child");
  
  var p = doc.childNodes[0];

  equal(p.nodeName, "P", "first child of generated DOM is <p>");
  ok('parseInfo' in p, "<p> has 'parseInfo' expando property");
  equal(p.parseInfo.start, 0, "<p> parseInfo.start is correct");
  equal(p.parseInfo.end, html.length, "<p> parseInfo.end is correct");
  equal(p.childNodes.length, 1, "<p> has one child");
  equal(p.attributes.length, 1, "<p> has one attribute");

  var textNode = p.childNodes[0];

  equal(textNode.nodeType, textNode.TEXT_NODE, "<p>'s child is a text node.");
  ok('parseInfo' in textNode, "text node has 'parseInfo' expando property");
  equal(substring(html, textNode.parseInfo),
        "hello there",
        "text node parseInfo.start/end positions are correct");

  var attr = p.attributes[0];

  ok('parseInfo' in attr, "attr node has 'parseInfo' expando property");
  equal(substring(html, attr.parseInfo.name),
        "class",
        "attr node parseInfo.name.start/end positions are correct");
  equal(substring(html, attr.parseInfo.value),
        '"foo"',
        "attr node parseInfo.value.start/end positions are correct");

  equal(documentFragmentHTML(doc), html,
        "serialization of generated DOM matches original HTML");
});

test("parsing of invalid HTML", function() {
  var html = '<p class="foo">hello there';
  var result = Slowparse.HTML(document, html);
  var error = result.error;
  var p = result.document.childNodes[0];
  
  equal(p.nodeName, "P", "first child of generated DOM is <p>");
  equal(error.type, "UNCLOSED_TAG", "parser dies b/c of unclosed tag");
  equal(error.position, html.length, "parser dies at end of string");
  equal(error.node, p, "affiliated node of error is <p>");
});
