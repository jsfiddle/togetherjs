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
    var doc, event, genOp, _i, _len, _ref, _results;
    doc = this;
    elem.value = this.snapshot;
    this.on('remoteop', function(op) {
      var newSelection;
      newSelection = [doc.type.transformCursor(elem.selectionStart, op, false), doc.type.transformCursor(elem.selectionEnd, op, false)];
      elem.value = doc.snapshot;
      return elem.selectionStart = newSelection[0], elem.selectionEnd = newSelection[1], newSelection;
    });
    genOp = function(event) {
      var onNextTick;
      console.log(event);
      onNextTick = function(fn) {
        return setTimeout(fn, 10);
      };
      return onNextTick(function() {
        var op;
        console.log(doc.snapshot, elem.value);
        op = opFromDiff(doc.snapshot, elem.value);
        console.log(op);
        if (op.length !== 0) {
          return doc.submitOp(op);
        }
      });
    };
    _ref = ['textInput', 'keydown', 'keyup', 'select', 'cut', 'paste'];
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      event = _ref[_i];
      _results.push(elem.addEventListener(event, genOp, false));
    }
    return _results;
  };
}).call(this);
