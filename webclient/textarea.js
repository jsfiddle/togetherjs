(function() {
  var applyChange;
  applyChange = function(doc, oldval, newval) {
    var commonEnd, commonStart;
    if (oldval === newval) {
      return;
    }
    commonStart = 0;
    while (oldval.charAt(commonStart) === newval.charAt(commonStart)) {
      commonStart++;
    }
    commonEnd = 0;
    while (oldval.charAt(oldval.length - 1 - commonEnd) === newval.charAt(newval.length - 1 - commonEnd) && commonEnd + commonStart < oldval.length && commonEnd + commonStart < newval.length) {
      commonEnd++;
    }
    if (oldval.length !== commonStart + commonEnd) {
      doc.del(oldval.length - commonStart - commonEnd, commonStart);
    }
    if (newval.length !== commonStart + commonEnd) {
      return doc.insert(newval.slice(commonStart, newval.length - commonEnd), commonStart);
    }
  };
  window.sharejs.Doc.prototype.attach_textarea = function(elem) {
    var doc, event, genOp, prevvalue, replaceText, _i, _len, _ref, _results;
    doc = this;
    elem.value = this.snapshot;
    prevvalue = elem.value;
    replaceText = function(newText, transformCursor) {
      var newSelection, scrollTop;
      newSelection = [transformCursor(elem.selectionStart), transformCursor(elem.selectionEnd)];
      scrollTop = elem.scrollTop;
      elem.value = newText;
      if (elem.scrollTop !== scrollTop) {
        elem.scrollTop = scrollTop;
      }
      return elem.selectionStart = newSelection[0], elem.selectionEnd = newSelection[1], newSelection;
    };
    this.on('insert', function(text, pos) {
      var transformCursor;
      transformCursor = function(cursor) {
        if (pos <= cursor) {
          return cursor + text.length;
        } else {
          return cursor;
        }
      };
      return replaceText(elem.value.slice(0, pos) + text + elem.value.slice(pos), transformCursor);
    });
    this.on('delete', function(text, pos) {
      var transformCursor;
      transformCursor = function(cursor) {
        if (pos < cursor) {
          return cursor - Math.min(text.length, cursor - pos);
        } else {
          return cursor;
        }
      };
      return replaceText(elem.value.slice(0, pos) + elem.value.slice(pos + text.length), transformCursor);
    });
    genOp = function(event) {
      var onNextTick;
      onNextTick = function(fn) {
        return setTimeout(fn, 0);
      };
      return onNextTick(function() {
        if (elem.value !== prevvalue) {
          prevvalue = elem.value;
          return applyChange(doc, doc.getText(), elem.value.replace(/\r\n/g, '\n'));
        }
      });
    };
    _ref = ['textInput', 'keydown', 'keyup', 'select', 'cut', 'paste'];
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      event = _ref[_i];
      _results.push(elem.addEventListener ? elem.addEventListener(event, genOp, false) : elem.attachEvent('on' + event, genOp));
    }
    return _results;
  };
}).call(this);
