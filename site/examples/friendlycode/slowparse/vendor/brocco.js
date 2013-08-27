"use strict";

// This is a simple port of [Docco][] to the browser, which potentially
// relieves developers of needing a build/deploy step for their
// documentation. This makes it a bit like Docco combined with
// [Code Illuminated][].
//
// The [source for Brocco][source] is available on GitHub, and released under
// the MIT license.
//
// ## Dependencies
//
// The only required dependencies are `brocco.js`, `docco.css`, and
// `showdown.js`.
//
// Optional syntax highlighting requires [CodeMirror][]. Simply
// include `codemirror.js` and the modes for any
// languages you're documenting, and Brocco will take care of
// the rest.
//
// ## Usage
//
// After including the requisite scripts and CSS file in a webpage,
// you can render basic documentation like this:
//
//     Brocco.document("myfile.js");
//
// This will insert the generated documentation into the page's
// `<body>` element. Alternatively, if you want to be passed the
// generated HTML, you can do this:
//
//     Brocco.document("myfile.js", function(html) {
//       document.getElementById("mydocs").innerHTML = html;
//     });
//
// By default, Brocco will try to fetch the source file over XHR. If
// you have it on hand, though, you can do this:
//
//     Brocco.document("myfile.js", {
//       code: "console.log('hello world.');"
//     });
//
//   [source]: https://github.com/toolness/brocco
//   [Docco]: http://jashkenas.github.com/docco/
//   [Code Illuminated]: http://www.toolness.com/wp/?p=441
//   [CodeMirror]: http://codemirror.net/

