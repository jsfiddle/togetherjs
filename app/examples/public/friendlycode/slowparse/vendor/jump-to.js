"use strict";

// This is a simple add-on to [Brocco][] which provides a Docco-style
// *Jump To&hellip;* menu at the top of a page, allowing for
// navigation between different source files.
//
// Using this file requires populating the `<body>` of an HTML
// page with content similar to the following:
//
//     <div id="container">
//       <div id="background"></div>
//       <div id="jump_to">
//         Jump To &hellip;
//         <div id="jump_wrapper">
//         <div id="jump_page">
//           <a class="source">path/to/foo.js</a>
//           <a class="source">path/to/bar.cpp</a>
//           <!-- ... And so on ... -->
//         </div>
//       </div>
//     </div>
//
// Simply including the `jump-to.js` script, preceded by
// `brocco.js` and its dependencies, will automatically parse
// all the links inside `#jump_page`, provide a table of
// contents, and display the appropriate source file.
// There is no need to write any JavaScript yourself
// when using this add-on.
//
// Viewing specific source files happens through the URL
// querystring. In the example above, a querystring of `?foo.js` 
// will show the source at `path/to/source/foo.js`, while `?bar.cpp`
// will show the other file. If nothing is specified in the
// querystring, then the first source listed (in this case,
// `foo.js`) will be shown.
//
//   [Brocco]: ?brocco.js

Brocco.jumpTo = (function() {
  var sourceMap = {};
  var defaultSource;
  var source = location.search.slice(1);
  var anchors = document.querySelectorAll("#jump_page > a.source");

  [].slice.call(anchors).forEach(function(a) {
    var path = a.textContent.trim();
    var basename = Brocco.path.basename(path);
    
    if (!defaultSource)
      defaultSource = basename;
    
    sourceMap[basename] = path;
    a.setAttribute("href", "?" + basename);
    a.textContent = basename;
  });

  if (!(source in sourceMap))
    source = defaultSource;

  document.title = source;
  Brocco.document(sourceMap[source], function(html) {
    var temp = document.createElement("div");
    temp.innerHTML = html;
    var table = temp.querySelector("table");
    document.getElementById("container").appendChild(table);
  });
})();
