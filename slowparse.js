var Slowparse = (function() {
  var CHARACTER_ENTITY_REFS = {
    lt: "<",
    gt: ">",
    quot: '"',
    amp: "&"
  };
  
  function replaceEntityRefs(text) {
    return text.replace(/&([A-Za-z]+);/g, function(ref, name) {
      name = name.toLowerCase();
      if (name in CHARACTER_ENTITY_REFS)
        return CHARACTER_ENTITY_REFS[name];

      // Be forgiving -- if the text doesn't map to a known character
      // entity reference, just return the original string instead of
      // raising an error.
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
  
  function HTMLParser(stream, domBuilder) {
    this.stream = stream;
    this.domBuilder = domBuilder;
  }

  HTMLParser.prototype = {
    _buildTextNode: function() {
      var token = this.stream.makeToken();
      if (token) {
        this.domBuilder.text(replaceEntityRefs(token.value), token.interval);
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
        var openTagName = this.domBuilder.currentNode.nodeName.toLowerCase();
        var closeTagName = tagName.slice(1).toLowerCase();
        if (closeTagName != openTagName)
          throw new ParseError("MISMATCHED_CLOSE_TAG", this, openTagName, 
                               closeTagName, token);
        this._parseEndCloseTag();
      } else {
        if (!(tagName && tagName.match(/^[A-Za-z]+$/)))
          throw new ParseError("INVALID_TAG_NAME", tagName, token);
        this.domBuilder.pushElement(tagName, {
          openTag: {
            start: token.interval.start
          }
        });

        if (!this.stream.end())
          this._parseEndOpenTag();
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
    _parseEndOpenTag: function() {
      while (!this.stream.end()) {
        if (this.stream.eatWhile(/[A-Za-z]/)) {
          this._parseAttribute();
        } else if (this.stream.eatSpace()) {
          this.stream.makeToken();
        } else if (this.stream.peek() == '>') {
          this.stream.next();
          var end = this.stream.makeToken().interval.end;
          this.domBuilder.currentNode.parseInfo.openTag.end = end;
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
