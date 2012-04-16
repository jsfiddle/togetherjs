var Slowparse = (function() {
  var CHARACTER_ENTITY_REFS = {
    lt: "<",
    gt: ">",
    quot: '"',
    amp: "&"
  };
  
  // Replace named character entity references (e.g. '&lt;') in the given
  // text string and return the result. If an entity name is unrecognized,
  // don't replace it at all; this makes the function "forgiving".
  //
  // This function does not currently replace numeric character entity
  // references (e.g., '&#160;').
  function replaceEntityRefs(text) {
    return text.replace(/&([A-Za-z]+);/g, function(ref, name) {
      name = name.toLowerCase();
      if (name in CHARACTER_ENTITY_REFS)
        return CHARACTER_ENTITY_REFS[name];
      return ref;
    });
  }
  
  function ParseError(parseInfo) {
    this.name = "ParseError";
    if (typeof(parseInfo) == "string") {
      var name = parseInfo;
      var args = [];
      for (var i = 1; i < arguments.length; i++)
        args.push(arguments[i]);
      parseInfo = ParseErrorBuilders[name].apply(ParseErrorBuilders, args);

      // This is a weird way of setting an attribute, but we want to
      // make the JSON serialize so the 'type' appears first, as it
      // makes our documentation read better.
      parseInfo = ParseErrorBuilders._combine({
        type: name
      }, parseInfo);
    }
    this.message = parseInfo.type;
    this.parseInfo = parseInfo;
  }

  ParseError.prototype = Error.prototype;

  var ParseErrorBuilders = {
    _combine: function(a, b) {
      var obj = {}, name;
      for (name in a) {
        obj[name] = a[name];
      }
      for (name in b) {
        obj[name] = b[name];
      }
      return obj;
    },
    UNCLOSED_TAG: function(parser) {
      return {
        openTag: this._combine({
          name: parser.domBuilder.currentNode.nodeName.toLowerCase()
        }, parser.domBuilder.currentNode.parseInfo.openTag)
      };
    },
    INVALID_TAG_NAME: function(tagName, token) {
      return {
        openTag: this._combine({
          name: tagName
        }, token.interval)
      };
    },
    UNEXPECTED_CLOSE_TAG: function(parser, closeTagName, token) {
      return {
        closeTag: this._combine({
          name: closeTagName
        }, token.interval)
      };
    },
    MISMATCHED_CLOSE_TAG: function(parser, openTagName, closeTagName, token) {
      return {
        openTag: this._combine({
          name: openTagName
        }, parser.domBuilder.currentNode.parseInfo.openTag),
        closeTag: this._combine({
          name: closeTagName
        }, token.interval)
      };
    },
    UNTERMINATED_ATTR_VALUE: function(parser, nameTok) {
      return {
        openTag: this._combine({
          name: parser.domBuilder.currentNode.nodeName.toLowerCase()
        }, parser.domBuilder.currentNode.parseInfo.openTag),
        attribute: {
          name: {
            value: nameTok.value,
            start: nameTok.interval.start,
            end: nameTok.interval.end
          },
          value: {
            start: parser.stream.makeToken().interval.start
          }
        },
      };
    },
    UNQUOTED_ATTR_VALUE: function(parser) {
      return {
        start: parser.stream.makeToken().interval.start
      };
    },
    UNTERMINATED_OPEN_TAG: function(parser) {
      return {
        openTag: {
          start: parser.domBuilder.currentNode.parseInfo.openTag.start,
          end: parser.stream.pos,
          name: parser.domBuilder.currentNode.nodeName.toLowerCase()
        }
      };
    },
    UNTERMINATED_CLOSE_TAG: function(parser) {
      return {
        closeTag: {
          name: parser.domBuilder.currentNode.nodeName.toLowerCase(),
          start: parser.domBuilder.currentNode.parseInfo.closeTag.start,
          end: parser.stream.makeToken().interval.start
        }
      };
    }
  };
  
  // The interface for this stream class is inspired by CodeMirror's:
  //
  // http://codemirror.net/doc/manual.html#modeapi
  function Stream(text) {
    this.text = text;
    this.pos = 0;
    this.tokenStart = 0;
  }

  Stream.prototype = {
    // Returns the next character in the stream without advancing it.
    // Will return undefined at the end of the text.
    peek: function() {
      return this.text[this.pos];
    },
    // Returns the next character in the stream and advances it.
    // Also returns undefined when no more characters are available.
    next: function() {
      if (!this.end())
        return this.text[this.pos++];
    },
    // Returns true only if the stream is at the end of the text.
    end: function() {
      return (this.pos == this.text.length);
    },
    // 'match' must be a regular expression. If the next character in the
    // stream 'matches' the given argument, it is consumed and returned.
    // Otherwise, undefined is returned.
    eat: function(match) {
      if (this.peek().match(match))
        return this.next();
    },
    // Repeatedly calls eat with the given argument, until it fails.
    // Returns true if any characters were eaten.
    eatWhile: function(matcher) {
      var wereAnyEaten = false;
      while (!this.end()) {
        if (this.eat(matcher))
          wereAnyEaten = true;
        else
          return wereAnyEaten;
      }
    },
    // Shortcut for eatWhile when matching white-space (including newlines).
    eatSpace: function() {
      return this.eatWhile(/[\s\n]/);
    },
    markTokenStart: function() {
      this.tokenStart = this.pos;
    },
    // Generates a JSON-serializable token object representing the interval
    // of text between the end of the last generated token and the current
    // stream position.
    makeToken: function() {
      if (this.pos == this.tokenStart)
        return null;
      var token = {
        value: this.text.slice(this.tokenStart, this.pos),
        interval: {
          start: this.tokenStart,
          end: this.pos
        }
      };
      this.tokenStart = this.pos;
      return token;
    }
  };

  function CSSParser(stream, domBuilder) {
    this.stream = stream;
    this.domBuilder = domBuilder;
  }

  CSSParser.prototype = {
    cssProperties: ["alignment-adjust","alignment-baseline","animation","animation-delay","animation-direction",
                    "animation-duration","animation-iteration-count","animation-name","animation-play-state",
                    "animation-timing-function","appearance","azimuth","backface-visibility","background",
                    "background-attachment","background-clip","background-color","background-image","background-origin",
                    "background-position","background-repeat","background-size","baseline-shift","binding","bleed",
                    "bookmark-label","bookmark-level","bookmark-state","bookmark-target","border","border-bottom",
                    "border-bottom-color","border-bottom-left-radius","border-bottom-right-radius","border-bottom-style",
                    "border-bottom-width","border-collapse","border-color","border-image","border-image-outset",
                    "border-image-repeat","border-image-slice","border-image-source","border-image-width",
                    "border-left","border-left-color","border-left-style","border-left-width","border-radius",
                    "border-right","border-right-color","border-right-style","border-right-width","border-spacing",
                    "border-style","border-top","border-top-color","border-top-left-radius","border-top-right-radius",
                    "border-top-style","border-top-width","border-width","bottom","box-decoration-break","box-shadow",
                    "box-sizing","break-after","break-before","break-inside","caption-side","clear","clip","color",
                    "color-profile","column-count","column-fill","column-gap","column-rule","column-rule-color",
                    "column-rule-style","column-rule-width","column-span","column-width","columns","content",
                    "counter-increment","counter-reset","crop","cue","cue-after","cue-before","cursor","direction",
                    "display","dominant-baseline","drop-initial-after-adjust","drop-initial-after-align",
                    "drop-initial-before-adjust","drop-initial-before-align","drop-initial-size","drop-initial-value",
                    "elevation","empty-cells","fit","fit-position","flex-align","flex-flow","flex-line-pack",
                    "flex-order","flex-pack","float","float-offset","font","font-family","font-size","font-size-adjust",
                    "font-stretch","font-style","font-variant","font-weight","grid-columns","grid-rows",
                    "hanging-punctuation","height","hyphenate-after","hyphenate-before","hyphenate-character",
                    "hyphenate-lines","hyphenate-resource","hyphens","icon","image-orientation","image-rendering",
                    "image-resolution","inline-box-align","left","letter-spacing","line-break","line-height",
                    "line-stacking","line-stacking-ruby","line-stacking-shift","line-stacking-strategy","list-style",
                    "list-style-image","list-style-position","list-style-type","margin","margin-bottom","margin-left",
                    "margin-right","margin-top","marker-offset","marks","marquee-direction","marquee-loop",
                    "marquee-play-count","marquee-speed","marquee-style","max-height","max-width","min-height",
                    "min-width","move-to","nav-down","nav-index","nav-left","nav-right","nav-up","opacity","orphans",
                    "outline","outline-color","outline-offset","outline-style","outline-width","overflow",
                    "overflow-style","overflow-wrap","overflow-x","overflow-y","padding","padding-bottom",
                    "padding-left","padding-right","padding-top","page","page-break-after","page-break-before",
                    "page-break-inside","page-policy","pause","pause-after","pause-before","perspective",
                    "perspective-origin","phonemes","pitch","pitch-range","play-during","position","presentation-level",
                    "punctuation-trim","quotes","rendering-intent","resize","rest","rest-after","rest-before",
                    "richness","right","rotation","rotation-point","ruby-align","ruby-overhang","ruby-position",
                    "ruby-span","size","speak","speak-header","speak-numeral","speak-punctuation","speech-rate",
                    "stress","string-set","tab-size","table-layout","target","target-name","target-new",
                    "target-position","text-align","text-align-last","text-decoration","text-decoration-color",
                    "text-decoration-line","text-decoration-skip","text-decoration-style","text-emphasis",
                    "text-emphasis-color","text-emphasis-position","text-emphasis-style","text-height","text-indent",
                    "text-justify","text-outline","text-shadow","text-space-collapse","text-transform",
                    "text-underline-position","text-wrap","top","transform","transform-origin","transform-style",
                    "transition","transition-delay","transition-duration","transition-property",
                    "transition-timing-function","unicode-bidi","vertical-align","visibility","voice-balance",
                    "voice-duration","voice-family","voice-pitch","voice-pitch-range","voice-rate","voice-stress",
                    "voice-volume","volume","white-space","widows","width","word-break","word-spacing","word-wrap",
                    "z-index"],
    _unknownCSSProperty: function(propertyName) {
      return this.cssProperties.indexOf(propertyName) === -1;
    },
    _parseSelector: function() {
      this.stream.eatWhile(/[^\{\}<]/);
      var token = this.stream.makeToken();
      if (token === null)
        return;

      var selector = token.value.trim();
      token.value = selector;
      
      //window.console.log("selector:");
      //window.console.log(token);
      //window.console.log("---");

      if (!(selector) || (selector && selector === '')) // && selector.match(/^[A-Za-z #~=\.\|"\(\)\[\]\:\+\*\-\_]+$/)))
        // FIXME: the regexp or even charset for selectors is complex, so I'm leaving
        //        this for when everything's up and running and we can start refining
        //        our accept/reject policies
        throw new ParseError({
          type: "INVALID_CSS_SELECTOR_NAME",
          node: this.domBuilder.currentNode,
          token: token
        });

      if (!this.stream.end()) {
        var peek = this.stream.peek();
        if (peek === '<') {
          // end of CSS!
          //window.console.log("end of CSS text block");
          return;
        }
        else if (peek === '}') {
          //window.console.log("CSS block end (selector level)");
          this.stream.eatWhile(/[}\s\n]/);
          this.stream.markTokenStart();
          this._parseSelector();        
        }
        else if (peek === '{') {
          //window.console.log("CSS block start");
          this.stream.eatWhile(/[\s\n{]/);
          this.stream.markTokenStart();
          this._parseDeclaration();
        }
        else {
          throw new ParseError({
            type: "MISSING_CSS_BLOCK_OPENER",
            node: this.domBuilder.currentNode,
            token: token
          });
        }
      }
    },
    _parseDeclaration: function() {
      this.stream.eatWhile(/[\s\n]/);
      this.stream.markTokenStart();

      if (this.stream.peek() === '}') {
        //window.console.log("CSS block end (Declaration level)");
        this.stream.next();
        this.stream.eatSpace();
        this._parseSelector();
      }
      this._parseProperty();
    },
    _parseProperty: function() {
      var rule = this.stream.eatWhile(/[^}<;:]/);
      var token = this.stream.makeToken();

      //window.console.log("property:");
      //window.console.log(token);
      //window.console.log("---");

      var next = this.stream.next();

      
      if(token === null && next === '}') {
        this.stream.eatWhile(/[\s\n]/);
        this.stream.markTokenStart();
        this._parseSelector();
      }

      else if (next === ':') {
        // proper parsing goes here
        var property = token.value.trim();
        if (!( property && property.match(/^[a-z\-]+$/)) || this._unknownCSSProperty(property))
          throw new ParseError({
            type: "INVALID_CSS_PROPERTY_NAME",
            node: this.domBuilder.currentNode,
            token: token
          });
        this.stream.eatWhile(/[\s]/);
        this.stream.markTokenStart();
        this._parseValue();
      }
      
      else {
        throw new ParseError({
            type: "INVALID_CSS_DECLARATION",
            node: this.domBuilder.currentNode,
            token: token
          });
      }
    },
    _parseValue: function() {
      var rule = this.stream.eatWhile(/[^}<;]/);
      var token = this.stream.makeToken();

      //window.console.log("value:");
      //window.console.log(token);
      //window.console.log("---");

      var next = this.stream.next();
      if (next === ';') {
        //window.console.log("end of prop:value; pair");
        this.stream.eatWhile(/[\s\n]/);
        this.stream.markTokenStart();
        this._parseProperty();
      }
      else if (next === '}') {
        //window.console.log("end of rule set");
        this.stream.eatWhile(/[\s\n]/);
        this.stream.markTokenStart();
        this._parseSelector();
      }
      else {
        throw new ParseError({
            type: "INVALID_CSS_RULE",
            node: this.domBuilder.currentNode,
            token: token
          });
      }
    },
    parse: function() {
      var sliceStart = this.stream.pos;
      this.stream.eatWhile(/[\s\n]/);
      this.stream.markTokenStart();
      this._parseSelector();
      var sliceEnd = this.stream.pos;
      var token = {
        value: this.stream.text.slice(sliceStart, sliceEnd),
        interval: {
          start: sliceStart,
          end: sliceEnd
        }
      };
      return token;
    }
  }

  function HTMLParser(stream, domBuilder) {
    this.stream = stream;
    this.domBuilder = domBuilder;
    this.cssParser = new CSSParser(stream, domBuilder);
  }

  HTMLParser.prototype = {
    htmlElements: ["a", "abbr", "acronym", "address", "applet", "area", "article", "aside", "audio", "b", "base",
                   "basefont", "bdi", "bdo", "bgsound", "big", "blink", "blockquote", "body", "br", "button",
                   "canvas", "caption", "center", "cite", "code", "col", "colgroup", "command", "datalist", "dd",
                   "del", "details", "dfn", "dir", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption",
                   "figure", "font", "footer", "form", "frame", "frameset", "h1", "h2", "h3", "h4", "h5", "h6",
                   "head", "header", "hgroup", "hr",
                   "html", "i", "iframe", "img", "input", "ins", "isindex", "kbd", "keygen", "label", "legend", "li",
                   "link", "listing", "map", "mark", "marquee", "menu", "meta", "meter", "nav", "nobr", "noframes",
                   "noscript", "object", "ol", "optgroup", "option", "output", "p", "param", "plaintext", "pre",
                   "progress", "q", "rp", "rt", "ruby", "s", "samp", "script", "section", "select", "small", "source",
                   "spacer", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td",
                   "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "tt", "u", "ul", "var",
                   "video", "wbr", "xmp"],
    _knownHTMLElement: function(tagName) {
      window.console.log("checking "+tagName);
      return this.htmlElements.indexOf(tagName) > -1;
    },
    _buildTextNode: function() {
      var token = this.stream.makeToken();
      if (token) {
        this.domBuilder.text(replaceEntityRefs(token.value), token.interval);
      }
    },
    _parseStartTag: function() {
      if (this.stream.next() != '<')
        throw new Error('assertion failed, expected to be on "<"');

      this.stream.eatWhile(/[\w\d\/]/);
      var token = this.stream.makeToken();
      var tagName = token.value.slice(1);
      window.console.log(tagName);
      if (tagName[0] == '/') {
        var closeTagName = tagName.slice(1).toLowerCase();
        if (!this.domBuilder.currentNode.parseInfo)
          throw new ParseError("UNEXPECTED_CLOSE_TAG", this, closeTagName,
                               token);
        this.domBuilder.currentNode.parseInfo.closeTag = {
          start: token.interval.start
        };
        var openTagName = this.domBuilder.currentNode.nodeName.toLowerCase();
        if (closeTagName != openTagName)
          throw new ParseError("MISMATCHED_CLOSE_TAG", this, openTagName, 
                               closeTagName, token);
        this._parseEndCloseTag();
      } else {
        if (!(tagName && this._knownHTMLElement(tagName)))
          throw new ParseError("INVALID_TAG_NAME", tagName, token);
        this.domBuilder.pushElement(tagName, {
          openTag: {
            start: token.interval.start
          }
        });
        if (!this.stream.end())
          this._parseEndOpenTag(tagName);
      }
    },
    _parseQuotedAttributeValue: function() {
      this.stream.eatSpace();
      this.stream.makeToken();
      if (this.stream.next() != '"')
        throw new ParseError("UNQUOTED_ATTR_VALUE", this);
      this.stream.eatWhile(/[^"]/);
    },
    _parseEndCloseTag: function() {
      this.stream.eatSpace();
      if (this.stream.next() != '>')
        throw new ParseError("UNTERMINATED_CLOSE_TAG", this);
      var end = this.stream.makeToken().interval.end;
      this.domBuilder.currentNode.parseInfo.closeTag.end = end;
      this.domBuilder.popElement();
    },
    _parseAttribute: function() {
      var nameTok = this.stream.makeToken();
      this.stream.eatSpace();
      if (this.stream.peek() == '=') {
        this.stream.next();
        this._parseQuotedAttributeValue();
        if (this.stream.next() != '"')
          throw new ParseError("UNTERMINATED_ATTR_VALUE", this, nameTok);
        var valueTok = this.stream.makeToken();
        var unquotedValue = replaceEntityRefs(valueTok.value.slice(1, -1));
        this.domBuilder.attribute(nameTok.value, unquotedValue, {
          name: nameTok.interval,
          value: valueTok.interval
        });
      } else
        throw new Error("TODO: boolean attributes are unimplemented");
    },
    _parseEndOpenTag: function(tagName) {
      while (!this.stream.end()) {
        if (this.stream.eatWhile(/[A-Za-z]/)) {
          this._parseAttribute();
        } else if (this.stream.eatSpace()) {
          this.stream.makeToken();
        } else if (this.stream.peek() == '>') {
          this.stream.next();
          var end = this.stream.makeToken().interval.end;
          this.domBuilder.currentNode.parseInfo.openTag.end = end;

          // special handling for style elements: we need to parse the CSS code here
          if (!this.stream.end() && tagName && tagName.toLowerCase() === "style") {
            var token = this.cssParser.parse();
            // FIXME: tokenizing inside the css parser seems to yield
            //        an odd placement when resuming HTML parsing.
            this.domBuilder.text(token.value, token.interval);
          }

          return;
        } else
          throw new ParseError("UNTERMINATED_OPEN_TAG", this);
      }
    },
    parse: function() {
      while (!this.stream.end()) {
        if (this.stream.peek() == '<') {
          this._buildTextNode();
          this._parseStartTag();
        } else
          this.stream.next();
      }

      this._buildTextNode();

      if (this.domBuilder.currentNode != this.domBuilder.fragment)
        throw new ParseError("UNCLOSED_TAG", this);
    }
  };

  function DOMBuilder(document) {
    this.document = document;
    this.fragment = document.createDocumentFragment();
    this.currentNode = this.fragment;
  }

  DOMBuilder.prototype = {
    pushElement: function(tagName, parseInfo) {
      var node = this.document.createElement(tagName);
      node.parseInfo = parseInfo;
      this.currentNode.appendChild(node);
      this.currentNode = node;
    },
    popElement: function() {
      this.currentNode = this.currentNode.parentNode;
    },
    attribute: function(name, value, parseInfo) {
      var attrNode = this.document.createAttribute(name);
      attrNode.parseInfo = parseInfo;
      attrNode.nodeValue = value;
      this.currentNode.attributes.setNamedItem(attrNode);
    },
    text: function(text, parseInfo) {
      var textNode = this.document.createTextNode(text);
      textNode.parseInfo = parseInfo;
      this.currentNode.appendChild(textNode);
    }
  };

  var Slowparse = {
    replaceEntityRefs: replaceEntityRefs,
    HTML: function(document, html) {
      var stream = new Stream(html),
          domBuilder = new DOMBuilder(document),
          parser = new HTMLParser(stream, domBuilder),
          error = null;

      try {
        parser.parse();
      } catch (e) {
        if (e.parseInfo) {
          error = e.parseInfo;
        } else
          throw e;
      }

      return {
        document: domBuilder.fragment,
        error: error
      };
    },
    findError: function(html) {
      return this.HTML(document, html).error;
    }
  };

  return Slowparse;
})();
