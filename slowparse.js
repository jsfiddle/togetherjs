var Slowparse = (function() {
  function ParseError(options) {
    this.name = "ParseError";
    this.message = options.type;
    this.options = options;
  }
  
  ParseError.prototype = Error.prototype;
  
  function Tokenizer(html) {
    var htmlMode = CodeMirror.getMode({
      indentUnit: 2
    }, "htmlmixed");
    var state = htmlMode.startState();
    var lines = html.split('\n').reverse();
    var pos = 0;
    var linePos = 0;
    var currentLine;
    var stream;

    function advanceLine() {
      currentLine = lines.pop();
      stream = new CodeMirror.StringStream(currentLine);
    }
    
    advanceLine();
    
    return {
      position: function() {
        return pos + linePos;
      },
      nextNonWhitespace: function() {
        while (1) {
          var token = this.next();
          if (token === null || token.string.trim().length)
            return token;
        }
      },
      next: function() {
        while (stream.eol()) {
          pos += currentLine.length;
          linePos = 0;
          if (lines.length == 0)
            return null;
          pos++;
          advanceLine();
        }
        var styleName = htmlMode.token(stream, state);
        var token = {
          string: currentLine.slice(linePos, stream.pos),
          style: styleName,
          position: pos + linePos,
          state: state
        };
        linePos = stream.pos;
        //console.log(token.string, token.state.htmlState.type);
        return token;
      }
    };
  }
  
  var Slowparse = {
    HTML: function(document, html) {
      var fragment = document.createDocumentFragment();
      var error = null;
      var tokenizer = Tokenizer(html);
      var currentNode = fragment;
      
      function parseOpenTag(tokenizer) {
        while (1) {
          var token = tokenizer.next();
          if (token) {
            var htmlState = token.state.htmlState;
            if (htmlState.type == "endTag") {
              currentNode.parseInfo.openTag.end = token.position + 1;
              return;
            } else if (token.style == "attribute") {
              var attr = document.createAttribute(token.string);
              attr.parseInfo = {
                name: {
                  start: token.position,
                  end: token.position + token.string.length
                }
              };
              // TODO: Verify this next token is an '='.
              tokenizer.nextNonWhitespace();
              // TODO: Verify this next token is an attribute value.
              token = tokenizer.nextNonWhitespace();
              attr.parseInfo.value = {
                start: token.position,
                end: token.position + token.string.length
              };
              attr.nodeValue = token.string.slice(1, -1);
              currentNode.attributes.setNamedItem(attr);
            }
          } else {
            throw new Error("TODO: Report an unclosed tag error");
          }
        }
      }
      
      function parseText(tokenizer) {
        while (1) {
          var token = tokenizer.next();
          if (token) {
            var htmlState = token.state.htmlState;
            if (htmlState.type == "openTag") {
              // TODO: make sure this is a valid tag name, or a
              // DOM exception will be thrown.
              var element = document.createElement(htmlState.tagName);
              currentNode.appendChild(element);
              currentNode = element;
              currentNode.parseInfo = {
                openTag: {
                  start: token.position,
                  end: undefined
                }
              };
              parseOpenTag(tokenizer);
            } else if (htmlState.type == null) {
              var textNode = document.createTextNode(token.string);
              currentNode.appendChild(textNode);
              textNode.parseInfo = {
                start: token.position,
                end: token.position + token.string.length
              };
            } else if (htmlState.type == "closeTag") {
              // TODO: Verify this token is a matching close tag.
              // TODO: Verify this next token is an endTag.
              tokenizer.nextNonWhitespace();
              currentNode.parseInfo.closeTag = {
                start: token.position,
                end: tokenizer.position() + 1
              };
              currentNode = currentNode.parentNode;
            } else {
              throw new Error("unexpected htmlState.type: " + htmlState.type);
            }
          } else {
            if (currentNode !== fragment) {
              throw new ParseError({
                type: "UNCLOSED_TAG",
                node: currentNode,
                position: tokenizer.position()
              });
            }
            return;
          }
        }
      }

      try {
        parseText(tokenizer);
      } catch (e) {
        if (e instanceof ParseError) {
          error = e.options;
        } else
          throw e;
      }
      
      return {
        document: fragment,
        error: error
      };
    }
  };
  
  return Slowparse;
})();
