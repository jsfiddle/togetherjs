var Slowparse = (function() {
  function ParseError(parseInfo) {
    this.name = "ParseError";
    this.message = parseInfo.type;
    this.parseInfo = parseInfo;
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
  
  function parseHTML(html, domBuilder) {
    var stream = new Stream(html);
    var error = null;
    
    var helpers = {
      buildTextNode: function() {
        var token = stream.makeToken();
        if (token) {
          domBuilder.text(token.value, token.interval);
        }
      },
    };
    
    var modes = {
      text: function() {
        while (!stream.end()) {
          if (stream.peek() == '<') {
            helpers.buildTextNode();
            modes.startTag();
          } else
            stream.next();
        }

        helpers.buildTextNode();

        if (domBuilder.currentNode != domBuilder.fragment)
          throw new ParseError({
            type: "UNCLOSED_TAG",
            node: domBuilder.currentNode,
            position: stream.pos
          });
      },
      startTag: function() {
        if (stream.next() != '<')
          throw new Error('assertion failed, expected to be on "<"');

        stream.eatWhile(/[A-Za-z\/]/);
        var token = stream.makeToken();
        var tagName = token.value.slice(1);
        if (tagName[0] == '/') {
          domBuilder.currentNode.parseInfo.closeTag = {
            start: token.interval.start
          };
          // TODO: Verify this is a matching close tag.
          modes.endCloseTag();
        } else {
          if (!(tagName && tagName.match(/^[A-Za-z]+$/)))
            throw new ParseError({
              type: "INVALID_TAG_NAME",
              value: tagName,
              position: token.interval.start + 1
            });
          domBuilder.pushElement(tagName, {
            openTag: {
              start: token.interval.start
            }
          });

          if (!stream.end())
            modes.endOpenTag();
        }
      },
      quotedAttributeValue: function() {
        stream.eatSpace();
        stream.makeToken();
        if (stream.next() != '"')
          throw new Error("TODO: unquoted attributes are unimplemented");
        stream.eatWhile(/[^"]/);
        if (stream.next() != '"')
          throw new Error("TODO: parse error for unterminated attr value");
      },
      endCloseTag: function() {
        stream.eatSpace();
        if (stream.next() != '>') {
          throw new Error("TODO: parse error for garbage in close tag");
        }
        var end = stream.makeToken().interval.end;
        domBuilder.currentNode.parseInfo.closeTag.end = end;
        domBuilder.popElement();
      },
      attribute: function() {
        var nameTok = stream.makeToken();
        stream.eatSpace();
        if (stream.peek() == '=') {
          stream.next();
          modes.quotedAttributeValue();
          var valueTok = stream.makeToken();
          domBuilder.attribute(nameTok.value, valueTok.value.slice(1, -1), {
            name: nameTok.interval,
            value: valueTok.interval
          });
        } else
          throw new Error("TODO: boolean attributes are unimplemented");
      },
      endOpenTag: function() {
        while (!stream.end()) {
          if (stream.eatWhile(/[A-Za-z]/)) {
            modes.attribute();
          } else if (stream.eatSpace()) {
            stream.makeToken();
          } else if (stream.peek() == '>') {
            stream.next();
            var end = stream.makeToken().interval.end;
            domBuilder.currentNode.parseInfo.openTag.end = end;
            return;
          } else
            throw new Error("don't know what to do with " + stream.peek());
        }
      }
    };
    
    try {
      modes.text();
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
      return parseHTML(html, new DOMBuilder(document));
    }
  };
  
  return Slowparse;
})();
