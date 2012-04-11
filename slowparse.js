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
          this._parseEndOpenTag();
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
