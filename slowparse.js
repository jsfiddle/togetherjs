/**
 * Slowparse is a token stream parser for HTML+CSS text,
 * recording regions of interest during the parse run and
 * signaling any errors detected accompanied by relevant
 * regions in the text stream, to make 'debugging' easy.
 *
 * Slowparse is effectively a finite state machine for
 * HTML+CSS strings, and will switch between the HTML
 * and CSS parsers while maintaining a single token stream.
 *
 * Clean termination means the code is good, premature
 * termination means an error occurred, and will result
 * in a ParseError being thrown.
 */
var Slowparse = (function() {
  var CHARACTER_ENTITY_REFS = {
    lt: "<",
    gt: ">",
    quot: '"',
    amp: "&"
  };
  
  /**
   * Replace named character entity references (e.g. '&lt;') in the given
   * text string and return the result. If an entity name is unrecognized,
   * don't replace it at all; this makes the function "forgiving".
   *
   * This function does not currently replace numeric character entity
   * references (e.g., '&#160;').
   */
  function replaceEntityRefs(text) {
    return text.replace(/&([A-Za-z]+);/g, function(ref, name) {
      name = name.toLowerCase();
      if (name in CHARACTER_ENTITY_REFS)
        return CHARACTER_ENTITY_REFS[name];
      return ref;
    });
  }
  
  /**
   * FIXME: document
   */
  function ParseError(parseInfo) {
    this.name = "ParseError";
    if (typeof(parseInfo) == "string") {
      var name = parseInfo;
      var args = [];
      for (var i = 1; i < arguments.length; i++)
        args.push(arguments[i]);
      parseInfo = ParseErrorBuilders[name].apply(ParseErrorBuilders, args);

      // This may seem a weird way of setting an attribute, but we want
      // to make the JSON serialize so the 'type' appears first, as it
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
    UNTERMINATED_COMMENT: function(token) {
      return {
        start: token.interval.start
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
      var pos = parser.stream.pos;
      if (!parser.stream.end())
        pos = parser.stream.makeToken().interval.start;
      return {
        start: pos
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
      var end = parser.stream.pos;
      if (!parser.stream.end())
        end = parser.stream.makeToken().interval.start;
      return {
        closeTag: {
          name: parser.domBuilder.currentNode.nodeName.toLowerCase(),
          start: parser.domBuilder.currentNode.parseInfo.closeTag.start,
          end: end
        }
      };
    },
    // CSS errors
    INVALID_CSS_PROPERTY_NAME: function(parser, start, end, property) {
        return {
            cssProperty: {
                start: start,
                end: end,
                property: property
            }
        };
    },
    MISSING_CSS_SELECTOR: function(parser, start, end) {
        return {
            cssBlock: {
                start: start,
                end: end
            }
        };
    },
    UNFINISHED_CSS_SELECTOR: function(parser, start, end, selector) {
        return {
            cssSelector: {
                start: start,
                end: end,
                selector: selector
            }
        };
    },
    MISSING_CSS_BLOCK_OPENER: function(parser, start, end, selector) {
        return {
            cssSelector: {
                start: start,
                end: end,
                selector: selector
            }
        };
    },
    INVALID_CSS_PROPERTY_NAME: function(parser, start, end, property) {
        return {
            cssProperty: {
                start: start,
                end: end,
                property: property
            }
        };
    },
    MISSING_CSS_PROPERTY: function(parser, start, end, selector) {
        return {
            cssSelector: {
                start: start,
                end: end,
                selector: selector
            }
        };
    },
    UNFINISHED_CSS_PROPERTY: function(parser, start, end, property) {
        return {
            cssProperty: {
                start: start,
                end: end,
                property: property
            }
        };
    },
    MISSING_CSS_VALUE: function(parser, start, end, property) {
        return {
            cssProperty: {
                start: start,
                end: end,
                property: property
            }
        };
    },
    UNFINISHED_CSS_VALUE: function(parser, start, end, value) {
        return {
            cssValue: {
                start: start,
                end: end,
                value: value
            }
        };
    },
    MISSING_CSS_BLOCK_CLOSER: function(parser, start, end, value) {
        return {
            cssValue: {
                start: start,
                end: end,
                value: value
            }
        };
    },
    UNCAUGHT_CSS_PARSE_ERROR: function(parser, start, end, msg) {
        return {
            error: {
                start: start,
                end: end,
                msg: msg
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
    // Set the start for the next token to "where we are now".
    markTokenStart: function() {
      this.tokenStart = this.pos;
    },
    // Wrapper function for eating up space, then marking the start for
    // a new token.
    markTokenStartAfterSpace: function() {
      this.eatSpace();
      this.markTokenStart();
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
    },
    // Act like a multi-character eat—if consume is true or not given—or a
    // look-ahead that doesn't update the stream position—if it is false.
    // string must be a string. caseFold can be set to true to make the match
    // case-insensitive.
    match: function(string, consume, caseFold) {
      var substring = this.text.slice(this.pos, this.pos + string.length);
      if (caseFold) {
        string = string.toLowerCase();
        substring = substring.toLowerCase();
      }
      if (string == substring) {
        if (consume)
          this.pos += string.length;
        return true;
      }
      return false;
    }
  };


  /**
   * Set up the CSS token stream parser object.
   * This object has references to the stream,
   * as well as the HTML dom builder that is
   * used by the HTML parser. 
   */
  function CSSParser(stream, domBuilder) {
    this.stream = stream;
    this.domBuilder = domBuilder;
  }

  CSSParser.prototype = {
    // all currently valid CSS properties (CSS1-CSS3). This list does not contain vendor prefixes
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
    // Verify that a specific string is a known CSS property
    _knownCSSProperty: function(propertyName) {
      return this.cssProperties.indexOf(propertyName) > -1;
    },
    /**
     * The CSS master parse function takes the token stream,
     * assumed to have its pointer inside a CSS element, and
     * will try to parse the content inside it as CSS until
     * it hits the end of the CSS element.
     * Any parse errors along the way will result in the code
     * throwing a ParseError.
     */
    parse: function() {
      // this tracks the CSS rulesets for the CSS block
      this.rules = [];
      // this tracks comment blocks inside the CSS
      this.comments = [];
      // this tracks the current ruleset, cleared on
      // every new selector found
      this.currentRuleSet = [];

      // parsing is based on finite states, and a call
      // to parseSelector will run through any number
      // of states until it either throws an error,
      // or terminates cleanly.
      var sliceStart = this.stream.pos;
      this.stream.markTokenStartAfterSpace();
      this._parseSelector();
      var sliceEnd = this.stream.pos;

      // If we get here, the CSS block has no errors,
      // and we report the start/end of the CSS block
      // in the stream, as well as the rules/comments
      // for the calling HTMLparser to work with.
      var cssBlock = {
        value: this.stream.text.slice(sliceStart, sliceEnd),
        parseInfo: {
          start: sliceStart,
          end: sliceEnd,
          rules: this.rules,
          comments: this.comments
        }
      };

      this.rules = null;
      this.comments = null;
      return cssBlock;
    },
    /**
     * Parse CSS selectors
     *
     * A selector is a string, and terminates on {, which signals
     * the start of a CSS property/value pair (which may be empty)
     * There are a few characters in selectors that are an immediate error:
     *
     *   ;  Rule terminator (ERROR: missing block opener)
     *   }  End of css block (ERROR: missing block opener)
     *   <  End of <style> element, start of </style> (ERROR: css declaration has no body)
     *
     * (We cannot flag : as an error because pseudo-classes use : as prefix)
     */
    _parseSelector: function() {
      // we keep track of rulesets per selector
      if (this.currentRule) {
        this.rules.push(this.currentRule);
        this.currentRule = null;
      }

      // gobbel all characters that could be part of the selector
      this.stream.eatWhile(/[^\{;\}<]/);
      var token = this.stream.makeToken(),
          peek = this.stream.peek();
      
      // if there was nothing to select, we're either done,
      // or an error occurred
      if (token === null) {
        if (!this.stream.end() && this.stream.peek() === '<') {
          // clean termination!
          return;
        }
        throw new ParseError("MISSING_CSS_SELECTOR", this, this.stream.pos-1, this.stream.pos);
      }

      // if we get here, we have a selector string.
      token.value = token.value.trim();
      var selector = token.value,
          selectorStart = token.interval.start,
          selectorEnd = selectorStart + selector.length;

      // set up a ruleset object for this selector
      this.currentRule = {
        selector: {
          value: selector,
          start: selectorStart,
          end: selectorEnd
        },
        declarations: {
          start: null,
          end: null,
          properties: []
        }
      };

      // Now we start to analyse whether we can continue,
      // or whether we're in a terminal state, based on the
      // next character in the stream.
      if (this.stream.end() || peek === '<') {
        throw new ParseError("UNFINISHED_CSS_SELECTOR", this, selectorStart, selectorEnd, selector);
      }

      if (!this.stream.end()) {
        var next = this.stream.next(),
            errorMsg = "[_parseSelector] Expected {, }, ; or :, instead found "+next;
        if (next === '{') {
          // The only legal continuation is the opening { character.
          // If that's the character we see, we can mark the start
          // of the declaractions block and start parsing them.
          this.currentRule.declarations.start = this.stream.pos-1;
          this._parseDeclaration(selector, selectorStart);
        } else if (next === ';' || next === '}') {
          // parse error: we should have seen { instead
          throw new ParseError("MISSING_CSS_BLOCK_OPENER", this, selectorStart, selectorEnd, selector);
        } else {
          // fallback error: an unexpected character was found!
          throw new ParseError("UNCAUGHT_CSS_PARSE_ERROR", this, token.interval.start, token.interval.end, errorMsg);
        }
      } else {
        // if the stream ended after the selector, we want the user to follow up with {
        throw new ParseError("MISSING_CSS_BLOCK_OPENER", this, selectorStart, selectorEnd, selector);
      }
    },
    /**
     * Parse CSS declarations
     *
     * A declaration is a "property: value;" pair. It can be empty,
     * in which case the next character must be }
     */
    _parseDeclaration: function(selector, selectorStart, value) {
      // forward the stream to the next non-space character
      this.stream.markTokenStartAfterSpace();
      var peek = this.stream.peek();
      // what is the next character?
      if (peek === '}') {
        // if it's } then this is an empty block, and we
        // should move on to trying to read a new selector ruleset.
        this.stream.next();
        this.currentRule.declarations.end = this.stream.pos;
        this.stream.markTokenStartAfterSpace();
        this._parseSelector();
      }
      // administratively important: there are two ways for parseDeclaration
      // to have been called. One is from parseSelector, which is "the normal
      // way", the other from parseValue, after finding a properly closed
      // property:value; pair. In this case "value" will be the last
      // declaration's value, which will let us throw a sensible debug error
      // in case the stream is empty at this point, or points to </style>
      else if (value && (this.stream.end() || peek === '<')) {
        throw new ParseError("MISSING_CSS_BLOCK_CLOSER", this, selectorStart, selectorStart+value.length, value);
      }
      
      // if we're still in this function at this point, all is well
      // and we can move on to property parsing.
      else {
        this._parseProperty(selector, selectorStart);
      }
    },
    /**
     * Parse CSS properties
     *
     * There is a fixed list of CSS properties, we we must check two things:
     * does the token string contain a syntax-legal property, and is that
     * property in the set of known ones.
     * 
     * Properties are terminated by :, but we might also see the following
     * characters, which should signal an error:
     *
     *   ;  Rule terminator (ERROR: missing value)
     *   }  End of css block (ERROR: missing value)
     *   <  End of <style> element, start of </style> (ERROR: missing value)
     */
    _parseProperty: function(selector, selectorStart) {
      var property = this.stream.eatWhile(/[^\{\}<;:]/),
          token = this.stream.makeToken();

      if (token === null) {
        throw new ParseError("MISSING_CSS_PROPERTY", this, selectorStart, selectorStart+selector.length, selector);
      }

      var property = token.value.trim();
          propertyStart = token.interval.start,
          propertyEnd = propertyStart + property.length;
      var next = this.stream.next(),
          errorMsg = "[_parseProperty] Expected }, <, ; or :, instead found "+next;

      if ((this.stream.end() && next !== ':') || next === '<' || next === '}') {
        throw new ParseError("UNFINISHED_CSS_PROPERTY", this, propertyStart, propertyEnd, property);
      }

      // we record property:value pairs as we run through the stream,
      // which are added to the set of property:value pairs in the
      // rules.properties array. (the push happens when we have a clean
      // run in parseValue)
      this.currentProperty = {
        name: {
          value: property,
          start: propertyStart,
          end: propertyEnd
        }
      };

      // if we find a colon, we have a property and now need a value to go along with it
      if (next === ':') {
        // before we continue, we must make sure the string we found is a real
        // CSS property. It must consist of specific characters, and 
        if (!( property && property.match(/^[a-z\-]+$/)) || !this._knownCSSProperty(property))
          throw new ParseError("INVALID_CSS_PROPERTY_NAME", this, propertyStart, propertyEnd, property);
        this.stream.markTokenStartAfterSpace();
        this._parseValue(selector, selectorStart, property, propertyStart);
      }
      // anything else, at this point, constitutes an error
      else if (next === ';') {
        throw new ParseError("MISSING_CSS_VALUE", this, propertyStart, propertyEnd, property);
      }
      else if (next === '{') {
        throw new ParseError("MISSING_CSS_BLOCK_CLOSER", this, selectorStart, propertyStart, selector);
      }
      else {
        // fallback error: an unexpected character was found!
        throw new ParseError("UNCAUGHT_CSS_PARSE_ERROR", this, token.interval.start, token.interval.end, errorMsg);
      }
    },
    /**
     * Parse CSS values
     *
     * Value must end either in ; or in }. We may also find:
     *
     *   <  End of <style> element, start of </style> (ERROR: missing block closer)
     */
    _parseValue: function(selector, selectorStart, property, propertyStart) {
      var rule = this.stream.eatWhile(/[^}<;]/),
          token = this.stream.makeToken();
          
      if(token === null) {
        throw new ParseError("MISSING_CSS_VALUE", this, propertyStart, propertyStart+property.length, property);
      }

      var next = (!this.stream.end() ? this.stream.next() : "end of stream"),
          errorMsg = "[_parseValue] Expected }, <, or ;, instead found "+next;
      token.value = token.value.trim();
      var value = token.value,
          valueStart = token.interval.start,
          valueEnd = valueStart + value.length;

      // at this point we can fill in the value part of the current
      // property:value; pair. However, we hold off binding it until
      // we are sure there are no parse errors.
      this.currentProperty.value = {
        value: value,
        start: valueStart,
        end: valueEnd
      }

      if ((this.stream.end() && next !== ';') || next === '<') {
        throw new ParseError("UNFINISHED_CSS_VALUE", this, valueStart, valueEnd, value);
      }

      if (next === ';') {
        // normal CSS rule termination; try to read a new property/value pair
        this._bindCurrentRule();
        this.stream.markTokenStartAfterSpace();
        this._parseDeclaration(selector, valueStart, value);
      }
      else if (next === '}') {
        // block level termination: try to read a new selector
        this.currentRule.declarations.end = this.stream.pos;
        this._bindCurrentRule();
        this.stream.markTokenStartAfterSpace();
        this._parseSelector();
      }
      else {
        // fallback error: an unexpected character was found!
        throw new ParseError("UNCAUGHT_CSS_PARSE_ERROR", this, token.interval.start, token.interval.end, errorMsg);
      }
    },
    /**
     * This helper function binds the "currrent property:value" object
     * in the current ruleset, and resets it for the next selector block. 
     */
    _bindCurrentRule: function() {
      this.currentRule.declarations.properties.push(this.currentProperty);
      this.currentProperty = null;
    }
  }


  /**
   * Set up the HTML token stream parser object.
   * This object has references to the stream,
   * as well as a dom builder that is used to
   * track the DOM while we run through the 
   * token stream, used for catching discrepancies
   * between what the DOM says we "should" find
   * vs. what we actually find in the token stream.
   */
  function HTMLParser(stream, domBuilder) {
    this.stream = stream;
    this.domBuilder = domBuilder;
    this.cssParser = new CSSParser(stream, domBuilder);
  }

  HTMLParser.prototype = {
    html5Doctype: '<!DOCTYPE html>',
    voidHtmlElements: ["area", "base", "br", "col", "command", "embed", "hr",
                       "img", "input", "keygen", "link", "meta", "param",
                       "source", "track", "wbr"],
    // but these elements should be:
    htmlElements: ["a", "abbr", "address", "area", "article", "aside", "audio", "b", "base",
                   "bdi", "bdo", "bgsound", "blink", "blockquote", "body", "br", "button",
                   "canvas", "caption", "cite", "code", "col", "colgroup", "command", "datalist", "dd",
                   "del", "details", "dfn", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption",
                   "figure", "footer", "form", "frame", "frameset", "h1", "h2", "h3", "h4", "h5", "h6",
                   "head", "header", "hgroup", "hr", "html", "i", "iframe", "img", "input", "ins", "kbd",
                   "keygen", "label", "legend", "li", "link", "map", "mark", "marquee", "menu", "meta",
                   "meter", "nav", "nobr", "noscript", "object", "ol", "optgroup", "option", "output",
                   "p", "param", "pre", "progress", "q", "rp", "rt", "ruby", "samp", "script", "section",
                   "select", "small", "source", "spacer", "span", "strong", "style", "sub", "summary",
                   "sup", "table", "tbody", "td", "textarea", "tfoot", "th", "thead", "time", "title",
                   "tr", "track", "u", "ul", "var", "video", "wbr"],
    // lastly, there is also the list of HTML elements that are now obsolete,
    // but possibly still encountered in the wild on popular sites.
    obsoleteHtmlElements: ["acronym", "applet", "basefont", "big", "center", "dir", "font",
                           "isindex", "listing", "noframes", "plaintext", "s", "strike", "tt", 
                           "xmp"],
    /**
     * Helper function to determine whether a given string
     * is a legal HTML element tag.
     */
    _knownHTMLElement: function(tagName) {
      return this.voidHtmlElements.indexOf(tagName) > -1 || 
              this.htmlElements.indexOf(tagName) > -1 ||
              this.obsoleteHtmlElements.indexOf(tagName) > -1;
    },
    /**
     * Helper function to build a DOM text node
     */
    _buildTextNode: function() {
      var token = this.stream.makeToken();
      if (token) {
        this.domBuilder.text(replaceEntityRefs(token.value), token.interval);
      }
    },
    _parseComment: function() {
      var token;
      while (!this.stream.end()) {
        if (this.stream.match('-->', true)) {
          token = this.stream.makeToken();
          this.domBuilder.comment(token.value.slice(4, -3), token.interval);
          return;
        }
        this.stream.next();
      }
      token = this.stream.makeToken();
      throw new ParseError("UNTERMINATED_COMMENT", token);
    },
    _parseStartTag: function() {
      if (this.stream.next() != '<')
        throw new Error('assertion failed, expected to be on "<"');

      if (this.stream.match('!--', true)) {
        this._parseComment();
        return;
      }
      
      this.stream.eatWhile(/[\w\d\/]/);
      var token = this.stream.makeToken();
      var tagName = token.value.slice(1);
      
      // is this actually a closing tag?
      if (tagName[0] == '/') {
        var closeTagName = tagName.slice(1).toLowerCase();
        if (!this.domBuilder.currentNode.parseInfo)
          throw new ParseError("UNEXPECTED_CLOSE_TAG", this, closeTagName, token);
        this.domBuilder.currentNode.parseInfo.closeTag = {
          start: token.interval.start
        };
        var openTagName = this.domBuilder.currentNode.nodeName.toLowerCase();
        if (closeTagName != openTagName)
          throw new ParseError("MISMATCHED_CLOSE_TAG", this, openTagName, closeTagName, token);
          
        // if we get here, no errors were thrown, and we just
        // keep parsing as a closing tag.
        this._parseEndCloseTag();
      }
      
      else {
        // if this is an opening tag, but for something that isn't a
        // legal HTML element, we throw a parse error
        if (!(tagName && this._knownHTMLElement(tagName)))
          throw new ParseError("INVALID_TAG_NAME", tagName, token);

        // if we get here, let's keep parsing this tag!
        this.domBuilder.pushElement(tagName, {
          openTag: {
            start: token.interval.start
          }
        });
        if (!this.stream.end())
          this._parseEndOpenTag(tagName);
      }
    },
    /**
     * Parse the rest of an opener tag, as it might contain
     * attribute="value" data.
     */
    _parseQuotedAttributeValue: function() {
      this.stream.eatSpace();
      this.stream.makeToken();
      if (this.stream.next() != '"')
        throw new ParseError("UNQUOTED_ATTR_VALUE", this);
      this.stream.eatWhile(/[^"]/);
    },
    /**
     * Parse HTML element closing tag
     */
    _parseEndCloseTag: function() {
      this.stream.eatSpace();
      if (this.stream.next() != '>')
        throw new ParseError("UNTERMINATED_CLOSE_TAG", this);
      var end = this.stream.makeToken().interval.end;
      this.domBuilder.currentNode.parseInfo.closeTag.end = end;
      this.domBuilder.popElement();
    },
    /**
     * Parse an HTML tag attribute
     */
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
      } else {
        this.stream.makeToken();
        this.domBuilder.attribute(nameTok.value, '', {
          name: nameTok.interval
        });
      }
    },
    /**
     * Parse the rest of an opener tag, as it might contain
     * attribute="value" data.
     */
    _parseEndOpenTag: function(tagName) {
      // FIXME: we probably don't need while() here, as the parser will
      //        either cleanly terminate or throw a ParseError anyway?
      while (!this.stream.end()) {
        // we gobble anything that can be part of an attribute name,
        // then try to parse it as an attribute to this opening tag
        if (this.stream.eatWhile(/[A-Za-z\-]/)) {
          this._parseAttribute();
        }
        // silently gobble white space
        else if (this.stream.eatSpace()) {
          this.stream.makeToken();
        }
        // if we find > then this tag can be finalised
        else if (this.stream.peek() == '>') {
          this.stream.next();
          var end = this.stream.makeToken().interval.end;
          this.domBuilder.currentNode.parseInfo.openTag.end = end;

          // If this is a void element, there will not be a closing element,
          // so we can move up a level in the dombuilder's DOM
          if (tagName && (this.voidHtmlElements.indexOf(tagName.toLowerCase()) != -1))
            this.domBuilder.popElement();
          
          // Of course, we need special handling for style elements: we need
          // to parse the CSS code contained inside <style> elements.
          if (!this.stream.end() && tagName && tagName.toLowerCase() === "style") {
            var cssBlock = this.cssParser.parse();
            this.domBuilder.text(cssBlock.value, cssBlock.parseInfo);
          }

          return;
        } else
          throw new ParseError("UNTERMINATED_OPEN_TAG", this);
      }
    },
    /**
     * The HTML master parse function works the same as the CSS
     * parser: it takes the token stream and will try to parse
     * the content as a sequence of HTML elements.
     *
     * Any parse errors along the way will result in the code
     * throwing a ParseError.
     */
    parse: function() {
      if (this.stream.match(this.html5Doctype, true, true))
        this.domBuilder.fragment.parseInfo = {
          doctype: {
            start: 0,
            end: this.stream.pos
          }
        };
      
      while (!this.stream.end()) {
        if (this.stream.peek() == '<') {
          // model all tokens that were gobbled as a text node
          this._buildTextNode();
          // then, start the HTML run by initiating a start tag parse
          this._parseStartTag();
        } else
          this.stream.next();
      }

      // finally, model all tokens that are left as text node
      this._buildTextNode();

      // it's possible we're left with an open tag, so let's test:
      if (this.domBuilder.currentNode != this.domBuilder.fragment)
        throw new ParseError("UNCLOSED_TAG", this);
    }
  };


  /**
   * In order to do "what we see" vs. "what we should see",
   * we track the latter using a DOM builder.
   */
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
    comment: function(data, parseInfo) {
      var comment = this.document.createComment(data);
      comment.parseInfo = parseInfo;
      this.currentNode.appendChild(comment);
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

  /**
   * This is the main entry point when using slowparse.js
   */
  var Slowparse = {
    // these properties can be used by an editor that relies
    // on slowparse for 'these things are supported' logic.
    HTML_ELEMENT_NAMES: HTMLParser.prototype.voidHtmlElements.concat(
                          HTMLParser.prototype.htmlElements.concat(
                            HTMLParser.prototype.obsoleteHtmlElements)),
    CSS_PROPERTY_NAMES: CSSParser.prototype.cssProperties,
    replaceEntityRefs: replaceEntityRefs,
    Stream: Stream,

    // run HTML code through the slowparser
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

      // we return our DOM interpretation of the
      // HTML code, plus an error (if there were
      // no errors found, error is null).
      return {
        document: domBuilder.fragment,
        error: error
      };
    },
    // explicitly try to find errors in some HTML code
    findError: function(html) {
      return this.HTML(document, html).error;
    }
  };

  return Slowparse;
})();
