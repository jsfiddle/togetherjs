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
function assertParseIntervals(html, node, name, map) {
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