var Brocco = (function() {
  var version = "0.1.0";
  
  // ## Main Documentation Generation Functions
  
  // Generate the documentation for a source file by (optionally) reading it
  // in, splitting it up into comment/code sections, highlighting them for
  // the appropriate language, and merging them into an HTML template.
  function generateDocumentation(source, config, callback) {
    var code;

    var parseAndHighlight = function() {
      var sections = parse(source, code);
      return highlight(source, sections, config, function() {
        callback(generateHtml(source, sections, config));
      });
    };

    if (typeof(config) != "object") {
      callback = config;
      config = {};
    }

    code = config.code;
    if (!config.template)
      config.template = defaultTemplate;
    
    if (!callback)
      callback = insertHtmlIntoBody;

    if (typeof(code) == "undefined") {
      getSourceFile(source, function(contents) {
        code = contents;
        parseAndHighlight();
      });
    } else
      parseAndHighlight();
  }

  // Given a string of source code, parse out each comment and the code that
  // follows it, and create an individual **section** for it.
  // Sections take the form:
  //
  //     {
  //       docsText: ...
  //       docsHtml: ...
  //       codeText: ...
  //       codeHtml: ...
  //     }
  function parse(source, code) {
    var codeText, docsText, hasCode, language, line, lines, save, 
        sections, _i, _len;
    lines = code.split('\n');
    sections = [];
    language = getLanguage(source);
    hasCode = docsText = codeText = '';
    save = function(docsText, codeText) {
      return sections.push({
        docsText: docsText,
        codeText: codeText
      });
    };
    for (_i = 0, _len = lines.length; _i < _len; _i++) {
      line = lines[_i];
      if (line.match(language.commentMatcher) &&
          !line.match(language.commentFilter)) {
        if (hasCode) {
          save(docsText, codeText);
          hasCode = docsText = codeText = '';
        }
        docsText += line.replace(language.commentMatcher, '') + '\n';
      } else {
        hasCode = true;
        codeText += line + '\n';
      }
    }
    save(docsText, codeText);
    return sections;
  };
  
  // Highlights parsed sections of code. Runs the text of
  // their corresponding comments through **Markdown**, using
  // [Showdown][]. If no syntax highlighter is present, output the
  // code in plain text.
  //
  //   [Showdown]: http://attacklab.net/showdown/
  function highlight(source, sections, config, callback) {
    var section;
    var language = getLanguage(source);
    var text = (function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = sections.length; _i < _len; _i++) {
        section = sections[_i];
        _results.push(section.codeText);
      }
      return _results;
    })();
    var highlighter = config.highlighter || codeMirrorHighlighter;
    var showdown = config.showdown || new Showdown.converter();
    highlighter(language, text, function(fragments) {
      var fragments, i, section, _i, _len;
      for (i = _i = 0, _len = sections.length; _i < _len; i = ++_i) {
        section = sections[i];
        section.codeHtml = fragments[i];
        section.docsHtml = showdown.makeHtml(section.docsText);
      }
      return callback();
    });
  }
  
  function generateHtml(source, sections, config) {
    var title = path.basename(source);
    return config.template({
      title: title,
      sections: sections
    });
  };

  // ## Helpers & Setup
  
  // Mappings between CodeMirror styles and the Pygments styles
  // defined in `docco.css`.
  var codeMirrorStyleMap = {
    "keyword": "k",
    "atom": "kc",
    "number": "m",
    "comment": "c",
    "string": "s2",
    "string-2": "s2",
  };
  
  // Each item maps the file extension to the name of the CodeMirror mode
  // and the symbol that indicates a comment.
  //
  // In Docco, this was in a separate JSON file, but we're including
  // it inline for simplicity.
  var languages = {
    ".coffee" :
      {"name" : "coffeescript", "symbol" : "#"},
    ".rb":
      {"name" : "ruby", "symbol" : "#"},
    ".py":
      {"name": "python", "symbol" : "#"},
    ".yaml":
      {"name" : "yaml", "symbol" : "#"},
    ".js":
      {"name" : "javascript", "symbol" : "//"},
    ".c":
      {"name" : "clike", "symbol" : "//"},
    ".h":
      {"name" : "clike", "symbol" : "//"},
    ".cpp":
      {"name" : "clike", "symbol" : "//"},
    ".php":
      {"name" : "php", "symbol" : "//"},
    ".hs":
      {"name" : "haskell", "symbol" : "--"},
    ".erl":
      {"name" : "erlang", "symbol" : "%"},
    ".hrl":
      {"name" : "erlang", "symbol" : "%"}
  };
  
  // This is a stand-in for node's <code>[path][]</code> module.
  //
  //   [path]: http://nodejs.org/api/path.html
  var path = {
    basename: function(p, ext) {
      var lastPart = p.split('/').slice(-1)[0];
      if (ext)
        lastPart = lastPart.slice(0, -(ext.length));
      return lastPart;
    },
    extname: function(filename) {
      return '.' + filename.split('.').slice(-1)[0];
    }
  };
  
  // This is a modified version of CodeMirror's [runmode][],
  // used to leverage CodeMirror's code editing modes for
  // syntax highlighting.
  //
  // If CodeMirror isn't detected or support for the current
  // language isn't available, this function falls back to
  // no highlighting.
  //
  //   [runmode]: http://codemirror.net/demo/runmode.html
  function codeMirrorHighlighter(language, fragments, cb) {
    if (typeof(CodeMirror) == "undefined")
      return nullHighlighter(language, fragments, cb);

    var mode = CodeMirror.getMode(CodeMirror.defaults, {
      name: language.name
    });
    if (mode.name == "null")
      return nullHighlighter(language, fragments, cb);
      
    var esc = htmlEscape;
    var string = fragments.join("\n" + language.symbol + "DIVIDER\n");
    var tabSize = CodeMirror.defaults.tabSize;
    var accum = [], col = 0;
    var onText = function(text, style) {
      if (text == "\n") {
        accum.push("\n");
        col = 0;
        return;
      }
      var escaped = "";
      // HTML-escape and replace tabs.
      for (var pos = 0;;) {
        var idx = text.indexOf("\t", pos);
        if (idx == -1) {
          escaped += esc(text.slice(pos));
          col += text.length - pos;
          break;
        } else {
          col += idx - pos;
          escaped += esc(text.slice(pos, idx));
          var size = tabSize - col % tabSize;
          col += size;
          for (var i = 0; i < size; ++i) escaped += " ";
          pos = idx + 1;
        }
      }

      if (style) {
        if (codeMirrorStyleMap[style])
          style = codeMirrorStyleMap[style] + " cm-" + style;
        else
          style = "cm-" + style;
        accum.push("<span class=\"" + esc(style) +
                   "\">" + escaped + "</span>");
      } else
        accum.push(escaped);
    };
    
    var lines = CodeMirror.splitLines(string),
        state = CodeMirror.startState(mode);
    for (var i = 0, e = lines.length; i < e; ++i) {
      if (i) onText("\n");
      var stream = new CodeMirror.StringStream(lines[i]);
      while (!stream.eol()) {
        var style = mode.token(stream, state);
        onText(stream.current(), style, i, stream.start);
        stream.start = stream.pos;
      }
    }
    
    fragments = accum.join("")
      .split('\n<span class="c cm-comment">' +
             language.symbol + 'DIVIDER</span>\n');
    cb(fragments.map(function(code) { return '<pre>' + code + '</pre>'; }));
  }
  
  // This null syntax highlighter doesn't do any syntax highlighting at
  // all; it just plops the plain-text source code in a `<pre>` element.
  function nullHighlighter(language, fragments, cb) {
    cb(fragments.map(function(code) {
      return '<pre>' + htmlEscape(code) + '</pre>';
    }));
  }
  
  // This default template produces an identical DOM to the 
  // <code>[docco.jst][]</code> template used by Docco for single-source
  // files. It's just easier to inline it than grab it via XHR because it
  // complicates the use and deployment of this browser-side script.
  //
  //   [docco.jst]: https://github.com/jashkenas/docco/blob/master/resources/docco.jst
  function defaultTemplate(context) {
    function el(name, attrs, children) {
      var element = document.createElement(name);
      Object.keys(attrs).forEach(function(attr) {
        element.setAttribute(attr, attrs[attr]);
      });
      (children || []).forEach(function(child) {
        if (typeof(child) == "string") {
          var temp = document.createElement("div");
          temp.innerHTML = child;
          for (var i = 0; i < temp.childNodes.length; i++)
            element.appendChild(temp.childNodes[i]);
        } else
          element.appendChild(child);
      });
      return element;
    }

    return el("div", {}, [
      el("div", {id: "container"}, [
        el("div", {id: "background"}),
        el("table", {cellpadding: 0, cellspacing: 0}, [
          el("thead", {}, [
            el("tr", {}, [
              el("th", {"class": "docs"}, [el("h1", {}, [context.title])]),
              el("th", {"class": "code"})
            ])
          ]),
          el("tbody", {}, context.sections.map(function(section, i) {
            return el("tr", {id: "section-" + (i+1)}, [
              el("td", {"class": "docs"}, [
                el("div", {"class": "pilwrap"}, [
                  el("a", {
                    "class": "pilcrow",
                    "href": "#section-" + (i+1)
                  }, ["&#182;"])
                ]),
                section.docsHtml
              ]),
              el("td", {"class": "code"}, [section.codeHtml])
            ]);
          }))
        ])
      ])
    ]).innerHTML;
  }

  // This helper inserts the given HTML into the `<body>` element
  // of the page. It also does a bit of hackery to ensure that
  // named anchors are automatically navigated to.
  function insertHtmlIntoBody(html) {
    document.body.innerHTML = html;
    // Some browsers, like Firefox and Opera, will automatically
    // move the page to its old location when the user refreshes
    // it. We'll give the browser time to do this, and only
    // scroll the page ourselves if it doesn't.
    setTimeout(function() {
      if (location.hash.length > 1 && window.scrollY == 0) {
        var el = document.getElementById(location.hash.slice(1));
        if (el)
          el.scrollIntoView();
      }
    }, 0);
  }
  
  // Leverage the DOM to do HTML escaping for us.
  function htmlEscape(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }
  
  // Retrieve the given source file over XHR. If an error occurs
  // and we're on a `file:` URL, there's a good chance it's
  // due to browser security restrictions, so provide content
  // that provides advice.
  function getSourceFile(filename, cb) {
    var req = new XMLHttpRequest();
    req.open("GET", filename);
    req.onerror = function() {
      var language = languages[path.extname(filename)];
      var lines = ["Couldn't get the source file at `" + filename + "`."];
      if (location.protocol == "file:")
        lines = lines.concat([
          "", "This may be due to browser security restrictions. You may ",
          "want to consider opening this file with another browser, or " +
          "using a simple Web server such as `python -m SimpleHTTPServer`."
        ]);
      cb(language.symbol + lines.join('\n' + language.symbol));
    };
    req.onload = function() { cb(req.responseText); };
    req.send(null);
  }
  
  // Get the current language we're documenting, based on the extension.
  function getLanguage(source) {
    return languages[path.extname(source)];
  };
  
  // Build out the appropriate matchers and delimiters for each language.
  function processLanguages(languages) {
    for (var ext in languages) {
      var l = languages[ext];
      // Does the line begin with a comment?
      l.commentMatcher = RegExp("^\\s*" + l.symbol + "\\s?");
      
      // Ignore [hashbangs][] and interpolations...
      //
      //   [hashbangs]: http://en.wikipedia.org/wiki/Shebang_(Unix\)
      l.commentFilter = /(^#![/]|^\s*#\{)/;
    }
  }
  
  processLanguages(languages);
  
  // ## Exports
  //
  // Information about Brocco, and functions for programmatic usage.
  return {
    version: version,
    document: generateDocumentation,
    nullHighlighter: nullHighlighter,
    codeMirrorHighlighter: codeMirrorHighlighter,
    path: path,
    languages: languages
  };
})();
