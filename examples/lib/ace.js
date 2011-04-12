(function() {
  var Range, applyToDoc, convertDelta;
  Range = require("ace/range").Range;
  convertDelta = function(editorDoc, delta) {
    var getStartOffsetPosition, pos, text;
    getStartOffsetPosition = function(range) {
      var i, line, lines, offset, _len;
      lines = editorDoc.getLines(0, range.start.row);
      offset = 0;
      for (i = 0, _len = lines.length; i < _len; i++) {
        line = lines[i];
        offset += i < range.start.row ? line.length : range.start.column;
      }
      return offset + range.start.row;
    };
    pos = getStartOffsetPosition(delta.range);
    switch (delta.action) {
      case 'insertText':
        return [
          {
            i: delta.text,
            p: pos
          }
        ];
      case 'removeText':
        return [
          {
            d: delta.text,
            p: pos
          }
        ];
      case 'insertLines':
        text = delta.lines.join('\n') + '\n';
        return [
          {
            i: text,
            p: pos
          }
        ];
      case 'removeLines':
        text = delta.lines.join('\n') + '\n';
        return [
          {
            d: text,
            p: pos
          }
        ];
      default:
        throw new Error("unknown action: " + delta.action);
    }
  };
  applyToDoc = function(editorDoc, op) {
    var c, offsetToPos, range, _i, _len;
    offsetToPos = function(offset) {
      var line, lines, row, _len;
      lines = editorDoc.getAllLines();
      row = 0;
      for (row = 0, _len = lines.length; row < _len; row++) {
        line = lines[row];
        if (offset <= line.length) {
          break;
        }
        offset -= lines[row].length + 1;
      }
      return {
        row: row,
        column: offset
      };
    };
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      c = op[_i];
      if (c.d != null) {
        range = Range.fromPoints(offsetToPos(c.p), offsetToPos(c.p + c.d.length));
        editorDoc.remove(range);
      } else {
        editorDoc.insert(offsetToPos(c.p), c.i);
      }
    }
  };
  window.sharejs.Document.prototype.attach_ace = function(editor) {
    var check, doc, docListener, editorDoc, editorListener, suppress;
    doc = this;
    editorDoc = editor.getSession().getDocument();
    editorDoc.setNewLineMode('unix');
    check = function() {
      var editorText, otText;
      editorText = editorDoc.getValue();
      otText = doc.snapshot;
      if (editorText !== otText) {
        console.error("Text does not match!");
        console.error("editor: " + editorText);
        return console.error("ot:     " + otText);
      }
    };
    editorDoc.setValue(doc.snapshot);
    check();
    suppress = false;
    editorListener = function(change) {
      var op;
      if (suppress) {
        return;
      }
      op = convertDelta(editorDoc, change.data);
      doc.submitOp(op);
      return check();
    };
    editorDoc.on('change', editorListener);
    docListener = function(op) {
      suppress = true;
      applyToDoc(editorDoc, op);
      suppress = false;
      return check();
    };
    doc.on('remoteop', docListener);
    doc.detach_ace = function() {
      doc.removeListener('remoteop', docListener);
      editorDoc.removeListener('change', editorListener);
      return delete doc.detach_ace;
    };
  };
}).call(this);
