(function() {
  var opFromDiff;
  opFromDiff = function(oldval, newval) {
    var commonEnd, commonStart;
    if (oldval === newval) {
      return [];
    }
    commonStart = 0;
    while (oldval.charAt(commonStart) === newval.charAt(commonStart)) {
      commonStart++;
    }
    commonEnd = 0;
    while (oldval.charAt(oldval.length - 1 - commonEnd) === newval.charAt(newval.length - 1 - commonEnd) && commonEnd + commonStart < oldval.length && commonEnd + commonStart < newval.length) {
      commonEnd++;
    }
    return window.sharejs.types.text.normalize([
      {
        p: commonStart,
        d: oldval.slice(commonStart, oldval.length - commonEnd)
      }, {
        p: commonStart,
        i: newval.slice(commonStart, newval.length - commonEnd)
      }
    ]);
  };
  window.sharejs.Document.prototype.attach_textarea = function(elem) {
    var doc, event, genOp, prevvalue, _i, _len, _ref, _results;
    doc = this;
    elem.value = this.snapshot;
    prevvalue = elem.value;
    this.on('remoteop', function(op) {
      var newSelection, scrollTop;
      newSelection = [doc.type.transformCursor(elem.selectionStart, op, true), doc.type.transformCursor(elem.selectionEnd, op, true)];
      scrollTop = elem.scrollTop;
      elem.value = doc.snapshot;
      if (elem.scrollTop !== scrollTop) {
        elem.scrollTop = scrollTop;
      }
      return elem.selectionStart = newSelection[0], elem.selectionEnd = newSelection[1], newSelection;
    });
    genOp = function(event) {
      var onNextTick;
      onNextTick = function(fn) {
        return setTimeout(fn, 0);
      };
      return onNextTick(function() {
        var op;
        if (elem.value !== prevvalue) {
          prevvalue = elem.value;
          op = opFromDiff(doc.snapshot, elem.value.replace(/\r\n/g, '\n'));
          if (op.length !== 0) {
            return doc.submitOp(op);
          }
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
