var Slowparse = (function() {
  function ParseError(parseInfo) {
    this.name = "ParseError";
    this.message = parseInfo.type;
    this.parseInfo = {
      type: parseInfo.type
    };
    if (parseInfo.node)
      this.parseInfo.node = parseInfo.node;
    if (parseInfo.token) {
      this.parseInfo.value = parseInfo.token.value;
      this.parseInfo.start = parseInfo.token.interval.start;
      this.parseInfo.end = parseInfo.token.interval.end;
    }
  }

  ParseError.prototype = Error.prototype;

  function Stream(text) {
    this.text = text;
    this.pos = 0;
    this.tokenStart = 0;
  }

  Stream.prototype = {
    peek: function() {
      return this.text[this.pos];
    },
    next: function() {
      if (!this.end())
        return this.text[this.pos++];
    },
    nextN: function(n) {
      var text = "";
      var available = Math.min(this.text.length - this.pos, n);
      while(available-->0) {
        text = this.text[this.pos + available] + text;
      }
      return text;
    },
    end: function() {
      return (this.pos == this.text.length);
    },
    eat: function(matcher) {
      if (this.peek().match(matcher))
        return this.next();
    },
    eatWhile: function(matcher) {
      var wereAnyEaten = false;
      while (!this.end()) {
        if (this.eat(matcher))
          wereAnyEaten = true;
        else
          return wereAnyEaten;
      }
    },
    eatSpace: function() {
      return this.eatWhile(/[\s\n]/);
    },
    markTokenStart: function() {
      this.tokenStart = this.pos;
    },
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
    },
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
      this.stream.eatWhile(/[^{<]/);
      var token = this.stream.makeToken();
      if (token === null)
        return;

      var selector = token.value.trim();
      if (selector && selector === '')
        return;
      if (!(selector && selector.match(/^[A-Za-z\-\_]+$/)))
        throw new ParseError({
          type: "INVALID_CSS_SELECTOR_NAME",
          token: token
        });

      if (!this.stream.end()) {
        var next = this.stream.peek();
        if (next === '<') {
          // end of CSS!
          return;
        }
        else if (next === '{') {
          this.stream.eatWhile(/[\s\n{]/);
          this.stream.markTokenStart();
          this._parseDeclaration();
        }
        else {
          throw new ParseError({
            type: "MISSING_CSS_BLOCK_OPENER",
            token: token
          });
        }
      }
    },
    _parseDeclaration: function() {
      this.stream.eatWhile(/[\s\n]/);
      this.stream.markTokenStart();

      if (this.stream.peek() === '}') {
        this.stream.next();
        this.stream.eatWhile(/[^<]/);
        return;
      }
      this._parseProperty();
    },
    _parseProperty: function() {
      var rule = this.stream.eatWhile(/[^}<;:]/);
      var token = this.stream.makeToken();
      var next = this.stream.next();
      if (next === ':') {
        // proper parsing goes here
        var property = token.value.trim();
        if (!( property && property.match(/^[A-Za-z\-\_]+$/)) || this._unknownCSSProperty(property))
          // FIXME: make sure this maps to not-allowed-characters!
          throw new ParseError({
            type: "INVALID_CSS_PROPERTY_NAME",
            node: this.domBuilder.currentNode,
            token: token
          });

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
      var next = this.stream.next();
      if (next === ';') {
        this._parseDeclaration();
      }
      else if (next === '}') {
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
    _buildTextNode: function() {
      var token = this.stream.makeToken();
      if (token) {
        this.domBuilder.text(token.value, token.interval);
      }
    },
    _parseStartTag: function() {
      if (this.stream.next() != '<')
        throw new Error('assertion failed, expected to be on "<"');

      this.stream.eatWhile(/[A-Za-z\/]/);
      var token = this.stream.makeToken();
      var tagName = token.value.slice(1);
      if (tagName[0] == '/') {
        this.domBuilder.currentNode.parseInfo.closeTag = {
          start: token.interval.start
        };
        if (tagName.slice(1).toLowerCase() !=
            this.domBuilder.currentNode.nodeName.toLowerCase())
          throw new ParseError({
            type: "MISMATCHED_CLOSE_TAG",
            node: this.domBuilder.currentNode,
            token: token
          });
        this._parseEndCloseTag();
      } else {
        if (!(tagName && tagName.match(/^[A-Za-z]+$/)))
          throw new ParseError({
            type: "INVALID_TAG_NAME",
            token: token
          });
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
        throw new Error("TODO: unquoted attributes are unimplemented");
      this.stream.eatWhile(/[^"]/);
      if (this.stream.next() != '"')
        throw new Error("TODO: parse error for unterminated attr value");
    },
    _parseEndCloseTag: function() {
      this.stream.eatSpace();
      if (this.stream.next() != '>') {
        if (this.stream.end())
          throw new Error("TODO: parse error for unterminated close tag");
        else
          throw new Error("TODO: parse error for garbage in close tag");
      }
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
        var valueTok = this.stream.makeToken();
        var unquotedValue = valueTok.value.slice(1, -1);
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
        } else if (this.stream.end()) {
          throw new Error("TODO: parse error for unterminated open tag");
        } else
          throw new Error("TODO: parse error for unexpected garbage: " +
                          this.stream.peek());
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
        throw new ParseError({
          type: "UNCLOSED_TAG",
          node: this.domBuilder.currentNode
        });
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
    }
  };

  return Slowparse;
})();
