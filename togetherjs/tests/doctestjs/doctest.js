(function (exports) {

// Some Node.js globals:
/*global global, require, exports */
// Some browser globals:
/*global console */
// Some doctest.js globals:
/*global writeln, wait, doctest:true, doctestReporterHook, esprima:true, JSHINT:true */

var globalObject;
if (typeof window == 'undefined') {
  if (typeof global == 'undefined') {
    globalObject = (function () {return this;})();
  } else {
    globalObject = global;
  }
} else {
  globalObject = window;
}

var doc;
if (typeof document != 'undefined') {
  doc = document;
} else {
  doc = null;
}

exports.setDocument = function (newDocument) {
  doc = newDocument;
};

var Example = exports.Example = function (runner, expr, expected, attrs) {
  this.runner = runner;
  this.expr = expr;
  if (typeof expected != "string") {
    throw "Bad value for expected: " + expected;
  }
  this.expected = expected;
  if (attrs) {
    for (var i in attrs) {
      if (attrs.hasOwnProperty(i)) {
        this[i] = attrs[i];
      }
    }
  }
};

Example.prototype = {
  run: function () {
    this.output = [];
    this.consoleOutput = [];
    var globs = this.runner.evalInit();
    try {
      this.result = this.runner.evaller(this.expr, globs, this.filename);
    } catch (e) {
      if (e && e['doctest.abort']) {
        return;
      }
      this.write('Error: ' + e + '\n');
      // FIXME: doesn't format nicely:
      if (e && e.stack) {
        console.log('Exception Stack:');
        console.log(e.stack);
      }
    }
  },
  check: function () {
    var output = this.output.join('');
    // FIXME: consider using this.result
    this.runner.matcher.match(this, output, this.expected);
  },
  write: function (text) {
    this.output.push(text);
  },
  writeConsole: function (message) {
    this.consoleOutput.push(message);
  },
  clearConsole: function () {
    this.consoleOutput = [];
  },
  timeout: function (passed) {
    this.runner.reporter.logFailure(this, "Error: wait timed out after " + passed + " milliseconds");
  },
  textSummary: function () {
    return strip(strip(this.expr).substr(0, 20)) + '...';
  }
};

var Matcher = exports.Matcher = function (runner) {
  this.runner = runner;
};

Matcher.prototype = {
  match: function (example, got, expected) {
    var cleanGot = this.clean(got);
    var cleanExpected = this.clean(expected);
    var regexp = this.makeRegex(cleanExpected);
    if (cleanGot.search(regexp) != -1) {
      this.runner.reporter.logSuccess(example, got);
      return;
    }
    var comparisonTable = this.makeComparisonTable(cleanGot, cleanExpected);
    this.runner.reporter.logFailure(example, got, comparisonTable);
  },

  makeComparisonTable: function (cleanGot, cleanExpected) {
    var gotLines = this.splitLines(cleanGot);
    var expectedLines = this.splitLines(cleanExpected);
    if (gotLines.length <= 1 || expectedLines.length <= 1) {
      return null;
    }
    var comparisonTable = [];
    comparisonTable.push({header: 'Details of mismatch:'});
    var shownTrailing = false;
    var matching = 0;
    for (var i=0; i<gotLines.length; i++) {
      if (i >= expectedLines.length) {
        if (! shownTrailing) {
          comparisonTable.push({header: 'Trailing lines in got:'});
          shownTrailing = true;
        }
        comparisonTable.push({got: gotLines[i], error: true});
      } else {
        var regexp = this.makeRegex(expectedLines[i]);
        var error = gotLines[i].search(regexp) == -1;
        comparisonTable.push({got: gotLines[i], expected: expectedLines[i], error: error});
        if (! error) {
          matching++;
        }
      }
    }
    if (matching <= 1) {
      return null;
    }
    if (expectedLines.length > gotLines.length) {
      comparisonTable.push({header: 'Trailing expected line(s):'});
      for (i=gotLines.length; i<expectedLines.length; i++) {
        comparisonTable.push({expected: expectedLines[i], error: true});
      }
    }
    return comparisonTable;
  },

  makeRegex: function (pattern) {
    var re = RegExpEscape(pattern);
    re = '^' + re + '$';
    re = re.replace(/\\\.\\\.\\\./g, "[\\S\\s\\r\\n]*");
    re = re.replace(/\\\?/g, "[a-zA-Z0-9_.\\?]+");
    re = re.replace(/[ \t]+/g, " +");
    re = re.replace(/["']/g, "['\"]");
    return new RegExp(re);
  },

  clean: function (s) {
    var lines = this.splitLines(s);
    var result = [];
    for (var i=0; i<lines.length; i++) {
      var line = strip(lines[i]);
      if (line) {
        result.push(line);
      }
    }
    return result.join('\n');
  },

  splitLines: function (s) {
    return s.split(/(?:\r\n|\r|\n)/);
  }
};

var HTMLReporter = exports.HTMLReporter = function (runner, containerEl) {
  this.runner = runner;
  if (! containerEl) {
    if (doc.getElementById('doctest-output')) {
      containerEl = 'doctest-output';
    } else {
      containerEl = makeElement('div');
      doc.body.insertBefore(containerEl, doc.body.childNodes[0]);
    }
  }
  if (typeof containerEl == 'string') {
    containerEl = doc.getElementById(containerEl);
  }
  addClass(containerEl, 'doctest-report');
  this.containerEl = containerEl;
  this.containerEl.innerHTML = (
    '<table class="doctest-report-table">' +
    '<tr><th>Passed:</th>' +
    '<td id="doctest-success-count">0</td></tr>' +
    '<tr><th>Failures:</th>' +
    '<td id="doctest-failure-count">0</td>' +
    '<td><button id="doctest-reload">reload/retest</button></td></tr>' +
    '<tr id="doctest-abort-row" style="display: none"><th>Aborted:</th>' +
    '<td id="doctest-aborted"></td></tr>' +
    '<tr><th></th>' +
    '<td colspan=2 id="doctest-failure-links"></td></tr>' +
    '</table>'
    );
  this.successEl = doc.getElementById('doctest-success-count');
  this.failureEl = doc.getElementById('doctest-failure-count');
  this.failureLinksEl = doc.getElementById('doctest-failure-links');
  var button = doc.getElementById('doctest-reload');
  // Sometimes this is sticky:
  button.disabled = false;
  button.addEventListener('click', function (ev) {
    button.innerHTML = 'reloading...';
    button.disabled = true;
    location.reload();
  }, false);
};

HTMLReporter.prototype = {

  logSuccess: function (example, got) {
    var num = parseInt(this.successEl.innerHTML.split('/')[0], 10);
    num++;
    this.successEl.innerHTML = num+' / '+this.runner.examples.length;
    addClass(this.successEl, 'doctest-nonzero');
    if (example.htmlSpan) {
      addClass(example.htmlSpan, 'doctest-success');
      if (example.expected.indexOf('...') != -1 ||
          example.expected.indexOf('?') != -1) {
        this.addExampleNote(example, 'Output:', 'doctest-actual-output', got || '(none)');
      }
    }
    this.showConsoleOutput(example, false);
    this.runner._hook('reportSuccess', example, got);
  },

  logFailure: function (example, got, comparisonTable) {
    this.addFailure();
    if (example.htmlSpan) {
      addClass(example.htmlSpan, 'doctest-failure');
      var showGot = got || '(nothing output)';
      var expectedSpan = makeElement('span', {className: 'doctest-description'}, ['Expected:\n']);
      example.htmlSpan.insertBefore(expectedSpan, example.htmlSpan.querySelector('.doctest-output'));
      if (! example.expected) {
        example.htmlSpan.querySelector('.doctest-output').innerHTML = '(nothing expected)\n';
      }
      this.addExampleNote(example, 'Got:', 'doctest-actual-output', showGot);
    }
    if (comparisonTable) {
      this.addComparisonTable(example, comparisonTable);
    }
    if (example.blockEl) {
      addClass(example.blockEl, 'doctest-some-failure');
    }
    if (example.htmlID) {
      var anchor = makeElement('a', {href: '#' + example.htmlID, className: 'doctest-failure-link'}, [example.textSummary()]);
      this.failureLinksEl.appendChild(anchor);
      if (example.htmlID == positionOnFailure) {
        location.hash = '#' + example.htmlID;
      }
    }
    this.showConsoleOutput(example, true);
    this.runner._hook('reportFailure', example, got);
  },

  logAbort: function (example, abortMessage) {
    this.addFailure();
    this.addAborted(abortMessage);
    if (example.htmlSpan) {
      addClass(example.htmlSpan, 'doctest-failure');
    }
    if (example.blockEl) {
      addClass(example.blockEl, 'doctest-some-failure');
    }
    this.addExampleNote(example, 'Aborted:', 'doctest-actual-output', abortMessage);
    this.runner._hook('reportAbort', example, abortMessage);
  },

  addFailure: function () {
    var num = parseInt(this.failureEl.innerHTML, 10);
    num++;
    this.failureEl.innerHTML = num+'';
    addClass(this.failureEl, 'doctest-nonzero');
  },

  addAborted: function (message) {
    doc.getElementById('doctest-abort-row').style.display = '';
    var td = doc.getElementById('doctest-aborted');
    td.appendChild(doc.createTextNode(message));
  },

  showConsoleOutput: function (example, error) {
    if (! example.consoleOutput.length) {
      return;
    }
    if (! example.htmlSpan) {
      return;
    }
    var text = example.consoleOutput.join('\n');
    this.addExampleNote(example, 'Console:', 'doctest-console', text);
  },

  addExampleNote: function (example, description, className, text) {
    if (! example.htmlSpan) {
      return;
    }
    example.htmlSpan.appendChild(makeElement('span', {className: 'doctest-description'}, [description + '\n']));
    example.htmlSpan.appendChild(makeElement('span', {className: className}, [text + '\n']));
  },

  addComparisonTable: function (example, comparisonTable) {
    if (! example.htmlSpan) {
      // FIXME; should display text table
      return;
    }
    var table = makeElement('table', {className: 'doctest-comparison-table'});
    for (var i=0; i<comparisonTable.length; i++) {
      var line = comparisonTable[i];
      if (line.header) {
        table.appendChild(makeElement('tr', {className: 'doctest-comparison-header'}, [
          makeElement('th', {colspan: 2}, [line.header])
        ]));
      } else {
        table.appendChild(makeElement('tr', {className: line.error ? 'doctest-comparison-error' : null}, [
          makeElement('td', {className: 'doctest-comparison-got'}, [line.got || '']),
          makeElement('td', {className: 'doctest-comparison-expected'}, [line.expected || ''])
        ]));
      }
    }
    example.htmlSpan.appendChild(table);
  }
};

var ConsoleReporter = exports.ConsoleReporter = function (runner) {
  this.runner = runner;
  this.successes = this.failures = 0;
};

ConsoleReporter.prototype = {
  logSuccess: function (example, got) {
    this.successes++;
    console.log('Passed:', example.textSummary());
  },
  logFailure: function (example, got) {
    this.failures++;
    console.log('Failed:', example.expr);
    console.log('Expected:');
    console.log(example.expected);
    console.log('Got:');
    console.log(got);
  }
};


var repr = exports.repr = function (o, indentString, maxLen) {
  /* Taken from MochiKit, with an addition to print objects */
  var reprMaker = new repr.ReprClass(indentString, maxLen);
  return reprMaker.repr(o);
};

repr.ReprClass = function (indentString, maxLen) {
  this.indentString = indentString || '';
  if (maxLen === undefined) {
    maxLen = this.defaultMaxLen;
  }
  this.maxLen = maxLen;
  this.tracker = [];
};

repr.ReprClass.prototype = {
  defaultMaxLen: 80,

  repr: function reprFunc(o, indentString) {
    if (indentString === undefined) {
      indentString = this.indentString;
    }
    if (this.seenObject(o)) {
      return '..recursive..';
    }
    if (o === undefined) {
      return 'undefined';
    } else if (o === null) {
      return "null";
    }
    try {
      if (typeof o.__repr__ == 'function') {
        return o.__repr__(indentString, this.maxLen);
      } else if (typeof o.repr == 'function' && o.repr != reprFunc &&
                 o.repr != repr) {
        return o.repr(indentString, this.maxLen);
      }
      for (var i=0; i<this.registry.length; i++) {
        var item = this.registry[i];
        if (item[0].call(this, o)) {
          var func = item[1];
          if (typeof func == "string") {
            func = this[func];
          }
          return func.call(this, o, indentString);
        }
      }
    } catch (e) {
      // FIXME: unclear what purpose this serves:
      console.warn('Error stringifying object:', e);
      if (typeof(o.NAME) == 'string' && (
            o.toString == Function.prototype.toString ||
            o.toString == Object.prototype.toString)) {
        return o.NAME;
      }
    }
    var ostring;
    try {
      ostring = (o + "");
      if (ostring == '[object Object]' || ostring == '[object]') {
        ostring = this.objRepr(o, indentString);
      }
    } catch (e) {
      return "[" + (typeof o) + "]";
    }
    if (typeof o == "function") {
      ostring = ostring.replace(/^\s+/, "").replace(/\s+/g, " ");
      var idx = ostring.indexOf("{");
      if (idx != -1) {
        ostring = ostring.substr(o, idx) + "{...}";
      }
    }
    return ostring;
  },

  seenObject: function (obj) {
    if (typeof obj != 'object' || obj === null) {
      return false;
    }
    for (var i=0; i<this.tracker.length; i++) {
      if (this.tracker[i] === obj) {
        return true;
      }
    }
    this.tracker.push(obj);
    return false;
  },

  seenPosition: function () {
    return this.tracker.length-1;
  },

  popSeen: function (point) {
    this.tracker.splice(point, this.tracker.length - point);
  },

  objRepr: function (obj, indentString) {
    var seenPosition = this.seenPosition();
    var ostring = '{';
    var keys = sortedKeys(obj);
    for (var i=0; i<keys.length; i++) {
      if (ostring != '{') {
        ostring += ', ';
      }
      ostring += this.keyRepr(keys[i]) + ': ' + this.repr(obj[keys[i]]);
    }
    ostring += '}';
    if (ostring.length > (this.maxLen - indentString.length)) {
      this.popSeen(seenPosition);
      ostring = this.multilineObjRepr(obj, indentString);
    }
    this.popSeen(seenPosition);
    return ostring;
  },

  multilineObjRepr: function (obj, indentString) {
    var keys = sortedKeys(obj);
    var ostring = '{\n';
    for (var i=0; i<keys.length; i++) {
      ostring += indentString + '  ' + this.keyRepr(keys[i]) + ': ';
      ostring += this.repr(obj[keys[i]], indentString+'  ');
      if (i != keys.length - 1) {
        ostring += ',';
      }
      ostring += '\n';
    }
    ostring += indentString + '}';
    return ostring;
  },

  keyRepr: function (key) {
    if (key.search(/^[a-zA-Z_][a-zA-Z0-9_]*$/) === 0) {
      return key;
    } else {
      return this.repr(key);
    }
  },

  arrayRepr: function (obj, indentString) {
    var seenPosition = this.seenPosition();
    var s = "[";
    for (var i=0; i<obj.length; i++) {
      s += this.repr(obj[i], indentString, this.maxLen);
      if (i != obj.length-1) {
        s += ", ";
      }
    }
    s += "]";
    if (s.length > (this.maxLen + indentString.length)) {
      this.popSeen(seenPosition);
      s = this.multilineArrayRepr(obj, indentString);
    }
    this.popSeen(seenPosition);
    return s;
  },

  multilineArrayRepr: function (obj, indentString) {
    var s = "[\n";
    for (var i=0; i<obj.length; i++) {
      s += indentString + '  ' + this.repr(obj[i], indentString+'  ');
      if (i != obj.length - 1) {
        s += ',';
      }
      s += '\n';
    }
    s += indentString + ']';
    return s;
  },

  xmlRepr: function (el, indentString) {
    var i;
    if (el.nodeType == el.DOCUMENT_NODE) {
      return "<document " + el.location.href + ">";
    }
    if (el.nodeType == el.DOCUMENT_TYPE_NODE) {
      return "<!DOCTYPE " + el.name + ">";
    }
    var tagName = el.tagName || "(no tag)";
    var s = '<' + tagName.toLowerCase();
    var attrs = [];
    if (el.attributes && el.attributes.length) {
      for (i=0; i<el.attributes.length; i++) {
        attrs.push(el.attributes[i].nodeName);
      }
      attrs.sort();
      for (i=0; i<attrs.length; i++) {
        s += ' ' + attrs[i] + '="';
        var value = el.getAttribute(attrs[i]);
        value = value.replace(/&/g, '&amp;');
        value = value.replace(/"/g, '&quot;');
        s += value;
        s += '"';
      }
    }
    if (! el.childNodes.length) {
      s += ' />';
      return s;
    } else {
      s += '>';
    }
    var hasNewline = false;
    for (i=0; i<el.childNodes.length; i++) {
      var child = el.childNodes[i];
      if (child.nodeType == child.TEXT_NODE) {
        s += strip(child.textContent);
      } else {
        if (! hasNewline) {
          s += '\n' + indentString;
          hasNewline = true;
        }
        s += '  ' + this.xmlRepr(child, indentString + '  ');
        s += '\n' + indentString;
      }
    }
    s += '</' + el.tagName.toLowerCase() + '>';
    return s;
  },

  xhrRepr: function (req, indentString) {
    var s = '[XMLHttpRequest ';
    var states = {
      0: 'UNSENT',
      1: 'OPENED',
      2: 'HEADERS_RECEIVED',
      3: 'LOADING',
      4: 'DONE'
    };
    s += states[req.readyState];
    if (req.readyState == 4) {
      s += ' ' + req.status + ' ' + req.statusText;
    }
    return s + ']';
  },

  registry: [
    [function (o) {
       return typeof o == 'string';
     },
     function (o) {
       o = '"' + o.replace(/([\"\\])/g, '\\$1') + '"';
       o = o.replace(/[\f]/g, "\\f")
       .replace(/[\b]/g, "\\b")
       .replace(/[\n]/g, "\\n")
       .replace(/[\t]/g, "\\t")
       .replace(/[\r]/g, "\\r");
       return o;
     }
    ],
    [function (o) {
       return typeof o == 'number';
     },
     function (o) {
         return o + "";
     }
    ],
    [function (o) {
       return typeof o == 'object' && o.nodeType;
     },
     "xmlRepr"
    ],
    [function (o) {
       var typ = typeof o;
       if ((typ != 'object' && ! (typ == 'function' && typeof o.item == 'function')) ||
           o === null ||
           typeof o.length != 'number' ||
           o.nodeType === 3) {
           return false;
       }
       return true;
     },
     "arrayRepr"
    ],
    [function (o) {
       return typeof XMLHttpRequest !== 'undefined' && o instanceof XMLHttpRequest;

     },
     'xhrRepr'
    ]
  ]

};

repr.register = function (condition, reprFunc) {
  repr.ReprClass.prototype.registry.push([condition, reprFunc]);
};

var Runner = exports.Runner = function (options) {
  this.examples = [];
  options = options || {};
  for (var i in options) {
    if (options.hasOwnProperty(i)) {
      if (this[i] === undefined) {
        throw 'Unexpected option: ' + i;
      }
      this[i] = options[i];
    }
  }
};

Runner.prototype = {

  init: function () {
    if (this.matcher === null) {
      this.matcher = this.makeMatcher();
    }
    if (this.reporter === null) {
      this.reporter = this.makeReporter();
    }
    if (this.repr === null) {
      this.repr = this.makeRepr();
    }
    this._hook('init', this);
  },

  run: function () {
    this.init();
    if (! this.examples.length) {
      throw 'No examples have been added';
    }
    this._exampleIndex = 0;
    this._runExample();
  },

  evalInit: function () {
    if (typeof this.globs != "undefined") {
      return this.globs;
    }
    this.logGrouped = false;
    this._abortCalled = false;
    var globs = {
      write: this.write.bind(this),
      writeln: this.writeln.bind(this),
      printResolved: this.printResolved.bind(this),
      wait: this.wait.bind(this),
      Abort: this.Abort.bind(this),
      repr: repr,
      Spy: Spy,
      jshint: jshint
    };
    globs.print = globs.writeln;
    var consoleOverwrites = {
      log: this.logFactory(null, console.log),
      warn: this.logFactory(null, console.warn),
      error: this.logFactory(null, console.error),
      info: this.logFactory(null, console.info),
      clear: this.clearLogs.bind(this)
    };
    if (typeof window == 'undefined') {
      // Can't just overwrite the console object
      globs.console = consoleOverwrites;
      for (var i in console) {
        if (console.hasOwnProperty(i) && (! globs.console.hasOwnProperty(i))) {
          if (console[i].bind) {
            globs.console[i] = console[i].bind(console);
          } else {
            globs.console[i] = console[i];
          }
        }
      }
      var context = require('vm').Script.createContext();
      extend(context, globs);
      return context;
    } else {
      extend(console, consoleOverwrites);
      window.onerror = this.windowOnerror;
      extend(window, globs);
      return null;
    }
  },

  write: function (text) {
    this._currentExample.write(text);
  },

  writeln: function () {
    for (var i=0; i<arguments.length; i++) {
      if (i) {
        this.write(' ');
      }
      if (typeof arguments[i] == "string") {
        this.write(arguments[i]);
      } else {
        this.write(this.repr(arguments[i]));
      }
    }
    this.write('\n');
  },

  printResolved: function () {
    // We used finished to signal that nothing should be printed, even when
    // waiting is 0, as there are more arguments still to collect:
    var finished = false;
    var waiting = 0;
    var fullValues = [];
    var args = Array.prototype.slice.call(arguments);

    // This function is called as each promise is resolved, to see if it
    // was the last promise:
    var check = (function (dec) {
      waiting -= dec;
      if (waiting || ! finished) {
        return;
      }
      var flattened = [];
      fullValues.forEach(function (items) {
        items.forEach(function (item) {
          flattened.push(item);
        });
      });
      this.writeln.apply(this, flattened);
    }).bind(this);

    args.forEach(function (value, index) {
      if (value.then) {
        // It's a promise
        waiting++;
        value.then(
          (function () {
            var values = Array.prototype.slice.call(arguments);
            if ((! values.length) || (values.length === 1 && values[0] === undefined)) {
              values = ["(resolved)"];
            }
            fullValues[index] = values;
            check(1);
          }).bind(this),
          (function () {
            var errs = Array.prototype.slice.call(arguments);
            if ((! errs.length) || (errs.length === 1 && errs[0] === undefined)) {
              errs = ["(error)"];
            }
            errs = ["Error:"].concat(errs);
            fullValues[index] = errs;
            check(1);
          }).bind(this));
      } else {
        fullValues[index] = [value];
      }
    }, this);
    finished = true;
    if (waiting) {
      this.wait(function () {
        return ! waiting;
      });
    }
    check(0);
  },

  wait: function (conditionOrTime, hardTimeout) {
    // FIXME: should support a timeout even with a condition
    if (conditionOrTime === undefined ||
        conditionOrTime === null) {
      // same as wait-some-small-amount-of-time
      conditionOrTime = 0;
    }
    this._waitCondition = conditionOrTime;
    if (typeof conditionOrTime == "number") {
      if (((! hardTimeout) && this._defaultWaitTimeout < conditionOrTime) ||
          hardTimeout < conditionOrTime) {
        hardTimeout = conditionOrTime + 10;
      }
    }
    this._waitTimeout = hardTimeout;
    this._exampleWait = true;
  },

  // FIXME: maybe this should be set more carefully just during the tests?
  windowOnerror: function (message, filename, lineno) {
    var m = message;
    if (filename || lineno) {
      m += ' (';
      if (filename) {
        m += filename;
        if (lineno) {
          m += ':' + lineno;
        }
      } else {
        m += 'line ' + lineno;
      }
      m += ')';
    }
    writeln('Error: ' + m);
  },

  logFactory: function (prefix, origFunc) {
    var self = this;
    var logFunc = origFunc || console.log.origFunc || console.log;

    var func = function () {
      if (console.group && (! self.logGrouped)) {
        self.logGrouped = true;
        console.group('Output from example:');
      }
      logFunc.apply(console, arguments);
      var s = prefix || '';
      for (var i=0; i<arguments.length; i++) {
        var text = arguments[i];
        if (i) {
          s += ' ';
        }
        if (typeof text == "string") {
          s += text;
        } else {
          s += repr(text);
        }
      }
      self._currentExample.writeConsole(s);
    };
    func.origFunc = origFunc;
    return func;
  },

  clearLogs: function () {
    this._currentExample.clearConsole();
    if (console.clear.origFunc) {
      console.clear.origFunc.call(console);
    }
  },

  Abort: function (message) {
    this._abortCalled = message || 'aborted';
    return {
      "doctest.abort": true,
      toString: function () {return 'Abort(' + message + ')';}
    };
  },

  evalUninit: function () {
    if (this.logGrouped) {
      if (console.groupEnd) {
        console.groupEnd();
      } else if (console.endGroup) {
        console.endGroup();
      }
    }
    this.logGrouped = false;
    if (typeof window != 'undefined') {
      window.write = undefined;
      window.writeln = undefined;
      window.printResolved = undefined;
      window.print = undefined;
      window.wait = undefined;
      window.onerror = undefined;
      window.jshint = undefined;
      window.console.log = window.console.log.origFunc;
      window.console.warn = window.console.warn.origFunc;
      window.console.error = window.console.error.origFunc;
      window.console.info = window.console.info.origFunc;
      window.console.clear = window.console.clear.origFunc;
    }
  },

  evaller: function (expr, context, filename) {
    var e = eval;
    var result;
    if (context) {
      if (typeof window == "undefined") {
        var vm = require('vm');

        if (! (context instanceof vm.Script.createContext().constructor)) {
            throw "context must be created with vm.Script.createContext()";
        }

        // Prepare context to evaluate `expr` in. Mostly follows CoffeeScript
        // [eval function](http://git.io/coffee-script-eval).
        context.global = context.root = context.GLOBAL = context;
        context.__filename = typeof filename != "undefined" ? filename : __filename;
        context.__dirname = require('path').dirname(context.__filename);
        context.module = module;
        context.require = require;

        // Set `module.filename` to script file name and evaluate the script.
        // Now, if the script executes `require('./something')`, it will look
        // up `'./something'` relative to script path.
        //
        // We restore `module.filename` afterwards, because `module` object
        // is reused. The other approach is to create a new `module` instance.
        // CoffeeScript [eval][1] [works this way][2]. Unfortunately it
        // [uses private Node API][3] to do it.
        //
        // [1]: http://git.io/coffee-script-eval
        // [2]: https://github.com/jashkenas/coffee-script/pull/1487
        // [3]: http://git.io/coffee-script-eval-comment
        var prevfilename = module.filename;
        module.filename = context.__filename;
        try {
          vm.runInContext(expr, context, context.__filename);
        } finally {
            module.filename = prevfilename;
        }

      } else {
        with (context) {
          result = eval(expr);
        }
      }
    } else {
      result = e(expr);
    }
    return result;
  },

  _runExample: function () {
    if (this._abortCalled) {
      return;
    }
    while (true) {
      if (this._exampleIndex >= this.examples.length) {
        this._finish();
        break;
      }
      this._currentExample = this.examples[this._exampleIndex];
      this._exampleIndex++;
      this._currentExample.run();
      if (this._exampleWait && ! this._abortCalled) {
        this._runWait();
        break;
      }
      this.evalUninit();
      this._currentExample.check();
      if (this._abortCalled) {
        // FIXME: this should show that while finished, and maybe successful,
        // the tests were aborted
        this.reporter.logAbort(this._currentExample, this._abortCalled);
        this._finish();
        break;
      }
      this._currentExample = null;
    }
  },

  _runWait: function () {
    var start = Date.now();
    var waitTimeout = this._waitTimeout || this._defaultWaitTimeout;
    this._waitTimeout = null;
    var self = this;
    function poll() {
      var now = Date.now();
      var cond = self._waitCondition;
      if (typeof cond == "number") {
        if (now - start >= cond) {
          self._exampleWait = false;
        }
      } else if (cond) {
        if (cond()) {
          self._exampleWait = false;
        }
      }
      if (self._exampleWait) {
        if (now - start > waitTimeout) {
          self._currentExample.timeout(now - start);
        } else {
          setTimeout(poll, self._waitPollTime);
          return;
        }
      }
      self.evalUninit();
      self._currentExample.check();
      self._currentExample = null;
      self._runExample();
    }
    // FIXME: instead of the poll time, cond could be used if it is a number
    setTimeout(poll, this._waitPollTime);
  },

  _hook: function (method) {
    if (typeof doctestReporterHook == "undefined") {
      return null;
    } else if (method && arguments.length > 1 && doctestReporterHook[method]) {
      var args = argsToArray(arguments).slice(1);
      return doctestReporterHook[method].apply(doctestReporterHook, args);
    } else if (method) {
      return doctestReporterHook[method];
    } else {
      return doctestReporterHook;
    }
  },

  _finish: function () {
    if (attemptedHash && location.hash == attemptedHash) {
      // This fixes up the anchor position after tests have run.
      // FIXME: would be nice to detect if the user has scrolled between
      // page load and the current moment
      location.hash = '';
      location.hash = attemptedHash;
    }
    this._hook('finish', this);
  },

  _waitPollTime: 100,
  _waitTimeout: null,
  _waitCondition: null,
  _defaultWaitTimeout: 5000,

  /* Dependency Injection, yay! */
  examples: null,
  Example: Example,
  exampleOptions: null,
  makeExample: function (text, expected, filename) {
    var options = {filename: filename};
    extend(options, this.exampleOptions);
    return new this.Example(this, text, expected, options);
  },
  matcher: null,
  Matcher: Matcher,
  matcherOptions: null,
  makeMatcher: function () {
    return new this.Matcher(this, this.matcherOptions);
  },
  reporter: null,
  Reporter: HTMLReporter,
  reporterOptions: null,
  makeReporter: function () {
    return new this.Reporter(this, this.reporterOptions);
  },
  repr: repr
};

var HTMLParser = exports.HTMLParser = function (runner, containerEl, selector) {
  this.runner = runner;
  containerEl = containerEl || doc.body;
  if (typeof containerEl == 'string') {
    containerEl = doc.getElementById(containerEl);
  }
  if (! containerEl) {
    throw 'Bad/null/missing containerEl';
  }
  this.containerEl = containerEl;
  this.selector = selector || 'pre.doctest, pre.commenttest, pre.test';
};

HTMLParser.prototype = {
  parse: function () {
    var els = this.findEls();
    for (var i=0; i<els.length; i++) {
      try {
        this.parseEl(els[i]);
      } catch (e) {
        addClass(els[i], 'doctest-some-failure');
        this.runner.reporter.addFailure();
        var failed = makeElement('span', {className: 'doctest-example doctest-failure'}, ['Exception parsing element: ', e+'\n']);
        els[i].insertBefore(failed, els[i].childNodes[0]);
        throw e;
      }
    }
  },

  findEls: function () {
    return this.containerEl.querySelectorAll(this.selector);
  },

  parseEl: function (el) {
    var examples;
    if (hasClass(el, 'doctest')) {
      examples = this.parseDoctestEl(el);
    } else if (hasClass(el, 'commenttest') || hasClass(el, 'test')) {
      examples = this.parseCommentEl(el);
    } else {
      throw 'Unknown element class/type';
    }
    var newChildren = [];
    for (var i=0; i<examples.length; i++) {
      var example = examples[i][0];
      var output = examples[i][1];
      var rawExample = examples[i][2];
      var rawOutput = examples[i][3];
      var ex = this.runner.makeExample(example, output);
      this.runner.examples.push(ex);
      ex.blockEl = el;
      ex.htmlID = genID('example');
      var span = makeElement('span', {id: ex.htmlID, className: 'doctest-example'}, [
        makeElement('div', {className: 'doctest-expr'}, [rawExample]),
        makeElement('div', {className: 'doctest-output'}, [rawOutput])
        ]);
      ex.htmlSpan = span;
      newChildren.push(span);
    }
    el.innerHTML = '';
    for (var i=0; i<newChildren.length; i++) {
      el.appendChild(newChildren[i]);
    }
  },

  parseDoctestEl: function (el) {
    var result = [];
    var text = getElementText(el);
    var lines = text.split(/(?:\r\n|\r|\n)/);
    var exampleLines = [];
    var rawExample = [];
    var outputLines = [];
    var rawOutput = [];
    for (var i=0; i<lines.length; i++) {
      var line = lines[i];
      if (line.search(/^\s*[$]/) != -1 || i==lines.length-1) {
        if (exampleLines.length) {
          result.push([
            exampleLines.join('\n'), outputLines.join('\n'),
            rawExample.join('\n'), rawOutput.join('\n')]);
        }
        exampleLines = [];
        outputLines = [];
        rawExample = [];
        rawOutput = [];
        rawExample.push(line);
        line = line.replace(/^ *[$] ?/, '');
        exampleLines.push(line);
      } else if (/^>/.test(line)) {
        if (! exampleLines.length) {
          throw ('Bad example: ' + this.runner.repr(line) + '\n' +
            '> line not preceded by $');
        }
        rawExample.push(line);
        line = line.replace(/^ *> ?/, '');
        exampleLines.push(line);
      } else {
        rawOutput.push(line);
        outputLines.push(line);
      }
    }
    return result;
  },

  parseCommentEl: function (el) {
    if (typeof esprima == "undefined") {
      if (typeof require != "undefined") {
        esprima = require("./esprima/esprima.js");
      } else {
        throw 'You must install or include esprima.js';
      }
    }
    var contents = getElementText(el);
    var ast = esprima.parse(contents, {
      range: true,
      comment: true
    });
    var pos = 0;
    var result = [];
    for (var i=0; i<ast.comments.length; i++) {
      var comment = ast.comments[i];
      if (comment.value.search(/^\s*==?>/) == -1) {
        // Not a comment we care about
        continue;
      }
      var start = comment.range[0];
      var end = comment.range[1];
      var example = contents.substr(pos, start-pos);
      var output = comment.value.replace(/^\s*=> ?/, '');
      var orig = comment.type == 'Block' ? '/*' + comment.value + '*/' : '//' + comment.value;
      if (example === '') {
          result[result.length-1][1] += '\n'+output;
          result[result.length-1][3] += '\n'+orig;
      }
      else {
        result.push([example, output, example, orig]);
      }
      pos = end;
    }
    var last = contents.substr(pos, contents.length-pos);
    if (strip(last)) {
      result.push([last, '', last, '']);
    }
    return result;
  },

  loadRemotes: function (callback, selector) {
    var els;
    if (! selector) {
      els = this.findEls();
    } else {
      els = document.querySelectorAll(selector);
    }
    var pending = 0;
    argsToArray(els).forEach(function (el) {
      var href = el.getAttribute('data-href-pattern');
      if (href) {
        try {
          href = this.fillPattern(href);
        } catch (e) {
          var text = '// Error resolving data-href-pattern "' + href + '":\n';
          text += '// ' + e;
          el.innerHTML = '';
          el.appendChild(document.createTextNode(text));
          return;
        }
      }
      if (! href) {
        href = el.getAttribute('href');
      }
      if (! href) {
        href = el.getAttribute('src');
      }
      if (! href) {
        return;
      }
      pending++;
      var req = new XMLHttpRequest();
      if (href.indexOf('?') == -1) {
        // Try to stop some caching:
        href += '?nocache=' + Date.now();
      }
      req.open('GET', href);
      req.setRequestHeader('Cache-Control', 'no-cache, max-age=0');
      req.onreadystatechange = (function () {
        if (req.readyState != 4) {
          return;
        }
        if (req.status != 200 && !(req.status === 0 && document.location.protocol == "file:")) {
          el.appendChild(doc.createTextNode('\n// Error fetching ' + href + ' status: ' + req.status));
        } else {
          this.fillElement(el, req.responseText);
        }
        pending--;
        if (! pending) {
          callback();
        }
      }).bind(this);
      req.send();
    }, this);
    if (! pending) {
      callback();
    }
  },

  fillPattern: function (pattern) {
    var regex = /\{([^\}]+)\}/;
    var result = '';
    while (true) {
      var match = regex.exec(pattern);
      if (! match) {
        result += pattern;
        break;
      }
      result += pattern.substr(0, match.index);
      pattern = pattern.substr(match.index + match[0].length);
      var name = match[1];
      var restriction = "^[\\w_\\-\\.]+$";
      var defaultValue = '';
      if (name.lastIndexOf('|') != -1) {
        defaultValue = name.substr(name.lastIndexOf('|')+1);
        name = name.substr(0, name.lastIndexOf('|'));
      }
      if (name.indexOf(':') != -1) {
        restriction = name.substr(name.indexOf(':')+1);
        name = name.substr(0, name.indexOf(':'));
      }
      var value = params[name];
      if (! value) {
        value = defaultValue;
      }
      if (restriction && value.search(new RegExp(restriction)) == -1) {
        throw 'Bad substitution for {' + name + ':' + restriction + '}: "' + value + '"';
      }
      result += value;
    }
    return result;
  },

  fillElement: function (el, text) {
    el.innerHTML = '';
    if (hasClass(el, 'commenttest') || hasClass(el, 'test')) {
      var texts = this.splitText(text);
      console.log("filling in tests", texts, el);
      if (texts && texts.length == 1 && ! texts[0].header) {
        el.appendChild(document.createTextNode(texts[0].body));
      } else if (texts && texts.length) {
        for (var i=0; i<texts.length; i++) {
          if (texts[i].header) {
            var h3 = document.createElement('h3');
            h3.className = 'doctest-section-header';
            h3.appendChild(document.createTextNode(texts[i].header));
            el.parentNode.insertBefore(h3, null);
          }
          var pre = document.createElement('pre');
          pre.className = el.className;
          pre.appendChild(document.createTextNode(texts[i].body));
          if (texts[i].expandOnFailure) {
            pre.className += " expand-on-failure";
          }
          el.parentNode.insertBefore(pre, null);
        }
        el.parentNode.removeChild(el);
      }
    }
  },

  splitText: function (text) {
    var ast;
    try {
      ast = esprima.parse(text, {
        range: true,
        comment: true
      });
    } catch (e) {
      // The error will get reported later on, so we'll just ignore it here
      return [{header: null, body: text}];
    }
    // FIXME: check if it didn't parse
    var result = [];
    var pos = 0;
    for (var i=0; i<ast.comments.length; i++) {
      var comment = ast.comments[i];
      if (comment.value.search(/^\s*=+\s*SECTION/) == -1) {
        // Not a section comment
        continue;
      }
      var start = comment.range[0];
      var end = comment.range[1];
      var body = text.substr(pos, start-pos);
      var header = strip(comment.value.replace(/^\s*=+\s*SECTION\s*/, ''));
      var expandOnFailure = false;
      if (header.search(/expand-on-failure/i) !== -1) {
        expandOnFailure = true;
        header = header.replace(/\s*expand-on-failure/i, "");
      }
      if (! result.length) {
        if (strip(body)) {
          result.push({header: null, body: body});
        }
      } else {
        result[result.length-1].body = body;
      }
      result.push({header: header, body: null, expandOnFailure: expandOnFailure});
      pos = end;
    }
    if (! result.length) {
      // No sections
      return [{header: '', body: text}];
    }
    var last = text.substr(pos, text.length-pos);
    result[result.length-1].body = last;
    return result;
  }

};

var TextParser = exports.TextParser = function (runner, text, filename) {
  if (typeof esprima == "undefined") {
    if (typeof require != "undefined") {
      esprima = require("./esprima/esprima.js");
    } else {
      throw 'You must install or include esprima.js';
    }
  }
  this.runner = runner;
  this.text = text;
  this.filename = filename;
};

TextParser.fromFile = function (runner, filename) {
  if (typeof filename != "string") {
    throw "You did not give a filename for the second argument: " + filename;
  }
  if (typeof require == "undefined") {
    throw "This method only works in Node, with the presence of require()";
  }
  var fs = require('fs');
  var text = fs.readFileSync(filename, 'UTF-8');
  return new TextParser(runner, text, filename);
};

TextParser.prototype = {
  parse: function () {
    var ast = esprima.parse(this.text, {
      range: true,
      comment: true
    });
    // FIXME: check if text didn't parse
    var pos = 0;
    for (var i=0; i<ast.comments.length; i++) {
      var comment = ast.comments[i];
      if (comment.value.search(/^\s*==?>/) == -1) {
        // Not a comment we care about
        continue;
      }
      var start = comment.range[0];
      var end = comment.range[1];
      var example = this.text.substr(pos, start-pos);
      var output = comment.value.replace(/^\s*=>\s*/, '');
      var ex = this.runner.makeExample(example, output, this.filename);
      this.runner.examples.push(ex);
      pos = end;
    }
    var last = this.text.substr(pos, this.text.length-pos);
    if (strip(last)) {
      this.runner.examples.push(this.runner.makeExample(last, '', this.filename));
    }
  }
};

var strip = exports.strip = function (str) {
  str = str + "";
  return str.replace(/\s+$/, "").replace(/^\s+/, "");
};

var rstrip = exports.rstrip = function (str) {
  str = str + "";
  return str.replace(/\s+$/, "");
};

var argsToArray = exports.argToArray = function (args) {
  var array = [];
  for (var i=0; i<args.length; i++) {
    array.push(args[i]);
  }
  return array;
};

var extend = exports.extend = function (obj, extendWith) {
  for (var i in extendWith) {
    if (extendWith.hasOwnProperty(i)) {
      obj[i] = extendWith[i];
    }
  }
  return obj;
};

var extendDefault = exports.extendDefault = function (obj, extendWith) {
  for (var i in extendWith) {
    if (extendWith.hasOwnProperty(i) && obj[i] === undefined) {
      obj[i] = extendWith[i];
    }
  }
  return obj;
};

var genID = exports.genID = function (prefix) {
  prefix = prefix || 'generic-doctest';
  var id = arguments.callee._idGen++;
  return prefix + '-' + id;
};
genID._idGen = 1;

function deIndent(text) {
    var minimum_spaces = 10000;
    var foo = text.split('\n');
    var i = 0;
    var j = 0;
    var result = '';
    for (i=0; i < foo.length; i++) {
        for (j=0; j < foo[i].length && j < minimum_spaces; j++) {
            if (foo[i][j] != ' ') {
                if (j < minimum_spaces) {
                    minimum_spaces = j;
                }
                break;
            }
        }
    }
    if (minimum_spaces == 0) {
        return text.replace(/^\s+|\s+$/g, '');
    }
    for (i=0; i < foo.length; i++) {
        if (strip(foo[i].substr(0, minimum_spaces)) !== '') {
            throw 'Deindent failed';
        }
        result += foo[i].substr(minimum_spaces) + '\n';
    }
    return strip(result);
}

var getElementText = exports.getElementText = function (el) {
  if (! el) {
    throw('You must pass in an element');
  }
  var text = '';
  for (var i=0; i<el.childNodes.length; i++) {
    var sub = el.childNodes[i];
    if (sub.nodeType == 3) {
      // TEXT_NODE
      text += sub.nodeValue;
    } else if (sub.childNodes) {
      text += getElementText(sub);
    }
  }

  return deIndent(text);
};

var makeElement = exports.makeElement = function (tagName, attrs, children) {
  var el = doc.createElement(tagName);
  if (attrs) {
    for (var i in attrs) {
      if (attrs.hasOwnProperty(i)) {
        if (i == 'className') {
          el.className = attrs[i];
        } else {
          el.setAttribute(i, attrs[i]);
        }
      }
    }
  }
  if (children) {
    for (var i=0; i<children.length; i++) {
      if (typeof children[i] == 'string') {
        el.appendChild(doc.createTextNode(children[i]));
      } else {
        el.appendChild(children[i]);
      }
    }
  }
  return el;
};

var addClass = exports.addClass = function (el, className) {
  if (! el.className) {
    el.className = className;
  } else if (! hasClass(el, className)) {
    el.className += ' ' + className;
  }
};

var hasClass = exports.hasClass = function (el, className) {
  return (' ' + el.className + ' ').indexOf(' ' + className + ' ') != -1;
};

var RegExpEscape = exports.RegExpEscape = function (text) {
  if (! arguments.callee.sRE) {
    var specials = [
      '/', '.', '*', '+', '?', '|', '$',
      '(', ')', '[', ']', '{', '}', '\\'
    ];
    arguments.callee.sRE = new RegExp(
      '(\\' + specials.join('|\\') + ')', 'g'
    );
  }
  return text.replace(arguments.callee.sRE, '\\$1');
};

var objDiff = exports.objDiff = function (orig, current) {
  var result = {
    added: {},
    removed: {},
    changed: {},
    same: {}
  };
  for (var i in orig) {
    if (! (i in current)) {
      result.removed[i] = orig[i];
    } else if (orig[i] !== current[i]) {
      result.changed[i] = [orig[i], current[i]];
    } else {
      result.same[i] = orig[i];
    }
  }
  for (i in current) {
    if (! (i in orig)) {
      result.added[i] = current[i];
    }
  }
  return result;
};

var writeDiff = exports.writeDiff = function (orig, current, indentString) {
  if (typeof orig != 'object' || typeof current != 'object') {
    print(indentString + repr(orig, indentString) + ' -> ' + repr(current, indentString));
    return;
  }
  indentString = indentString || '';
  var diff = objDiff(orig, current);
  var i, keys;
  var any = false;
  keys = sortedKeys(diff.added);
  for (i=0; i<keys.length; i++) {
    any = true;
    print(indentString + '+' + keys[i] + ': '
          + repr(diff.added[keys[i]], indentString));
  }
  keys = sortedKeys(diff.removed);
  for (i=0; i<keys.length; i++) {
    any = true;
    print(indentString + '-' + keys[i] + ': '
          + repr(diff.removed[keys[i]], indentString));
  }
  keys = sortedKeys(diff.changed);
  for (i=0; i<keys.length; i++) {
    any = true;
    print(indentString + keys[i] + ': '
          + repr(diff.changed[keys[i]][0], indentString)
          + ' -> '
          + repr(diff.changed[keys[i]][1], indentString));
  }
  if (! any) {
    print(indentString + '(no changes)');
  }
};

var sortedKeys = exports.sortedKeys = function (obj) {
  var keys = [];
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      keys.push(i);
    }
  }
  keys.sort();
  return keys;
};

var Spy = exports.Spy = function (name, options, extraOptions) {
  var self;
  name = name || 'spy';
  if (Spy.spies[name]) {
     self = Spy.spies[name];
     if ((! options) && ! extraOptions) {
       return self;
     }
  } else {
    self = function () {
      return self.func.apply(this, arguments);
    };
  }
  options = options || {};
  if (typeof options == 'function') {
    options = {applies: options};
  }
  if (extraOptions) {
    extendDefault(options, extraOptions);
  }
  extendDefault(options, Spy.defaultOptions);
  self._name = name;
  self.options = options;
  self.called = false;
  self.calledWait = false;
  self.args = null;
  self.self = null;
  self.argList = [];
  self.selfList = [];
  self.writes = options.writes || false;
  self.returns = options.returns || undefined;
  self.applies = options.applies || null;
  self.throwError = options.throwError || null;
  self.ignoreThis = options.ignoreThis || false;
  self.wrapArgs = options.wrapArgs || false;
  self.func = function () {
    self.called = true;
    self.calledWait = true;
    self.args = argsToArray(arguments);
    self.self = this;
    self.argList.push(self.args);
    self.selfList.push(this);
    // It might be possible to get the caller?
    if (self.writes) {
      if (typeof writeln == "undefined") {
        console.warn("Spy writing outside of test:", self.formatCall());
      } else {
        writeln(self.formatCall());
      }
    }
    if (self.throwError) {
      var throwError = self.throwError;
      if (typeof throwError == "function") {
        throwError = self.throwError.apply(this, arguments);
      }
      throw throwError;
    }
    if (self.applies) {
      try {
        return self.applies.apply(this, arguments);
      } catch (e) {
        console.error('Error in ' + self.repr() + '.applies:', e);
        throw e;
      }
    }
    return self.returns;
  };
  self.func.toString = function () {
    return "Spy('" + self._name + "').func";
  };

  // Method definitions:
  self.formatCall = function () {
    var s = '';
    if ((! self.ignoreThis) && self.self !== globalObject && self.self !== self) {
      s += repr(self.self) + '.';
    }
    s += self._name;
    if (self.args === null) {
      return s + ':never called';
    }
    s += '(';
    // This eliminates trailing undefined arguments:
    var length = self.args.length;
    while (length && self.args[length-1] === undefined) {
      length--;
    }
    for (var i=0; i<length; i++) {
      if (i) {
        s += ', ';
      }
      var maxLen;
      if (self.wrapArgs) {
        maxLen = 10;
      } else {
        maxLen = undefined;
      }
      s += repr(self.args[i], '', maxLen);
    }
    s += ')';
    return s;
  };

  self.method = function (name, options, extraOptions) {
    var desc = self._name + '.' + name;
    var newSpy = Spy(desc, options, extraOptions);
    self[name] = self.func[name] = newSpy.func;
    return newSpy;
  };

  self.methods = function (props) {
    for (var i in props) {
      if (props.hasOwnProperty(i)) {
        var prop = props[i];
        if (prop === true || prop === false || prop === null) {
          prop = {};
        }
        self.method(i, props[i]);
      }
    }
    return self;
  };

  self.wait = function (timeout) {
    var func = function () {
      var value = self.calledWait;
      if (value) {
        self.calledWait = false;
      }
      return value;
    };
    func.repr = function () {
      return 'called:'+repr(self);
    };
    wait(func, timeout);
  };

  self.repr = function () {
    return "Spy('" + self._name + "')";
  };

  if (options.methods) {
    self.methods(options.methods);
  }
  Spy.spies[name] = self;
  if (options.wait) {
    if (typeof options.wait == 'number') {
      self.wait(options.wait);
    } else {
      self.wait();
    }
  }
  return self;
};

Spy.spies = {};
Spy.defaultOptions = {writes: true};

Spy.on = function (obj, attrOrOptions, options) {
  if (typeof obj == "string") {
    var name = obj;
    if (obj.indexOf('.') == -1) {
      throw 'You must provide an object name with a .attribute (not: "' + obj + '")';
    }
    var attr = obj.substr(obj.lastIndexOf('.')+1);
    var objName = obj.substr(0, obj.lastIndexOf('.'));
    var e = eval;
    try {
      var obj = eval(objName);
    } catch (e) {
      throw 'Could not get object "' + obj + '": ' + e + ' (maybe you are not referring to a global variable?)';
    }
    if (obj === undefined || obj === null) {
      throw 'Object "' + objName + '" is ' + obj;
    }
    options = attrOrOptions;
  } else {
    var name = attrOrOptions;
    if (name.indexOf('.') == -1) {
      throw 'You must provide an object name with a .attribute (not: "' + obj + '")';
    }
    attr = attrOrOptions.substr(attrOrOptions.lastIndexOf('.')+1);
  }
  var spy = Spy(name, options);
  spy.overriding = obj[attr];
  spy.onAttribute = attr;
  spy.onObject = obj;
  obj[attr] = spy;
  return spy;
};

var params = exports.params = {};

function jshint(src, options) {
  if (typeof JSHINT == 'undefined') {
    throw 'jshint.js is not included';
  }
  if (! src) {
    throw 'You must call jshint(src) with a src (got ' + src + ')';
  }
  var url = src;
  if (typeof document != 'undefined') {
    var scripts = document.getElementsByTagName('script');
    for (var i=0; i<scripts.length; i++) {
      var scriptSrc = scripts[i].src;
      if (scriptSrc.indexOf(src) != -1) {
        url = scriptSrc;
        break;
      }
    }
  }
  var req = new XMLHttpRequest();
  req.open('GET', url);
  var done = false;
  req.onreadystatechange = function () {
    if (req.readyState != 4) {
      return;
    }
    if (req.status != 200) {
      if (req.status === 0) {
        print('Error: request to', url, 'failed with no status (cross-origin problem?');
      } else {
        print('Error: request to', url, 'failed with status:', req.status);
      }
    } else {
      var text = req.responseText;
      text = _removeJshintSections(text);
      var result = JSHINT(text, options);
      if (result) {
        print('Script passed:', url);
      } else {
        print('Script failed:', repr(url));
        for (var i=0; i<JSHINT.errors.length; i++) {
          var error = JSHINT.errors[i];
          if (error === null) {
            print('Fatal error; jshint could not continue');
          } else {
            print('  ' + (error.line) + ':' + (error.character) + ' ' + error.reason);
            print('    ' + error.evidence);
          }
        }
      }
      /*  Doesn't seem helpful:
      var report = JSHINT.report();
      report = report.replace(/<br>(<(div|p)[^>]*>)?/g, '\n');
      report = report.replace(/<(div|p)[^>]*>/g, '\n');
      report = report.replace(/<[^>]*>/g, ' ');
      report = report.replace(/  +/g, ' ');
      console.log('Report:', report);
      */
    }
    done = true;
  };
  req.send();
  wait(function () {return done;});
}

function _removeJshintSections(text) {
  /* Removes anything surrounded with a comment like:
     // jshint-ignore
     ...
     // jshint-endignore

     It replaces these with whitespace so character and line counts still work.
  */
  var result = '';
  var start = /(\/\/|\/\*)\s*jshint-ignore/i;
  var end = /jshint-endignore\s*(\*\/)?/i;
  while (true) {
    var match = text.search(start);
    if (match == -1) {
      result += text;
      break;
    }
    result += text.substr(0, match);
    text = text.substr(match);
    match = end.exec(text);
    if (! match) {
      // throw everything left away.  Warn?
      break;
    }
    var endPos = match.index + match[0].length;
    var skipped = text.substr(0, endPos);
    text = text.substr(endPos);
    // Maintain line numbers:
    skipped = skipped.replace(/[^\n]/g, ' ');
    result += skipped;
  }
  return result;
}


exports.jshint = jshint;

function NosyXMLHttpRequest(name, req) {
  if (this === globalObject) {
    throw 'You forgot *new* NosyXMLHttpRequest(' + repr(name) + ')';
  }
  if (! name) {
    throw 'The name argument is required';
  }
  if (typeof name != "string") {
    throw 'Wrong type of argument for name: ' + name;
  }
  if (! req) {
    req = new NosyXMLHttpRequest.realXMLHttpRequest();
  }
  this._name = name;
  this._req = req;
  this._method = null;
  this._data = null;
  this._url = null;
  this._headers = {};
  this.abort = printWrap(this._req, 'abort', this._name);
  this.getAllResponseHeaders = this._req.getAllResponseHeaders.bind(this._req);
  this.getResponseHeader = this._req.getResponseHeader.bind(this._req);
  this.open = printWrap(this._req, 'open', this._name, (function (method, url) {
    this._method = method;
    this._url = url;
  }).bind(this));
  this.overrideMimeType = printWrap(this._req, 'overrideMimeType', this._name);
  this.send = printWrap(this._req, 'send', this._name, (function (data) {
    if (this.timeout !== undefined) {
      this._req.timeout = this.timeout;
    }
    if (this.withCredentials !== undefined) {
      this._req.withCredentials = this.withCredentials;
    }
    this._data = data;
  }).bind(this));
  this.setRequestHeader = printWrap(this._req, 'setRequestHeader', this._name, (function (name, value) {
    this._headers[name] = value;
  }).bind(this));
  this.onreadystatechange = null;
  this._req.onreadystatechange = (function () {
    this.readyState = this._req.readyState;
    if (this.readyState >= this.HEADERS_RECEIVED) {
      var props = ['response', 'responseText', 'responseType',
                   'responseXML', 'status', 'statusText', 'upload'];

      for (var i=0; i<props.length; i++) {
        this[props[i]] = this._req[props[i]];
      }
    }
    if (this.onreadystatechange) {
      this.onreadystatechange();
    }
  }).bind(this);
  this.UNSENT = 0;
  this.OPENED = 1;
  this.HEADERS_RECEIVED = 2;
  this.LOADING = 3;
  this.DONE = 4;
  this.readyState = this.UNSENT;
  this.toString = function () {
    var s = 'NosyXMLHttpRequest ';
    s += {0: 'UNSENT', 1: 'OPENED', 2: 'HEADERS_RECEIVED', 3: 'LOADING', 4: 'DONE'}[this.readyState];
    if (this._method) {
      s += '\n' + this._method + ' ' + this._url;
    }
    for (var i in this._headers) {
      if (this._headers.hasOwnProperty(i)) {
        s += '\n' + i + ': ' + this._headers[i];
      }
    }
    if (this._data) {
      s += '\n\n' + this._data;
    }
    s += '\n';
    return s;
  };
}

NosyXMLHttpRequest.realXMLHttpRequest = typeof XMLHttpRequest == "undefined" ? undefined : XMLHttpRequest;

NosyXMLHttpRequest.factory = function (name) {
  return function () {
    return new NosyXMLHttpRequest(name);
  };
};

exports.NosyXMLHttpRequest = NosyXMLHttpRequest;

function printWrap(realObject, methodName, objectName, before) {
  return function () {
    var r = objectName + '.' + methodName + '(';
    var length = arguments.length;
    while (length && arguments[length-1] === undefined) {
      length--;
    }
    for (var i=0; i<length; i++) {
      if (i) {
        r += ', ';
      }
      r += repr(arguments[i]);
    }
    r += ')';
    print(r);
    if (before) {
      before.apply(realObject, arguments);
    }
    return realObject[methodName].apply(realObject, arguments);
  };
}

var positionOnFailure = null;

var attemptedHash = null;

if (typeof location != 'undefined') {

  (function (params) {
    var url = location.href + '';
    if (url.indexOf('#') != -1) {
      url = url.substr(0, url.indexOf('#'));
    }
    if (url.indexOf('?') == -1) {
      return;
    }
    var qs = url.substr(url.indexOf('?')+1);
    var parts = qs.split('&');
    for (var i=0; i<parts.length; i++) {
      var name, value;
      if (parts[i].indexOf('=') == -1) {
        name = decodeURIComponent(parts[i]);
        value = null;
      } else {
        name = decodeURIComponent(parts[i].substr(0, parts[i].indexOf('=')));
        value = decodeURIComponent(parts[i].substr(parts[i].indexOf('=')+1));
      }
      if (params.hasOwnProperty(name)) {
        if (params[name] === null || typeof params[name] == 'string') {
          params[name] = [params[name], value];
        } else {
          params[name].push(value);
        }
      } else {
        params[name] = value;
      }
    }
  })(params);

  if (location.hash.indexOf('#example') === 0) {
    positionOnFailure = location.hash.substr(1);
    location.hash = '';
  } else if (location.hash) {
    // Anchors get all mixed up because we move content around on the page
    attemptedHash = location.hash;
  }
}

if (typeof window != 'undefined') {
  window.addEventListener('load', function () {
    if (hasClass(doc.body, 'autodoctest')) {
      var runner = new Runner();
      var parser = new HTMLParser(runner);
      parser.loadRemotes(function () {
        runner.init();
        parser.parse();
        runner.run();
      },
      hasClass(doc.body, 'load-all-remotes') ? 'pre' : null);
    }
  }, false);
}

// jshint-ignore
/* Includes a minified esprima: http://esprima.org/ */
// Avoid clobbering:
var realExports = exports;
exports = {};

/* INSERT esprima.js */
(function(root,factory){"use strict";if(typeof define==="function"&&define.amd){define(["exports"],factory)}else if(typeof exports!=="undefined"){factory(exports)}else{factory(root.esprima={})}})(this,function(exports){"use strict";
var Token,TokenName,FnExprTokens,Syntax,PropertyKind,Messages,Regex,SyntaxTreeDelegate,source,strict,index,lineNumber,lineStart,length,delegate,lookahead,state,extra;Token={BooleanLiteral:1,EOF:2,Identifier:3,Keyword:4,NullLiteral:5,NumericLiteral:6,Punctuator:7,StringLiteral:8,RegularExpression:9};
TokenName={};TokenName[Token.BooleanLiteral]="Boolean";TokenName[Token.EOF]="<end>";TokenName[Token.Identifier]="Identifier";TokenName[Token.Keyword]="Keyword";TokenName[Token.NullLiteral]="Null";TokenName[Token.NumericLiteral]="Numeric";
TokenName[Token.Punctuator]="Punctuator";TokenName[Token.StringLiteral]="String";TokenName[Token.RegularExpression]="RegularExpression";FnExprTokens=["(","{","[","in","typeof","instanceof","new","return","case","delete","throw","void","=","+=","-=","*=","/=","%=","<<=",">>=",">>>=","&=","|=","^=",",","+","-","*","/","%","++","--","<<",">>",">>>","&","|","^","!","~","&&","||","?",":","===","==",">=","<=","<",">","!=","!=="];
Syntax={AssignmentExpression:"AssignmentExpression",ArrayExpression:"ArrayExpression",BlockStatement:"BlockStatement",BinaryExpression:"BinaryExpression",BreakStatement:"BreakStatement",CallExpression:"CallExpression",CatchClause:"CatchClause",ConditionalExpression:"ConditionalExpression",ContinueStatement:"ContinueStatement",DoWhileStatement:"DoWhileStatement",DebuggerStatement:"DebuggerStatement",EmptyStatement:"EmptyStatement",ExpressionStatement:"ExpressionStatement",ForStatement:"ForStatement",ForInStatement:"ForInStatement",FunctionDeclaration:"FunctionDeclaration",FunctionExpression:"FunctionExpression",Identifier:"Identifier",IfStatement:"IfStatement",Literal:"Literal",LabeledStatement:"LabeledStatement",LogicalExpression:"LogicalExpression",MemberExpression:"MemberExpression",NewExpression:"NewExpression",ObjectExpression:"ObjectExpression",Program:"Program",Property:"Property",ReturnStatement:"ReturnStatement",SequenceExpression:"SequenceExpression",SwitchStatement:"SwitchStatement",SwitchCase:"SwitchCase",ThisExpression:"ThisExpression",ThrowStatement:"ThrowStatement",TryStatement:"TryStatement",UnaryExpression:"UnaryExpression",UpdateExpression:"UpdateExpression",VariableDeclaration:"VariableDeclaration",VariableDeclarator:"VariableDeclarator",WhileStatement:"WhileStatement",WithStatement:"WithStatement"};
PropertyKind={Data:1,Get:2,Set:4};Messages={UnexpectedToken:"Unexpected token %0",UnexpectedNumber:"Unexpected number",UnexpectedString:"Unexpected string",UnexpectedIdentifier:"Unexpected identifier",UnexpectedReserved:"Unexpected reserved word",UnexpectedEOS:"Unexpected end of input",NewlineAfterThrow:"Illegal newline after throw",InvalidRegExp:"Invalid regular expression",UnterminatedRegExp:"Invalid regular expression: missing /",InvalidLHSInAssignment:"Invalid left-hand side in assignment",InvalidLHSInForIn:"Invalid left-hand side in for-in",MultipleDefaultsInSwitch:"More than one default clause in switch statement",NoCatchOrFinally:"Missing catch or finally after try",UnknownLabel:"Undefined label '%0'",Redeclaration:"%0 '%1' has already been declared",IllegalContinue:"Illegal continue statement",IllegalBreak:"Illegal break statement",IllegalReturn:"Illegal return statement",StrictModeWith:"Strict mode code may not include a with statement",StrictCatchVariable:"Catch variable may not be eval or arguments in strict mode",StrictVarName:"Variable name may not be eval or arguments in strict mode",StrictParamName:"Parameter name eval or arguments is not allowed in strict mode",StrictParamDupe:"Strict mode function may not have duplicate parameter names",StrictFunctionName:"Function name may not be eval or arguments in strict mode",StrictOctalLiteral:"Octal literals are not allowed in strict mode.",StrictDelete:"Delete of an unqualified identifier in strict mode.",StrictDuplicateProperty:"Duplicate data property in object literal not allowed in strict mode",AccessorDataProperty:"Object literal may not have data and accessor property with the same name",AccessorGetSet:"Object literal may not have multiple get/set accessors with the same name",StrictLHSAssignment:"Assignment to eval or arguments is not allowed in strict mode",StrictLHSPostfix:"Postfix increment/decrement may not have eval or arguments operand in strict mode",StrictLHSPrefix:"Prefix increment/decrement may not have eval or arguments operand in strict mode",StrictReservedWord:"Use of future reserved word in strict mode"};
Regex={NonAsciiIdentifierStart:new RegExp("[\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]"),NonAsciiIdentifierPart:new RegExp("[\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0300-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u0483-\u0487\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea\u05f0-\u05f2\u0610-\u061a\u0620-\u0669\u066e-\u06d3\u06d5-\u06dc\u06df-\u06e8\u06ea-\u06fc\u06ff\u0710-\u074a\u074d-\u07b1\u07c0-\u07f5\u07fa\u0800-\u082d\u0840-\u085b\u08a0\u08a2-\u08ac\u08e4-\u08fe\u0900-\u0963\u0966-\u096f\u0971-\u0977\u0979-\u097f\u0981-\u0983\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bc-\u09c4\u09c7\u09c8\u09cb-\u09ce\u09d7\u09dc\u09dd\u09df-\u09e3\u09e6-\u09f1\u0a01-\u0a03\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a59-\u0a5c\u0a5e\u0a66-\u0a75\u0a81-\u0a83\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abc-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ad0\u0ae0-\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3c-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b5c\u0b5d\u0b5f-\u0b63\u0b66-\u0b6f\u0b71\u0b82\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd0\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c58\u0c59\u0c60-\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbc-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0cde\u0ce0-\u0ce3\u0ce6-\u0cef\u0cf1\u0cf2\u0d02\u0d03\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d-\u0d44\u0d46-\u0d48\u0d4a-\u0d4e\u0d57\u0d60-\u0d63\u0d66-\u0d6f\u0d7a-\u0d7f\u0d82\u0d83\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e01-\u0e3a\u0e40-\u0e4e\u0e50-\u0e59\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb9\u0ebb-\u0ebd\u0ec0-\u0ec4\u0ec6\u0ec8-\u0ecd\u0ed0-\u0ed9\u0edc-\u0edf\u0f00\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e-\u0f47\u0f49-\u0f6c\u0f71-\u0f84\u0f86-\u0f97\u0f99-\u0fbc\u0fc6\u1000-\u1049\u1050-\u109d\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u135d-\u135f\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176c\u176e-\u1770\u1772\u1773\u1780-\u17d3\u17d7\u17dc\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u1820-\u1877\u1880-\u18aa\u18b0-\u18f5\u1900-\u191c\u1920-\u192b\u1930-\u193b\u1946-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u19d0-\u19d9\u1a00-\u1a1b\u1a20-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1aa7\u1b00-\u1b4b\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1bf3\u1c00-\u1c37\u1c40-\u1c49\u1c4d-\u1c7d\u1cd0-\u1cd2\u1cd4-\u1cf6\u1d00-\u1de6\u1dfc-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u200c\u200d\u203f\u2040\u2054\u2071\u207f\u2090-\u209c\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d7f-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2de0-\u2dff\u2e2f\u3005-\u3007\u3021-\u302f\u3031-\u3035\u3038-\u303c\u3041-\u3096\u3099\u309a\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua62b\ua640-\ua66f\ua674-\ua67d\ua67f-\ua697\ua69f-\ua6f1\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua827\ua840-\ua873\ua880-\ua8c4\ua8d0-\ua8d9\ua8e0-\ua8f7\ua8fb\ua900-\ua92d\ua930-\ua953\ua960-\ua97c\ua980-\ua9c0\ua9cf-\ua9d9\uaa00-\uaa36\uaa40-\uaa4d\uaa50-\uaa59\uaa60-\uaa76\uaa7a\uaa7b\uaa80-\uaac2\uaadb-\uaadd\uaae0-\uaaef\uaaf2-\uaaf6\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabea\uabec\uabed\uabf0-\uabf9\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff3f\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]")};
function assert(condition,message){if(!condition){throw new Error("ASSERT: "+message)}}function isDecimalDigit(ch){return ch>=48&&ch<=57}function isHexDigit(ch){return"0123456789abcdefABCDEF".indexOf(ch)>=0
}function isOctalDigit(ch){return"01234567".indexOf(ch)>=0}function isWhiteSpace(ch){return ch===32||ch===9||ch===11||ch===12||ch===160||ch>=5760&&"\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\ufeff".indexOf(String.fromCharCode(ch))>0
}function isLineTerminator(ch){return ch===10||ch===13||ch===8232||ch===8233}function isIdentifierStart(ch){return ch===36||ch===95||ch>=65&&ch<=90||ch>=97&&ch<=122||ch===92||ch>=128&&Regex.NonAsciiIdentifierStart.test(String.fromCharCode(ch))
}function isIdentifierPart(ch){return ch===36||ch===95||ch>=65&&ch<=90||ch>=97&&ch<=122||ch>=48&&ch<=57||ch===92||ch>=128&&Regex.NonAsciiIdentifierPart.test(String.fromCharCode(ch))}function isFutureReservedWord(id){switch(id){case"class":case"enum":case"export":case"extends":case"import":case"super":return true;
default:return false}}function isStrictModeReservedWord(id){switch(id){case"implements":case"interface":case"package":case"private":case"protected":case"public":case"static":case"yield":case"let":return true;
default:return false}}function isRestrictedWord(id){return id==="eval"||id==="arguments"}function isKeyword(id){if(strict&&isStrictModeReservedWord(id)){return true}switch(id.length){case 2:return id==="if"||id==="in"||id==="do";
case 3:return id==="var"||id==="for"||id==="new"||id==="try"||id==="let";case 4:return id==="this"||id==="else"||id==="case"||id==="void"||id==="with"||id==="enum";case 5:return id==="while"||id==="break"||id==="catch"||id==="throw"||id==="const"||id==="yield"||id==="class"||id==="super";
case 6:return id==="return"||id==="typeof"||id==="delete"||id==="switch"||id==="export"||id==="import";case 7:return id==="default"||id==="finally"||id==="extends";case 8:return id==="function"||id==="continue"||id==="debugger";
case 10:return id==="instanceof";default:return false}}function skipComment(){var ch,blockComment,lineComment;blockComment=false;lineComment=false;while(index<length){ch=source.charCodeAt(index);if(lineComment){++index;
if(isLineTerminator(ch)){lineComment=false;if(ch===13&&source.charCodeAt(index)===10){++index}++lineNumber;lineStart=index}}else if(blockComment){if(isLineTerminator(ch)){if(ch===13&&source.charCodeAt(index+1)===10){++index
}++lineNumber;++index;lineStart=index;if(index>=length){throwError({},Messages.UnexpectedToken,"ILLEGAL")}}else{ch=source.charCodeAt(index++);if(index>=length){throwError({},Messages.UnexpectedToken,"ILLEGAL")
}if(ch===42){ch=source.charCodeAt(index);if(ch===47){++index;blockComment=false}}}}else if(ch===47){ch=source.charCodeAt(index+1);if(ch===47){index+=2;lineComment=true}else if(ch===42){index+=2;blockComment=true;
if(index>=length){throwError({},Messages.UnexpectedToken,"ILLEGAL")}}else{break}}else if(isWhiteSpace(ch)){++index}else if(isLineTerminator(ch)){++index;if(ch===13&&source.charCodeAt(index)===10){++index
}++lineNumber;lineStart=index}else{break}}}function scanHexEscape(prefix){var i,len,ch,code=0;len=prefix==="u"?4:2;for(i=0;i<len;++i){if(index<length&&isHexDigit(source[index])){ch=source[index++];code=code*16+"0123456789abcdef".indexOf(ch.toLowerCase())
}else{return""}}return String.fromCharCode(code)}function getEscapedIdentifier(){var ch,id;ch=source.charCodeAt(index++);id=String.fromCharCode(ch);if(ch===92){if(source.charCodeAt(index)!==117){throwError({},Messages.UnexpectedToken,"ILLEGAL")
}++index;ch=scanHexEscape("u");if(!ch||ch==="\\"||!isIdentifierStart(ch.charCodeAt(0))){throwError({},Messages.UnexpectedToken,"ILLEGAL")}id=ch}while(index<length){ch=source.charCodeAt(index);if(!isIdentifierPart(ch)){break
}++index;id+=String.fromCharCode(ch);if(ch===92){id=id.substr(0,id.length-1);if(source.charCodeAt(index)!==117){throwError({},Messages.UnexpectedToken,"ILLEGAL")}++index;ch=scanHexEscape("u");if(!ch||ch==="\\"||!isIdentifierPart(ch.charCodeAt(0))){throwError({},Messages.UnexpectedToken,"ILLEGAL")
}id+=ch}}return id}function getIdentifier(){var start,ch;start=index++;while(index<length){ch=source.charCodeAt(index);if(ch===92){index=start;return getEscapedIdentifier()}if(isIdentifierPart(ch)){++index
}else{break}}return source.slice(start,index)}function scanIdentifier(){var start,id,type;start=index;id=source.charCodeAt(index)===92?getEscapedIdentifier():getIdentifier();if(id.length===1){type=Token.Identifier
}else if(isKeyword(id)){type=Token.Keyword}else if(id==="null"){type=Token.NullLiteral}else if(id==="true"||id==="false"){type=Token.BooleanLiteral}else{type=Token.Identifier}return{type:type,value:id,lineNumber:lineNumber,lineStart:lineStart,range:[start,index]}
}function scanPunctuator(){var start=index,code=source.charCodeAt(index),code2,ch1=source[index],ch2,ch3,ch4;switch(code){case 46:case 40:case 41:case 59:case 44:case 123:case 125:case 91:case 93:case 58:case 63:case 126:++index;
if(extra.tokenize){if(code===40){extra.openParenToken=extra.tokens.length}else if(code===123){extra.openCurlyToken=extra.tokens.length}}return{type:Token.Punctuator,value:String.fromCharCode(code),lineNumber:lineNumber,lineStart:lineStart,range:[start,index]};
default:code2=source.charCodeAt(index+1);if(code2===61){switch(code){case 37:case 38:case 42:case 43:case 45:case 47:case 60:case 62:case 94:case 124:index+=2;return{type:Token.Punctuator,value:String.fromCharCode(code)+String.fromCharCode(code2),lineNumber:lineNumber,lineStart:lineStart,range:[start,index]};
case 33:case 61:index+=2;if(source.charCodeAt(index)===61){++index}return{type:Token.Punctuator,value:source.slice(start,index),lineNumber:lineNumber,lineStart:lineStart,range:[start,index]};default:break
}}break}ch2=source[index+1];ch3=source[index+2];ch4=source[index+3];if(ch1===">"&&ch2===">"&&ch3===">"){if(ch4==="="){index+=4;return{type:Token.Punctuator,value:">>>=",lineNumber:lineNumber,lineStart:lineStart,range:[start,index]}
}}if(ch1===">"&&ch2===">"&&ch3===">"){index+=3;return{type:Token.Punctuator,value:">>>",lineNumber:lineNumber,lineStart:lineStart,range:[start,index]}}if(ch1==="<"&&ch2==="<"&&ch3==="="){index+=3;return{type:Token.Punctuator,value:"<<=",lineNumber:lineNumber,lineStart:lineStart,range:[start,index]}
}if(ch1===">"&&ch2===">"&&ch3==="="){index+=3;return{type:Token.Punctuator,value:">>=",lineNumber:lineNumber,lineStart:lineStart,range:[start,index]}}if(ch1===ch2&&"+-<>&|".indexOf(ch1)>=0){index+=2;return{type:Token.Punctuator,value:ch1+ch2,lineNumber:lineNumber,lineStart:lineStart,range:[start,index]}
}if("<>=!+-*%&|^/".indexOf(ch1)>=0){++index;return{type:Token.Punctuator,value:ch1,lineNumber:lineNumber,lineStart:lineStart,range:[start,index]}}throwError({},Messages.UnexpectedToken,"ILLEGAL")}function scanHexLiteral(start){var number="";
while(index<length){if(!isHexDigit(source[index])){break}number+=source[index++]}if(number.length===0){throwError({},Messages.UnexpectedToken,"ILLEGAL")}if(isIdentifierStart(source.charCodeAt(index))){throwError({},Messages.UnexpectedToken,"ILLEGAL")
}return{type:Token.NumericLiteral,value:parseInt("0x"+number,16),lineNumber:lineNumber,lineStart:lineStart,range:[start,index]}}function scanOctalLiteral(start){var number="0"+source[index++];while(index<length){if(!isOctalDigit(source[index])){break
}number+=source[index++]}if(isIdentifierStart(source.charCodeAt(index))||isDecimalDigit(source.charCodeAt(index))){throwError({},Messages.UnexpectedToken,"ILLEGAL")}return{type:Token.NumericLiteral,value:parseInt(number,8),octal:true,lineNumber:lineNumber,lineStart:lineStart,range:[start,index]}
}function scanNumericLiteral(){var number,start,ch;ch=source[index];assert(isDecimalDigit(ch.charCodeAt(0))||ch===".","Numeric literal must start with a decimal digit or a decimal point");start=index;number="";
if(ch!=="."){number=source[index++];ch=source[index];if(number==="0"){if(ch==="x"||ch==="X"){++index;return scanHexLiteral(start)}if(isOctalDigit(ch)){return scanOctalLiteral(start)}if(ch&&isDecimalDigit(ch.charCodeAt(0))){throwError({},Messages.UnexpectedToken,"ILLEGAL")
}}while(isDecimalDigit(source.charCodeAt(index))){number+=source[index++]}ch=source[index]}if(ch==="."){number+=source[index++];while(isDecimalDigit(source.charCodeAt(index))){number+=source[index++]}ch=source[index]
}if(ch==="e"||ch==="E"){number+=source[index++];ch=source[index];if(ch==="+"||ch==="-"){number+=source[index++]}if(isDecimalDigit(source.charCodeAt(index))){while(isDecimalDigit(source.charCodeAt(index))){number+=source[index++]
}}else{throwError({},Messages.UnexpectedToken,"ILLEGAL")}}if(isIdentifierStart(source.charCodeAt(index))){throwError({},Messages.UnexpectedToken,"ILLEGAL")}return{type:Token.NumericLiteral,value:parseFloat(number),lineNumber:lineNumber,lineStart:lineStart,range:[start,index]}
}function scanStringLiteral(){var str="",quote,start,ch,code,unescaped,restore,octal=false;quote=source[index];assert(quote==="'"||quote==='"',"String literal must starts with a quote");start=index;++index;
while(index<length){ch=source[index++];if(ch===quote){quote="";break}else if(ch==="\\"){ch=source[index++];if(!ch||!isLineTerminator(ch.charCodeAt(0))){switch(ch){case"n":str+="\n";break;case"r":str+="\r";
break;case"t":str+="	";break;case"u":case"x":restore=index;unescaped=scanHexEscape(ch);if(unescaped){str+=unescaped}else{index=restore;str+=ch}break;case"b":str+="\b";break;case"f":str+="\f";break;case"v":str+="";
break;default:if(isOctalDigit(ch)){code="01234567".indexOf(ch);if(code!==0){octal=true}if(index<length&&isOctalDigit(source[index])){octal=true;code=code*8+"01234567".indexOf(source[index++]);if("0123".indexOf(ch)>=0&&index<length&&isOctalDigit(source[index])){code=code*8+"01234567".indexOf(source[index++])
}}str+=String.fromCharCode(code)}else{str+=ch}break}}else{++lineNumber;if(ch==="\r"&&source[index]==="\n"){++index}}}else if(isLineTerminator(ch.charCodeAt(0))){break}else{str+=ch}}if(quote!==""){throwError({},Messages.UnexpectedToken,"ILLEGAL")
}return{type:Token.StringLiteral,value:str,octal:octal,lineNumber:lineNumber,lineStart:lineStart,range:[start,index]}}function scanRegExp(){var str,ch,start,pattern,flags,value,classMarker=false,restore,terminated=false;
lookahead=null;skipComment();start=index;ch=source[index];assert(ch==="/","Regular expression literal must start with a slash");str=source[index++];while(index<length){ch=source[index++];str+=ch;if(classMarker){if(ch==="]"){classMarker=false
}}else{if(ch==="\\"){ch=source[index++];if(isLineTerminator(ch.charCodeAt(0))){throwError({},Messages.UnterminatedRegExp)}str+=ch}else if(ch==="/"){terminated=true;break}else if(ch==="["){classMarker=true
}else if(isLineTerminator(ch.charCodeAt(0))){throwError({},Messages.UnterminatedRegExp)}}}if(!terminated){throwError({},Messages.UnterminatedRegExp)}pattern=str.substr(1,str.length-2);flags="";while(index<length){ch=source[index];
if(!isIdentifierPart(ch.charCodeAt(0))){break}++index;if(ch==="\\"&&index<length){ch=source[index];if(ch==="u"){++index;restore=index;ch=scanHexEscape("u");if(ch){flags+=ch;for(str+="\\u";restore<index;++restore){str+=source[restore]
}}else{index=restore;flags+="u";str+="\\u"}}else{str+="\\"}}else{flags+=ch;str+=ch}}try{value=new RegExp(pattern,flags)}catch(e){throwError({},Messages.InvalidRegExp)}peek();if(extra.tokenize){return{type:Token.RegularExpression,value:value,lineNumber:lineNumber,lineStart:lineStart,range:[start,index]}
}return{literal:str,value:value,range:[start,index]}}function isIdentifierName(token){return token.type===Token.Identifier||token.type===Token.Keyword||token.type===Token.BooleanLiteral||token.type===Token.NullLiteral
}function advanceSlash(){var prevToken,checkToken;prevToken=extra.tokens[extra.tokens.length-1];if(!prevToken){return scanRegExp()}if(prevToken.type==="Punctuator"){if(prevToken.value===")"){checkToken=extra.tokens[extra.openParenToken-1];
if(checkToken&&checkToken.type==="Keyword"&&(checkToken.value==="if"||checkToken.value==="while"||checkToken.value==="for"||checkToken.value==="with")){return scanRegExp()}return scanPunctuator()}if(prevToken.value==="}"){if(extra.tokens[extra.openCurlyToken-3]&&extra.tokens[extra.openCurlyToken-3].type==="Keyword"){checkToken=extra.tokens[extra.openCurlyToken-4];
if(!checkToken){return scanPunctuator()}}else if(extra.tokens[extra.openCurlyToken-4]&&extra.tokens[extra.openCurlyToken-4].type==="Keyword"){checkToken=extra.tokens[extra.openCurlyToken-5];if(!checkToken){return scanRegExp()
}}else{return scanPunctuator()}if(FnExprTokens.indexOf(checkToken.value)>=0){return scanPunctuator()}return scanRegExp()}return scanRegExp()}if(prevToken.type==="Keyword"){return scanRegExp()}return scanPunctuator()
}function advance(){var ch;skipComment();if(index>=length){return{type:Token.EOF,lineNumber:lineNumber,lineStart:lineStart,range:[index,index]}}ch=source.charCodeAt(index);if(ch===40||ch===41||ch===58){return scanPunctuator()
}if(ch===39||ch===34){return scanStringLiteral()}if(isIdentifierStart(ch)){return scanIdentifier()}if(ch===46){if(isDecimalDigit(source.charCodeAt(index+1))){return scanNumericLiteral()}return scanPunctuator()
}if(isDecimalDigit(ch)){return scanNumericLiteral()}if(extra.tokenize&&ch===47){return advanceSlash()}return scanPunctuator()}function lex(){var token;token=lookahead;index=token.range[1];lineNumber=token.lineNumber;
lineStart=token.lineStart;lookahead=advance();index=token.range[1];lineNumber=token.lineNumber;lineStart=token.lineStart;return token}function peek(){var pos,line,start;pos=index;line=lineNumber;start=lineStart;
lookahead=advance();index=pos;lineNumber=line;lineStart=start}SyntaxTreeDelegate={name:"SyntaxTree",markStart:function(){},markEnd:function(node){return node},markGroupEnd:function(node){return node},postProcess:function(node){return node
},createArrayExpression:function(elements){return{type:Syntax.ArrayExpression,elements:elements}},createAssignmentExpression:function(operator,left,right){return{type:Syntax.AssignmentExpression,operator:operator,left:left,right:right}
},createBinaryExpression:function(operator,left,right){var type=operator==="||"||operator==="&&"?Syntax.LogicalExpression:Syntax.BinaryExpression;return{type:type,operator:operator,left:left,right:right}
},createBlockStatement:function(body){return{type:Syntax.BlockStatement,body:body}},createBreakStatement:function(label){return{type:Syntax.BreakStatement,label:label}},createCallExpression:function(callee,args){return{type:Syntax.CallExpression,callee:callee,arguments:args}
},createCatchClause:function(param,body){return{type:Syntax.CatchClause,param:param,body:body}},createConditionalExpression:function(test,consequent,alternate){return{type:Syntax.ConditionalExpression,test:test,consequent:consequent,alternate:alternate}
},createContinueStatement:function(label){return{type:Syntax.ContinueStatement,label:label}},createDebuggerStatement:function(){return{type:Syntax.DebuggerStatement}},createDoWhileStatement:function(body,test){return{type:Syntax.DoWhileStatement,body:body,test:test}
},createEmptyStatement:function(){return{type:Syntax.EmptyStatement}},createExpressionStatement:function(expression){return{type:Syntax.ExpressionStatement,expression:expression}},createForStatement:function(init,test,update,body){return{type:Syntax.ForStatement,init:init,test:test,update:update,body:body}
},createForInStatement:function(left,right,body){return{type:Syntax.ForInStatement,left:left,right:right,body:body,each:false}},createFunctionDeclaration:function(id,params,defaults,body){return{type:Syntax.FunctionDeclaration,id:id,params:params,defaults:defaults,body:body,rest:null,generator:false,expression:false}
},createFunctionExpression:function(id,params,defaults,body){return{type:Syntax.FunctionExpression,id:id,params:params,defaults:defaults,body:body,rest:null,generator:false,expression:false}},createIdentifier:function(name){return{type:Syntax.Identifier,name:name}
},createIfStatement:function(test,consequent,alternate){return{type:Syntax.IfStatement,test:test,consequent:consequent,alternate:alternate}},createLabeledStatement:function(label,body){return{type:Syntax.LabeledStatement,label:label,body:body}
},createLiteral:function(token){return{type:Syntax.Literal,value:token.value,raw:source.slice(token.range[0],token.range[1])}},createMemberExpression:function(accessor,object,property){return{type:Syntax.MemberExpression,computed:accessor==="[",object:object,property:property}
},createNewExpression:function(callee,args){return{type:Syntax.NewExpression,callee:callee,arguments:args}},createObjectExpression:function(properties){return{type:Syntax.ObjectExpression,properties:properties}
},createPostfixExpression:function(operator,argument){return{type:Syntax.UpdateExpression,operator:operator,argument:argument,prefix:false}},createProgram:function(body){return{type:Syntax.Program,body:body}
},createProperty:function(kind,key,value){return{type:Syntax.Property,key:key,value:value,kind:kind}},createReturnStatement:function(argument){return{type:Syntax.ReturnStatement,argument:argument}},createSequenceExpression:function(expressions){return{type:Syntax.SequenceExpression,expressions:expressions}
},createSwitchCase:function(test,consequent){return{type:Syntax.SwitchCase,test:test,consequent:consequent}},createSwitchStatement:function(discriminant,cases){return{type:Syntax.SwitchStatement,discriminant:discriminant,cases:cases}
},createThisExpression:function(){return{type:Syntax.ThisExpression}},createThrowStatement:function(argument){return{type:Syntax.ThrowStatement,argument:argument}},createTryStatement:function(block,guardedHandlers,handlers,finalizer){return{type:Syntax.TryStatement,block:block,guardedHandlers:guardedHandlers,handlers:handlers,finalizer:finalizer}
},createUnaryExpression:function(operator,argument){if(operator==="++"||operator==="--"){return{type:Syntax.UpdateExpression,operator:operator,argument:argument,prefix:true}}return{type:Syntax.UnaryExpression,operator:operator,argument:argument}
},createVariableDeclaration:function(declarations,kind){return{type:Syntax.VariableDeclaration,declarations:declarations,kind:kind}},createVariableDeclarator:function(id,init){return{type:Syntax.VariableDeclarator,id:id,init:init}
},createWhileStatement:function(test,body){return{type:Syntax.WhileStatement,test:test,body:body}},createWithStatement:function(object,body){return{type:Syntax.WithStatement,object:object,body:body}}};
function peekLineTerminator(){var pos,line,start,found;pos=index;line=lineNumber;start=lineStart;skipComment();found=lineNumber!==line;index=pos;lineNumber=line;lineStart=start;return found}function throwError(token,messageFormat){var error,args=Array.prototype.slice.call(arguments,2),msg=messageFormat.replace(/%(\d)/g,function(whole,index){assert(index<args.length,"Message reference must be in range");
return args[index]});if(typeof token.lineNumber==="number"){error=new Error("Line "+token.lineNumber+": "+msg);error.index=token.range[0];error.lineNumber=token.lineNumber;error.column=token.range[0]-lineStart+1
}else{error=new Error("Line "+lineNumber+": "+msg);error.index=index;error.lineNumber=lineNumber;error.column=index-lineStart+1}error.description=msg;throw error}function throwErrorTolerant(){try{throwError.apply(null,arguments)
}catch(e){if(extra.errors){extra.errors.push(e)}else{throw e}}}function throwUnexpected(token){if(token.type===Token.EOF){throwError(token,Messages.UnexpectedEOS)}if(token.type===Token.NumericLiteral){throwError(token,Messages.UnexpectedNumber)
}if(token.type===Token.StringLiteral){throwError(token,Messages.UnexpectedString)}if(token.type===Token.Identifier){throwError(token,Messages.UnexpectedIdentifier)}if(token.type===Token.Keyword){if(isFutureReservedWord(token.value)){throwError(token,Messages.UnexpectedReserved)
}else if(strict&&isStrictModeReservedWord(token.value)){throwErrorTolerant(token,Messages.StrictReservedWord);return}throwError(token,Messages.UnexpectedToken,token.value)}throwError(token,Messages.UnexpectedToken,token.value)
}function expect(value){var token=lex();if(token.type!==Token.Punctuator||token.value!==value){throwUnexpected(token)}}function expectKeyword(keyword){var token=lex();if(token.type!==Token.Keyword||token.value!==keyword){throwUnexpected(token)
}}function match(value){return lookahead.type===Token.Punctuator&&lookahead.value===value}function matchKeyword(keyword){return lookahead.type===Token.Keyword&&lookahead.value===keyword}function matchAssign(){var op;
if(lookahead.type!==Token.Punctuator){return false}op=lookahead.value;return op==="="||op==="*="||op==="/="||op==="%="||op==="+="||op==="-="||op==="<<="||op===">>="||op===">>>="||op==="&="||op==="^="||op==="|="
}function consumeSemicolon(){var line;if(source.charCodeAt(index)===59){lex();return}line=lineNumber;skipComment();if(lineNumber!==line){return}if(match(";")){lex();return}if(lookahead.type!==Token.EOF&&!match("}")){throwUnexpected(lookahead)
}}function isLeftHandSide(expr){return expr.type===Syntax.Identifier||expr.type===Syntax.MemberExpression}function parseArrayInitialiser(){var elements=[];expect("[");while(!match("]")){if(match(",")){lex();
elements.push(null)}else{elements.push(parseAssignmentExpression());if(!match("]")){expect(",")}}}expect("]");return delegate.createArrayExpression(elements)}function parsePropertyFunction(param,first){var previousStrict,body;
previousStrict=strict;delegate.markStart();body=parseFunctionSourceElements();if(first&&strict&&isRestrictedWord(param[0].name)){throwErrorTolerant(first,Messages.StrictParamName)}strict=previousStrict;
return delegate.markEnd(delegate.createFunctionExpression(null,param,[],body))}function parseObjectPropertyKey(){var token;delegate.markStart();token=lex();if(token.type===Token.StringLiteral||token.type===Token.NumericLiteral){if(strict&&token.octal){throwErrorTolerant(token,Messages.StrictOctalLiteral)
}return delegate.markEnd(delegate.createLiteral(token))}return delegate.markEnd(delegate.createIdentifier(token.value))}function parseObjectProperty(){var token,key,id,value,param;token=lookahead;delegate.markStart();
if(token.type===Token.Identifier){id=parseObjectPropertyKey();if(token.value==="get"&&!match(":")){key=parseObjectPropertyKey();expect("(");expect(")");value=parsePropertyFunction([]);return delegate.markEnd(delegate.createProperty("get",key,value))
}if(token.value==="set"&&!match(":")){key=parseObjectPropertyKey();expect("(");token=lookahead;if(token.type!==Token.Identifier){throwUnexpected(lex())}param=[parseVariableIdentifier()];expect(")");value=parsePropertyFunction(param,token);
return delegate.markEnd(delegate.createProperty("set",key,value))}expect(":");value=parseAssignmentExpression();return delegate.markEnd(delegate.createProperty("init",id,value))}if(token.type===Token.EOF||token.type===Token.Punctuator){throwUnexpected(token)
}else{key=parseObjectPropertyKey();expect(":");value=parseAssignmentExpression();return delegate.markEnd(delegate.createProperty("init",key,value))}}function parseObjectInitialiser(){var properties=[],property,name,key,kind,map={},toString=String;
expect("{");while(!match("}")){property=parseObjectProperty();if(property.key.type===Syntax.Identifier){name=property.key.name}else{name=toString(property.key.value)}kind=property.kind==="init"?PropertyKind.Data:property.kind==="get"?PropertyKind.Get:PropertyKind.Set;
key="$"+name;if(Object.prototype.hasOwnProperty.call(map,key)){if(map[key]===PropertyKind.Data){if(strict&&kind===PropertyKind.Data){throwErrorTolerant({},Messages.StrictDuplicateProperty)}else if(kind!==PropertyKind.Data){throwErrorTolerant({},Messages.AccessorDataProperty)
}}else{if(kind===PropertyKind.Data){throwErrorTolerant({},Messages.AccessorDataProperty)}else if(map[key]&kind){throwErrorTolerant({},Messages.AccessorGetSet)}}map[key]|=kind}else{map[key]=kind}properties.push(property);
if(!match("}")){expect(",")}}expect("}");return delegate.createObjectExpression(properties)}function parseGroupExpression(){var expr;delegate.markStart();expect("(");expr=parseExpression();expect(")");
return delegate.markGroupEnd(expr)}function parsePrimaryExpression(){var type,token,expr;if(match("(")){return parseGroupExpression()}type=lookahead.type;delegate.markStart();if(type===Token.Identifier){expr=delegate.createIdentifier(lex().value)
}else if(type===Token.StringLiteral||type===Token.NumericLiteral){if(strict&&lookahead.octal){throwErrorTolerant(lookahead,Messages.StrictOctalLiteral)}expr=delegate.createLiteral(lex())}else if(type===Token.Keyword){if(matchKeyword("this")){lex();
expr=delegate.createThisExpression()}else if(matchKeyword("function")){expr=parseFunctionExpression()}}else if(type===Token.BooleanLiteral){token=lex();token.value=token.value==="true";expr=delegate.createLiteral(token)
}else if(type===Token.NullLiteral){token=lex();token.value=null;expr=delegate.createLiteral(token)}else if(match("[")){expr=parseArrayInitialiser()}else if(match("{")){expr=parseObjectInitialiser()}else if(match("/")||match("/=")){expr=delegate.createLiteral(scanRegExp())
}if(expr){return delegate.markEnd(expr)}throwUnexpected(lex())}function parseArguments(){var args=[];expect("(");if(!match(")")){while(index<length){args.push(parseAssignmentExpression());if(match(")")){break
}expect(",")}}expect(")");return args}function parseNonComputedProperty(){var token;delegate.markStart();token=lex();if(!isIdentifierName(token)){throwUnexpected(token)}return delegate.markEnd(delegate.createIdentifier(token.value))
}function parseNonComputedMember(){expect(".");return parseNonComputedProperty()}function parseComputedMember(){var expr;expect("[");expr=parseExpression();expect("]");return expr}function parseNewExpression(){var callee,args;
delegate.markStart();expectKeyword("new");callee=parseLeftHandSideExpression();args=match("(")?parseArguments():[];return delegate.markEnd(delegate.createNewExpression(callee,args))}function parseLeftHandSideExpressionAllowCall(){var marker,expr,args,property;
marker=createLocationMarker();expr=matchKeyword("new")?parseNewExpression():parsePrimaryExpression();while(match(".")||match("[")||match("(")){if(match("(")){args=parseArguments();expr=delegate.createCallExpression(expr,args)
}else if(match("[")){property=parseComputedMember();expr=delegate.createMemberExpression("[",expr,property)}else{property=parseNonComputedMember();expr=delegate.createMemberExpression(".",expr,property)
}if(marker){marker.end();marker.apply(expr)}}return expr}function parseLeftHandSideExpression(){var marker,expr,property;marker=createLocationMarker();expr=matchKeyword("new")?parseNewExpression():parsePrimaryExpression();
while(match(".")||match("[")){if(match("[")){property=parseComputedMember();expr=delegate.createMemberExpression("[",expr,property)}else{property=parseNonComputedMember();expr=delegate.createMemberExpression(".",expr,property)
}if(marker){marker.end();marker.apply(expr)}}return expr}function parsePostfixExpression(){var marker,expr,token;marker=createLocationMarker();expr=parseLeftHandSideExpressionAllowCall();if(lookahead.type===Token.Punctuator){if((match("++")||match("--"))&&!peekLineTerminator()){if(strict&&expr.type===Syntax.Identifier&&isRestrictedWord(expr.name)){throwErrorTolerant({},Messages.StrictLHSPostfix)
}if(!isLeftHandSide(expr)){throwError({},Messages.InvalidLHSInAssignment)}token=lex();expr=delegate.createPostfixExpression(token.value,expr)}}if(marker){marker.end();return marker.applyIf(expr)}return expr
}function parseUnaryExpression(){var marker,token,expr;marker=createLocationMarker();if(lookahead.type!==Token.Punctuator&&lookahead.type!==Token.Keyword){expr=parsePostfixExpression()}else if(match("++")||match("--")){token=lex();
expr=parseUnaryExpression();if(strict&&expr.type===Syntax.Identifier&&isRestrictedWord(expr.name)){throwErrorTolerant({},Messages.StrictLHSPrefix)}if(!isLeftHandSide(expr)){throwError({},Messages.InvalidLHSInAssignment)
}expr=delegate.createUnaryExpression(token.value,expr)}else if(match("+")||match("-")||match("~")||match("!")){token=lex();expr=parseUnaryExpression();expr=delegate.createUnaryExpression(token.value,expr)
}else if(matchKeyword("delete")||matchKeyword("void")||matchKeyword("typeof")){token=lex();expr=parseUnaryExpression();expr=delegate.createUnaryExpression(token.value,expr);if(strict&&expr.operator==="delete"&&expr.argument.type===Syntax.Identifier){throwErrorTolerant({},Messages.StrictDelete)
}}else{expr=parsePostfixExpression()}if(marker){marker.end();expr=marker.applyIf(expr)}return expr}function binaryPrecedence(token,allowIn){var prec=0;if(token.type!==Token.Punctuator&&token.type!==Token.Keyword){return 0
}switch(token.value){case"||":prec=1;break;case"&&":prec=2;break;case"|":prec=3;break;case"^":prec=4;break;case"&":prec=5;break;case"==":case"!=":case"===":case"!==":prec=6;break;case"<":case">":case"<=":case">=":case"instanceof":prec=7;
break;case"in":prec=allowIn?7:0;break;case"<<":case">>":case">>>":prec=8;break;case"+":case"-":prec=9;break;case"*":case"/":case"%":prec=11;break;default:break}return prec}function parseBinaryExpression(){var expr,token,prec,previousAllowIn,stack,right,operator,left,i;
previousAllowIn=state.allowIn;state.allowIn=true;expr=parseUnaryExpression();token=lookahead;prec=binaryPrecedence(token,previousAllowIn);if(prec===0){return expr}token.prec=prec;lex();stack=[expr,token,parseUnaryExpression()];
while((prec=binaryPrecedence(lookahead,previousAllowIn))>0){while(stack.length>2&&prec<=stack[stack.length-2].prec){right=stack.pop();operator=stack.pop().value;left=stack.pop();stack.push(delegate.createBinaryExpression(operator,left,right))
}token=lex();token.prec=prec;stack.push(token);stack.push(parseUnaryExpression())}state.allowIn=previousAllowIn;i=stack.length-1;expr=stack[i];while(i>1){expr=delegate.createBinaryExpression(stack[i-1].value,stack[i-2],expr);
i-=2}return expr}function parseConditionalExpression(){var expr,previousAllowIn,consequent,alternate;delegate.markStart();expr=parseBinaryExpression();if(match("?")){lex();previousAllowIn=state.allowIn;
state.allowIn=true;consequent=parseAssignmentExpression();state.allowIn=previousAllowIn;expect(":");alternate=parseAssignmentExpression();expr=delegate.markEnd(delegate.createConditionalExpression(expr,consequent,alternate))
}else{delegate.markEnd({})}return expr}function parseAssignmentExpression(){var token,marker,left,right,node;token=lookahead;marker=createLocationMarker();node=left=parseConditionalExpression();if(matchAssign()){if(!isLeftHandSide(left)){throwError({},Messages.InvalidLHSInAssignment)
}if(strict&&left.type===Syntax.Identifier&&isRestrictedWord(left.name)){throwErrorTolerant(token,Messages.StrictLHSAssignment)}token=lex();right=parseAssignmentExpression();node=delegate.createAssignmentExpression(token.value,left,right)
}if(marker){marker.end();return marker.applyIf(node)}return node}function parseExpression(){var marker,expr;marker=createLocationMarker();expr=parseAssignmentExpression();if(match(",")){expr=delegate.createSequenceExpression([expr]);
while(index<length){if(!match(",")){break}lex();expr.expressions.push(parseAssignmentExpression())}}if(marker){marker.end();return marker.applyIf(expr)}return expr}function parseStatementList(){var list=[],statement;
while(index<length){if(match("}")){break}statement=parseSourceElement();if(typeof statement==="undefined"){break}list.push(statement)}return list}function parseBlock(){var block;delegate.markStart();expect("{");
block=parseStatementList();expect("}");return delegate.markEnd(delegate.createBlockStatement(block))}function parseVariableIdentifier(){var token;delegate.markStart();token=lex();if(token.type!==Token.Identifier){throwUnexpected(token)
}return delegate.markEnd(delegate.createIdentifier(token.value))}function parseVariableDeclaration(kind){var init=null,id;delegate.markStart();id=parseVariableIdentifier();if(strict&&isRestrictedWord(id.name)){throwErrorTolerant({},Messages.StrictVarName)
}if(kind==="const"){expect("=");init=parseAssignmentExpression()}else if(match("=")){lex();init=parseAssignmentExpression()}return delegate.markEnd(delegate.createVariableDeclarator(id,init))}function parseVariableDeclarationList(kind){var list=[];
do{list.push(parseVariableDeclaration(kind));if(!match(",")){break}lex()}while(index<length);return list}function parseVariableStatement(){var declarations;expectKeyword("var");declarations=parseVariableDeclarationList();
consumeSemicolon();return delegate.createVariableDeclaration(declarations,"var")}function parseConstLetDeclaration(kind){var declarations;delegate.markStart();expectKeyword(kind);declarations=parseVariableDeclarationList(kind);
consumeSemicolon();return delegate.markEnd(delegate.createVariableDeclaration(declarations,kind))}function parseEmptyStatement(){expect(";");return delegate.createEmptyStatement()}function parseExpressionStatement(){var expr=parseExpression();
consumeSemicolon();return delegate.createExpressionStatement(expr)}function parseIfStatement(){var test,consequent,alternate;expectKeyword("if");expect("(");test=parseExpression();expect(")");consequent=parseStatement();
if(matchKeyword("else")){lex();alternate=parseStatement()}else{alternate=null}return delegate.createIfStatement(test,consequent,alternate)}function parseDoWhileStatement(){var body,test,oldInIteration;
expectKeyword("do");oldInIteration=state.inIteration;state.inIteration=true;body=parseStatement();state.inIteration=oldInIteration;expectKeyword("while");expect("(");test=parseExpression();expect(")");
if(match(";")){lex()}return delegate.createDoWhileStatement(body,test)}function parseWhileStatement(){var test,body,oldInIteration;expectKeyword("while");expect("(");test=parseExpression();expect(")");
oldInIteration=state.inIteration;state.inIteration=true;body=parseStatement();state.inIteration=oldInIteration;return delegate.createWhileStatement(test,body)}function parseForVariableDeclaration(){var token,declarations;
delegate.markStart();token=lex();declarations=parseVariableDeclarationList();return delegate.markEnd(delegate.createVariableDeclaration(declarations,token.value))}function parseForStatement(){var init,test,update,left,right,body,oldInIteration;
init=test=update=null;expectKeyword("for");expect("(");if(match(";")){lex()}else{if(matchKeyword("var")||matchKeyword("let")){state.allowIn=false;init=parseForVariableDeclaration();state.allowIn=true;if(init.declarations.length===1&&matchKeyword("in")){lex();
left=init;right=parseExpression();init=null}}else{state.allowIn=false;init=parseExpression();state.allowIn=true;if(matchKeyword("in")){if(!isLeftHandSide(init)){throwError({},Messages.InvalidLHSInForIn)
}lex();left=init;right=parseExpression();init=null}}if(typeof left==="undefined"){expect(";")}}if(typeof left==="undefined"){if(!match(";")){test=parseExpression()}expect(";");if(!match(")")){update=parseExpression()
}}expect(")");oldInIteration=state.inIteration;state.inIteration=true;body=parseStatement();state.inIteration=oldInIteration;return typeof left==="undefined"?delegate.createForStatement(init,test,update,body):delegate.createForInStatement(left,right,body)
}function parseContinueStatement(){var label=null,key;expectKeyword("continue");if(source.charCodeAt(index)===59){lex();if(!state.inIteration){throwError({},Messages.IllegalContinue)}return delegate.createContinueStatement(null)
}if(peekLineTerminator()){if(!state.inIteration){throwError({},Messages.IllegalContinue)}return delegate.createContinueStatement(null)}if(lookahead.type===Token.Identifier){label=parseVariableIdentifier();
key="$"+label.name;if(!Object.prototype.hasOwnProperty.call(state.labelSet,key)){throwError({},Messages.UnknownLabel,label.name)}}consumeSemicolon();if(label===null&&!state.inIteration){throwError({},Messages.IllegalContinue)
}return delegate.createContinueStatement(label)}function parseBreakStatement(){var label=null,key;expectKeyword("break");if(source.charCodeAt(index)===59){lex();if(!(state.inIteration||state.inSwitch)){throwError({},Messages.IllegalBreak)
}return delegate.createBreakStatement(null)}if(peekLineTerminator()){if(!(state.inIteration||state.inSwitch)){throwError({},Messages.IllegalBreak)}return delegate.createBreakStatement(null)}if(lookahead.type===Token.Identifier){label=parseVariableIdentifier();
key="$"+label.name;if(!Object.prototype.hasOwnProperty.call(state.labelSet,key)){throwError({},Messages.UnknownLabel,label.name)}}consumeSemicolon();if(label===null&&!(state.inIteration||state.inSwitch)){throwError({},Messages.IllegalBreak)
}return delegate.createBreakStatement(label)}function parseReturnStatement(){var argument=null;expectKeyword("return");if(!state.inFunctionBody){throwErrorTolerant({},Messages.IllegalReturn)}if(source.charCodeAt(index)===32){if(isIdentifierStart(source.charCodeAt(index+1))){argument=parseExpression();
consumeSemicolon();return delegate.createReturnStatement(argument)}}if(peekLineTerminator()){return delegate.createReturnStatement(null)}if(!match(";")){if(!match("}")&&lookahead.type!==Token.EOF){argument=parseExpression()
}}consumeSemicolon();return delegate.createReturnStatement(argument)}function parseWithStatement(){var object,body;if(strict){throwErrorTolerant({},Messages.StrictModeWith)}expectKeyword("with");expect("(");
object=parseExpression();expect(")");body=parseStatement();return delegate.createWithStatement(object,body)}function parseSwitchCase(){var test,consequent=[],statement;delegate.markStart();if(matchKeyword("default")){lex();
test=null}else{expectKeyword("case");test=parseExpression()}expect(":");while(index<length){if(match("}")||matchKeyword("default")||matchKeyword("case")){break}statement=parseStatement();consequent.push(statement)
}return delegate.markEnd(delegate.createSwitchCase(test,consequent))}function parseSwitchStatement(){var discriminant,cases,clause,oldInSwitch,defaultFound;expectKeyword("switch");expect("(");discriminant=parseExpression();
expect(")");expect("{");if(match("}")){lex();return delegate.createSwitchStatement(discriminant)}cases=[];oldInSwitch=state.inSwitch;state.inSwitch=true;defaultFound=false;while(index<length){if(match("}")){break
}clause=parseSwitchCase();if(clause.test===null){if(defaultFound){throwError({},Messages.MultipleDefaultsInSwitch)}defaultFound=true}cases.push(clause)}state.inSwitch=oldInSwitch;expect("}");return delegate.createSwitchStatement(discriminant,cases)
}function parseThrowStatement(){var argument;expectKeyword("throw");if(peekLineTerminator()){throwError({},Messages.NewlineAfterThrow)}argument=parseExpression();consumeSemicolon();return delegate.createThrowStatement(argument)
}function parseCatchClause(){var param,body;delegate.markStart();expectKeyword("catch");expect("(");if(match(")")){throwUnexpected(lookahead)}param=parseExpression();if(strict&&param.type===Syntax.Identifier&&isRestrictedWord(param.name)){throwErrorTolerant({},Messages.StrictCatchVariable)
}expect(")");body=parseBlock();return delegate.markEnd(delegate.createCatchClause(param,body))}function parseTryStatement(){var block,handlers=[],finalizer=null;expectKeyword("try");block=parseBlock();
if(matchKeyword("catch")){handlers.push(parseCatchClause())}if(matchKeyword("finally")){lex();finalizer=parseBlock()}if(handlers.length===0&&!finalizer){throwError({},Messages.NoCatchOrFinally)}return delegate.createTryStatement(block,[],handlers,finalizer)
}function parseDebuggerStatement(){expectKeyword("debugger");consumeSemicolon();return delegate.createDebuggerStatement()}function parseStatement(){var type=lookahead.type,expr,labeledBody,key;if(type===Token.EOF){throwUnexpected(lookahead)
}delegate.markStart();if(type===Token.Punctuator){switch(lookahead.value){case";":return delegate.markEnd(parseEmptyStatement());case"{":return delegate.markEnd(parseBlock());case"(":return delegate.markEnd(parseExpressionStatement());
default:break}}if(type===Token.Keyword){switch(lookahead.value){case"break":return delegate.markEnd(parseBreakStatement());case"continue":return delegate.markEnd(parseContinueStatement());case"debugger":return delegate.markEnd(parseDebuggerStatement());
case"do":return delegate.markEnd(parseDoWhileStatement());case"for":return delegate.markEnd(parseForStatement());case"function":return delegate.markEnd(parseFunctionDeclaration());case"if":return delegate.markEnd(parseIfStatement());
case"return":return delegate.markEnd(parseReturnStatement());case"switch":return delegate.markEnd(parseSwitchStatement());case"throw":return delegate.markEnd(parseThrowStatement());case"try":return delegate.markEnd(parseTryStatement());
case"var":return delegate.markEnd(parseVariableStatement());case"while":return delegate.markEnd(parseWhileStatement());case"with":return delegate.markEnd(parseWithStatement());default:break}}expr=parseExpression();
if(expr.type===Syntax.Identifier&&match(":")){lex();key="$"+expr.name;if(Object.prototype.hasOwnProperty.call(state.labelSet,key)){throwError({},Messages.Redeclaration,"Label",expr.name)}state.labelSet[key]=true;
labeledBody=parseStatement();delete state.labelSet[key];return delegate.markEnd(delegate.createLabeledStatement(expr,labeledBody))}consumeSemicolon();return delegate.markEnd(delegate.createExpressionStatement(expr))
}function parseFunctionSourceElements(){var sourceElement,sourceElements=[],token,directive,firstRestricted,oldLabelSet,oldInIteration,oldInSwitch,oldInFunctionBody;delegate.markStart();expect("{");while(index<length){if(lookahead.type!==Token.StringLiteral){break
}token=lookahead;sourceElement=parseSourceElement();sourceElements.push(sourceElement);if(sourceElement.expression.type!==Syntax.Literal){break}directive=source.slice(token.range[0]+1,token.range[1]-1);
if(directive==="use strict"){strict=true;if(firstRestricted){throwErrorTolerant(firstRestricted,Messages.StrictOctalLiteral)}}else{if(!firstRestricted&&token.octal){firstRestricted=token}}}oldLabelSet=state.labelSet;
oldInIteration=state.inIteration;oldInSwitch=state.inSwitch;oldInFunctionBody=state.inFunctionBody;state.labelSet={};state.inIteration=false;state.inSwitch=false;state.inFunctionBody=true;while(index<length){if(match("}")){break
}sourceElement=parseSourceElement();if(typeof sourceElement==="undefined"){break}sourceElements.push(sourceElement)}expect("}");state.labelSet=oldLabelSet;state.inIteration=oldInIteration;state.inSwitch=oldInSwitch;
state.inFunctionBody=oldInFunctionBody;return delegate.markEnd(delegate.createBlockStatement(sourceElements))}function parseParams(firstRestricted){var param,params=[],token,stricted,paramSet,key,message;
expect("(");if(!match(")")){paramSet={};while(index<length){token=lookahead;param=parseVariableIdentifier();key="$"+token.value;if(strict){if(isRestrictedWord(token.value)){stricted=token;message=Messages.StrictParamName
}if(Object.prototype.hasOwnProperty.call(paramSet,key)){stricted=token;message=Messages.StrictParamDupe}}else if(!firstRestricted){if(isRestrictedWord(token.value)){firstRestricted=token;message=Messages.StrictParamName
}else if(isStrictModeReservedWord(token.value)){firstRestricted=token;message=Messages.StrictReservedWord}else if(Object.prototype.hasOwnProperty.call(paramSet,key)){firstRestricted=token;message=Messages.StrictParamDupe
}}params.push(param);paramSet[key]=true;if(match(")")){break}expect(",")}}expect(")");return{params:params,stricted:stricted,firstRestricted:firstRestricted,message:message}}function parseFunctionDeclaration(){var id,params=[],body,token,stricted,tmp,firstRestricted,message,previousStrict;
delegate.markStart();expectKeyword("function");token=lookahead;id=parseVariableIdentifier();if(strict){if(isRestrictedWord(token.value)){throwErrorTolerant(token,Messages.StrictFunctionName)}}else{if(isRestrictedWord(token.value)){firstRestricted=token;
message=Messages.StrictFunctionName}else if(isStrictModeReservedWord(token.value)){firstRestricted=token;message=Messages.StrictReservedWord}}tmp=parseParams(firstRestricted);params=tmp.params;stricted=tmp.stricted;
firstRestricted=tmp.firstRestricted;if(tmp.message){message=tmp.message}previousStrict=strict;body=parseFunctionSourceElements();if(strict&&firstRestricted){throwError(firstRestricted,message)}if(strict&&stricted){throwErrorTolerant(stricted,message)
}strict=previousStrict;return delegate.markEnd(delegate.createFunctionDeclaration(id,params,[],body))}function parseFunctionExpression(){var token,id=null,stricted,firstRestricted,message,tmp,params=[],body,previousStrict;
delegate.markStart();expectKeyword("function");if(!match("(")){token=lookahead;id=parseVariableIdentifier();if(strict){if(isRestrictedWord(token.value)){throwErrorTolerant(token,Messages.StrictFunctionName)
}}else{if(isRestrictedWord(token.value)){firstRestricted=token;message=Messages.StrictFunctionName}else if(isStrictModeReservedWord(token.value)){firstRestricted=token;message=Messages.StrictReservedWord
}}}tmp=parseParams(firstRestricted);params=tmp.params;stricted=tmp.stricted;firstRestricted=tmp.firstRestricted;if(tmp.message){message=tmp.message}previousStrict=strict;body=parseFunctionSourceElements();
if(strict&&firstRestricted){throwError(firstRestricted,message)}if(strict&&stricted){throwErrorTolerant(stricted,message)}strict=previousStrict;return delegate.markEnd(delegate.createFunctionExpression(id,params,[],body))
}function parseSourceElement(){if(lookahead.type===Token.Keyword){switch(lookahead.value){case"const":case"let":return parseConstLetDeclaration(lookahead.value);case"function":return parseFunctionDeclaration();
default:return parseStatement()}}if(lookahead.type!==Token.EOF){return parseStatement()}}function parseSourceElements(){var sourceElement,sourceElements=[],token,directive,firstRestricted;while(index<length){token=lookahead;
if(token.type!==Token.StringLiteral){break}sourceElement=parseSourceElement();sourceElements.push(sourceElement);if(sourceElement.expression.type!==Syntax.Literal){break}directive=source.slice(token.range[0]+1,token.range[1]-1);
if(directive==="use strict"){strict=true;if(firstRestricted){throwErrorTolerant(firstRestricted,Messages.StrictOctalLiteral)}}else{if(!firstRestricted&&token.octal){firstRestricted=token}}}while(index<length){sourceElement=parseSourceElement();
if(typeof sourceElement==="undefined"){break}sourceElements.push(sourceElement)}return sourceElements}function parseProgram(){var body;delegate.markStart();strict=false;peek();body=parseSourceElements();
return delegate.markEnd(delegate.createProgram(body))}function addComment(type,value,start,end,loc){assert(typeof start==="number","Comment must have valid position");if(extra.comments.length>0){if(extra.comments[extra.comments.length-1].range[1]>start){return
}}extra.comments.push({type:type,value:value,range:[start,end],loc:loc})}function scanComment(){var comment,ch,loc,start,blockComment,lineComment;comment="";blockComment=false;lineComment=false;while(index<length){ch=source[index];
if(lineComment){ch=source[index++];if(isLineTerminator(ch.charCodeAt(0))){loc.end={line:lineNumber,column:index-lineStart-1};lineComment=false;addComment("Line",comment,start,index-1,loc);if(ch==="\r"&&source[index]==="\n"){++index
}++lineNumber;lineStart=index;comment=""}else if(index>=length){lineComment=false;comment+=ch;loc.end={line:lineNumber,column:length-lineStart};addComment("Line",comment,start,length,loc)}else{comment+=ch
}}else if(blockComment){if(isLineTerminator(ch.charCodeAt(0))){if(ch==="\r"&&source[index+1]==="\n"){++index;comment+="\r\n"}else{comment+=ch}++lineNumber;++index;lineStart=index;if(index>=length){throwError({},Messages.UnexpectedToken,"ILLEGAL")
}}else{ch=source[index++];if(index>=length){throwError({},Messages.UnexpectedToken,"ILLEGAL")}comment+=ch;if(ch==="*"){ch=source[index];if(ch==="/"){comment=comment.substr(0,comment.length-1);blockComment=false;
++index;loc.end={line:lineNumber,column:index-lineStart};addComment("Block",comment,start,index,loc);comment=""}}}}else if(ch==="/"){ch=source[index+1];if(ch==="/"){loc={start:{line:lineNumber,column:index-lineStart}};
start=index;index+=2;lineComment=true;if(index>=length){loc.end={line:lineNumber,column:index-lineStart};lineComment=false;addComment("Line",comment,start,index,loc)}}else if(ch==="*"){start=index;index+=2;
blockComment=true;loc={start:{line:lineNumber,column:index-lineStart-2}};if(index>=length){throwError({},Messages.UnexpectedToken,"ILLEGAL")}}else{break}}else if(isWhiteSpace(ch.charCodeAt(0))){++index
}else if(isLineTerminator(ch.charCodeAt(0))){++index;if(ch==="\r"&&source[index]==="\n"){++index}++lineNumber;lineStart=index}else{break}}}function filterCommentLocation(){var i,entry,comment,comments=[];
for(i=0;i<extra.comments.length;++i){entry=extra.comments[i];comment={type:entry.type,value:entry.value};if(extra.range){comment.range=entry.range}if(extra.loc){comment.loc=entry.loc}comments.push(comment)
}extra.comments=comments}function collectToken(){var start,loc,token,range,value;skipComment();start=index;loc={start:{line:lineNumber,column:index-lineStart}};token=extra.advance();loc.end={line:lineNumber,column:index-lineStart};
if(token.type!==Token.EOF){range=[token.range[0],token.range[1]];value=source.slice(token.range[0],token.range[1]);extra.tokens.push({type:TokenName[token.type],value:value,range:range,loc:loc})}return token
}function collectRegex(){var pos,loc,regex,token;skipComment();pos=index;loc={start:{line:lineNumber,column:index-lineStart}};regex=extra.scanRegExp();loc.end={line:lineNumber,column:index-lineStart};if(!extra.tokenize){if(extra.tokens.length>0){token=extra.tokens[extra.tokens.length-1];
if(token.range[0]===pos&&token.type==="Punctuator"){if(token.value==="/"||token.value==="/="){extra.tokens.pop()}}}extra.tokens.push({type:"RegularExpression",value:regex.literal,range:[pos,index],loc:loc})
}return regex}function filterTokenLocation(){var i,entry,token,tokens=[];for(i=0;i<extra.tokens.length;++i){entry=extra.tokens[i];token={type:entry.type,value:entry.value};if(extra.range){token.range=entry.range
}if(extra.loc){token.loc=entry.loc}tokens.push(token)}extra.tokens=tokens}function createLocationMarker(){if(!extra.loc&&!extra.range){return null}skipComment();return{range:[index,index],loc:{start:{line:lineNumber,column:index-lineStart},end:{line:lineNumber,column:index-lineStart}},end:function(){this.range[1]=index;
this.loc.end.line=lineNumber;this.loc.end.column=index-lineStart},apply:function(node){node.range=[this.range[0],this.range[1]];node.loc={start:{line:this.loc.start.line,column:this.loc.start.column},end:{line:this.loc.end.line,column:this.loc.end.column}};
node=delegate.postProcess(node)},applyIf:function(node){if(extra.range&&!node.range){this.apply(node)}if(extra.loc&&!node.loc){this.apply(node)}return node}}}function filterGroup(node){var name;delete node.groupRange;
delete node.groupLoc;for(name in node){if(node.hasOwnProperty(name)&&typeof node[name]==="object"&&node[name]){if(node[name].type||node[name].length&&!node[name].substr){filterGroup(node[name])}}}}function wrapTrackingFunction(range,loc){return function(parseFunction){function isBinary(node){return node.type===Syntax.LogicalExpression||node.type===Syntax.BinaryExpression
}function visit(node){var start,end;if(isBinary(node.left)){visit(node.left)}if(isBinary(node.right)){visit(node.right)}if(range){if(node.left.groupRange||node.right.groupRange){start=node.left.groupRange?node.left.groupRange[0]:node.left.range[0];
end=node.right.groupRange?node.right.groupRange[1]:node.right.range[1];node.range=[start,end]}else if(typeof node.range==="undefined"){start=node.left.range[0];end=node.right.range[1];node.range=[start,end]
}}if(loc){if(node.left.groupLoc||node.right.groupLoc){start=node.left.groupLoc?node.left.groupLoc.start:node.left.loc.start;end=node.right.groupLoc?node.right.groupLoc.end:node.right.loc.end;node.loc={start:start,end:end};
node=delegate.postProcess(node)}else if(typeof node.loc==="undefined"){node.loc={start:node.left.loc.start,end:node.right.loc.end};node=delegate.postProcess(node)}}}return function(){var marker,node;marker=createLocationMarker();
node=parseFunction.apply(null,arguments);marker.end();if(range&&typeof node.range==="undefined"){marker.apply(node)}if(loc&&typeof node.loc==="undefined"){marker.apply(node)}if(isBinary(node)){visit(node)
}return node}}}function patch(){var wrapTracking;if(extra.comments){extra.skipComment=skipComment;skipComment=scanComment}if(extra.range||extra.loc){wrapTracking=wrapTrackingFunction(extra.range,extra.loc);
extra.parseBinaryExpression=parseBinaryExpression;parseBinaryExpression=wrapTracking(extra.parseBinaryExpression)}if(typeof extra.tokens!=="undefined"){extra.advance=advance;extra.scanRegExp=scanRegExp;
advance=collectToken;scanRegExp=collectRegex}}function unpatch(){if(typeof extra.skipComment==="function"){skipComment=extra.skipComment}if(extra.range||extra.loc){parseBinaryExpression=extra.parseBinaryExpression
}if(typeof extra.scanRegExp==="function"){advance=extra.advance;scanRegExp=extra.scanRegExp}}function extend(object,properties){var entry,result={};for(entry in object){if(object.hasOwnProperty(entry)){result[entry]=object[entry]
}}for(entry in properties){if(properties.hasOwnProperty(entry)){result[entry]=properties[entry]}}return result}function tokenize(code,options){var toString,token,tokens;toString=String;if(typeof code!=="string"&&!(code instanceof String)){code=toString(code)
}delegate=SyntaxTreeDelegate;source=code;index=0;lineNumber=source.length>0?1:0;lineStart=0;length=source.length;lookahead=null;state={allowIn:true,labelSet:{},inFunctionBody:false,inIteration:false,inSwitch:false};
extra={};options=options||{};options.tokens=true;extra.tokens=[];extra.tokenize=true;extra.openParenToken=-1;extra.openCurlyToken=-1;extra.range=typeof options.range==="boolean"&&options.range;extra.loc=typeof options.loc==="boolean"&&options.loc;
if(typeof options.comment==="boolean"&&options.comment){extra.comments=[]}if(typeof options.tolerant==="boolean"&&options.tolerant){extra.errors=[]}if(length>0){if(typeof source[0]==="undefined"){if(code instanceof String){source=code.valueOf()
}}}patch();try{peek();if(lookahead.type===Token.EOF){return extra.tokens}token=lex();while(lookahead.type!==Token.EOF){try{token=lex()}catch(lexError){token=lookahead;if(extra.errors){extra.errors.push(lexError);
break}else{throw lexError}}}filterTokenLocation();tokens=extra.tokens;if(typeof extra.comments!=="undefined"){filterCommentLocation();tokens.comments=extra.comments}if(typeof extra.errors!=="undefined"){tokens.errors=extra.errors
}}catch(e){throw e}finally{unpatch();extra={}}return tokens}function parse(code,options){var program,toString;toString=String;if(typeof code!=="string"&&!(code instanceof String)){code=toString(code)}delegate=SyntaxTreeDelegate;
source=code;index=0;lineNumber=source.length>0?1:0;lineStart=0;length=source.length;lookahead=null;state={allowIn:true,labelSet:{},inFunctionBody:false,inIteration:false,inSwitch:false};extra={};if(typeof options!=="undefined"){extra.range=typeof options.range==="boolean"&&options.range;
extra.loc=typeof options.loc==="boolean"&&options.loc;if(typeof options.range==="boolean"&&options.range){state.rangeStack=[];delegate=extend(delegate,{markStart:function(){skipComment();state.rangeStack.push(index)
}});delegate=extend(delegate,{markEnd:function(node){node.range=[state.rangeStack.pop(),index];return node}})}if(typeof options.loc==="boolean"&&options.loc){state.locStack=[];delegate=extend(delegate,{markStart:function(){skipComment();
state.locStack.push({line:lineNumber,column:index-lineStart});if(state.rangeStack){state.rangeStack.push(index)}}});delegate=extend(delegate,{markEnd:function(node){if(state.rangeStack){node.range=[state.rangeStack.pop(),index]
}node.loc={};node.loc.start=state.locStack.pop();node.loc.end={line:lineNumber,column:index-lineStart};if(options.source!==null&&options.source!==undefined){node.loc.source=toString(options.source)}return node
}});delegate=extend(delegate,{markGroupEnd:function(node){if(state.rangeStack){node.groupRange=[state.rangeStack.pop(),index]}node.groupLoc={};node.groupLoc.start=state.locStack.pop();node.groupLoc.end={line:lineNumber,column:index-lineStart};
if(options.source!==null&&options.source!==undefined){node.groupLoc.source=toString(options.source)}return node}})}if(extra.loc&&options.source!==null&&options.source!==undefined){delegate=extend(delegate,{postProcess:function(node){node.loc.source=toString(options.source);
return node}})}if(typeof options.tokens==="boolean"&&options.tokens){extra.tokens=[]}if(typeof options.comment==="boolean"&&options.comment){extra.comments=[]}if(typeof options.tolerant==="boolean"&&options.tolerant){extra.errors=[]
}}if(length>0){if(typeof source[0]==="undefined"){if(code instanceof String){source=code.valueOf()}}}patch();try{program=parseProgram();if(typeof extra.comments!=="undefined"){filterCommentLocation();program.comments=extra.comments
}if(typeof extra.tokens!=="undefined"){filterTokenLocation();program.tokens=extra.tokens}if(typeof extra.errors!=="undefined"){program.errors=extra.errors}if(extra.range||extra.loc){filterGroup(program.body)
}}catch(e){throw e}finally{unpatch();extra={}}return program}exports.version="1.1.0-dev";exports.tokenize=tokenize;exports.parse=parse;exports.Syntax=function(){var name,types={};if(typeof Object.create==="function"){types=Object.create(null)
}for(name in Syntax){if(Syntax.hasOwnProperty(name)){types[name]=Syntax[name]}}if(typeof Object.freeze==="function"){Object.freeze(types)}return types}()});
/* END INSERT */

realExports.esprima = exports;
var esprima = exports;
/* Includes a minified jshint: http://www.jshint.com/ */
// Avoid clobber:
exports = {};

/* INSERT jshint.js */
var JSHINT;(function(){var require=function(file,cwd){var resolved=require.resolve(file,cwd||"/");var mod=require.modules[resolved];if(!mod)throw new Error("Failed to resolve module "+file+", tried "+resolved);
var cached=require.cache[resolved];var res=cached?cached.exports:mod();return res};require.paths=[];require.modules={};require.cache={};require.extensions=[".js",".coffee",".json"];require._core={assert:true,events:true,fs:true,path:true,vm:true};
require.resolve=function(){return function(x,cwd){if(!cwd)cwd="/";if(require._core[x])return x;var path=require.modules.path();cwd=path.resolve("/",cwd);var y=cwd||"/";if(x.match(/^(?:\.\.?\/|\/)/)){var m=loadAsFileSync(path.resolve(y,x))||loadAsDirectorySync(path.resolve(y,x));
if(m)return m}var n=loadNodeModulesSync(x,y);if(n)return n;throw new Error("Cannot find module '"+x+"'");function loadAsFileSync(x){x=path.normalize(x);if(require.modules[x]){return x}for(var i=0;i<require.extensions.length;i++){var ext=require.extensions[i];
if(require.modules[x+ext])return x+ext}}function loadAsDirectorySync(x){x=x.replace(/\/+$/,"");var pkgfile=path.normalize(x+"/package.json");if(require.modules[pkgfile]){var pkg=require.modules[pkgfile]();
var b=pkg.browserify;if(typeof b==="object"&&b.main){var m=loadAsFileSync(path.resolve(x,b.main));if(m)return m}else if(typeof b==="string"){var m=loadAsFileSync(path.resolve(x,b));if(m)return m}else if(pkg.main){var m=loadAsFileSync(path.resolve(x,pkg.main));
if(m)return m}}return loadAsFileSync(x+"/index")}function loadNodeModulesSync(x,start){var dirs=nodeModulesPathsSync(start);for(var i=0;i<dirs.length;i++){var dir=dirs[i];var m=loadAsFileSync(dir+"/"+x);
if(m)return m;var n=loadAsDirectorySync(dir+"/"+x);if(n)return n}var m=loadAsFileSync(x);if(m)return m}function nodeModulesPathsSync(start){var parts;if(start==="/")parts=[""];else parts=path.normalize(start).split("/");
var dirs=[];for(var i=parts.length-1;i>=0;i--){if(parts[i]==="node_modules")continue;var dir=parts.slice(0,i+1).join("/")+"/node_modules";dirs.push(dir)}return dirs}}}();require.alias=function(from,to){var path=require.modules.path();
var res=null;try{res=require.resolve(from+"/package.json","/")}catch(err){res=require.resolve(from,"/")}var basedir=path.dirname(res);var keys=(Object.keys||function(obj){var res=[];for(var key in obj)res.push(key);
return res})(require.modules);for(var i=0;i<keys.length;i++){var key=keys[i];if(key.slice(0,basedir.length+1)===basedir+"/"){var f=key.slice(basedir.length);require.modules[to+f]=require.modules[basedir+f]
}else if(key===basedir){require.modules[to]=require.modules[basedir]}}};(function(){var process={};var global=typeof window!=="undefined"?window:{};var definedProcess=false;require.define=function(filename,fn){if(!definedProcess&&require.modules.__browserify_process){process=require.modules.__browserify_process();
definedProcess=true}var dirname=require._core[filename]?"":require.modules.path().dirname(filename);var require_=function(file){var requiredModule=require(file,dirname);var cached=require.cache[require.resolve(file,dirname)];
if(cached&&cached.parent===null){cached.parent=module_}return requiredModule};require_.resolve=function(name){return require.resolve(name,dirname)};require_.modules=require.modules;require_.define=require.define;
require_.cache=require.cache;var module_={id:filename,filename:filename,exports:{},loaded:false,parent:null};require.modules[filename]=function(){require.cache[filename]=module_;fn.call(module_.exports,require_,module_,module_.exports,dirname,filename,process,global);
module_.loaded=true;return module_.exports}}})();require.define("path",Function(["require","module","exports","__dirname","__filename","process","global"],"function filter (xs, fn) {\n    var res = [];\n    for (var i = 0; i < xs.length; i++) {\n        if (fn(xs[i], i, xs)) res.push(xs[i]);\n    }\n    return res;\n}\n\n// resolves . and .. elements in a path array with directory names there\n// must be no slashes, empty elements, or device names (c:\\) in the array\n// (so also no leading and trailing slashes - it does not distinguish\n// relative and absolute paths)\nfunction normalizeArray(parts, allowAboveRoot) {\n  // if the path tries to go above the root, `up` ends up > 0\n  var up = 0;\n  for (var i = parts.length; i >= 0; i--) {\n    var last = parts[i];\n    if (last == '.') {\n      parts.splice(i, 1);\n    } else if (last === '..') {\n      parts.splice(i, 1);\n      up++;\n    } else if (up) {\n      parts.splice(i, 1);\n      up--;\n    }\n  }\n\n  // if the path is allowed to go above the root, restore leading ..s\n  if (allowAboveRoot) {\n    for (; up--; up) {\n      parts.unshift('..');\n    }\n  }\n\n  return parts;\n}\n\n// Regex to split a filename into [*, dir, basename, ext]\n// posix version\nvar splitPathRe = /^(.+\\/(?!$)|\\/)?((?:.+?)?(\\.[^.]*)?)$/;\n\n// path.resolve([from ...], to)\n// posix version\nexports.resolve = function() {\nvar resolvedPath = '',\n    resolvedAbsolute = false;\n\nfor (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {\n  var path = (i >= 0)\n      ? arguments[i]\n      : process.cwd();\n\n  // Skip empty and invalid entries\n  if (typeof path !== 'string' || !path) {\n    continue;\n  }\n\n  resolvedPath = path + '/' + resolvedPath;\n  resolvedAbsolute = path.charAt(0) === '/';\n}\n\n// At this point the path should be resolved to a full absolute path, but\n// handle relative paths to be safe (might happen when process.cwd() fails)\n\n// Normalize the path\nresolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {\n    return !!p;\n  }), !resolvedAbsolute).join('/');\n\n  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';\n};\n\n// path.normalize(path)\n// posix version\nexports.normalize = function(path) {\nvar isAbsolute = path.charAt(0) === '/',\n    trailingSlash = path.slice(-1) === '/';\n\n// Normalize the path\npath = normalizeArray(filter(path.split('/'), function(p) {\n    return !!p;\n  }), !isAbsolute).join('/');\n\n  if (!path && !isAbsolute) {\n    path = '.';\n  }\n  if (path && trailingSlash) {\n    path += '/';\n  }\n  \n  return (isAbsolute ? '/' : '') + path;\n};\n\n\n// posix version\nexports.join = function() {\n  var paths = Array.prototype.slice.call(arguments, 0);\n  return exports.normalize(filter(paths, function(p, index) {\n    return p && typeof p === 'string';\n  }).join('/'));\n};\n\n\nexports.dirname = function(path) {\n  var dir = splitPathRe.exec(path)[1] || '';\n  var isWindows = false;\n  if (!dir) {\n    // No dirname\n    return '.';\n  } else if (dir.length === 1 ||\n      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {\n    // It is just a slash or a drive letter with a slash\n    return dir;\n  } else {\n    // It is a full dirname, strip trailing slash\n    return dir.substring(0, dir.length - 1);\n  }\n};\n\n\nexports.basename = function(path, ext) {\n  var f = splitPathRe.exec(path)[2] || '';\n  // TODO: make this comparison case-insensitive on windows?\n  if (ext && f.substr(-1 * ext.length) === ext) {\n    f = f.substr(0, f.length - ext.length);\n  }\n  return f;\n};\n\n\nexports.extname = function(path) {\n  return splitPathRe.exec(path)[3] || '';\n};\n\n//@ sourceURL=path"));
require.define("__browserify_process",Function(["require","module","exports","__dirname","__filename","process","global"],"var process = module.exports = {};\n\nprocess.nextTick = (function () {\n    var canSetImmediate = typeof window !== 'undefined'\n        && window.setImmediate;\n    var canPost = typeof window !== 'undefined'\n        && window.postMessage && window.addEventListener\n    ;\n\n    if (canSetImmediate) {\n        return window.setImmediate;\n    }\n\n    if (canPost) {\n        var queue = [];\n        window.addEventListener('message', function (ev) {\n            if (ev.source === window && ev.data === 'browserify-tick') {\n                ev.stopPropagation();\n                if (queue.length > 0) {\n                    var fn = queue.shift();\n                    fn();\n                }\n            }\n        }, true);\n\n        return function nextTick(fn) {\n            queue.push(fn);\n            window.postMessage('browserify-tick', '*');\n        };\n    }\n\n    return function nextTick(fn) {\n        setTimeout(fn, 0);\n    };\n})();\n\nprocess.title = 'browser';\nprocess.browser = true;\nprocess.env = {};\nprocess.argv = [];\n\nprocess.binding = function (name) {\n    if (name === 'evals') return (require)('vm')\n    else throw new Error('No such module. (Possibly not yet loaded)')\n};\n\n(function () {\n    var cwd = '/';\n    var path;\n    process.cwd = function () { return cwd };\n    process.chdir = function (dir) {\n        if (!path) path = require('path');\n        cwd = path.resolve(dir, cwd);\n    };\n})();\n\n//@ sourceURL=__browserify_process"));
require.define("/node_modules/underscore/package.json",Function(["require","module","exports","__dirname","__filename","process","global"],'module.exports = {"main":"underscore.js"}\n//@ sourceURL=/node_modules/underscore/package.json'));
require.define("/node_modules/underscore/underscore.js",Function(["require","module","exports","__dirname","__filename","process","global"],"//     Underscore.js 1.4.4\n//     http://underscorejs.org\n//     (c) 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.\n//     Underscore may be freely distributed under the MIT license.\n\n(function() {\n\n  // Baseline setup\n  // --------------\n\n  // Establish the root object, `window` in the browser, or `global` on the server.\n  var root = this;\n\n  // Save the previous value of the `_` variable.\n  var previousUnderscore = root._;\n\n  // Establish the object that gets returned to break out of a loop iteration.\n  var breaker = {};\n\n  // Save bytes in the minified (but not gzipped) version:\n  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;\n\n  // Create quick reference variables for speed access to core prototypes.\n  var push             = ArrayProto.push,\n      slice            = ArrayProto.slice,\n      concat           = ArrayProto.concat,\n      toString         = ObjProto.toString,\n      hasOwnProperty   = ObjProto.hasOwnProperty;\n\n  // All **ECMAScript 5** native function implementations that we hope to use\n  // are declared here.\n  var\n    nativeForEach      = ArrayProto.forEach,\n    nativeMap          = ArrayProto.map,\n    nativeReduce       = ArrayProto.reduce,\n    nativeReduceRight  = ArrayProto.reduceRight,\n    nativeFilter       = ArrayProto.filter,\n    nativeEvery        = ArrayProto.every,\n    nativeSome         = ArrayProto.some,\n    nativeIndexOf      = ArrayProto.indexOf,\n    nativeLastIndexOf  = ArrayProto.lastIndexOf,\n    nativeIsArray      = Array.isArray,\n    nativeKeys         = Object.keys,\n    nativeBind         = FuncProto.bind;\n\n  // Create a safe reference to the Underscore object for use below.\n  var _ = function(obj) {\n    if (obj instanceof _) return obj;\n    if (!(this instanceof _)) return new _(obj);\n    this._wrapped = obj;\n  };\n\n  // Export the Underscore object for **Node.js**, with\n  // backwards-compatibility for the old `require()` API. If we're in\n  // the browser, add `_` as a global object via a string identifier,\n  // for Closure Compiler \"advanced\" mode.\n  if (typeof exports !== 'undefined') {\n    if (typeof module !== 'undefined' && module.exports) {\n      exports = module.exports = _;\n    }\n    exports._ = _;\n  } else {\n    root._ = _;\n  }\n\n  // Current version.\n  _.VERSION = '1.4.4';\n\n  // Collection Functions\n  // --------------------\n\n  // The cornerstone, an `each` implementation, aka `forEach`.\n  // Handles objects with the built-in `forEach`, arrays, and raw objects.\n  // Delegates to **ECMAScript 5**'s native `forEach` if available.\n  var each = _.each = _.forEach = function(obj, iterator, context) {\n    if (obj == null) return;\n    if (nativeForEach && obj.forEach === nativeForEach) {\n      obj.forEach(iterator, context);\n    } else if (obj.length === +obj.length) {\n      for (var i = 0, l = obj.length; i < l; i++) {\n        if (iterator.call(context, obj[i], i, obj) === breaker) return;\n      }\n    } else {\n      for (var key in obj) {\n        if (_.has(obj, key)) {\n          if (iterator.call(context, obj[key], key, obj) === breaker) return;\n        }\n      }\n    }\n  };\n\n  // Return the results of applying the iterator to each element.\n  // Delegates to **ECMAScript 5**'s native `map` if available.\n  _.map = _.collect = function(obj, iterator, context) {\n    var results = [];\n    if (obj == null) return results;\n    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);\n    each(obj, function(value, index, list) {\n      results[results.length] = iterator.call(context, value, index, list);\n    });\n    return results;\n  };\n\n  var reduceError = 'Reduce of empty array with no initial value';\n\n  // **Reduce** builds up a single result from a list of values, aka `inject`,\n  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.\n  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {\n    var initial = arguments.length > 2;\n    if (obj == null) obj = [];\n    if (nativeReduce && obj.reduce === nativeReduce) {\n      if (context) iterator = _.bind(iterator, context);\n      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);\n    }\n    each(obj, function(value, index, list) {\n      if (!initial) {\n        memo = value;\n        initial = true;\n      } else {\n        memo = iterator.call(context, memo, value, index, list);\n      }\n    });\n    if (!initial) throw new TypeError(reduceError);\n    return memo;\n  };\n\n  // The right-associative version of reduce, also known as `foldr`.\n  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.\n  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {\n    var initial = arguments.length > 2;\n    if (obj == null) obj = [];\n    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {\n      if (context) iterator = _.bind(iterator, context);\n      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);\n    }\n    var length = obj.length;\n    if (length !== +length) {\n      var keys = _.keys(obj);\n      length = keys.length;\n    }\n    each(obj, function(value, index, list) {\n      index = keys ? keys[--length] : --length;\n      if (!initial) {\n        memo = obj[index];\n        initial = true;\n      } else {\n        memo = iterator.call(context, memo, obj[index], index, list);\n      }\n    });\n    if (!initial) throw new TypeError(reduceError);\n    return memo;\n  };\n\n  // Return the first value which passes a truth test. Aliased as `detect`.\n  _.find = _.detect = function(obj, iterator, context) {\n    var result;\n    any(obj, function(value, index, list) {\n      if (iterator.call(context, value, index, list)) {\n        result = value;\n        return true;\n      }\n    });\n    return result;\n  };\n\n  // Return all the elements that pass a truth test.\n  // Delegates to **ECMAScript 5**'s native `filter` if available.\n  // Aliased as `select`.\n  _.filter = _.select = function(obj, iterator, context) {\n    var results = [];\n    if (obj == null) return results;\n    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);\n    each(obj, function(value, index, list) {\n      if (iterator.call(context, value, index, list)) results[results.length] = value;\n    });\n    return results;\n  };\n\n  // Return all the elements for which a truth test fails.\n  _.reject = function(obj, iterator, context) {\n    return _.filter(obj, function(value, index, list) {\n      return !iterator.call(context, value, index, list);\n    }, context);\n  };\n\n  // Determine whether all of the elements match a truth test.\n  // Delegates to **ECMAScript 5**'s native `every` if available.\n  // Aliased as `all`.\n  _.every = _.all = function(obj, iterator, context) {\n    iterator || (iterator = _.identity);\n    var result = true;\n    if (obj == null) return result;\n    if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);\n    each(obj, function(value, index, list) {\n      if (!(result = result && iterator.call(context, value, index, list))) return breaker;\n    });\n    return !!result;\n  };\n\n  // Determine if at least one element in the object matches a truth test.\n  // Delegates to **ECMAScript 5**'s native `some` if available.\n  // Aliased as `any`.\n  var any = _.some = _.any = function(obj, iterator, context) {\n    iterator || (iterator = _.identity);\n    var result = false;\n    if (obj == null) return result;\n    if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);\n    each(obj, function(value, index, list) {\n      if (result || (result = iterator.call(context, value, index, list))) return breaker;\n    });\n    return !!result;\n  };\n\n  // Determine if the array or object contains a given value (using `===`).\n  // Aliased as `include`.\n  _.contains = _.include = function(obj, target) {\n    if (obj == null) return false;\n    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;\n    return any(obj, function(value) {\n      return value === target;\n    });\n  };\n\n  // Invoke a method (with arguments) on every item in a collection.\n  _.invoke = function(obj, method) {\n    var args = slice.call(arguments, 2);\n    var isFunc = _.isFunction(method);\n    return _.map(obj, function(value) {\n      return (isFunc ? method : value[method]).apply(value, args);\n    });\n  };\n\n  // Convenience version of a common use case of `map`: fetching a property.\n  _.pluck = function(obj, key) {\n    return _.map(obj, function(value){ return value[key]; });\n  };\n\n  // Convenience version of a common use case of `filter`: selecting only objects\n  // containing specific `key:value` pairs.\n  _.where = function(obj, attrs, first) {\n    if (_.isEmpty(attrs)) return first ? null : [];\n    return _[first ? 'find' : 'filter'](obj, function(value) {\n      for (var key in attrs) {\n        if (attrs[key] !== value[key]) return false;\n      }\n      return true;\n    });\n  };\n\n  // Convenience version of a common use case of `find`: getting the first object\n  // containing specific `key:value` pairs.\n  _.findWhere = function(obj, attrs) {\n    return _.where(obj, attrs, true);\n  };\n\n  // Return the maximum element or (element-based computation).\n  // Can't optimize arrays of integers longer than 65,535 elements.\n  // See: https://bugs.webkit.org/show_bug.cgi?id=80797\n  _.max = function(obj, iterator, context) {\n    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {\n      return Math.max.apply(Math, obj);\n    }\n    if (!iterator && _.isEmpty(obj)) return -Infinity;\n    var result = {computed : -Infinity, value: -Infinity};\n    each(obj, function(value, index, list) {\n      var computed = iterator ? iterator.call(context, value, index, list) : value;\n      computed >= result.computed && (result = {value : value, computed : computed});\n    });\n    return result.value;\n  };\n\n  // Return the minimum element (or element-based computation).\n  _.min = function(obj, iterator, context) {\n    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {\n      return Math.min.apply(Math, obj);\n    }\n    if (!iterator && _.isEmpty(obj)) return Infinity;\n    var result = {computed : Infinity, value: Infinity};\n    each(obj, function(value, index, list) {\n      var computed = iterator ? iterator.call(context, value, index, list) : value;\n      computed < result.computed && (result = {value : value, computed : computed});\n    });\n    return result.value;\n  };\n\n  // Shuffle an array.\n  _.shuffle = function(obj) {\n    var rand;\n    var index = 0;\n    var shuffled = [];\n    each(obj, function(value) {\n      rand = _.random(index++);\n      shuffled[index - 1] = shuffled[rand];\n      shuffled[rand] = value;\n    });\n    return shuffled;\n  };\n\n  // An internal function to generate lookup iterators.\n  var lookupIterator = function(value) {\n    return _.isFunction(value) ? value : function(obj){ return obj[value]; };\n  };\n\n  // Sort the object's values by a criterion produced by an iterator.\n  _.sortBy = function(obj, value, context) {\n    var iterator = lookupIterator(value);\n    return _.pluck(_.map(obj, function(value, index, list) {\n      return {\n        value : value,\n        index : index,\n        criteria : iterator.call(context, value, index, list)\n      };\n    }).sort(function(left, right) {\n      var a = left.criteria;\n      var b = right.criteria;\n      if (a !== b) {\n        if (a > b || a === void 0) return 1;\n        if (a < b || b === void 0) return -1;\n      }\n      return left.index < right.index ? -1 : 1;\n    }), 'value');\n  };\n\n  // An internal function used for aggregate \"group by\" operations.\n  var group = function(obj, value, context, behavior) {\n    var result = {};\n    var iterator = lookupIterator(value || _.identity);\n    each(obj, function(value, index) {\n      var key = iterator.call(context, value, index, obj);\n      behavior(result, key, value);\n    });\n    return result;\n  };\n\n  // Groups the object's values by a criterion. Pass either a string attribute\n  // to group by, or a function that returns the criterion.\n  _.groupBy = function(obj, value, context) {\n    return group(obj, value, context, function(result, key, value) {\n      (_.has(result, key) ? result[key] : (result[key] = [])).push(value);\n    });\n  };\n\n  // Counts instances of an object that group by a certain criterion. Pass\n  // either a string attribute to count by, or a function that returns the\n  // criterion.\n  _.countBy = function(obj, value, context) {\n    return group(obj, value, context, function(result, key) {\n      if (!_.has(result, key)) result[key] = 0;\n      result[key]++;\n    });\n  };\n\n  // Use a comparator function to figure out the smallest index at which\n  // an object should be inserted so as to maintain order. Uses binary search.\n  _.sortedIndex = function(array, obj, iterator, context) {\n    iterator = iterator == null ? _.identity : lookupIterator(iterator);\n    var value = iterator.call(context, obj);\n    var low = 0, high = array.length;\n    while (low < high) {\n      var mid = (low + high) >>> 1;\n      iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;\n    }\n    return low;\n  };\n\n  // Safely convert anything iterable into a real, live array.\n  _.toArray = function(obj) {\n    if (!obj) return [];\n    if (_.isArray(obj)) return slice.call(obj);\n    if (obj.length === +obj.length) return _.map(obj, _.identity);\n    return _.values(obj);\n  };\n\n  // Return the number of elements in an object.\n  _.size = function(obj) {\n    if (obj == null) return 0;\n    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;\n  };\n\n  // Array Functions\n  // ---------------\n\n  // Get the first element of an array. Passing **n** will return the first N\n  // values in the array. Aliased as `head` and `take`. The **guard** check\n  // allows it to work with `_.map`.\n  _.first = _.head = _.take = function(array, n, guard) {\n    if (array == null) return void 0;\n    return (n != null) && !guard ? slice.call(array, 0, n) : array[0];\n  };\n\n  // Returns everything but the last entry of the array. Especially useful on\n  // the arguments object. Passing **n** will return all the values in\n  // the array, excluding the last N. The **guard** check allows it to work with\n  // `_.map`.\n  _.initial = function(array, n, guard) {\n    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));\n  };\n\n  // Get the last element of an array. Passing **n** will return the last N\n  // values in the array. The **guard** check allows it to work with `_.map`.\n  _.last = function(array, n, guard) {\n    if (array == null) return void 0;\n    if ((n != null) && !guard) {\n      return slice.call(array, Math.max(array.length - n, 0));\n    } else {\n      return array[array.length - 1];\n    }\n  };\n\n  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.\n  // Especially useful on the arguments object. Passing an **n** will return\n  // the rest N values in the array. The **guard**\n  // check allows it to work with `_.map`.\n  _.rest = _.tail = _.drop = function(array, n, guard) {\n    return slice.call(array, (n == null) || guard ? 1 : n);\n  };\n\n  // Trim out all falsy values from an array.\n  _.compact = function(array) {\n    return _.filter(array, _.identity);\n  };\n\n  // Internal implementation of a recursive `flatten` function.\n  var flatten = function(input, shallow, output) {\n    each(input, function(value) {\n      if (_.isArray(value)) {\n        shallow ? push.apply(output, value) : flatten(value, shallow, output);\n      } else {\n        output.push(value);\n      }\n    });\n    return output;\n  };\n\n  // Return a completely flattened version of an array.\n  _.flatten = function(array, shallow) {\n    return flatten(array, shallow, []);\n  };\n\n  // Return a version of the array that does not contain the specified value(s).\n  _.without = function(array) {\n    return _.difference(array, slice.call(arguments, 1));\n  };\n\n  // Produce a duplicate-free version of the array. If the array has already\n  // been sorted, you have the option of using a faster algorithm.\n  // Aliased as `unique`.\n  _.uniq = _.unique = function(array, isSorted, iterator, context) {\n    if (_.isFunction(isSorted)) {\n      context = iterator;\n      iterator = isSorted;\n      isSorted = false;\n    }\n    var initial = iterator ? _.map(array, iterator, context) : array;\n    var results = [];\n    var seen = [];\n    each(initial, function(value, index) {\n      if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {\n        seen.push(value);\n        results.push(array[index]);\n      }\n    });\n    return results;\n  };\n\n  // Produce an array that contains the union: each distinct element from all of\n  // the passed-in arrays.\n  _.union = function() {\n    return _.uniq(concat.apply(ArrayProto, arguments));\n  };\n\n  // Produce an array that contains every item shared between all the\n  // passed-in arrays.\n  _.intersection = function(array) {\n    var rest = slice.call(arguments, 1);\n    return _.filter(_.uniq(array), function(item) {\n      return _.every(rest, function(other) {\n        return _.indexOf(other, item) >= 0;\n      });\n    });\n  };\n\n  // Take the difference between one array and a number of other arrays.\n  // Only the elements present in just the first array will remain.\n  _.difference = function(array) {\n    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));\n    return _.filter(array, function(value){ return !_.contains(rest, value); });\n  };\n\n  // Zip together multiple lists into a single array -- elements that share\n  // an index go together.\n  _.zip = function() {\n    var args = slice.call(arguments);\n    var length = _.max(_.pluck(args, 'length'));\n    var results = new Array(length);\n    for (var i = 0; i < length; i++) {\n      results[i] = _.pluck(args, \"\" + i);\n    }\n    return results;\n  };\n\n  // Converts lists into objects. Pass either a single array of `[key, value]`\n  // pairs, or two parallel arrays of the same length -- one of keys, and one of\n  // the corresponding values.\n  _.object = function(list, values) {\n    if (list == null) return {};\n    var result = {};\n    for (var i = 0, l = list.length; i < l; i++) {\n      if (values) {\n        result[list[i]] = values[i];\n      } else {\n        result[list[i][0]] = list[i][1];\n      }\n    }\n    return result;\n  };\n\n  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),\n  // we need this function. Return the position of the first occurrence of an\n  // item in an array, or -1 if the item is not included in the array.\n  // Delegates to **ECMAScript 5**'s native `indexOf` if available.\n  // If the array is large and already in sort order, pass `true`\n  // for **isSorted** to use binary search.\n  _.indexOf = function(array, item, isSorted) {\n    if (array == null) return -1;\n    var i = 0, l = array.length;\n    if (isSorted) {\n      if (typeof isSorted == 'number') {\n        i = (isSorted < 0 ? Math.max(0, l + isSorted) : isSorted);\n      } else {\n        i = _.sortedIndex(array, item);\n        return array[i] === item ? i : -1;\n      }\n    }\n    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);\n    for (; i < l; i++) if (array[i] === item) return i;\n    return -1;\n  };\n\n  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.\n  _.lastIndexOf = function(array, item, from) {\n    if (array == null) return -1;\n    var hasIndex = from != null;\n    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {\n      return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);\n    }\n    var i = (hasIndex ? from : array.length);\n    while (i--) if (array[i] === item) return i;\n    return -1;\n  };\n\n  // Generate an integer Array containing an arithmetic progression. A port of\n  // the native Python `range()` function. See\n  // [the Python documentation](http://docs.python.org/library/functions.html#range).\n  _.range = function(start, stop, step) {\n    if (arguments.length <= 1) {\n      stop = start || 0;\n      start = 0;\n    }\n    step = arguments[2] || 1;\n\n    var len = Math.max(Math.ceil((stop - start) / step), 0);\n    var idx = 0;\n    var range = new Array(len);\n\n    while(idx < len) {\n      range[idx++] = start;\n      start += step;\n    }\n\n    return range;\n  };\n\n  // Function (ahem) Functions\n  // ------------------\n\n  // Create a function bound to a given object (assigning `this`, and arguments,\n  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if\n  // available.\n  _.bind = function(func, context) {\n    if (func.bind === nativeBind && nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));\n    var args = slice.call(arguments, 2);\n    return function() {\n      return func.apply(context, args.concat(slice.call(arguments)));\n    };\n  };\n\n  // Partially apply a function by creating a version that has had some of its\n  // arguments pre-filled, without changing its dynamic `this` context.\n  _.partial = function(func) {\n    var args = slice.call(arguments, 1);\n    return function() {\n      return func.apply(this, args.concat(slice.call(arguments)));\n    };\n  };\n\n  // Bind all of an object's methods to that object. Useful for ensuring that\n  // all callbacks defined on an object belong to it.\n  _.bindAll = function(obj) {\n    var funcs = slice.call(arguments, 1);\n    if (funcs.length === 0) funcs = _.functions(obj);\n    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });\n    return obj;\n  };\n\n  // Memoize an expensive function by storing its results.\n  _.memoize = function(func, hasher) {\n    var memo = {};\n    hasher || (hasher = _.identity);\n    return function() {\n      var key = hasher.apply(this, arguments);\n      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));\n    };\n  };\n\n  // Delays a function for the given number of milliseconds, and then calls\n  // it with the arguments supplied.\n  _.delay = function(func, wait) {\n    var args = slice.call(arguments, 2);\n    return setTimeout(function(){ return func.apply(null, args); }, wait);\n  };\n\n  // Defers a function, scheduling it to run after the current call stack has\n  // cleared.\n  _.defer = function(func) {\n    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));\n  };\n\n  // Returns a function, that, when invoked, will only be triggered at most once\n  // during a given window of time.\n  _.throttle = function(func, wait) {\n    var context, args, timeout, result;\n    var previous = 0;\n    var later = function() {\n      previous = new Date;\n      timeout = null;\n      result = func.apply(context, args);\n    };\n    return function() {\n      var now = new Date;\n      var remaining = wait - (now - previous);\n      context = this;\n      args = arguments;\n      if (remaining <= 0) {\n        clearTimeout(timeout);\n        timeout = null;\n        previous = now;\n        result = func.apply(context, args);\n      } else if (!timeout) {\n        timeout = setTimeout(later, remaining);\n      }\n      return result;\n    };\n  };\n\n  // Returns a function, that, as long as it continues to be invoked, will not\n  // be triggered. The function will be called after it stops being called for\n  // N milliseconds. If `immediate` is passed, trigger the function on the\n  // leading edge, instead of the trailing.\n  _.debounce = function(func, wait, immediate) {\n    var timeout, result;\n    return function() {\n      var context = this, args = arguments;\n      var later = function() {\n        timeout = null;\n        if (!immediate) result = func.apply(context, args);\n      };\n      var callNow = immediate && !timeout;\n      clearTimeout(timeout);\n      timeout = setTimeout(later, wait);\n      if (callNow) result = func.apply(context, args);\n      return result;\n    };\n  };\n\n  // Returns a function that will be executed at most one time, no matter how\n  // often you call it. Useful for lazy initialization.\n  _.once = function(func) {\n    var ran = false, memo;\n    return function() {\n      if (ran) return memo;\n      ran = true;\n      memo = func.apply(this, arguments);\n      func = null;\n      return memo;\n    };\n  };\n\n  // Returns the first function passed as an argument to the second,\n  // allowing you to adjust arguments, run code before and after, and\n  // conditionally execute the original function.\n  _.wrap = function(func, wrapper) {\n    return function() {\n      var args = [func];\n      push.apply(args, arguments);\n      return wrapper.apply(this, args);\n    };\n  };\n\n  // Returns a function that is the composition of a list of functions, each\n  // consuming the return value of the function that follows.\n  _.compose = function() {\n    var funcs = arguments;\n    return function() {\n      var args = arguments;\n      for (var i = funcs.length - 1; i >= 0; i--) {\n        args = [funcs[i].apply(this, args)];\n      }\n      return args[0];\n    };\n  };\n\n  // Returns a function that will only be executed after being called N times.\n  _.after = function(times, func) {\n    if (times <= 0) return func();\n    return function() {\n      if (--times < 1) {\n        return func.apply(this, arguments);\n      }\n    };\n  };\n\n  // Object Functions\n  // ----------------\n\n  // Retrieve the names of an object's properties.\n  // Delegates to **ECMAScript 5**'s native `Object.keys`\n  _.keys = nativeKeys || function(obj) {\n    if (obj !== Object(obj)) throw new TypeError('Invalid object');\n    var keys = [];\n    for (var key in obj) if (_.has(obj, key)) keys[keys.length] = key;\n    return keys;\n  };\n\n  // Retrieve the values of an object's properties.\n  _.values = function(obj) {\n    var values = [];\n    for (var key in obj) if (_.has(obj, key)) values.push(obj[key]);\n    return values;\n  };\n\n  // Convert an object into a list of `[key, value]` pairs.\n  _.pairs = function(obj) {\n    var pairs = [];\n    for (var key in obj) if (_.has(obj, key)) pairs.push([key, obj[key]]);\n    return pairs;\n  };\n\n  // Invert the keys and values of an object. The values must be serializable.\n  _.invert = function(obj) {\n    var result = {};\n    for (var key in obj) if (_.has(obj, key)) result[obj[key]] = key;\n    return result;\n  };\n\n  // Return a sorted list of the function names available on the object.\n  // Aliased as `methods`\n  _.functions = _.methods = function(obj) {\n    var names = [];\n    for (var key in obj) {\n      if (_.isFunction(obj[key])) names.push(key);\n    }\n    return names.sort();\n  };\n\n  // Extend a given object with all the properties in passed-in object(s).\n  _.extend = function(obj) {\n    each(slice.call(arguments, 1), function(source) {\n      if (source) {\n        for (var prop in source) {\n          obj[prop] = source[prop];\n        }\n      }\n    });\n    return obj;\n  };\n\n  // Return a copy of the object only containing the whitelisted properties.\n  _.pick = function(obj) {\n    var copy = {};\n    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));\n    each(keys, function(key) {\n      if (key in obj) copy[key] = obj[key];\n    });\n    return copy;\n  };\n\n   // Return a copy of the object without the blacklisted properties.\n  _.omit = function(obj) {\n    var copy = {};\n    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));\n    for (var key in obj) {\n      if (!_.contains(keys, key)) copy[key] = obj[key];\n    }\n    return copy;\n  };\n\n  // Fill in a given object with default properties.\n  _.defaults = function(obj) {\n    each(slice.call(arguments, 1), function(source) {\n      if (source) {\n        for (var prop in source) {\n          if (obj[prop] == null) obj[prop] = source[prop];\n        }\n      }\n    });\n    return obj;\n  };\n\n  // Create a (shallow-cloned) duplicate of an object.\n  _.clone = function(obj) {\n    if (!_.isObject(obj)) return obj;\n    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);\n  };\n\n  // Invokes interceptor with the obj, and then returns obj.\n  // The primary purpose of this method is to \"tap into\" a method chain, in\n  // order to perform operations on intermediate results within the chain.\n  _.tap = function(obj, interceptor) {\n    interceptor(obj);\n    return obj;\n  };\n\n  // Internal recursive comparison function for `isEqual`.\n  var eq = function(a, b, aStack, bStack) {\n    // Identical objects are equal. `0 === -0`, but they aren't identical.\n    // See the Harmony `egal` proposal: http://wiki.ecmascript.org/doku.php?id=harmony:egal.\n    if (a === b) return a !== 0 || 1 / a == 1 / b;\n    // A strict comparison is necessary because `null == undefined`.\n    if (a == null || b == null) return a === b;\n    // Unwrap any wrapped objects.\n    if (a instanceof _) a = a._wrapped;\n    if (b instanceof _) b = b._wrapped;\n    // Compare `[[Class]]` names.\n    var className = toString.call(a);\n    if (className != toString.call(b)) return false;\n    switch (className) {\n      // Strings, numbers, dates, and booleans are compared by value.\n      case '[object String]':\n        // Primitives and their corresponding object wrappers are equivalent; thus, `\"5\"` is\n        // equivalent to `new String(\"5\")`.\n        return a == String(b);\n      case '[object Number]':\n        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for\n        // other numeric values.\n        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);\n      case '[object Date]':\n      case '[object Boolean]':\n        // Coerce dates and booleans to numeric primitive values. Dates are compared by their\n        // millisecond representations. Note that invalid dates with millisecond representations\n        // of `NaN` are not equivalent.\n        return +a == +b;\n      // RegExps are compared by their source patterns and flags.\n      case '[object RegExp]':\n        return a.source == b.source &&\n               a.global == b.global &&\n               a.multiline == b.multiline &&\n               a.ignoreCase == b.ignoreCase;\n    }\n    if (typeof a != 'object' || typeof b != 'object') return false;\n    // Assume equality for cyclic structures. The algorithm for detecting cyclic\n    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.\n    var length = aStack.length;\n    while (length--) {\n      // Linear search. Performance is inversely proportional to the number of\n      // unique nested structures.\n      if (aStack[length] == a) return bStack[length] == b;\n    }\n    // Add the first object to the stack of traversed objects.\n    aStack.push(a);\n    bStack.push(b);\n    var size = 0, result = true;\n    // Recursively compare objects and arrays.\n    if (className == '[object Array]') {\n      // Compare array lengths to determine if a deep comparison is necessary.\n      size = a.length;\n      result = size == b.length;\n      if (result) {\n        // Deep compare the contents, ignoring non-numeric properties.\n        while (size--) {\n          if (!(result = eq(a[size], b[size], aStack, bStack))) break;\n        }\n      }\n    } else {\n      // Objects with different constructors are not equivalent, but `Object`s\n      // from different frames are.\n      var aCtor = a.constructor, bCtor = b.constructor;\n      if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&\n                               _.isFunction(bCtor) && (bCtor instanceof bCtor))) {\n        return false;\n      }\n      // Deep compare objects.\n      for (var key in a) {\n        if (_.has(a, key)) {\n          // Count the expected number of properties.\n          size++;\n          // Deep compare each member.\n          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;\n        }\n      }\n      // Ensure that both objects contain the same number of properties.\n      if (result) {\n        for (key in b) {\n          if (_.has(b, key) && !(size--)) break;\n        }\n        result = !size;\n      }\n    }\n    // Remove the first object from the stack of traversed objects.\n    aStack.pop();\n    bStack.pop();\n    return result;\n  };\n\n  // Perform a deep comparison to check if two objects are equal.\n  _.isEqual = function(a, b) {\n    return eq(a, b, [], []);\n  };\n\n  // Is a given array, string, or object empty?\n  // An \"empty\" object has no enumerable own-properties.\n  _.isEmpty = function(obj) {\n    if (obj == null) return true;\n    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;\n    for (var key in obj) if (_.has(obj, key)) return false;\n    return true;\n  };\n\n  // Is a given value a DOM element?\n  _.isElement = function(obj) {\n    return !!(obj && obj.nodeType === 1);\n  };\n\n  // Is a given value an array?\n  // Delegates to ECMA5's native Array.isArray\n  _.isArray = nativeIsArray || function(obj) {\n    return toString.call(obj) == '[object Array]';\n  };\n\n  // Is a given variable an object?\n  _.isObject = function(obj) {\n    return obj === Object(obj);\n  };\n\n  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.\n  each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {\n    _['is' + name] = function(obj) {\n      return toString.call(obj) == '[object ' + name + ']';\n    };\n  });\n\n  // Define a fallback version of the method in browsers (ahem, IE), where\n  // there isn't any inspectable \"Arguments\" type.\n  if (!_.isArguments(arguments)) {\n    _.isArguments = function(obj) {\n      return !!(obj && _.has(obj, 'callee'));\n    };\n  }\n\n  // Optimize `isFunction` if appropriate.\n  if (typeof (/./) !== 'function') {\n    _.isFunction = function(obj) {\n      return typeof obj === 'function';\n    };\n  }\n\n  // Is a given object a finite number?\n  _.isFinite = function(obj) {\n    return isFinite(obj) && !isNaN(parseFloat(obj));\n  };\n\n  // Is the given value `NaN`? (NaN is the only number which does not equal itself).\n  _.isNaN = function(obj) {\n    return _.isNumber(obj) && obj != +obj;\n  };\n\n  // Is a given value a boolean?\n  _.isBoolean = function(obj) {\n    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';\n  };\n\n  // Is a given value equal to null?\n  _.isNull = function(obj) {\n    return obj === null;\n  };\n\n  // Is a given variable undefined?\n  _.isUndefined = function(obj) {\n    return obj === void 0;\n  };\n\n  // Shortcut function for checking if an object has a given property directly\n  // on itself (in other words, not on a prototype).\n  _.has = function(obj, key) {\n    return hasOwnProperty.call(obj, key);\n  };\n\n  // Utility Functions\n  // -----------------\n\n  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its\n  // previous owner. Returns a reference to the Underscore object.\n  _.noConflict = function() {\n    root._ = previousUnderscore;\n    return this;\n  };\n\n  // Keep the identity function around for default iterators.\n  _.identity = function(value) {\n    return value;\n  };\n\n  // Run a function **n** times.\n  _.times = function(n, iterator, context) {\n    var accum = Array(n);\n    for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);\n    return accum;\n  };\n\n  // Return a random integer between min and max (inclusive).\n  _.random = function(min, max) {\n    if (max == null) {\n      max = min;\n      min = 0;\n    }\n    return min + Math.floor(Math.random() * (max - min + 1));\n  };\n\n  // List of HTML entities for escaping.\n  var entityMap = {\n    escape: {\n      '&': '&amp;',\n      '<': '&lt;',\n      '>': '&gt;',\n      '\"': '&quot;',\n      \"'\": '&#x27;',\n      '/': '&#x2F;'\n    }\n  };\n  entityMap.unescape = _.invert(entityMap.escape);\n\n  // Regexes containing the keys and values listed immediately above.\n  var entityRegexes = {\n    escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),\n    unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')\n  };\n\n  // Functions for escaping and unescaping strings to/from HTML interpolation.\n  _.each(['escape', 'unescape'], function(method) {\n    _[method] = function(string) {\n      if (string == null) return '';\n      return ('' + string).replace(entityRegexes[method], function(match) {\n        return entityMap[method][match];\n      });\n    };\n  });\n\n  // If the value of the named property is a function then invoke it;\n  // otherwise, return it.\n  _.result = function(object, property) {\n    if (object == null) return null;\n    var value = object[property];\n    return _.isFunction(value) ? value.call(object) : value;\n  };\n\n  // Add your own custom functions to the Underscore object.\n  _.mixin = function(obj) {\n    each(_.functions(obj), function(name){\n      var func = _[name] = obj[name];\n      _.prototype[name] = function() {\n        var args = [this._wrapped];\n        push.apply(args, arguments);\n        return result.call(this, func.apply(_, args));\n      };\n    });\n  };\n\n  // Generate a unique integer id (unique within the entire client session).\n  // Useful for temporary DOM ids.\n  var idCounter = 0;\n  _.uniqueId = function(prefix) {\n    var id = ++idCounter + '';\n    return prefix ? prefix + id : id;\n  };\n\n  // By default, Underscore uses ERB-style template delimiters, change the\n  // following template settings to use alternative delimiters.\n  _.templateSettings = {\n    evaluate    : /<%([\\s\\S]+?)%>/g,\n    interpolate : /<%=([\\s\\S]+?)%>/g,\n    escape      : /<%-([\\s\\S]+?)%>/g\n  };\n\n  // When customizing `templateSettings`, if you don't want to define an\n  // interpolation, evaluation or escaping regex, we need one that is\n  // guaranteed not to match.\n  var noMatch = /(.)^/;\n\n  // Certain characters need to be escaped so that they can be put into a\n  // string literal.\n  var escapes = {\n    \"'\":      \"'\",\n    '\\\\':     '\\\\',\n    '\\r':     'r',\n    '\\n':     'n',\n    '\\t':     't',\n    '\\u2028': 'u2028',\n    '\\u2029': 'u2029'\n  };\n\n  var escaper = /\\\\|'|\\r|\\n|\\t|\\u2028|\\u2029/g;\n\n  // JavaScript micro-templating, similar to John Resig's implementation.\n  // Underscore templating handles arbitrary delimiters, preserves whitespace,\n  // and correctly escapes quotes within interpolated code.\n  _.template = function(text, data, settings) {\n    var render;\n    settings = _.defaults({}, settings, _.templateSettings);\n\n    // Combine delimiters into one regular expression via alternation.\n    var matcher = new RegExp([\n      (settings.escape || noMatch).source,\n      (settings.interpolate || noMatch).source,\n      (settings.evaluate || noMatch).source\n    ].join('|') + '|$', 'g');\n\n    // Compile the template source, escaping string literals appropriately.\n    var index = 0;\n    var source = \"__p+='\";\n    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {\n      source += text.slice(index, offset)\n        .replace(escaper, function(match) { return '\\\\' + escapes[match]; });\n\n      if (escape) {\n        source += \"'+\\n((__t=(\" + escape + \"))==null?'':_.escape(__t))+\\n'\";\n      }\n      if (interpolate) {\n        source += \"'+\\n((__t=(\" + interpolate + \"))==null?'':__t)+\\n'\";\n      }\n      if (evaluate) {\n        source += \"';\\n\" + evaluate + \"\\n__p+='\";\n      }\n      index = offset + match.length;\n      return match;\n    });\n    source += \"';\\n\";\n\n    // If a variable is not specified, place data values in local scope.\n    if (!settings.variable) source = 'with(obj||{}){\\n' + source + '}\\n';\n\n    source = \"var __t,__p='',__j=Array.prototype.join,\" +\n      \"print=function(){__p+=__j.call(arguments,'');};\\n\" +\n      source + \"return __p;\\n\";\n\n    try {\n      render = new Function(settings.variable || 'obj', '_', source);\n    } catch (e) {\n      e.source = source;\n      throw e;\n    }\n\n    if (data) return render(data, _);\n    var template = function(data) {\n      return render.call(this, data, _);\n    };\n\n    // Provide the compiled function source as a convenience for precompilation.\n    template.source = 'function(' + (settings.variable || 'obj') + '){\\n' + source + '}';\n\n    return template;\n  };\n\n  // Add a \"chain\" function, which will delegate to the wrapper.\n  _.chain = function(obj) {\n    return _(obj).chain();\n  };\n\n  // OOP\n  // ---------------\n  // If Underscore is called as a function, it returns a wrapped object that\n  // can be used OO-style. This wrapper holds altered versions of all the\n  // underscore functions. Wrapped objects may be chained.\n\n  // Helper function to continue chaining intermediate results.\n  var result = function(obj) {\n    return this._chain ? _(obj).chain() : obj;\n  };\n\n  // Add all of the Underscore functions to the wrapper object.\n  _.mixin(_);\n\n  // Add all mutator Array functions to the wrapper.\n  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {\n    var method = ArrayProto[name];\n    _.prototype[name] = function() {\n      var obj = this._wrapped;\n      method.apply(obj, arguments);\n      if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];\n      return result.call(this, obj);\n    };\n  });\n\n  // Add all accessor Array functions to the wrapper.\n  each(['concat', 'join', 'slice'], function(name) {\n    var method = ArrayProto[name];\n    _.prototype[name] = function() {\n      return result.call(this, method.apply(this._wrapped, arguments));\n    };\n  });\n\n  _.extend(_.prototype, {\n\n    // Start chaining a wrapped Underscore object.\n    chain: function() {\n      this._chain = true;\n      return this;\n    },\n\n    // Extracts the result from a wrapped and chained object.\n    value: function() {\n      return this._wrapped;\n    }\n\n  });\n\n}).call(this);\n\n//@ sourceURL=/node_modules/underscore/underscore.js"));
require.define("events",Function(["require","module","exports","__dirname","__filename","process","global"],"if (!process.EventEmitter) process.EventEmitter = function () {};\n\nvar EventEmitter = exports.EventEmitter = process.EventEmitter;\nvar isArray = typeof Array.isArray === 'function'\n    ? Array.isArray\n    : function (xs) {\n        return Object.prototype.toString.call(xs) === '[object Array]'\n    }\n;\n\n// By default EventEmitters will print a warning if more than\n// 10 listeners are added to it. This is a useful default which\n// helps finding memory leaks.\n//\n// Obviously not all Emitters should be limited to 10. This function allows\n// that to be increased. Set to zero for unlimited.\nvar defaultMaxListeners = 10;\nEventEmitter.prototype.setMaxListeners = function(n) {\n  if (!this._events) this._events = {};\n  this._events.maxListeners = n;\n};\n\n\nEventEmitter.prototype.emit = function(type) {\n  // If there is no 'error' event listener then throw.\n  if (type === 'error') {\n    if (!this._events || !this._events.error ||\n        (isArray(this._events.error) && !this._events.error.length))\n    {\n      if (arguments[1] instanceof Error) {\n        throw arguments[1]; // Unhandled 'error' event\n      } else {\n        throw new Error(\"Uncaught, unspecified 'error' event.\");\n      }\n      return false;\n    }\n  }\n\n  if (!this._events) return false;\n  var handler = this._events[type];\n  if (!handler) return false;\n\n  if (typeof handler == 'function') {\n    switch (arguments.length) {\n      // fast cases\n      case 1:\n        handler.call(this);\n        break;\n      case 2:\n        handler.call(this, arguments[1]);\n        break;\n      case 3:\n        handler.call(this, arguments[1], arguments[2]);\n        break;\n      // slower\n      default:\n        var args = Array.prototype.slice.call(arguments, 1);\n        handler.apply(this, args);\n    }\n    return true;\n\n  } else if (isArray(handler)) {\n    var args = Array.prototype.slice.call(arguments, 1);\n\n    var listeners = handler.slice();\n    for (var i = 0, l = listeners.length; i < l; i++) {\n      listeners[i].apply(this, args);\n    }\n    return true;\n\n  } else {\n    return false;\n  }\n};\n\n// EventEmitter is defined in src/node_events.cc\n// EventEmitter.prototype.emit() is also defined there.\nEventEmitter.prototype.addListener = function(type, listener) {\n  if ('function' !== typeof listener) {\n    throw new Error('addListener only takes instances of Function');\n  }\n\n  if (!this._events) this._events = {};\n\n  // To avoid recursion in the case that type == \"newListeners\"! Before\n  // adding it to the listeners, first emit \"newListeners\".\n  this.emit('newListener', type, listener);\n\n  if (!this._events[type]) {\n    // Optimize the case of one listener. Don't need the extra array object.\n    this._events[type] = listener;\n  } else if (isArray(this._events[type])) {\n\n    // Check for listener leak\n    if (!this._events[type].warned) {\n      var m;\n      if (this._events.maxListeners !== undefined) {\n        m = this._events.maxListeners;\n      } else {\n        m = defaultMaxListeners;\n      }\n\n      if (m && m > 0 && this._events[type].length > m) {\n        this._events[type].warned = true;\n        console.error('(node) warning: possible EventEmitter memory ' +\n                      'leak detected. %d listeners added. ' +\n                      'Use emitter.setMaxListeners() to increase limit.',\n                      this._events[type].length);\n        console.trace();\n      }\n    }\n\n    // If we've already got an array, just append.\n    this._events[type].push(listener);\n  } else {\n    // Adding the second element, need to change to array.\n    this._events[type] = [this._events[type], listener];\n  }\n\n  return this;\n};\n\nEventEmitter.prototype.on = EventEmitter.prototype.addListener;\n\nEventEmitter.prototype.once = function(type, listener) {\n  var self = this;\n  self.on(type, function g() {\n    self.removeListener(type, g);\n    listener.apply(this, arguments);\n  });\n\n  return this;\n};\n\nEventEmitter.prototype.removeListener = function(type, listener) {\n  if ('function' !== typeof listener) {\n    throw new Error('removeListener only takes instances of Function');\n  }\n\n  // does not use listeners(), so no side effect of creating _events[type]\n  if (!this._events || !this._events[type]) return this;\n\n  var list = this._events[type];\n\n  if (isArray(list)) {\n    var i = list.indexOf(listener);\n    if (i < 0) return this;\n    list.splice(i, 1);\n    if (list.length == 0)\n      delete this._events[type];\n  } else if (this._events[type] === listener) {\n    delete this._events[type];\n  }\n\n  return this;\n};\n\nEventEmitter.prototype.removeAllListeners = function(type) {\n  // does not use listeners(), so no side effect of creating _events[type]\n  if (type && this._events && this._events[type]) this._events[type] = null;\n  return this;\n};\n\nEventEmitter.prototype.listeners = function(type) {\n  if (!this._events) this._events = {};\n  if (!this._events[type]) this._events[type] = [];\n  if (!isArray(this._events[type])) {\n    this._events[type] = [this._events[type]];\n  }\n  return this._events[type];\n};\n\n//@ sourceURL=events"));
require.define("/src/shared/vars.js",Function(["require","module","exports","__dirname","__filename","process","global"],'// jshint -W001\n\n"use strict";\n\n// Identifiers provided by the ECMAScript standard.\n\nexports.reservedVars = {\n	arguments : false,\n	NaN       : false\n};\n\nexports.ecmaIdentifiers = {\n	Array              : false,\n	Boolean            : false,\n	Date               : false,\n	decodeURI          : false,\n	decodeURIComponent : false,\n	encodeURI          : false,\n	encodeURIComponent : false,\n	Error              : false,\n	"eval"             : false,\n	EvalError          : false,\n	Function           : false,\n	hasOwnProperty     : false,\n	isFinite           : false,\n	isNaN              : false,\n	JSON               : false,\n	Math               : false,\n	Map                : false,\n	Number             : false,\n	Object             : false,\n	parseInt           : false,\n	parseFloat         : false,\n	RangeError         : false,\n	ReferenceError     : false,\n	RegExp             : false,\n	Set                : false,\n	String             : false,\n	SyntaxError        : false,\n	TypeError          : false,\n	URIError           : false,\n	WeakMap            : false\n};\n\n// Global variables commonly provided by a web browser environment.\n\nexports.browser = {\n	ArrayBuffer          : false,\n	ArrayBufferView      : false,\n	Audio                : false,\n	Blob                 : false,\n	addEventListener     : false,\n	applicationCache     : false,\n	atob                 : false,\n	blur                 : false,\n	btoa                 : false,\n	clearInterval        : false,\n	clearTimeout         : false,\n	close                : false,\n	closed               : false,\n	DataView             : false,\n	DOMParser            : false,\n	defaultStatus        : false,\n	document             : false,\n	Element              : false,\n	event                : false,\n	FileReader           : false,\n	Float32Array         : false,\n	Float64Array         : false,\n	FormData             : false,\n	focus                : false,\n	frames               : false,\n	getComputedStyle     : false,\n	HTMLElement          : false,\n	HTMLAnchorElement    : false,\n	HTMLBaseElement      : false,\n	HTMLBlockquoteElement: false,\n	HTMLBodyElement      : false,\n	HTMLBRElement        : false,\n	HTMLButtonElement    : false,\n	HTMLCanvasElement    : false,\n	HTMLDirectoryElement : false,\n	HTMLDivElement       : false,\n	HTMLDListElement     : false,\n	HTMLFieldSetElement  : false,\n	HTMLFontElement      : false,\n	HTMLFormElement      : false,\n	HTMLFrameElement     : false,\n	HTMLFrameSetElement  : false,\n	HTMLHeadElement      : false,\n	HTMLHeadingElement   : false,\n	HTMLHRElement        : false,\n	HTMLHtmlElement      : false,\n	HTMLIFrameElement    : false,\n	HTMLImageElement     : false,\n	HTMLInputElement     : false,\n	HTMLIsIndexElement   : false,\n	HTMLLabelElement     : false,\n	HTMLLayerElement     : false,\n	HTMLLegendElement    : false,\n	HTMLLIElement        : false,\n	HTMLLinkElement      : false,\n	HTMLMapElement       : false,\n	HTMLMenuElement      : false,\n	HTMLMetaElement      : false,\n	HTMLModElement       : false,\n	HTMLObjectElement    : false,\n	HTMLOListElement     : false,\n	HTMLOptGroupElement  : false,\n	HTMLOptionElement    : false,\n	HTMLParagraphElement : false,\n	HTMLParamElement     : false,\n	HTMLPreElement       : false,\n	HTMLQuoteElement     : false,\n	HTMLScriptElement    : false,\n	HTMLSelectElement    : false,\n	HTMLStyleElement     : false,\n	HTMLTableCaptionElement: false,\n	HTMLTableCellElement : false,\n	HTMLTableColElement  : false,\n	HTMLTableElement     : false,\n	HTMLTableRowElement  : false,\n	HTMLTableSectionElement: false,\n	HTMLTextAreaElement  : false,\n	HTMLTitleElement     : false,\n	HTMLUListElement     : false,\n	HTMLVideoElement     : false,\n	history              : false,\n	Int16Array           : false,\n	Int32Array           : false,\n	Int8Array            : false,\n	Image                : false,\n	length               : false,\n	localStorage         : false,\n	location             : false,\n	MessageChannel       : false,\n	MessageEvent         : false,\n	MessagePort          : false,\n	moveBy               : false,\n	moveTo               : false,\n	MutationObserver     : false,\n	name                 : false,\n	Node                 : false,\n	NodeFilter           : false,\n	navigator            : false,\n	onbeforeunload       : true,\n	onblur               : true,\n	onerror              : true,\n	onfocus              : true,\n	onload               : true,\n	onresize             : true,\n	onunload             : true,\n	open                 : false,\n	openDatabase         : false,\n	opener               : false,\n	Option               : false,\n	parent               : false,\n	print                : false,\n	removeEventListener  : false,\n	resizeBy             : false,\n	resizeTo             : false,\n	screen               : false,\n	scroll               : false,\n	scrollBy             : false,\n	scrollTo             : false,\n	sessionStorage       : false,\n	setInterval          : false,\n	setTimeout           : false,\n	SharedWorker         : false,\n	status               : false,\n	top                  : false,\n	Uint16Array          : false,\n	Uint32Array          : false,\n	Uint8Array           : false,\n	Uint8ClampedArray    : false,\n	WebSocket            : false,\n	window               : false,\n	Worker               : false,\n	XMLHttpRequest       : false,\n	XMLSerializer        : false,\n	XPathEvaluator       : false,\n	XPathException       : false,\n	XPathExpression      : false,\n	XPathNamespace       : false,\n	XPathNSResolver      : false,\n	XPathResult          : false\n};\n\nexports.devel = {\n	alert  : false,\n	confirm: false,\n	console: false,\n	Debug  : false,\n	opera  : false,\n	prompt : false\n};\n\nexports.worker = {\n	importScripts: true,\n	postMessage  : true,\n	self         : true\n};\n\n// Widely adopted global names that are not part of ECMAScript standard\nexports.nonstandard = {\n	escape  : false,\n	unescape: false\n};\n\n// Globals provided by popular JavaScript environments.\n\nexports.couch = {\n	"require" : false,\n	respond   : false,\n	getRow    : false,\n	emit      : false,\n	send      : false,\n	start     : false,\n	sum       : false,\n	log       : false,\n	exports   : false,\n	module    : false,\n	provides  : false\n};\n\nexports.node = {\n	__filename   : false,\n	__dirname    : false,\n	Buffer       : false,\n	DataView     : false,\n	console      : false,\n	exports      : true,  // In Node it is ok to exports = module.exports = foo();\n	GLOBAL       : false,\n	global       : false,\n	module       : false,\n	process      : false,\n	require      : false,\n	setTimeout   : false,\n	clearTimeout : false,\n	setInterval  : false,\n	clearInterval: false\n};\n\nexports.phantom = {\n	phantom      : true,\n	require      : true,\n	WebPage      : true\n};\n\nexports.rhino = {\n	defineClass  : false,\n	deserialize  : false,\n	gc           : false,\n	help         : false,\n	importPackage: false,\n	"java"       : false,\n	load         : false,\n	loadClass    : false,\n	print        : false,\n	quit         : false,\n	readFile     : false,\n	readUrl      : false,\n	runCommand   : false,\n	seal         : false,\n	serialize    : false,\n	spawn        : false,\n	sync         : false,\n	toint32      : false,\n	version      : false\n};\n\nexports.wsh = {\n	ActiveXObject            : true,\n	Enumerator               : true,\n	GetObject                : true,\n	ScriptEngine             : true,\n	ScriptEngineBuildVersion : true,\n	ScriptEngineMajorVersion : true,\n	ScriptEngineMinorVersion : true,\n	VBArray                  : true,\n	WSH                      : true,\n	WScript                  : true,\n	XDomainRequest           : true\n};\n\n// Globals provided by popular JavaScript libraries.\n\nexports.dojo = {\n	dojo     : false,\n	dijit    : false,\n	dojox    : false,\n	define	 : false,\n	"require": false\n};\n\nexports.jquery = {\n	"$"    : false,\n	jQuery : false\n};\n\nexports.mootools = {\n	"$"           : false,\n	"$$"          : false,\n	Asset         : false,\n	Browser       : false,\n	Chain         : false,\n	Class         : false,\n	Color         : false,\n	Cookie        : false,\n	Core          : false,\n	Document      : false,\n	DomReady      : false,\n	DOMEvent      : false,\n	DOMReady      : false,\n	Drag          : false,\n	Element       : false,\n	Elements      : false,\n	Event         : false,\n	Events        : false,\n	Fx            : false,\n	Group         : false,\n	Hash          : false,\n	HtmlTable     : false,\n	Iframe        : false,\n	IframeShim    : false,\n	InputValidator: false,\n	instanceOf    : false,\n	Keyboard      : false,\n	Locale        : false,\n	Mask          : false,\n	MooTools      : false,\n	Native        : false,\n	Options       : false,\n	OverText      : false,\n	Request       : false,\n	Scroller      : false,\n	Slick         : false,\n	Slider        : false,\n	Sortables     : false,\n	Spinner       : false,\n	Swiff         : false,\n	Tips          : false,\n	Type          : false,\n	typeOf        : false,\n	URI           : false,\n	Window        : false\n};\n\nexports.prototypejs = {\n	"$"               : false,\n	"$$"              : false,\n	"$A"              : false,\n	"$F"              : false,\n	"$H"              : false,\n	"$R"              : false,\n	"$break"          : false,\n	"$continue"       : false,\n	"$w"              : false,\n	Abstract          : false,\n	Ajax              : false,\n	Class             : false,\n	Enumerable        : false,\n	Element           : false,\n	Event             : false,\n	Field             : false,\n	Form              : false,\n	Hash              : false,\n	Insertion         : false,\n	ObjectRange       : false,\n	PeriodicalExecuter: false,\n	Position          : false,\n	Prototype         : false,\n	Selector          : false,\n	Template          : false,\n	Toggle            : false,\n	Try               : false,\n	Autocompleter     : false,\n	Builder           : false,\n	Control           : false,\n	Draggable         : false,\n	Draggables        : false,\n	Droppables        : false,\n	Effect            : false,\n	Sortable          : false,\n	SortableObserver  : false,\n	Sound             : false,\n	Scriptaculous     : false\n};\n\nexports.yui = {\n	YUI       : false,\n	Y         : false,\n	YUI_config: false\n};\n\n\n//@ sourceURL=/src/shared/vars.js'));
require.define("/src/shared/messages.js",Function(["require","module","exports","__dirname","__filename","process","global"],'"use strict";\n\nvar _ = require("underscore");\n\nvar errors = {\n	// JSHint options\n	E001: "Bad option: \'{a}\'.",\n	E002: "Bad option value.",\n\n	// JSHint input\n	E003: "Expected a JSON value.",\n	E004: "Input is neither a string nor an array of strings.",\n	E005: "Input is empty.",\n	E006: "Unexpected early end of program.",\n\n	// Strict mode\n	E007: "Missing \\"use strict\\" statement.",\n	E008: "Strict violation.",\n	E009: "Option \'validthis\' can\'t be used in a global scope.",\n	E010: "\'with\' is not allowed in strict mode.",\n\n	// Constants\n	E011: "const \'{a}\' has already been declared.",\n	E012: "const \'{a}\' is initialized to \'undefined\'.",\n	E013: "Attempting to override \'{a}\' which is a constant.",\n\n	// Regular expressions\n	E014: "A regular expression literal can be confused with \'/=\'.",\n	E015: "Unclosed regular expression.",\n	E016: "Invalid regular expression.",\n\n	// Tokens\n	E017: "Unclosed comment.",\n	E018: "Unbegun comment.",\n	E019: "Unmatched \'{a}\'.",\n	E020: "Expected \'{a}\' to match \'{b}\' from line {c} and instead saw \'{d}\'.",\n	E021: "Expected \'{a}\' and instead saw \'{b}\'.",\n	E022: "Line breaking error \'{a}\'.",\n	E023: "Missing \'{a}\'.",\n	E024: "Unexpected \'{a}\'.",\n	E025: "Missing \':\' on a case clause.",\n	E026: "Missing \'}\' to match \'{\' from line {a}.",\n	E027: "Missing \']\' to match \'[\' form line {a}.",\n	E028: "Illegal comma.",\n	E029: "Unclosed string.",\n\n	// Everything else\n	E030: "Expected an identifier and instead saw \'{a}\'.",\n	E031: "Bad assignment.", // FIXME: Rephrase\n	E032: "Expected a small integer and instead saw \'{a}\'.",\n	E033: "Expected an operator and instead saw \'{a}\'.",\n	E034: "get/set are ES5 features.",\n	E035: "Missing property name.",\n	E036: "Expected to see a statement and instead saw a block.",\n	E037: "Constant {a} was not declared correctly.",\n	E038: "Variable {a} was not declared correctly.",\n	E039: "Function declarations are not invocable. Wrap the whole function invocation in parens.",\n	E040: "Each value should have its own case label.",\n	E041: "Unrecoverable syntax error.",\n	E042: "Stopping.",\n	E043: "Too many errors."\n};\n\nvar warnings = {\n	W001: "\'hasOwnProperty\' is a really bad name.",\n	W002: "Value of \'{a}\' may be overwritten in IE.",\n	W003: "\'{a}\' was used before it was defined.",\n	W004: "\'{a}\' is already defined.",\n	W005: "A dot following a number can be confused with a decimal point.",\n	W006: "Confusing minuses.",\n	W007: "Confusing pluses.",\n	W008: "A leading decimal point can be confused with a dot: \'{a}\'.",\n	W009: "The array literal notation [] is preferrable.",\n	W010: "The object literal notation {} is preferrable.",\n	W011: "Unexpected space after \'{a}\'.",\n	W012: "Unexpected space before \'{a}\'.",\n	W013: "Missing space after \'{a}\'.",\n	W014: "Bad line breaking before \'{a}\'.",\n	W015: "Expected \'{a}\' to have an indentation at {b} instead at {c}.",\n	W016: "Unexpected use of \'{a}\'.",\n	W017: "Bad operand.",\n	W018: "Confusing use of \'{a}\'.",\n	W019: "Use the isNaN function to compare with NaN.",\n	W020: "Read only.",\n	W021: "\'{a}\' is a function.",\n	W022: "Do not assign to the exception parameter.",\n	W023: "Expected an identifier in an assignment and instead saw a function invocation.",\n	W024: "Expected an identifier and instead saw \'{a}\' (a reserved word).",\n	W025: "Missing name in function declaration.",\n	W026: "Inner functions should be listed at the top of the outer function.",\n	W027: "Unreachable \'{a}\' after \'{b}\'.",\n	W028: "Label \'{a}\' on {b} statement.",\n	W029: "Label \'{a}\' looks like a javascript url.",\n	W030: "Expected an assignment or function call and instead saw an expression.",\n	W031: "Do not use \'new\' for side effects.",\n	W032: "Unnecessary semicolon.",\n	W033: "Missing semicolon.",\n	W034: "Unnecessary directive \\"{a}\\".",\n	W035: "Empty block.",\n	W036: "Unexpected /*member \'{a}\'.",\n	W037: "\'{a}\' is a statement label.",\n	W038: "\'{a}\' used out of scope.",\n	W039: "\'{a}\' is not allowed.",\n	W040: "Possible strict violation.",\n	W041: "Use \'{a}\' to compare with \'{b}\'.",\n	W042: "Avoid EOL escaping.",\n	W043: "Bad escaping of EOL. Use option multistr if needed.",\n	W044: "Bad escaping.",\n	W045: "Bad number \'{a}\'.",\n	W046: "Don\'t use extra leading zeros \'{a}\'.",\n	W047: "A trailing decimal point can be confused with a dot: \'{a}\'.",\n	W048: "Unexpected control character in regular expression.",\n	W049: "Unexpected escaped character \'{a}\' in regular expression.",\n	W050: "JavaScript URL.",\n	W051: "Variables should not be deleted.",\n	W052: "Unexpected \'{a}\'.",\n	W053: "Do not use {a} as a constructor.",\n	W054: "The Function constructor is a form of eval.",\n	W055: "A constructor name should start with an uppercase letter.",\n	W056: "Bad constructor.",\n	W057: "Weird construction. Is \'new\' unnecessary?",\n	W058: "Missing \'()\' invoking a constructor.",\n	W059: "Avoid arguments.{a}.",\n	W060: "document.write can be a form of eval.",\n	W061: "eval can be harmful.",\n	W062: "Wrap an immediate function invocation in parens " +\n		"to assist the reader in understanding that the expression " +\n		"is the result of a function, and not the function itself.",\n	W063: "Math is not a function.",\n	W064: "Missing \'new\' prefix when invoking a constructor.",\n	W065: "Missing radix parameter.",\n	W066: "Implied eval. Consider passing a function instead of a string.",\n	W067: "Bad invocation.",\n	W068: "Wrapping non-IIFE function literals in parens is unnecessary.",\n	W069: "[\'{a}\'] is better written in dot notation.",\n	W070: "Extra comma. (it breaks older versions of IE)",\n	W071: "This function has too many statements. ({a})",\n	W072: "This function has too many parameters. ({a})",\n	W073: "Blocks are nested too deeply. ({a})",\n	W074: "This function\'s cyclomatic complexity is too high. ({a})",\n	W075: "Duplicate key \'{a}\'.",\n	W076: "Unexpected parameter \'{a}\' in get {b} function.",\n	W077: "Expected a single parameter in set {a} function.",\n	W078: "Setter is defined without getter.",\n	W079: "Redefinition of \'{a}\'.",\n	W080: "It\'s not necessary to initialize \'{a}\' to \'undefined\'.",\n	W081: "Too many var statements.",\n	W082: "Function declarations should not be placed in blocks. " +\n		"Use a function expression or move the statement to the top of " +\n		"the outer function.",\n	W083: "Don\'t make functions within a loop.",\n	W084: "Expected a conditional expression and instead saw an assignment.",\n	W085: "Don\'t use \'with\'.",\n	W086: "Expected a \'break\' statement before \'{a}\'.",\n	W087: "Forgotten \'debugger\' statement?",\n	W088: "Creating global \'for\' variable. Should be \'for (var {a} ...\'.",\n	W089: "The body of a for in should be wrapped in an if statement to filter " +\n		"unwanted properties from the prototype.",\n	W090: "\'{a}\' is not a statement label.",\n	W091: "\'{a}\' is out of scope.",\n	W092: "Wrap the /regexp/ literal in parens to disambiguate the slash operator.",\n	W093: "Did you mean to return a conditional instead of an assignment?",\n	W094: "Unexpected comma.",\n	W095: "Expected a string and instead saw {a}.",\n	W096: "The \'{a}\' key may produce unexpected results.",\n	W097: "Use the function form of \\"use strict\\".",\n	W098: "\'{a}\' is defined but never used.",\n	W099: "Mixed spaces and tabs.",\n	W100: "This character may get silently deleted by one or more browsers.",\n	W101: "Line is too long.",\n	W102: "Trailing whitespace.",\n	W103: "The \'{a}\' property is deprecated.",\n	W104: "\'{a}\' is only available in JavaScript 1.7.",\n	W105: "Unexpected {a} in \'{b}\'.",\n	W106: "Identifier \'{a}\' is not in camel case.",\n	W107: "Script URL.",\n	W108: "Strings must use doublequote.",\n	W109: "Strings must use singlequote.",\n	W110: "Mixed double and single quotes.",\n	W112: "Unclosed string.",\n	W113: "Control character in string: {a}.",\n	W114: "Avoid {a}.",\n	W115: "Octal literals are not allowed in strict mode.",\n	W116: "Expected \'{a}\' and instead saw \'{b}\'.",\n	W117: "\'{a}\' is not defined.",\n};\n\nvar info = {\n	I001: "Comma warnings can be turned off with \'laxcomma\'."\n};\n\nexports.errors = {};\nexports.warnings = {};\nexports.info = {};\n\n_.each(errors, function (desc, code) {\n	exports.errors[code] = { code: code, desc: desc };\n});\n\n_.each(warnings, function (desc, code) {\n	exports.warnings[code] = { code: code, desc: desc };\n});\n\n_.each(info, function (desc, code) {\n	exports.info[code] = { code: code, desc: desc };\n});\n\n//@ sourceURL=/src/shared/messages.js'));
require.define("/src/stable/lex.js",Function(["require","module","exports","__dirname","__filename","process","global"],'/*\n * Lexical analysis and token construction.\n */\n\n"use strict";\n\nvar _      = require("underscore");\nvar events = require("events");\nvar reg    = require("./reg.js");\nvar state  = require("./state.js").state;\n\n// Some of these token types are from JavaScript Parser API\n// while others are specific to JSHint parser.\n// JS Parser API: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API\n\nvar Token = {\n	Identifier: 1,\n	Punctuator: 2,\n	NumericLiteral: 3,\n	StringLiteral: 4,\n	Comment: 5,\n	Keyword: 6,\n	NullLiteral: 7,\n	BooleanLiteral: 8,\n	RegExp: 9\n};\n\n// This is auto generated from the unicode tables.\n// The tables are at:\n// http://www.fileformat.info/info/unicode/category/Lu/list.htm\n// http://www.fileformat.info/info/unicode/category/Ll/list.htm\n// http://www.fileformat.info/info/unicode/category/Lt/list.htm\n// http://www.fileformat.info/info/unicode/category/Lm/list.htm\n// http://www.fileformat.info/info/unicode/category/Lo/list.htm\n// http://www.fileformat.info/info/unicode/category/Nl/list.htm\n\nvar unicodeLetterTable = [\n	170, 170, 181, 181, 186, 186, 192, 214,\n	216, 246, 248, 705, 710, 721, 736, 740, 748, 748, 750, 750,\n	880, 884, 886, 887, 890, 893, 902, 902, 904, 906, 908, 908,\n	910, 929, 931, 1013, 1015, 1153, 1162, 1319, 1329, 1366,\n	1369, 1369, 1377, 1415, 1488, 1514, 1520, 1522, 1568, 1610,\n	1646, 1647, 1649, 1747, 1749, 1749, 1765, 1766, 1774, 1775,\n	1786, 1788, 1791, 1791, 1808, 1808, 1810, 1839, 1869, 1957,\n	1969, 1969, 1994, 2026, 2036, 2037, 2042, 2042, 2048, 2069,\n	2074, 2074, 2084, 2084, 2088, 2088, 2112, 2136, 2308, 2361,\n	2365, 2365, 2384, 2384, 2392, 2401, 2417, 2423, 2425, 2431,\n	2437, 2444, 2447, 2448, 2451, 2472, 2474, 2480, 2482, 2482,\n	2486, 2489, 2493, 2493, 2510, 2510, 2524, 2525, 2527, 2529,\n	2544, 2545, 2565, 2570, 2575, 2576, 2579, 2600, 2602, 2608,\n	2610, 2611, 2613, 2614, 2616, 2617, 2649, 2652, 2654, 2654,\n	2674, 2676, 2693, 2701, 2703, 2705, 2707, 2728, 2730, 2736,\n	2738, 2739, 2741, 2745, 2749, 2749, 2768, 2768, 2784, 2785,\n	2821, 2828, 2831, 2832, 2835, 2856, 2858, 2864, 2866, 2867,\n	2869, 2873, 2877, 2877, 2908, 2909, 2911, 2913, 2929, 2929,\n	2947, 2947, 2949, 2954, 2958, 2960, 2962, 2965, 2969, 2970,\n	2972, 2972, 2974, 2975, 2979, 2980, 2984, 2986, 2990, 3001,\n	3024, 3024, 3077, 3084, 3086, 3088, 3090, 3112, 3114, 3123,\n	3125, 3129, 3133, 3133, 3160, 3161, 3168, 3169, 3205, 3212,\n	3214, 3216, 3218, 3240, 3242, 3251, 3253, 3257, 3261, 3261,\n	3294, 3294, 3296, 3297, 3313, 3314, 3333, 3340, 3342, 3344,\n	3346, 3386, 3389, 3389, 3406, 3406, 3424, 3425, 3450, 3455,\n	3461, 3478, 3482, 3505, 3507, 3515, 3517, 3517, 3520, 3526,\n	3585, 3632, 3634, 3635, 3648, 3654, 3713, 3714, 3716, 3716,\n	3719, 3720, 3722, 3722, 3725, 3725, 3732, 3735, 3737, 3743,\n	3745, 3747, 3749, 3749, 3751, 3751, 3754, 3755, 3757, 3760,\n	3762, 3763, 3773, 3773, 3776, 3780, 3782, 3782, 3804, 3805,\n	3840, 3840, 3904, 3911, 3913, 3948, 3976, 3980, 4096, 4138,\n	4159, 4159, 4176, 4181, 4186, 4189, 4193, 4193, 4197, 4198,\n	4206, 4208, 4213, 4225, 4238, 4238, 4256, 4293, 4304, 4346,\n	4348, 4348, 4352, 4680, 4682, 4685, 4688, 4694, 4696, 4696,\n	4698, 4701, 4704, 4744, 4746, 4749, 4752, 4784, 4786, 4789,\n	4792, 4798, 4800, 4800, 4802, 4805, 4808, 4822, 4824, 4880,\n	4882, 4885, 4888, 4954, 4992, 5007, 5024, 5108, 5121, 5740,\n	5743, 5759, 5761, 5786, 5792, 5866, 5870, 5872, 5888, 5900,\n	5902, 5905, 5920, 5937, 5952, 5969, 5984, 5996, 5998, 6000,\n	6016, 6067, 6103, 6103, 6108, 6108, 6176, 6263, 6272, 6312,\n	6314, 6314, 6320, 6389, 6400, 6428, 6480, 6509, 6512, 6516,\n	6528, 6571, 6593, 6599, 6656, 6678, 6688, 6740, 6823, 6823,\n	6917, 6963, 6981, 6987, 7043, 7072, 7086, 7087, 7104, 7141,\n	7168, 7203, 7245, 7247, 7258, 7293, 7401, 7404, 7406, 7409,\n	7424, 7615, 7680, 7957, 7960, 7965, 7968, 8005, 8008, 8013,\n	8016, 8023, 8025, 8025, 8027, 8027, 8029, 8029, 8031, 8061,\n	8064, 8116, 8118, 8124, 8126, 8126, 8130, 8132, 8134, 8140,\n	8144, 8147, 8150, 8155, 8160, 8172, 8178, 8180, 8182, 8188,\n	8305, 8305, 8319, 8319, 8336, 8348, 8450, 8450, 8455, 8455,\n	8458, 8467, 8469, 8469, 8473, 8477, 8484, 8484, 8486, 8486,\n	8488, 8488, 8490, 8493, 8495, 8505, 8508, 8511, 8517, 8521,\n	8526, 8526, 8544, 8584, 11264, 11310, 11312, 11358,\n	11360, 11492, 11499, 11502, 11520, 11557, 11568, 11621,\n	11631, 11631, 11648, 11670, 11680, 11686, 11688, 11694,\n	11696, 11702, 11704, 11710, 11712, 11718, 11720, 11726,\n	11728, 11734, 11736, 11742, 11823, 11823, 12293, 12295,\n	12321, 12329, 12337, 12341, 12344, 12348, 12353, 12438,\n	12445, 12447, 12449, 12538, 12540, 12543, 12549, 12589,\n	12593, 12686, 12704, 12730, 12784, 12799, 13312, 13312,\n	19893, 19893, 19968, 19968, 40907, 40907, 40960, 42124,\n	42192, 42237, 42240, 42508, 42512, 42527, 42538, 42539,\n	42560, 42606, 42623, 42647, 42656, 42735, 42775, 42783,\n	42786, 42888, 42891, 42894, 42896, 42897, 42912, 42921,\n	43002, 43009, 43011, 43013, 43015, 43018, 43020, 43042,\n	43072, 43123, 43138, 43187, 43250, 43255, 43259, 43259,\n	43274, 43301, 43312, 43334, 43360, 43388, 43396, 43442,\n	43471, 43471, 43520, 43560, 43584, 43586, 43588, 43595,\n	43616, 43638, 43642, 43642, 43648, 43695, 43697, 43697,\n	43701, 43702, 43705, 43709, 43712, 43712, 43714, 43714,\n	43739, 43741, 43777, 43782, 43785, 43790, 43793, 43798,\n	43808, 43814, 43816, 43822, 43968, 44002, 44032, 44032,\n	55203, 55203, 55216, 55238, 55243, 55291, 63744, 64045,\n	64048, 64109, 64112, 64217, 64256, 64262, 64275, 64279,\n	64285, 64285, 64287, 64296, 64298, 64310, 64312, 64316,\n	64318, 64318, 64320, 64321, 64323, 64324, 64326, 64433,\n	64467, 64829, 64848, 64911, 64914, 64967, 65008, 65019,\n	65136, 65140, 65142, 65276, 65313, 65338, 65345, 65370,\n	65382, 65470, 65474, 65479, 65482, 65487, 65490, 65495,\n	65498, 65500, 65536, 65547, 65549, 65574, 65576, 65594,\n	65596, 65597, 65599, 65613, 65616, 65629, 65664, 65786,\n	65856, 65908, 66176, 66204, 66208, 66256, 66304, 66334,\n	66352, 66378, 66432, 66461, 66464, 66499, 66504, 66511,\n	66513, 66517, 66560, 66717, 67584, 67589, 67592, 67592,\n	67594, 67637, 67639, 67640, 67644, 67644, 67647, 67669,\n	67840, 67861, 67872, 67897, 68096, 68096, 68112, 68115,\n	68117, 68119, 68121, 68147, 68192, 68220, 68352, 68405,\n	68416, 68437, 68448, 68466, 68608, 68680, 69635, 69687,\n	69763, 69807, 73728, 74606, 74752, 74850, 77824, 78894,\n	92160, 92728, 110592, 110593, 119808, 119892, 119894, 119964,\n	119966, 119967, 119970, 119970, 119973, 119974, 119977, 119980,\n	119982, 119993, 119995, 119995, 119997, 120003, 120005, 120069,\n	120071, 120074, 120077, 120084, 120086, 120092, 120094, 120121,\n	120123, 120126, 120128, 120132, 120134, 120134, 120138, 120144,\n	120146, 120485, 120488, 120512, 120514, 120538, 120540, 120570,\n	120572, 120596, 120598, 120628, 120630, 120654, 120656, 120686,\n	120688, 120712, 120714, 120744, 120746, 120770, 120772, 120779,\n	131072, 131072, 173782, 173782, 173824, 173824, 177972, 177972,\n	177984, 177984, 178205, 178205, 194560, 195101\n];\n\nvar identifierStartTable = [];\n\nfor (var i = 0; i < 128; i++) {\n	identifierStartTable[i] =\n		i === 36 ||           // $\n		i >= 65 && i <= 90 || // A-Z\n		i === 95 ||           // _\n		i >= 97 && i <= 122;  // a-z\n}\n\nvar identifierPartTable = [];\n\nfor (var i = 0; i < 128; i++) {\n	identifierPartTable[i] =\n		identifierStartTable[i] || // $, _, A-Z, a-z\n		i >= 48 && i <= 57;        // 0-9\n}\n\n/*\n * Lexer for JSHint.\n *\n * This object does a char-by-char scan of the provided source code\n * and produces a sequence of tokens.\n *\n *   var lex = new Lexer("var i = 0;");\n *   lex.start();\n *   lex.token(); // returns the next token\n *\n * You have to use the token() method to move the lexer forward\n * but you don\'t have to use its return value to get tokens. In addition\n * to token() method returning the next token, the Lexer object also\n * emits events.\n *\n *   lex.on("Identifier", function (data) {\n *     if (data.name.indexOf("_") >= 0) {\n *       // Produce a warning.\n *     }\n *   });\n *\n * Note that the token() method returns tokens in a JSLint-compatible\n * format while the event emitter uses a slightly modified version of\n * Mozilla\'s JavaScript Parser API. Eventually, we will move away from\n * JSLint format.\n */\nfunction Lexer(source) {\n	var lines = source;\n\n	if (typeof lines === "string") {\n		lines = lines\n			.replace(/\\r\\n/g, "\\n")\n			.replace(/\\r/g, "\\n")\n			.split("\\n");\n	}\n\n	// If the first line is a shebang (#!), make it a blank and move on.\n	// Shebangs are used by Node scripts.\n\n	if (lines[0] && lines[0].substr(0, 2) === "#!") {\n		lines[0] = "";\n	}\n\n	this.emitter = new events.EventEmitter();\n	this.source = source;\n	this.lines = lines;\n	this.prereg = true;\n\n	this.line = 0;\n	this.char = 1;\n	this.from = 1;\n	this.input = "";\n\n	for (var i = 0; i < state.option.indent; i += 1) {\n		state.tab += " ";\n	}\n}\n\nLexer.prototype = {\n	_lines: [],\n\n	get lines() {\n		this._lines = state.lines;\n		return this._lines;\n	},\n\n	set lines(val) {\n		this._lines = val;\n		state.lines = this._lines;\n	},\n\n	/*\n	 * Return the next i character without actually moving the\n	 * char pointer.\n	 */\n	peek: function (i) {\n		return this.input.charAt(i || 0);\n	},\n\n	/*\n	 * Move the char pointer forward i times.\n	 */\n	skip: function (i) {\n		i = i || 1;\n		this.char += i;\n		this.input = this.input.slice(i);\n	},\n\n	/*\n	 * Subscribe to a token event. The API for this method is similar\n	 * Underscore.js i.e. you can subscribe to multiple events with\n	 * one call:\n	 *\n	 *   lex.on("Identifier Number", function (data) {\n	 *     // ...\n	 *   });\n	 */\n	on: function (names, listener) {\n		names.split(" ").forEach(function (name) {\n			this.emitter.on(name, listener);\n		}.bind(this));\n	},\n\n	/*\n	 * Trigger a token event. All arguments will be passed to each\n	 * listener.\n	 */\n	trigger: function () {\n		this.emitter.emit.apply(this.emitter, Array.prototype.slice.call(arguments));\n	},\n\n	/*\n	 * Extract a punctuator out of the next sequence of characters\n	 * or return \'null\' if its not possible.\n	 *\n	 * This method\'s implementation was heavily influenced by the\n	 * scanPunctuator function in the Esprima parser\'s source code.\n	 */\n	scanPunctuator: function () {\n		var ch1 = this.peek();\n		var ch2, ch3, ch4;\n\n		switch (ch1) {\n		// Most common single-character punctuators\n		case ".":\n			if ((/^[0-9]$/).test(this.peek(1))) {\n				return null;\n			}\n\n			/* falls through */\n		case "(":\n		case ")":\n		case ";":\n		case ",":\n		case "{":\n		case "}":\n		case "[":\n		case "]":\n		case ":":\n		case "~":\n		case "?":\n			return {\n				type: Token.Punctuator,\n				value: ch1\n			};\n\n		// A pound sign (for Node shebangs)\n		case "#":\n			return {\n				type: Token.Punctuator,\n				value: ch1\n			};\n\n		// We\'re at the end of input\n		case "":\n			return null;\n		}\n\n		// Peek more characters\n\n		ch2 = this.peek(1);\n		ch3 = this.peek(2);\n		ch4 = this.peek(3);\n\n		// 4-character punctuator: >>>=\n\n		if (ch1 === ">" && ch2 === ">" && ch3 === ">" && ch4 === "=") {\n			return {\n				type: Token.Punctuator,\n				value: ">>>="\n			};\n		}\n\n		// 3-character punctuators: === !== >>> <<= >>=\n\n		if (ch1 === "=" && ch2 === "=" && ch3 === "=") {\n			return {\n				type: Token.Punctuator,\n				value: "==="\n			};\n		}\n\n		if (ch1 === "!" && ch2 === "=" && ch3 === "=") {\n			return {\n				type: Token.Punctuator,\n				value: "!=="\n			};\n		}\n\n		if (ch1 === ">" && ch2 === ">" && ch3 === ">") {\n			return {\n				type: Token.Punctuator,\n				value: ">>>"\n			};\n		}\n\n		if (ch1 === "<" && ch2 === "<" && ch3 === "=") {\n			return {\n				type: Token.Punctuator,\n				value: "<<="\n			};\n		}\n\n		if (ch1 === ">" && ch2 === ">" && ch3 === "=") {\n			return {\n				type: Token.Punctuator,\n				value: "<<="\n			};\n		}\n\n		// 2-character punctuators: <= >= == != ++ -- << >> && ||\n		// += -= *= %= &= |= ^= (but not /=, see below)\n		if (ch1 === ch2 && ("+-<>&|".indexOf(ch1) >= 0)) {\n			return {\n				type: Token.Punctuator,\n				value: ch1 + ch2\n			};\n		}\n\n		if ("<>=!+-*%&|^".indexOf(ch1) >= 0) {\n			if (ch2 === "=") {\n				return {\n					type: Token.Punctuator,\n					value: ch1 + ch2\n				};\n			}\n\n			return {\n				type: Token.Punctuator,\n				value: ch1\n			};\n		}\n\n		// Special case: /=. We need to make sure that this is an\n		// operator and not a regular expression.\n\n		if (ch1 === "/") {\n			if (ch2 === "=" && /\\/=(?!(\\S*\\/[gim]?))/.test(this.input)) {\n				// /= is not a part of a regular expression, return it as a\n				// punctuator.\n				return {\n					type: Token.Punctuator,\n					value: "/="\n				};\n			}\n\n			return {\n				type: Token.Punctuator,\n				value: "/"\n			};\n		}\n\n		return null;\n	},\n\n	/*\n	 * Extract a comment out of the next sequence of characters and/or\n	 * lines or return \'null\' if its not possible. Since comments can\n	 * span across multiple lines this method has to move the char\n	 * pointer.\n	 *\n	 * In addition to normal JavaScript comments (// and /*) this method\n	 * also recognizes JSHint- and JSLint-specific comments such as\n	 * /*jshint, /*jslint, /*globals and so on.\n	 */\n	scanComments: function () {\n		var ch1 = this.peek();\n		var ch2 = this.peek(1);\n		var rest = this.input.substr(2);\n		var startLine = this.line;\n		var startChar = this.char;\n\n		// Create a comment token object and make sure it\n		// has all the data JSHint needs to work with special\n		// comments.\n\n		function commentToken(label, body, opt) {\n			var special = ["jshint", "jslint", "members", "member", "globals", "global", "exported"];\n			var isSpecial = false;\n			var value = label + body;\n			var commentType = "plain";\n			opt = opt || {};\n\n			if (opt.isMultiline) {\n				value += "*/";\n			}\n\n			special.forEach(function (str) {\n				if (isSpecial) {\n					return;\n				}\n\n				// Don\'t recognize any special comments other than jshint for single-line\n				// comments. This introduced many problems with legit comments.\n				if (label === "//" && str !== "jshint") {\n					return;\n				}\n\n				if (body.substr(0, str.length) === str) {\n					isSpecial = true;\n					label = label + str;\n					body = body.substr(str.length);\n				}\n\n				if (!isSpecial && body.charAt(0) === " " && body.substr(1, str.length) === str) {\n					isSpecial = true;\n					label = label + " " + str;\n					body = body.substr(str.length + 1);\n				}\n\n				if (!isSpecial) {\n					return;\n				}\n\n				switch (str) {\n				case "member":\n					commentType = "members";\n					break;\n				case "global":\n					commentType = "globals";\n					break;\n				default:\n					commentType = str;\n				}\n			});\n\n			return {\n				type: Token.Comment,\n				commentType: commentType,\n				value: value,\n				body: body,\n				isSpecial: isSpecial,\n				isMultiline: opt.isMultiline || false,\n				isMalformed: opt.isMalformed || false\n			};\n		}\n\n		// End of unbegun comment. Raise an error and skip that input.\n		if (ch1 === "*" && ch2 === "/") {\n			this.trigger("error", {\n				code: "E018",\n				line: startLine,\n				character: startChar\n			});\n\n			this.skip(2);\n			return null;\n		}\n\n		// Comments must start either with // or /*\n		if (ch1 !== "/" || (ch2 !== "*" && ch2 !== "/")) {\n			return null;\n		}\n\n		// One-line comment\n		if (ch2 === "/") {\n			this.skip(this.input.length); // Skip to the EOL.\n			return commentToken("//", rest);\n		}\n\n		var body = "";\n\n		/* Multi-line comment */\n		if (ch2 === "*") {\n			this.skip(2);\n\n			while (this.peek() !== "*" || this.peek(1) !== "/") {\n				if (this.peek() === "") { // End of Line\n					body += "\\n";\n\n					// If we hit EOF and our comment is still unclosed,\n					// trigger an error and end the comment implicitly.\n					if (!this.nextLine()) {\n						this.trigger("error", {\n							code: "E017",\n							line: startLine,\n							character: startChar\n						});\n\n						return commentToken("/*", body, {\n							isMultiline: true,\n							isMalformed: true\n						});\n					}\n				} else {\n					body += this.peek();\n					this.skip();\n				}\n			}\n\n			this.skip(2);\n			return commentToken("/*", body, { isMultiline: true });\n		}\n	},\n\n	/*\n	 * Extract a keyword out of the next sequence of characters or\n	 * return \'null\' if its not possible.\n	 */\n	scanKeyword: function () {\n		var result = /^[a-zA-Z_$][a-zA-Z0-9_$]*/.exec(this.input);\n		var keywords = [\n			"if", "in", "do", "var", "for", "new",\n			"try", "let", "this", "else", "case",\n			"void", "with", "enum", "while", "break",\n			"catch", "throw", "const", "yield", "class",\n			"super", "return", "typeof", "delete",\n			"switch", "export", "import", "default",\n			"finally", "extends", "function", "continue",\n			"debugger", "instanceof"\n		];\n\n		if (result && keywords.indexOf(result[0]) >= 0) {\n			return {\n				type: Token.Keyword,\n				value: result[0]\n			};\n		}\n\n		return null;\n	},\n\n	/*\n	 * Extract a JavaScript identifier out of the next sequence of\n	 * characters or return \'null\' if its not possible. In addition,\n	 * to Identifier this method can also produce BooleanLiteral\n	 * (true/false) and NullLiteral (null).\n	 */\n	scanIdentifier: function () {\n		var id = "";\n		var index = 0;\n		var type, char;\n\n		// Detects any character in the Unicode categories "Uppercase\n		// letter (Lu)", "Lowercase letter (Ll)", "Titlecase letter\n		// (Lt)", "Modifier letter (Lm)", "Other letter (Lo)", or\n		// "Letter number (Nl)".\n		//\n		// Both approach and unicodeLetterTable were borrowed from\n		// Google\'s Traceur.\n\n		function isUnicodeLetter(code) {\n			for (var i = 0; i < unicodeLetterTable.length;) {\n				if (code < unicodeLetterTable[i++]) {\n					return false;\n				}\n\n				if (code <= unicodeLetterTable[i++]) {\n					return true;\n				}\n			}\n\n			return false;\n		}\n\n		function isHexDigit(str) {\n			return (/^[0-9a-fA-F]$/).test(str);\n		}\n\n		var readUnicodeEscapeSequence = function () {\n			/*jshint validthis:true */\n			index += 1;\n\n			if (this.peek(index) !== "u") {\n				return null;\n			}\n\n			var ch1 = this.peek(index + 1);\n			var ch2 = this.peek(index + 2);\n			var ch3 = this.peek(index + 3);\n			var ch4 = this.peek(index + 4);\n			var code;\n\n			if (isHexDigit(ch1) && isHexDigit(ch2) && isHexDigit(ch3) && isHexDigit(ch4)) {\n				code = parseInt(ch1 + ch2 + ch3 + ch4, 16);\n\n				if (isUnicodeLetter(code)) {\n					index += 5;\n					return "\\\\u" + ch1 + ch2 + ch3 + ch4;\n				}\n\n				return null;\n			}\n\n			return null;\n		}.bind(this);\n\n		var getIdentifierStart = function () {\n			/*jshint validthis:true */\n			var chr = this.peek(index);\n			var code = chr.charCodeAt(0);\n\n			if (code === 92) {\n				return readUnicodeEscapeSequence();\n			}\n\n			if (code < 128) {\n				if (identifierStartTable[code]) {\n					index += 1;\n					return chr;\n				}\n\n				return null;\n			}\n\n			if (isUnicodeLetter(code)) {\n				index += 1;\n				return chr;\n			}\n\n			return null;\n		}.bind(this);\n\n		var getIdentifierPart = function () {\n			/*jshint validthis:true */\n			var chr = this.peek(index);\n			var code = chr.charCodeAt(0);\n\n			if (code === 92) {\n				return readUnicodeEscapeSequence();\n			}\n\n			if (code < 128) {\n				if (identifierPartTable[code]) {\n					index += 1;\n					return chr;\n				}\n\n				return null;\n			}\n\n			if (isUnicodeLetter(code)) {\n				index += 1;\n				return chr;\n			}\n\n			return null;\n		}.bind(this);\n\n		char = getIdentifierStart();\n		if (char === null) {\n			return null;\n		}\n\n		id = char;\n		for (;;) {\n			char = getIdentifierPart();\n\n			if (char === null) {\n				break;\n			}\n\n			id += char;\n		}\n\n		switch (id) {\n		case "true":\n		case "false":\n			type = Token.BooleanLiteral;\n			break;\n		case "null":\n			type = Token.NullLiteral;\n			break;\n		default:\n			type = Token.Identifier;\n		}\n\n		return {\n			type: type,\n			value: id\n		};\n	},\n\n	/*\n	 * Extract a numeric literal out of the next sequence of\n	 * characters or return \'null\' if its not possible. This method\n	 * supports all numeric literals described in section 7.8.3\n	 * of the EcmaScript 5 specification.\n	 *\n	 * This method\'s implementation was heavily influenced by the\n	 * scanNumericLiteral function in the Esprima parser\'s source code.\n	 */\n	scanNumericLiteral: function () {\n		var index = 0;\n		var value = "";\n		var length = this.input.length;\n		var char = this.peek(index);\n		var bad;\n\n		function isDecimalDigit(str) {\n			return (/^[0-9]$/).test(str);\n		}\n\n		function isOctalDigit(str) {\n			return (/^[0-7]$/).test(str);\n		}\n\n		function isHexDigit(str) {\n			return (/^[0-9a-fA-F]$/).test(str);\n		}\n\n		function isIdentifierStart(ch) {\n			return (ch === "$") || (ch === "_") || (ch === "\\\\") ||\n				(ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");\n		}\n\n		// Numbers must start either with a decimal digit or a point.\n\n		if (char !== "." && !isDecimalDigit(char)) {\n			return null;\n		}\n\n		if (char !== ".") {\n			value = this.peek(index);\n			index += 1;\n			char = this.peek(index);\n\n			if (value === "0") {\n				// Base-16 numbers.\n				if (char === "x" || char === "X") {\n					index += 1;\n					value += char;\n\n					while (index < length) {\n						char = this.peek(index);\n						if (!isHexDigit(char)) {\n							break;\n						}\n						value += char;\n						index += 1;\n					}\n\n					if (value.length <= 2) { // 0x\n						return {\n							type: Token.NumericLiteral,\n							value: value,\n							isMalformed: true\n						};\n					}\n\n					if (index < length) {\n						char = this.peek(index);\n						if (isIdentifierStart(char)) {\n							return null;\n						}\n					}\n\n					return {\n						type: Token.NumericLiteral,\n						value: value,\n						base: 16,\n						isMalformed: false\n					};\n				}\n\n				// Base-8 numbers.\n				if (isOctalDigit(char)) {\n					index += 1;\n					value += char;\n					bad = false;\n\n					while (index < length) {\n						char = this.peek(index);\n\n						// Numbers like \'019\' (note the 9) are not valid octals\n						// but we still parse them and mark as malformed.\n\n						if (isDecimalDigit(char)) {\n							bad = true;\n						} else if (!isOctalDigit(char)) {\n							break;\n						}\n						value += char;\n						index += 1;\n					}\n\n					if (index < length) {\n						char = this.peek(index);\n						if (isIdentifierStart(char)) {\n							return null;\n						}\n					}\n\n					return {\n						type: Token.NumericLiteral,\n						value: value,\n						base: 8,\n						isMalformed: false\n					};\n				}\n\n				// Decimal numbers that start with \'0\' such as \'09\' are illegal\n				// but we still parse them and return as malformed.\n\n				if (isDecimalDigit(char)) {\n					index += 1;\n					value += char;\n				}\n			}\n\n			while (index < length) {\n				char = this.peek(index);\n				if (!isDecimalDigit(char)) {\n					break;\n				}\n				value += char;\n				index += 1;\n			}\n		}\n\n		// Decimal digits.\n\n		if (char === ".") {\n			value += char;\n			index += 1;\n\n			while (index < length) {\n				char = this.peek(index);\n				if (!isDecimalDigit(char)) {\n					break;\n				}\n				value += char;\n				index += 1;\n			}\n		}\n\n		// Exponent part.\n\n		if (char === "e" || char === "E") {\n			value += char;\n			index += 1;\n			char = this.peek(index);\n\n			if (char === "+" || char === "-") {\n				value += this.peek(index);\n				index += 1;\n			}\n\n			char = this.peek(index);\n			if (isDecimalDigit(char)) {\n				value += char;\n				index += 1;\n\n				while (index < length) {\n					char = this.peek(index);\n					if (!isDecimalDigit(char)) {\n						break;\n					}\n					value += char;\n					index += 1;\n				}\n			} else {\n				return null;\n			}\n		}\n\n		if (index < length) {\n			char = this.peek(index);\n			if (isIdentifierStart(char)) {\n				return null;\n			}\n		}\n\n		return {\n			type: Token.NumericLiteral,\n			value: value,\n			base: 10,\n			isMalformed: !isFinite(value)\n		};\n	},\n\n	/*\n	 * Extract a string out of the next sequence of characters and/or\n	 * lines or return \'null\' if its not possible. Since strings can\n	 * span across multiple lines this method has to move the char\n	 * pointer.\n	 *\n	 * This method recognizes pseudo-multiline JavaScript strings:\n	 *\n	 *   var str = "hello\\\n	 *   world";\n   */\n	scanStringLiteral: function () {\n		var quote = this.peek();\n\n		// String must start with a quote.\n		if (quote !== "\\"" && quote !== "\'") {\n			return null;\n		}\n\n		// In JSON strings must always use double quotes.\n		if (state.jsonMode && quote !== "\\"") {\n			this.trigger("warning", {\n				code: "W108",\n				line: this.line,\n				character: this.char // +1?\n			});\n		}\n\n		var value = "";\n		var startLine = this.line;\n		var startChar = this.char;\n		var allowNewLine = false;\n\n		this.skip();\n\n		while (this.peek() !== quote) {\n			while (this.peek() === "") { // End Of Line\n\n				// If an EOL is not preceded by a backslash, show a warning\n				// and proceed like it was a legit multi-line string where\n				// author simply forgot to escape the newline symbol.\n				//\n				// Another approach is to implicitly close a string on EOL\n				// but it generates too many false positives.\n\n				if (!allowNewLine) {\n					this.trigger("warning", {\n						code: "W112",\n						line: this.line,\n						character: this.char\n					});\n				} else {\n					allowNewLine = false;\n\n					// Otherwise show a warning if multistr option was not set.\n					// For JSON, show warning no matter what.\n\n					if (!state.option.multistr) {\n						this.trigger("warning", {\n							code: "W043",\n							line: this.line,\n							character: this.char\n						});\n					} else if (state.jsonMode) {\n						this.trigger("warning", {\n							code: "W042",\n							line: this.line,\n							character: this.char\n						});\n					}\n				}\n\n				// If we get an EOF inside of an unclosed string, show an\n				// error and implicitly close it at the EOF point.\n\n				if (!this.nextLine()) {\n					this.trigger("error", {\n						code: "E029",\n						line: startLine,\n						character: startChar\n					});\n\n					return {\n						type: Token.StringLiteral,\n						value: value,\n						isUnclosed: true,\n						quote: quote\n					};\n				}\n			}\n\n			allowNewLine = false;\n			var char = this.peek();\n			var jump = 1; // A length of a jump, after we\'re done\n			              // parsing this character.\n\n			if (char < " ") {\n				// Warn about a control character in a string.\n				this.trigger("warning", {\n					code: "W113",\n					line: this.line,\n					character: this.char,\n					data: [ "<non-printable>" ]\n				});\n			}\n\n			// Special treatment for some escaped characters.\n\n			if (char === "\\\\") {\n				this.skip();\n				char = this.peek();\n\n				switch (char) {\n				case "\'":\n					if (state.jsonMode) {\n						this.trigger("warning", {\n							code: "W114",\n							line: this.line,\n							character: this.char,\n							data: [ "\\\\\'" ]\n						});\n					}\n					break;\n				case "b":\n					char = "\\b";\n					break;\n				case "f":\n					char = "\\f";\n					break;\n				case "n":\n					char = "\\n";\n					break;\n				case "r":\n					char = "\\r";\n					break;\n				case "t":\n					char = "\\t";\n					break;\n				case "0":\n					char = "\\0";\n\n					// Octal literals fail in strict mode.\n					// Check if the number is between 00 and 07.\n					var n = parseInt(this.peek(1), 10);\n					if (n >= 0 && n <= 7 && state.directive["use strict"]) {\n						this.trigger("warning", {\n							code: "W115",\n							line: this.line,\n							character: this.char\n						});\n					}\n					break;\n				case "u":\n					char = String.fromCharCode(parseInt(this.input.substr(1, 4), 16));\n					jump = 5;\n					break;\n				case "v":\n					if (state.jsonMode) {\n						this.trigger("warning", {\n							code: "W114",\n							line: this.line,\n							character: this.char,\n							data: [ "\\\\v" ]\n						});\n					}\n\n					char = "\\v";\n					break;\n				case "x":\n					var	x = parseInt(this.input.substr(1, 2), 16);\n\n					if (state.jsonMode) {\n						this.trigger("warning", {\n							code: "W114",\n							line: this.line,\n							character: this.char,\n							data: [ "\\\\x-" ]\n						});\n					}\n\n					char = String.fromCharCode(x);\n					jump = 3;\n					break;\n				case "\\\\":\n				case "\\"":\n				case "/":\n					break;\n				case "":\n					allowNewLine = true;\n					char = "";\n					break;\n				case "!":\n					if (value.slice(value.length - 2) === "<") {\n						break;\n					}\n\n					/*falls through */\n				default:\n					// Weird escaping.\n					this.trigger("warning", {\n						code: "W044",\n						line: this.line,\n						character: this.char\n					});\n				}\n			}\n\n			value += char;\n			this.skip(jump);\n		}\n\n		this.skip();\n		return {\n			type: Token.StringLiteral,\n			value: value,\n			isUnclosed: false,\n			quote: quote\n		};\n	},\n\n	/*\n	 * Extract a regular expression out of the next sequence of\n	 * characters and/or lines or return \'null\' if its not possible.\n	 *\n	 * This method is platform dependent: it accepts almost any\n	 * regular expression values but then tries to compile and run\n	 * them using system\'s RegExp object. This means that there are\n	 * rare edge cases where one JavaScript engine complains about\n	 * your regular expression while others don\'t.\n	 */\n	scanRegExp: function () {\n		var index = 0;\n		var length = this.input.length;\n		var char = this.peek();\n		var value = char;\n		var body = "";\n		var flags = [];\n		var malformed = false;\n		var isCharSet = false;\n		var terminated;\n\n		var scanUnexpectedChars = function () {\n			// Unexpected control character\n			if (char < " ") {\n				malformed = true;\n				this.trigger("warning", {\n					code: "W048",\n					line: this.line,\n					character: this.char\n				});\n			}\n\n			// Unexpected escaped character\n			if (char === "<") {\n				malformed = true;\n				this.trigger("warning", {\n					code: "W049",\n					line: this.line,\n					character: this.char,\n					data: [ char ]\n				});\n			}\n		}.bind(this);\n\n		// Regular expressions must start with \'/\'\n		if (!this.prereg || char !== "/") {\n			return null;\n		}\n\n		index += 1;\n		terminated = false;\n\n		// Try to get everything in between slashes. A couple of\n		// cases aside (see scanUnexpectedChars) we don\'t really\n		// care whether the resulting expression is valid or not.\n		// We will check that later using the RegExp object.\n\n		while (index < length) {\n			char = this.peek(index);\n			value += char;\n			body += char;\n\n			if (isCharSet) {\n				if (char === "]") {\n					if (this.peek(index - 1) !== "\\\\" || this.peek(index - 2) === "\\\\") {\n						isCharSet = false;\n					}\n				}\n\n				if (char === "\\\\") {\n					index += 1;\n					char = this.peek(index);\n					body += char;\n					value += char;\n\n					scanUnexpectedChars();\n				}\n\n				index += 1;\n				continue;\n			}\n\n			if (char === "\\\\") {\n				index += 1;\n				char = this.peek(index);\n				body += char;\n				value += char;\n\n				scanUnexpectedChars();\n\n				if (char === "/") {\n					index += 1;\n					continue;\n				}\n\n				if (char === "[") {\n					index += 1;\n					continue;\n				}\n			}\n\n			if (char === "[") {\n				isCharSet = true;\n				index += 1;\n				continue;\n			}\n\n			if (char === "/") {\n				body = body.substr(0, body.length - 1);\n				terminated = true;\n				index += 1;\n				break;\n			}\n\n			index += 1;\n		}\n\n		// A regular expression that was never closed is an\n		// error from which we cannot recover.\n\n		if (!terminated) {\n			this.trigger("error", {\n				code: "E015",\n				line: this.line,\n				character: this.from\n			});\n\n			return void this.trigger("fatal", {\n				line: this.line,\n				from: this.from\n			});\n		}\n\n		// Parse flags (if any).\n\n		while (index < length) {\n			char = this.peek(index);\n			if (!/[gim]/.test(char)) {\n				break;\n			}\n			flags.push(char);\n			value += char;\n			index += 1;\n		}\n\n		// Check regular expression for correctness.\n\n		try {\n			new RegExp(body, flags.join(""));\n		} catch (err) {\n			malformed = true;\n			this.trigger("error", {\n				code: "E016",\n				line: this.line,\n				character: this.char,\n				data: [ err.message ] // Platform dependent!\n			});\n		}\n\n		return {\n			type: Token.RegExp,\n			value: value,\n			flags: flags,\n			isMalformed: malformed\n		};\n	},\n\n	/*\n	 * Scan for any occurence of mixed tabs and spaces. If smarttabs option\n	 * is on, ignore tabs followed by spaces.\n	 *\n	 * Tabs followed by one space followed by a block comment are allowed.\n	 */\n	scanMixedSpacesAndTabs: function () {\n		var at, match;\n\n		if (state.option.smarttabs) {\n			// Negative look-behind for "//"\n			match = this.input.match(/(\\/\\/)? \\t/);\n			at = match && !match[1] ? 0 : -1;\n		} else {\n			at = this.input.search(/ \\t|\\t [^\\*]/);\n		}\n\n		return at;\n	},\n\n	/*\n	 * Scan for characters that get silently deleted by one or more browsers.\n	 */\n	scanUnsafeChars: function () {\n		return this.input.search(reg.unsafeChars);\n	},\n\n	/*\n	 * Produce the next raw token or return \'null\' if no tokens can be matched.\n	 * This method skips over all space characters.\n	 */\n	next: function () {\n		this.from = this.char;\n\n		// Move to the next non-space character.\n		var start;\n		if (/\\s/.test(this.peek())) {\n			start = this.char;\n\n			while (/\\s/.test(this.peek())) {\n				this.from += 1;\n				this.skip();\n			}\n\n			if (this.peek() === "") { // EOL\n				if (state.option.trailing) {\n					this.trigger("warning", { code: "W102", line: this.line, character: start });\n				}\n			}\n		}\n\n		// Methods that work with multi-line structures and move the\n		// character pointer.\n\n		var match = this.scanComments() ||\n			this.scanStringLiteral();\n\n		if (match) {\n			return match;\n		}\n\n		// Methods that don\'t move the character pointer.\n\n		match =\n			this.scanRegExp() ||\n			this.scanPunctuator() ||\n			this.scanKeyword() ||\n			this.scanIdentifier() ||\n			this.scanNumericLiteral();\n\n		if (match) {\n			this.skip(match.value.length);\n			return match;\n		}\n\n		// No token could be matched, give up.\n\n		return null;\n	},\n\n	/*\n	 * Switch to the next line and reset all char pointers. Once\n	 * switched, this method also checks for mixed spaces and tabs\n	 * and other minor warnings.\n	 */\n	nextLine: function () {\n		var char;\n\n		if (this.line >= this.lines.length) {\n			return false;\n		}\n\n		this.input = this.lines[this.line];\n		this.line += 1;\n		this.char = 1;\n		this.from = 1;\n\n		char = this.scanMixedSpacesAndTabs();\n		if (char >= 0) {\n			this.trigger("warning", { code: "W099", line: this.line, character: char + 1 });\n		}\n\n		this.input = this.input.replace(/\\t/g, state.tab);\n		char = this.scanUnsafeChars();\n\n		if (char >= 0) {\n			this.trigger("warning", { code: "W100", line: this.line, character: char });\n		}\n\n		// If there is a limit on line length, warn when lines get too\n		// long.\n\n		if (state.option.maxlen && state.option.maxlen < this.input.length) {\n			this.trigger("warning", { code: "W101", line: this.line, character: this.input.length });\n		}\n\n		return true;\n	},\n\n	/*\n	 * This is simply a synonym for nextLine() method with a friendlier\n	 * public name.\n	 */\n	start: function () {\n		this.nextLine();\n	},\n\n	/*\n	 * Produce the next token. This function is called by advance() to get\n	 * the next token. It retuns a token in a JSLint-compatible format.\n	 */\n	token: function () {\n		var token;\n\n		function isReserved(token, isProperty) {\n			if (!token.reserved) {\n				return false;\n			}\n\n			if (token.meta && token.meta.isFutureReservedWord) {\n				// ES3 FutureReservedWord in an ES5 environment.\n				if (state.option.es5 && !token.meta.es5) {\n					return false;\n				}\n\n				// Some ES5 FutureReservedWord identifiers are active only\n				// within a strict mode environment.\n				if (token.meta.strictOnly) {\n					if (!state.option.strict && !state.directive["use strict"]) {\n						return false;\n					}\n				}\n\n				if (isProperty) {\n					return false;\n				}\n			}\n\n			return true;\n		}\n\n		// Produce a token object.\n		var create = function (type, value, isProperty) {\n			/*jshint validthis:true */\n			var obj;\n\n			if (type !== "(endline)" && type !== "(end)") {\n				this.prereg = false;\n			}\n\n			if (type === "(punctuator)") {\n				switch (value) {\n				case ".":\n				case ")":\n				case "~":\n				case "#":\n				case "]":\n					this.prereg = false;\n					break;\n				default:\n					this.prereg = true;\n				}\n\n				obj = Object.create(state.syntax[value] || state.syntax["(error)"]);\n			}\n\n			if (type === "(identifier)") {\n				if (value === "return" || value === "case" || value === "typeof") {\n					this.prereg = true;\n				}\n\n				if (_.has(state.syntax, value)) {\n					obj = Object.create(state.syntax[value] || state.syntax["(error)"]);\n\n					// If this can\'t be a reserved keyword, reset the object.\n					if (!isReserved(obj, isProperty && type === "(identifier)")) {\n						obj = null;\n					}\n				}\n			}\n\n			if (!obj) {\n				obj = Object.create(state.syntax[type]);\n			}\n\n			obj.identifier = (type === "(identifier)");\n			obj.type = obj.type || type;\n			obj.value = value;\n			obj.line = this.line;\n			obj.character = this.char;\n			obj.from = this.from;\n\n			if (isProperty && obj.identifier) {\n				obj.isProperty = isProperty;\n			}\n\n			return obj;\n		}.bind(this);\n\n		for (;;) {\n			if (!this.input.length) {\n				return create(this.nextLine() ? "(endline)" : "(end)", "");\n			}\n\n			token = this.next();\n\n			if (!token) {\n				if (this.input.length) {\n					// Unexpected character.\n					this.trigger("error", {\n						code: "E024",\n						line: this.line,\n						character: this.char,\n						data: [ this.peek() ]\n					});\n\n					this.input = "";\n				}\n\n				continue;\n			}\n\n			switch (token.type) {\n			case Token.StringLiteral:\n				this.trigger("String", {\n					line: this.line,\n					char: this.char,\n					from: this.from,\n					value: token.value,\n					quote: token.quote\n				});\n\n				return create("(string)", token.value);\n			case Token.Identifier:\n				this.trigger("Identifier", {\n					line: this.line,\n					char: this.char,\n					from: this.form,\n					name: token.value,\n					isProperty: state.tokens.curr.id === "."\n				});\n\n				/* falls through */\n			case Token.Keyword:\n			case Token.NullLiteral:\n			case Token.BooleanLiteral:\n				return create("(identifier)", token.value, state.tokens.curr.id === ".");\n\n			case Token.NumericLiteral:\n				if (token.isMalformed) {\n					this.trigger("warning", {\n						code: "W045",\n						line: this.line,\n						character: this.char,\n						data: [ token.value ]\n					});\n				}\n\n				if (state.jsonMode && token.base === 16) {\n					this.trigger("warning", {\n						code: "W114",\n						line: this.line,\n						character: this.char,\n						data: [ "0x-" ]\n					});\n				}\n\n				if (state.directive["use strict"] && token.base === 8) {\n					this.trigger("warning", {\n						code: "W115",\n						line: this.line,\n						character: this.char\n					});\n				}\n\n				this.trigger("Number", {\n					line: this.line,\n					char: this.char,\n					from: this.from,\n					value: token.value,\n					base: token.base,\n					isMalformed: token.malformed\n				});\n\n				return create("(number)", token.value);\n\n			case Token.RegExp:\n				return create("(regexp)", token.value);\n\n			case Token.Comment:\n				state.tokens.curr.comment = true;\n\n				if (token.isSpecial) {\n					return {\n						value: token.value,\n						body: token.body,\n						type: token.commentType,\n						isSpecial: token.isSpecial,\n						line: this.line,\n						character: this.char,\n						from: this.from\n					};\n				}\n\n				break;\n\n			case "":\n				break;\n\n			default:\n				return create("(punctuator)", token.value);\n			}\n		}\n	}\n};\n\nexports.Lexer = Lexer;\n//@ sourceURL=/src/stable/lex.js'));
require.define("/src/stable/reg.js",Function(["require","module","exports","__dirname","__filename","process","global"],'/*\n * Regular expressions. Some of these are stupidly long.\n */\n\n/*jshint maxlen:1000 */\n\n"use string";\n\n// Unsafe comment or string (ax)\nexports.unsafeString =\n	/@cc|<\\/?|script|\\]\\s*\\]|<\\s*!|&lt/i;\n\n// Unsafe characters that are silently deleted by one or more browsers (cx)\nexports.unsafeChars =\n	/[\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]/;\n\n// Characters in strings that need escaping (nx and nxg)\nexports.needEsc =\n	/[\\u0000-\\u001f&<"\\/\\\\\\u007f-\\u009f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]/;\n\nexports.needEscGlobal =\n	/[\\u0000-\\u001f&<"\\/\\\\\\u007f-\\u009f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]/g;\n\n// Star slash (lx)\nexports.starSlash = /\\*\\//;\n\n// Identifier (ix)\nexports.identifier = /^([a-zA-Z_$][a-zA-Z0-9_$]*)$/;\n\n// JavaScript URL (jx)\nexports.javascriptURL = /^(?:javascript|jscript|ecmascript|vbscript|mocha|livescript)\\s*:/i;\n\n// Catches /* falls through */ comments (ft)\nexports.fallsThrough = /^\\s*\\/\\*\\s*falls\\sthrough\\s*\\*\\/\\s*$/;\n//@ sourceURL=/src/stable/reg.js'));
require.define("/src/stable/state.js",Function(["require","module","exports","__dirname","__filename","process","global"],'"use strict";\n\nvar state = {\n	syntax: {},\n\n	reset: function () {\n		this.tokens = {\n			prev: null,\n			next: null,\n			curr: null\n		},\n\n		this.option = {};\n		this.directive = {};\n		this.jsonMode = false;\n		this.lines = [];\n		this.tab = "";\n		this.cache = {}; // Node.JS doesn\'t have Map. Sniff.\n	}\n};\n\nexports.state = state;\n//@ sourceURL=/src/stable/state.js'));
require.define("/src/stable/style.js",Function(["require","module","exports","__dirname","__filename","process","global"],'"use strict";\n\nexports.register = function (linter) {\n	// Check for properties named __proto__. This special property was\n	// deprecated and then re-introduced for ES6.\n\n	linter.on("Identifier", function style_scanProto(data) {\n		if (linter.getOption("proto")) {\n			return;\n		}\n\n		if (data.name === "__proto__") {\n			linter.warn("W103", {\n				line: data.line,\n				char: data.char,\n				data: [ data.name ]\n			});\n		}\n	});\n\n	// Check for properties named __iterator__. This is a special property\n	// available only in browsers with JavaScript 1.7 implementation.\n\n	linter.on("Identifier", function style_scanIterator(data) {\n		if (linter.getOption("iterator")) {\n			return;\n		}\n\n		if (data.name === "__iterator__") {\n			linter.warn("W104", {\n				line: data.line,\n				char: data.char,\n				data: [ data.name ]\n			});\n		}\n	});\n\n	// Check for dangling underscores.\n\n	linter.on("Identifier", function style_scanDangling(data) {\n		if (!linter.getOption("nomen")) {\n			return;\n		}\n\n		// Underscore.js\n		if (data.name === "_") {\n			return;\n		}\n\n		// In Node, __dirname and __filename should be ignored.\n		if (linter.getOption("node")) {\n			if (/^(__dirname|__filename)$/.test(data.name) && !data.isProperty) {\n				return;\n			}\n		}\n\n		if (/^(_+.*|.*_+)$/.test(data.name)) {\n			linter.warn("W105", {\n				line: data.line,\n				char: data.from,\n				data: [ "dangling \'_\'", data.name ]\n			});\n		}\n	});\n\n	// Check that all identifiers are using camelCase notation.\n	// Exceptions: names like MY_VAR and _myVar.\n\n	linter.on("Identifier", function style_scanCamelCase(data) {\n		if (!linter.getOption("camelcase")) {\n			return;\n		}\n\n		if (data.name.replace(/^_+/, "").indexOf("_") > -1 && !data.name.match(/^[A-Z0-9_]*$/)) {\n			linter.warn("W106", {\n				line: data.line,\n				char: data.from,\n				data: [ data.name ]\n			});\n		}\n	});\n\n	// Enforce consistency in style of quoting.\n\n	linter.on("String", function style_scanQuotes(data) {\n		var quotmark = linter.getOption("quotmark");\n		var code;\n\n		if (!quotmark) {\n			return;\n		}\n\n		// If quotmark is set to \'single\' warn about all double-quotes.\n\n		if (quotmark === "single" && data.quote !== "\'") {\n			code = "W109";\n		}\n\n		// If quotmark is set to \'double\' warn about all single-quotes.\n\n		if (quotmark === "double" && data.quote !== "\\"") {\n			code = "W108";\n		}\n\n		// If quotmark is set to true, remember the first quotation style\n		// and then warn about all others.\n\n		if (quotmark === true) {\n			if (!linter.getCache("quotmark")) {\n				linter.setCache("quotmark", data.quote);\n			}\n\n			if (linter.getCache("quotmark") !== data.quote) {\n				code = "W110";\n			}\n		}\n\n		if (code) {\n			linter.warn(code, {\n				line: data.line,\n				char: data.char,\n			});\n		}\n	});\n\n	linter.on("Number", function style_scanNumbers(data) {\n		if (data.value.charAt(0) === ".") {\n			// Warn about a leading decimal point.\n			linter.warn("W008", {\n				line: data.line,\n				char: data.char,\n				data: [ data.value ]\n			});\n		}\n\n		if (data.value.substr(data.value.length - 1) === ".") {\n			// Warn about a trailing decimal point.\n			linter.warn("W047", {\n				line: data.line,\n				char: data.char,\n				data: [ data.value ]\n			});\n		}\n\n		if (/^00+/.test(data.value)) {\n			// Multiple leading zeroes.\n			linter.warn("W046", {\n				line: data.line,\n				char: data.char,\n				data: [ data.value ]\n			});\n		}\n	});\n\n	// Warn about script URLs.\n\n	linter.on("String", function style_scanJavaScriptURLs(data) {\n		var re = /^(?:javascript|jscript|ecmascript|vbscript|mocha|livescript)\\s*:/i;\n\n		if (linter.getOption("scripturl")) {\n			return;\n		}\n\n		if (re.test(data.value)) {\n			linter.warn("W107", {\n				line: data.line,\n				char: data.char\n			});\n		}\n	});\n};\n//@ sourceURL=/src/stable/style.js'));
require.define("/src/stable/jshint.js",Function(["require","module","exports","__dirname","__filename","process","global"],'/*!\n * JSHint, by JSHint Community.\n *\n * This file (and this file only) is licensed under the same slightly modified\n * MIT license that JSLint is. It stops evil-doers everywhere:\n *\n *	 Copyright (c) 2002 Douglas Crockford  (www.JSLint.com)\n *\n *	 Permission is hereby granted, free of charge, to any person obtaining\n *	 a copy of this software and associated documentation files (the "Software"),\n *	 to deal in the Software without restriction, including without limitation\n *	 the rights to use, copy, modify, merge, publish, distribute, sublicense,\n *	 and/or sell copies of the Software, and to permit persons to whom\n *	 the Software is furnished to do so, subject to the following conditions:\n *\n *	 The above copyright notice and this permission notice shall be included\n *	 in all copies or substantial portions of the Software.\n *\n *	 The Software shall be used for Good, not Evil.\n *\n *	 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n *	 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n *	 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n *	 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n *	 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n *	 FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n *	 DEALINGS IN THE SOFTWARE.\n *\n */\n\n/*jshint quotmark:double */\n\nvar _        = require("underscore");\nvar events   = require("events");\nvar vars     = require("../shared/vars.js");\nvar messages = require("../shared/messages.js");\nvar Lexer    = require("./lex.js").Lexer;\nvar reg      = require("./reg.js");\nvar state    = require("./state.js").state;\nvar style    = require("./style.js");\n\n// We build the application inside a function so that we produce only a single\n// global variable. That function will be invoked immediately, and its return\n// value is the JSHINT function itself.\n\nvar JSHINT = (function () {\n	"use strict";\n\n	var anonname,		// The guessed name for anonymous functions.\n\n// These are operators that should not be used with the ! operator.\n\n		bang = {\n			"<"  : true,\n			"<=" : true,\n			"==" : true,\n			"===": true,\n			"!==": true,\n			"!=" : true,\n			">"  : true,\n			">=" : true,\n			"+"  : true,\n			"-"  : true,\n			"*"  : true,\n			"/"  : true,\n			"%"  : true\n		},\n\n		// These are the JSHint boolean options.\n		boolOptions = {\n			asi         : true, // if automatic semicolon insertion should be tolerated\n			bitwise     : true, // if bitwise operators should not be allowed\n			boss        : true, // if advanced usage of assignments should be allowed\n			browser     : true, // if the standard browser globals should be predefined\n			camelcase   : true, // if identifiers should be required in camel case\n			couch       : true, // if CouchDB globals should be predefined\n			curly       : true, // if curly braces around all blocks should be required\n			debug       : true, // if debugger statements should be allowed\n			devel       : true, // if logging globals should be predefined (console, alert, etc.)\n			dojo        : true, // if Dojo Toolkit globals should be predefined\n			eqeqeq      : true, // if === should be required\n			eqnull      : true, // if == null comparisons should be tolerated\n			es5         : true, // if ES5 syntax should be allowed\n			esnext      : true, // if es.next specific syntax should be allowed\n			evil        : true, // if eval should be allowed\n			expr        : true, // if ExpressionStatement should be allowed as Programs\n			forin       : true, // if for in statements must filter\n			funcscope   : true, // if only function scope should be used for scope tests\n			gcl         : true, // if JSHint should be compatible with Google Closure Linter\n			globalstrict: true, // if global "use strict"; should be allowed (also enables \'strict\')\n			immed       : true, // if immediate invocations must be wrapped in parens\n			iterator    : true, // if the `__iterator__` property should be allowed\n			jquery      : true, // if jQuery globals should be predefined\n			lastsemic   : true, // if semicolons may be ommitted for the trailing\n			                    // statements inside of a one-line blocks.\n			latedef     : true, // if the use before definition should not be tolerated\n			laxbreak    : true, // if line breaks should not be checked\n			laxcomma    : true, // if line breaks should not be checked around commas\n			loopfunc    : true, // if functions should be allowed to be defined within\n			                    // loops\n			mootools    : true, // if MooTools globals should be predefined\n			multistr    : true, // allow multiline strings\n			newcap      : true, // if constructor names must be capitalized\n			noarg       : true, // if arguments.caller and arguments.callee should be\n			                    // disallowed\n			node        : true, // if the Node.js environment globals should be\n			                    // predefined\n			noempty     : true, // if empty blocks should be disallowed\n			nonew       : true, // if using `new` for side-effects should be disallowed\n			nonstandard : true, // if non-standard (but widely adopted) globals should\n			                    // be predefined\n			nomen       : true, // if names should be checked\n			onevar      : true, // if only one var statement per function should be\n			                    // allowed\n			passfail    : true, // if the scan should stop on first error\n			phantom     : true, // if PhantomJS symbols should be allowed\n			plusplus    : true, // if increment/decrement should not be allowed\n			proto       : true, // if the `__proto__` property should be allowed\n			prototypejs : true, // if Prototype and Scriptaculous globals should be\n			                    // predefined\n			rhino       : true, // if the Rhino environment globals should be predefined\n			undef       : true, // if variables should be declared before used\n			scripturl   : true, // if script-targeted URLs should be tolerated\n			shadow      : true, // if variable shadowing should be tolerated\n			smarttabs   : true, // if smarttabs should be tolerated\n			                    // (http://www.emacswiki.org/emacs/SmartTabs)\n			strict      : true, // require the "use strict"; pragma\n			sub         : true, // if all forms of subscript notation are tolerated\n			supernew    : true, // if `new function () { ... };` and `new Object;`\n			                    // should be tolerated\n			trailing    : true, // if trailing whitespace rules apply\n			validthis   : true, // if \'this\' inside a non-constructor function is valid.\n			                    // This is a function scoped option only.\n			withstmt    : true, // if with statements should be allowed\n			white       : true, // if strict whitespace rules apply\n			worker      : true, // if Web Worker script symbols should be allowed\n			wsh         : true, // if the Windows Scripting Host environment globals\n			                    // should be predefined\n			yui         : true, // YUI variables should be predefined\n\n			// Obsolete options\n			onecase     : true, // if one case switch statements should be allowed\n			regexp      : true, // if the . should not be allowed in regexp literals\n			regexdash   : true  // if unescaped first/last dash (-) inside brackets\n			                    // should be tolerated\n		},\n\n		// These are the JSHint options that can take any value\n		// (we use this object to detect invalid options)\n		valOptions = {\n			maxlen       : false,\n			indent       : false,\n			maxerr       : false,\n			predef       : false,\n			quotmark     : false, //\'single\'|\'double\'|true\n			scope        : false,\n			maxstatements: false, // {int} max statements per function\n			maxdepth     : false, // {int} max nested block depth per function\n			maxparams    : false, // {int} max params per function\n			maxcomplexity: false, // {int} max cyclomatic complexity per function\n			unused       : true  // warn if variables are unused. Available options:\n			                     //   false    - don\'t check for unused variables\n			                     //   true     - "vars" + check last function param\n			                     //   "vars"   - skip checking unused function params\n			                     //   "strict" - "vars" + check all function params\n		},\n\n		// These are JSHint boolean options which are shared with JSLint\n		// where the definition in JSHint is opposite JSLint\n		invertedOptions = {\n			bitwise : true,\n			forin   : true,\n			newcap  : true,\n			nomen   : true,\n			plusplus: true,\n			regexp  : true,\n			undef   : true,\n			white   : true,\n\n			// Inverted and renamed, use JSHint name here\n			eqeqeq  : true,\n			onevar  : true\n		},\n\n		// These are JSHint boolean options which are shared with JSLint\n		// where the name has been changed but the effect is unchanged\n		renamedOptions = {\n			eqeq   : "eqeqeq",\n			vars   : "onevar",\n			windows: "wsh"\n		},\n\n		declared, // Globals that were declared using /*global ... */ syntax.\n		exported, // Variables that are used outside of the current file.\n\n		functionicity = [\n			"closure", "exception", "global", "label",\n			"outer", "unused", "var"\n		],\n\n		funct, // The current function\n		functions, // All of the functions\n\n		global, // The global scope\n		ignored, // Ignored warnings\n		implied, // Implied globals\n		inblock,\n		indent,\n		lookahead,\n		lex,\n		member,\n		membersOnly,\n		noreach,\n		predefined,		// Global variables defined by option\n\n		scope,  // The current scope\n		stack,\n		unuseds,\n		urls,\n		useESNextSyntax,\n		warnings,\n\n		extraModules = [],\n		emitter = new events.EventEmitter();\n\n	function checkOption(name, t) {\n		name = name.trim();\n\n		if (/^-W\\d{3}$/g.test(name)) {\n			return true;\n		}\n\n		if (valOptions[name] === undefined && boolOptions[name] === undefined) {\n			if (t.type !== "jslint" || renamedOptions[name] === undefined) {\n				error("E001", t, name);\n				return false;\n			}\n		}\n\n		return true;\n	}\n\n	function isString(obj) {\n		return Object.prototype.toString.call(obj) === "[object String]";\n	}\n\n	function isIdentifier(tkn, value) {\n		if (!tkn)\n			return false;\n\n		if (!tkn.identifier || tkn.value !== value)\n			return false;\n\n		return true;\n	}\n\n	function isReserved(token) {\n		if (!token.reserved) {\n			return false;\n		}\n\n		if (token.meta && token.meta.isFutureReservedWord) {\n			// ES3 FutureReservedWord in an ES5 environment.\n			if (state.option.es5 && !token.meta.es5) {\n				return false;\n			}\n\n			// Some ES5 FutureReservedWord identifiers are active only\n			// within a strict mode environment.\n			if (token.meta.strictOnly) {\n				if (!state.option.strict && !state.directive["use strict"]) {\n					return false;\n				}\n			}\n\n			if (token.isProperty) {\n				return false;\n			}\n		}\n\n		return true;\n	}\n\n	function supplant(str, data) {\n		return str.replace(/\\{([^{}]*)\\}/g, function (a, b) {\n			var r = data[b];\n			return typeof r === "string" || typeof r === "number" ? r : a;\n		});\n	}\n\n	function combine(t, o) {\n		var n;\n		for (n in o) {\n			if (_.has(o, n) && !_.has(JSHINT.blacklist, n)) {\n				t[n] = o[n];\n			}\n		}\n	}\n\n	function updatePredefined() {\n		Object.keys(JSHINT.blacklist).forEach(function (key) {\n			delete predefined[key];\n		});\n	}\n\n	function assume() {\n		if (state.option.couch) {\n			combine(predefined, vars.couch);\n		}\n\n		if (state.option.rhino) {\n			combine(predefined, vars.rhino);\n		}\n\n		if (state.option.phantom) {\n			combine(predefined, vars.phantom);\n		}\n\n		if (state.option.prototypejs) {\n			combine(predefined, vars.prototypejs);\n		}\n\n		if (state.option.node) {\n			combine(predefined, vars.node);\n		}\n\n		if (state.option.devel) {\n			combine(predefined, vars.devel);\n		}\n\n		if (state.option.dojo) {\n			combine(predefined, vars.dojo);\n		}\n\n		if (state.option.browser) {\n			combine(predefined, vars.browser);\n		}\n\n		if (state.option.nonstandard) {\n			combine(predefined, vars.nonstandard);\n		}\n\n		if (state.option.jquery) {\n			combine(predefined, vars.jquery);\n		}\n\n		if (state.option.mootools) {\n			combine(predefined, vars.mootools);\n		}\n\n		if (state.option.worker) {\n			combine(predefined, vars.worker);\n		}\n\n		if (state.option.wsh) {\n			combine(predefined, vars.wsh);\n		}\n\n		if (state.option.esnext) {\n			useESNextSyntax();\n		}\n\n		if (state.option.globalstrict && state.option.strict !== false) {\n			state.option.strict = true;\n		}\n\n		if (state.option.yui) {\n			combine(predefined, vars.yui);\n		}\n	}\n\n\n	// Produce an error warning.\n	function quit(code, line, chr) {\n		var percentage = Math.floor((line / state.lines.length) * 100);\n		var message = messages.errors[code].desc;\n\n		throw {\n			name: "JSHintError",\n			line: line,\n			character: chr,\n			message: message + " (" + percentage + "% scanned).",\n			raw: message\n		};\n	}\n\n	function isundef(scope, code, token, a) {\n		return JSHINT.undefs.push([scope, code, token, a]);\n	}\n\n	function warning(code, t, a, b, c, d) {\n		var ch, l, w, msg;\n\n		if (/^W\\d{3}$/.test(code)) {\n			if (ignored[code]) {\n				return;\n			}\n\n			msg = messages.warnings[code];\n		} else if (/E\\d{3}/.test(code)) {\n			msg = messages.errors[code];\n		} else if (/I\\d{3}/.test(code)) {\n			msg = messages.info[code];\n		}\n\n		t = t || state.tokens.next;\n		if (t.id === "(end)") {  // `~\n			t = state.tokens.curr;\n		}\n\n		l = t.line || 0;\n		ch = t.from || 0;\n\n		w = {\n			id: "(error)",\n			raw: msg.desc,\n			code: msg.code,\n			evidence: state.lines[l - 1] || "",\n			line: l,\n			character: ch,\n			scope: JSHINT.scope,\n			a: a,\n			b: b,\n			c: c,\n			d: d\n		};\n\n		w.reason = supplant(msg.desc, w);\n		JSHINT.errors.push(w);\n\n		if (state.option.passfail) {\n			quit("E042", l, ch);\n		}\n\n		warnings += 1;\n		if (warnings >= state.option.maxerr) {\n			quit("E043", l, ch);\n		}\n\n		return w;\n	}\n\n	function warningAt(m, l, ch, a, b, c, d) {\n		return warning(m, {\n			line: l,\n			from: ch\n		}, a, b, c, d);\n	}\n\n	function error(m, t, a, b, c, d) {\n		warning(m, t, a, b, c, d);\n	}\n\n	function errorAt(m, l, ch, a, b, c, d) {\n		return error(m, {\n			line: l,\n			from: ch\n		}, a, b, c, d);\n	}\n\n	// Tracking of "internal" scripts, like eval containing a static string\n	function addInternalSrc(elem, src) {\n		var i;\n		i = {\n			id: "(internal)",\n			elem: elem,\n			value: src\n		};\n		JSHINT.internals.push(i);\n		return i;\n	}\n\n	function addlabel(t, type, tkn) {\n		// Define t in the current function in the current scope.\n		if (type === "exception") {\n			if (_.has(funct["(context)"], t)) {\n				if (funct[t] !== true && !state.option.node) {\n					warning("W002", state.tokens.next, t);\n				}\n			}\n		}\n\n		if (_.has(funct, t) && !funct["(global)"]) {\n			if (funct[t] === true) {\n				if (state.option.latedef)\n					warning("W003", state.tokens.next, t);\n			} else {\n				if (!state.option.shadow && type !== "exception") {\n					warning("W004", state.tokens.next, t);\n				}\n			}\n		}\n\n		funct[t] = type;\n\n		if (tkn) {\n			funct["(tokens)"][t] = tkn;\n		}\n\n		if (funct["(global)"]) {\n			global[t] = funct;\n			if (_.has(implied, t)) {\n				if (state.option.latedef) {\n					warning("W003", state.tokens.next, t);\n				}\n\n				delete implied[t];\n			}\n		} else {\n			scope[t] = funct;\n		}\n	}\n\n	function doOption() {\n		var nt = state.tokens.next;\n		var body = nt.body.split(",").map(function (s) { return s.trim(); });\n		var predef = {};\n\n		if (nt.type === "globals") {\n			body.forEach(function (g) {\n				g = g.split(":");\n				var key = g[0];\n				var val = g[1];\n\n				if (key.charAt(0) === "-") {\n					key = key.slice(1);\n					val = false;\n\n					JSHINT.blacklist[key] = key;\n					updatePredefined();\n				} else {\n					predef[key] = (val === "true");\n				}\n			});\n\n			combine(predefined, predef);\n\n			for (var key in predef) {\n				if (_.has(predef, key)) {\n					declared[key] = nt;\n				}\n			}\n		}\n\n		if (nt.type === "exported") {\n			body.forEach(function (e) {\n				exported[e] = true;\n			});\n		}\n\n		if (nt.type === "members") {\n			membersOnly = membersOnly || {};\n\n			body.forEach(function (m) {\n				var ch1 = m.charAt(0);\n				var ch2 = m.charAt(m.length - 1);\n\n				if (ch1 === ch2 && (ch1 === "\\"" || ch1 === "\'")) {\n					m = m\n						.substr(1, m.length - 2)\n						.replace("\\\\b", "\\b")\n						.replace("\\\\t", "\\t")\n						.replace("\\\\n", "\\n")\n						.replace("\\\\v", "\\v")\n						.replace("\\\\f", "\\f")\n						.replace("\\\\r", "\\r")\n						.replace("\\\\\\\\", "\\\\")\n						.replace("\\\\\\"", "\\"");\n				}\n\n				membersOnly[m] = false;\n			});\n		}\n\n		var numvals = [\n			"maxstatements",\n			"maxparams",\n			"maxdepth",\n			"maxcomplexity",\n			"maxerr",\n			"maxlen",\n			"indent"\n		];\n\n		if (nt.type === "jshint" || nt.type === "jslint") {\n			body.forEach(function (g) {\n				g = g.split(":");\n				var key = (g[0] || "").trim();\n				var val = (g[1] || "").trim();\n\n				if (!checkOption(key, nt)) {\n					return;\n				}\n\n				if (numvals.indexOf(key) >= 0) {\n					val = +val;\n\n					if (typeof val !== "number" || !isFinite(val) || val <= 0 || Math.floor(val) !== val) {\n						error("E032", nt, g[1].trim());\n						return;\n					}\n\n					if (key === "indent") {\n						state.option["(explicitIndent)"] = true;\n					}\n\n					state.option[key] = val;\n					return;\n				}\n\n				if (key === "validthis") {\n					// `validthis` is valid only within a function scope.\n					if (funct["(global)"]) {\n						error("E009");\n					} else {\n						if (val === "true" || val === "false") {\n							state.option.validthis = (val === "true");\n						} else {\n							error("E002", nt);\n						}\n					}\n					return;\n				}\n\n				if (key === "quotmark") {\n					switch (val) {\n					case "true":\n					case "false":\n						state.option.quotmark = (val === "true");\n						break;\n					case "double":\n					case "single":\n						state.option.quotmark = val;\n						break;\n					default:\n						error("E002", nt);\n					}\n					return;\n				}\n\n				if (key === "unused") {\n					switch (val) {\n					case "true":\n						state.option.unused = true;\n						break;\n					case "false":\n						state.option.unused = false;\n						break;\n					case "vars":\n					case "strict":\n						state.option.unused = val;\n						break;\n					default:\n						error("E002", nt);\n					}\n					return;\n				}\n\n				if (/^-W\\d{3}$/g.test(key)) {\n					ignored[key.slice(1)] = true;\n					return;\n				}\n\n				var tn;\n				if (val === "true" || val === "false") {\n					if (nt.type === "jslint") {\n						tn = renamedOptions[key] || key;\n						state.option[tn] = (val === "true");\n\n						if (invertedOptions[tn] !== undefined) {\n							state.option[tn] = !state.option[tn];\n						}\n					} else {\n						state.option[key] = (val === "true");\n					}\n\n					if (key === "newcap") {\n						state.option["(explicitNewcap)"] = true;\n					}\n					return;\n				}\n\n				error("E002", nt);\n			});\n\n			assume();\n		}\n	}\n\n	// We need a peek function. If it has an argument, it peeks that much farther\n	// ahead. It is used to distinguish\n	//	   for ( var i in ...\n	// from\n	//	   for ( var i = ...\n\n	function peek(p) {\n		var i = p || 0, j = 0, t;\n\n		while (j <= i) {\n			t = lookahead[j];\n			if (!t) {\n				t = lookahead[j] = lex.token();\n			}\n			j += 1;\n		}\n		return t;\n	}\n\n	// Produce the next token. It looks for programming errors.\n\n	function advance(id, t) {\n		switch (state.tokens.curr.id) {\n		case "(number)":\n			if (state.tokens.next.id === ".") {\n				warning("W005", state.tokens.curr);\n			}\n			break;\n		case "-":\n			if (state.tokens.next.id === "-" || state.tokens.next.id === "--") {\n				warning("W006");\n			}\n			break;\n		case "+":\n			if (state.tokens.next.id === "+" || state.tokens.next.id === "++") {\n				warning("W007");\n			}\n			break;\n		}\n\n		if (state.tokens.curr.type === "(string)" || state.tokens.curr.identifier) {\n			anonname = state.tokens.curr.value;\n		}\n\n		if (id && state.tokens.next.id !== id) {\n			if (t) {\n				if (state.tokens.next.id === "(end)") {\n					error("E019", t, t.id);\n				} else {\n					error("E020", state.tokens.next, id, t.id, t.line, state.tokens.next.value);\n				}\n			} else if (state.tokens.next.type !== "(identifier)" || state.tokens.next.value !== id) {\n				warning("W116", state.tokens.next, id, state.tokens.next.value);\n			}\n		}\n\n		state.tokens.prev = state.tokens.curr;\n		state.tokens.curr = state.tokens.next;\n		for (;;) {\n			state.tokens.next = lookahead.shift() || lex.token();\n\n			if (!state.tokens.next) { // No more tokens left, give up\n				quit("E041", state.tokens.curr.line);\n			}\n\n			if (state.tokens.next.id === "(end)" || state.tokens.next.id === "(error)") {\n				return;\n			}\n\n			if (state.tokens.next.isSpecial) {\n				doOption();\n			} else {\n				if (state.tokens.next.id !== "(endline)") {\n					break;\n				}\n			}\n		}\n	}\n\n\n	// This is the heart of JSHINT, the Pratt parser. In addition to parsing, it\n	// is looking for ad hoc lint patterns. We add .fud to Pratt\'s model, which is\n	// like .nud except that it is only used on the first token of a statement.\n	// Having .fud makes it much easier to define statement-oriented languages like\n	// JavaScript. I retained Pratt\'s nomenclature.\n\n	// .nud  Null denotation\n	// .fud  First null denotation\n	// .led  Left denotation\n	//  lbp  Left binding power\n	//  rbp  Right binding power\n\n	// They are elements of the parsing method called Top Down Operator Precedence.\n\n	function expression(rbp, initial) {\n		var left, isArray = false, isObject = false;\n\n		if (state.tokens.next.id === "(end)")\n			error("E006", state.tokens.curr);\n\n		advance();\n\n		if (initial) {\n			anonname = "anonymous";\n			funct["(verb)"] = state.tokens.curr.value;\n		}\n\n		if (initial === true && state.tokens.curr.fud) {\n			left = state.tokens.curr.fud();\n		} else {\n			if (state.tokens.curr.nud) {\n				left = state.tokens.curr.nud();\n			} else {\n				error("E030", state.tokens.curr, state.tokens.curr.id);\n			}\n\n			while (rbp < state.tokens.next.lbp) {\n				isArray = state.tokens.curr.value === "Array";\n				isObject = state.tokens.curr.value === "Object";\n\n				// #527, new Foo.Array(), Foo.Array(), new Foo.Object(), Foo.Object()\n				// Line breaks in IfStatement heads exist to satisfy the checkJSHint\n				// "Line too long." error.\n				if (left && (left.value || (left.first && left.first.value))) {\n					// If the left.value is not "new", or the left.first.value is a "."\n					// then safely assume that this is not "new Array()" and possibly\n					// not "new Object()"...\n					if (left.value !== "new" ||\n					  (left.first && left.first.value && left.first.value === ".")) {\n						isArray = false;\n						// ...In the case of Object, if the left.value and state.tokens.curr.value\n						// are not equal, then safely assume that this not "new Object()"\n						if (left.value !== state.tokens.curr.value) {\n							isObject = false;\n						}\n					}\n				}\n\n				advance();\n\n				if (isArray && state.tokens.curr.id === "(" && state.tokens.next.id === ")") {\n					warning("W009", state.tokens.curr);\n				}\n\n				if (isObject && state.tokens.curr.id === "(" && state.tokens.next.id === ")") {\n					warning("W010", state.tokens.curr);\n				}\n\n				if (state.tokens.curr.led) {\n					left = state.tokens.curr.led(left);\n				} else {\n					error("E033", state.tokens.curr, state.tokens.curr.id);\n				}\n			}\n		}\n		return left;\n	}\n\n\n// Functions for conformance of style.\n\n	function adjacent(left, right) {\n		left = left || state.tokens.curr;\n		right = right || state.tokens.next;\n		if (state.option.white) {\n			if (left.character !== right.from && left.line === right.line) {\n				left.from += (left.character - left.from);\n				warning("W011", left, left.value);\n			}\n		}\n	}\n\n	function nobreak(left, right) {\n		left = left || state.tokens.curr;\n		right = right || state.tokens.next;\n		if (state.option.white && (left.character !== right.from || left.line !== right.line)) {\n			warning("W012", right, right.value);\n		}\n	}\n\n	function nospace(left, right) {\n		left = left || state.tokens.curr;\n		right = right || state.tokens.next;\n		if (state.option.white && !left.comment) {\n			if (left.line === right.line) {\n				adjacent(left, right);\n			}\n		}\n	}\n\n	function nonadjacent(left, right) {\n		if (state.option.white) {\n			left = left || state.tokens.curr;\n			right = right || state.tokens.next;\n\n			if (left.value === ";" && right.value === ";") {\n				return;\n			}\n\n			if (left.line === right.line && left.character === right.from) {\n				left.from += (left.character - left.from);\n				warning("W013", left, left.value);\n			}\n		}\n	}\n\n	function nobreaknonadjacent(left, right) {\n		left = left || state.tokens.curr;\n		right = right || state.tokens.next;\n		if (!state.option.laxbreak && left.line !== right.line) {\n			warning("W014", right, right.id);\n		} else if (state.option.white) {\n			left = left || state.tokens.curr;\n			right = right || state.tokens.next;\n			if (left.character === right.from) {\n				left.from += (left.character - left.from);\n				warning("W013", left, left.value);\n			}\n		}\n	}\n\n	function indentation(bias) {\n		if (!state.option.white && !state.option["(explicitIndent)"]) {\n			return;\n		}\n\n		if (state.tokens.next.id === "(end)") {\n			return;\n		}\n\n		var i = indent + (bias || 0);\n		if (state.tokens.next.from !== i) {\n			warning("W015", state.tokens.next, state.tokens.next.value, i, state.tokens.next.from);\n		}\n	}\n\n	function nolinebreak(t) {\n		t = t || state.tokens.curr;\n		if (t.line !== state.tokens.next.line) {\n			warning("E022", t, t.value);\n		}\n	}\n\n\n	function comma(opts) {\n		opts = opts || {};\n\n		if (state.tokens.curr.line !== state.tokens.next.line) {\n			if (!state.option.laxcomma) {\n				if (comma.first) {\n					warning("I001");\n					comma.first = false;\n				}\n				warning("W014", state.tokens.curr, state.tokens.next.id);\n			}\n		} else if (!state.tokens.curr.comment &&\n				state.tokens.curr.character !== state.tokens.next.from && state.option.white) {\n			state.tokens.curr.from += (state.tokens.curr.character - state.tokens.curr.from);\n			warning("W011", state.tokens.curr, state.tokens.curr.value);\n		}\n\n		advance(",");\n\n		// TODO: This is a temporary solution to fight against false-positives in\n		// arrays and objects with trailing commas (see GH-363). The best solution\n		// would be to extract all whitespace rules out of parser.\n\n		if (state.tokens.next.value !== "]" && state.tokens.next.value !== "}") {\n			nonadjacent(state.tokens.curr, state.tokens.next);\n		}\n\n		if (state.tokens.next.identifier) {\n			// Keywords that cannot follow a comma operator.\n			switch (state.tokens.next.value) {\n			case "break":\n			case "case":\n			case "catch":\n			case "continue":\n			case "default":\n			case "do":\n			case "else":\n			case "finally":\n			case "for":\n			case "if":\n			case "in":\n			case "instanceof":\n			case "return":\n			case "switch":\n			case "throw":\n			case "try":\n			case "var":\n			case "while":\n			case "with":\n				error("E024", state.tokens.next, state.tokens.next.value);\n				return;\n			}\n		}\n\n		if (state.tokens.next.type === "(punctuator)") {\n			switch (state.tokens.next.value) {\n			case "}":\n			case "]":\n			case ",":\n				if (opts.allowTrailing) {\n					return;\n				}\n\n				/* falls through */\n			case ")":\n				error("E024", state.tokens.next, state.tokens.next.value);\n			}\n		}\n	}\n\n	// Functional constructors for making the symbols that will be inherited by\n	// tokens.\n\n	function symbol(s, p) {\n		var x = state.syntax[s];\n		if (!x || typeof x !== "object") {\n			state.syntax[s] = x = {\n				id: s,\n				lbp: p,\n				value: s\n			};\n		}\n		return x;\n	}\n\n	function delim(s) {\n		return symbol(s, 0);\n	}\n\n	function stmt(s, f) {\n		var x = delim(s);\n		x.identifier = x.reserved = true;\n		x.fud = f;\n		return x;\n	}\n\n	function blockstmt(s, f) {\n		var x = stmt(s, f);\n		x.block = true;\n		return x;\n	}\n\n	function reserveName(x) {\n		var c = x.id.charAt(0);\n		if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z")) {\n			x.identifier = x.reserved = true;\n		}\n		return x;\n	}\n\n	function prefix(s, f) {\n		var x = symbol(s, 150);\n		reserveName(x);\n		x.nud = (typeof f === "function") ? f : function () {\n			this.right = expression(150);\n			this.arity = "unary";\n			if (this.id === "++" || this.id === "--") {\n				if (state.option.plusplus) {\n					warning("W016", this, this.id);\n				} else if ((!this.right.identifier || isReserved(this.right)) &&\n						this.right.id !== "." && this.right.id !== "[") {\n					warning("W017", this);\n				}\n			}\n			return this;\n		};\n		return x;\n	}\n\n	function type(s, f) {\n		var x = delim(s);\n		x.type = s;\n		x.nud = f;\n		return x;\n	}\n\n	function reserve(name, func) {\n		var x = type(name, func);\n		x.identifier = true;\n		x.reserved = true;\n		return x;\n	}\n\n	function FutureReservedWord(name, meta) {\n		var x = type(name, function () {\n			return this;\n		});\n\n		meta = meta || {};\n		meta.isFutureReservedWord = true;\n\n		x.value = name;\n		x.identifier = true;\n		x.reserved = true;\n		x.meta = meta;\n\n		return x;\n	}\n\n	function reservevar(s, v) {\n		return reserve(s, function () {\n			if (typeof v === "function") {\n				v(this);\n			}\n			return this;\n		});\n	}\n\n	function infix(s, f, p, w) {\n		var x = symbol(s, p);\n		reserveName(x);\n		x.led = function (left) {\n			if (!w) {\n				nobreaknonadjacent(state.tokens.prev, state.tokens.curr);\n				nonadjacent(state.tokens.curr, state.tokens.next);\n			}\n			if (s === "in" && left.id === "!") {\n				warning("W018", left, "!");\n			}\n			if (typeof f === "function") {\n				return f(left, this);\n			} else {\n				this.left = left;\n				this.right = expression(p);\n				return this;\n			}\n		};\n		return x;\n	}\n\n	function relation(s, f) {\n		var x = symbol(s, 100);\n\n		x.led = function (left) {\n			nobreaknonadjacent(state.tokens.prev, state.tokens.curr);\n			nonadjacent(state.tokens.curr, state.tokens.next);\n			var right = expression(100);\n\n			if (isIdentifier(left, "NaN") || isIdentifier(right, "NaN")) {\n				warning("W019", this);\n			} else if (f) {\n				f.apply(this, [left, right]);\n			}\n\n			if (!left || !right) {\n				quit("E041", state.tokens.curr.line);\n			}\n\n			if (left.id === "!") {\n				warning("W018", left, "!");\n			}\n\n			if (right.id === "!") {\n				warning("W018", right, "!");\n			}\n\n			this.left = left;\n			this.right = right;\n			return this;\n		};\n		return x;\n	}\n\n	function isPoorRelation(node) {\n		return node &&\n			  ((node.type === "(number)" && +node.value === 0) ||\n			   (node.type === "(string)" && node.value === "") ||\n			   (node.type === "null" && !state.option.eqnull) ||\n				node.type === "true" ||\n				node.type === "false" ||\n				node.type === "undefined");\n	}\n\n	function assignop(s) {\n		symbol(s, 20).exps = true;\n\n		return infix(s, function (left, that) {\n			that.left = left;\n\n			if (predefined[left.value] === false &&\n					scope[left.value]["(global)"] === true) {\n				warning("W020", left);\n			} else if (left["function"]) {\n				warning("W021", left, left.value);\n			}\n\n			if (left) {\n				if (state.option.esnext && funct[left.value] === "const") {\n					error("E013", left, left.value);\n				}\n\n				if (left.id === "." || left.id === "[") {\n					if (!left.left || left.left.value === "arguments") {\n						warning("E031", that);\n					}\n					that.right = expression(19);\n					return that;\n				} else if (left.identifier && !isReserved(left)) {\n					if (funct[left.value] === "exception") {\n						warning("W022", left);\n					}\n					that.right = expression(19);\n					return that;\n				}\n\n				if (left === state.syntax["function"]) {\n					warning("W023", state.tokens.curr);\n				}\n			}\n\n			error("E031", that);\n		}, 20);\n	}\n\n\n	function bitwise(s, f, p) {\n		var x = symbol(s, p);\n		reserveName(x);\n		x.led = (typeof f === "function") ? f : function (left) {\n			if (state.option.bitwise) {\n				warning("W016", this, this.id);\n			}\n			this.left = left;\n			this.right = expression(p);\n			return this;\n		};\n		return x;\n	}\n\n\n	function bitwiseassignop(s) {\n		symbol(s, 20).exps = true;\n		return infix(s, function (left, that) {\n			if (state.option.bitwise) {\n				warning("W016", that, that.id);\n			}\n			nonadjacent(state.tokens.prev, state.tokens.curr);\n			nonadjacent(state.tokens.curr, state.tokens.next);\n			if (left) {\n				if (left.id === "." || left.id === "[" ||\n						(left.identifier && !isReserved(left))) {\n					expression(19);\n					return that;\n				}\n				if (left === state.syntax["function"]) {\n					warning("W023", state.tokens.curr);\n				}\n				return that;\n			}\n			error("E031", that);\n		}, 20);\n	}\n\n\n	function suffix(s) {\n		var x = symbol(s, 150);\n\n		x.led = function (left) {\n			if (state.option.plusplus) {\n				warning("W016", this, this.id);\n			} else if ((!left.identifier || isReserved(left)) && left.id !== "." && left.id !== "[") {\n				warning("W017", this);\n			}\n\n			this.left = left;\n			return this;\n		};\n		return x;\n	}\n\n	// fnparam means that this identifier is being defined as a function\n	// argument (see identifier())\n	// prop means that this identifier is that of an object property\n\n	function optionalidentifier(fnparam, prop) {\n		if (!state.tokens.next.identifier) {\n			return;\n		}\n\n		advance();\n\n		var curr = state.tokens.curr;\n		var meta = curr.meta || {};\n		var val  = state.tokens.curr.value;\n\n		if (!isReserved(curr)) {\n			return val;\n		}\n\n		if (prop) {\n			if (state.option.es5 || meta.isFutureReservedWord) {\n				return val;\n			}\n		}\n\n		if (fnparam && val === "undefined") {\n			return val;\n		}\n\n		warning("W024", state.tokens.curr, state.tokens.curr.id);\n		return val;\n	}\n\n	// fnparam means that this identifier is being defined as a function\n	// argument\n	// prop means that this identifier is that of an object property\n	function identifier(fnparam, prop) {\n		var i = optionalidentifier(fnparam, prop);\n		if (i) {\n			return i;\n		}\n		if (state.tokens.curr.id === "function" && state.tokens.next.id === "(") {\n			warning("W025");\n		} else {\n			error("E030", state.tokens.next, state.tokens.next.value);\n		}\n	}\n\n\n	function reachable(s) {\n		var i = 0, t;\n		if (state.tokens.next.id !== ";" || noreach) {\n			return;\n		}\n		for (;;) {\n			t = peek(i);\n			if (t.reach) {\n				return;\n			}\n			if (t.id !== "(endline)") {\n				if (t.id === "function") {\n					if (!state.option.latedef) {\n						break;\n					}\n\n					warning("W026", t);\n					break;\n				}\n\n				warning("W027", t, t.value, s);\n				break;\n			}\n			i += 1;\n		}\n	}\n\n\n	function statement(noindent) {\n		var i = indent, r, s = scope, t = state.tokens.next;\n\n		if (t.id === ";") {\n			advance(";");\n			return;\n		}\n\n		// Is this a labelled statement?\n		var res = isReserved(t);\n\n		// We\'re being more tolerant here: if someone uses\n		// a FutureReservedWord as a label, we warn but proceed\n		// anyway.\n\n		if (res && t.meta && t.meta.isFutureReservedWord) {\n			warning("W024", t, t.id);\n			res = false;\n		}\n\n		if (t.identifier && !res && peek().id === ":") {\n			advance();\n			advance(":");\n			scope = Object.create(s);\n			addlabel(t.value, "label");\n\n			if (!state.tokens.next.labelled && state.tokens.next.value !== "{") {\n				warning("W028", state.tokens.next, t.value, state.tokens.next.value);\n			}\n\n			if (reg.javascriptURL.test(t.value + ":")) {\n				warning("W029", t, t.value);\n			}\n\n			state.tokens.next.label = t.value;\n			t = state.tokens.next;\n		}\n\n		// Is it a lonely block?\n\n		if (t.id === "{") {\n			block(true, true);\n			return;\n		}\n\n		// Parse the statement.\n\n		if (!noindent) {\n			indentation();\n		}\n		r = expression(0, true);\n\n		// Look for the final semicolon.\n\n		if (!t.block) {\n			if (!state.option.expr && (!r || !r.exps)) {\n				warning("W030", state.tokens.curr);\n			} else if (state.option.nonew && r.id === "(" && r.left.id === "new") {\n				warning("W031", t);\n			}\n\n			if (state.tokens.next.id === ",") {\n				return comma();\n			}\n\n			if (state.tokens.next.id !== ";") {\n				if (!state.option.asi) {\n					// If this is the last statement in a block that ends on\n					// the same line *and* option lastsemic is on, ignore the warning.\n					// Otherwise, complain about missing semicolon.\n					if (!state.option.lastsemic || state.tokens.next.id !== "}" ||\n						state.tokens.next.line !== state.tokens.curr.line) {\n						warningAt("W033", state.tokens.curr.line, state.tokens.curr.character);\n					}\n				}\n			} else {\n				adjacent(state.tokens.curr, state.tokens.next);\n				advance(";");\n				nonadjacent(state.tokens.curr, state.tokens.next);\n			}\n		}\n\n		// Restore the indentation.\n\n		indent = i;\n		scope = s;\n		return r;\n	}\n\n\n	function statements(startLine) {\n		var a = [], p;\n\n		while (!state.tokens.next.reach && state.tokens.next.id !== "(end)") {\n			if (state.tokens.next.id === ";") {\n				p = peek();\n\n				if (!p || (p.id !== "(" && p.id !== "[")) {\n					warning("W032");\n				}\n\n				advance(";");\n			} else {\n				a.push(statement(startLine === state.tokens.next.line));\n			}\n		}\n		return a;\n	}\n\n\n	/*\n	 * read all directives\n	 * recognizes a simple form of asi, but always\n	 * warns, if it is used\n	 */\n	function directives() {\n		var i, p, pn;\n\n		for (;;) {\n			if (state.tokens.next.id === "(string)") {\n				p = peek(0);\n				if (p.id === "(endline)") {\n					i = 1;\n					do {\n						pn = peek(i);\n						i = i + 1;\n					} while (pn.id === "(endline)");\n\n					if (pn.id !== ";") {\n						if (pn.id !== "(string)" && pn.id !== "(number)" &&\n							pn.id !== "(regexp)" && pn.identifier !== true &&\n							pn.id !== "}") {\n							break;\n						}\n						warning("W033", state.tokens.next);\n					} else {\n						p = pn;\n					}\n				} else if (p.id === "}") {\n					// Directive with no other statements, warn about missing semicolon\n					warning("W033", p);\n				} else if (p.id !== ";") {\n					break;\n				}\n\n				indentation();\n				advance();\n				if (state.directive[state.tokens.curr.value]) {\n					warning("W034", state.tokens.curr, state.tokens.curr.value);\n				}\n\n				if (state.tokens.curr.value === "use strict") {\n					if (!state.option["(explicitNewcap)"])\n						state.option.newcap = true;\n					state.option.undef = true;\n				}\n\n				// there\'s no directive negation, so always set to true\n				state.directive[state.tokens.curr.value] = true;\n\n				if (p.id === ";") {\n					advance(";");\n				}\n				continue;\n			}\n			break;\n		}\n	}\n\n\n	/*\n	 * Parses a single block. A block is a sequence of statements wrapped in\n	 * braces.\n	 *\n	 * ordinary - true for everything but function bodies and try blocks.\n	 * stmt		- true if block can be a single statement (e.g. in if/for/while).\n	 * isfunc	- true if block is a function body\n	 */\n	function block(ordinary, stmt, isfunc) {\n		var a,\n			b = inblock,\n			old_indent = indent,\n			m,\n			s = scope,\n			t,\n			line,\n			d;\n\n		inblock = ordinary;\n\n		if (!ordinary || !state.option.funcscope)\n			scope = Object.create(scope);\n\n		nonadjacent(state.tokens.curr, state.tokens.next);\n		t = state.tokens.next;\n\n		var metrics = funct["(metrics)"];\n		metrics.nestedBlockDepth += 1;\n		metrics.verifyMaxNestedBlockDepthPerFunction();\n\n		if (state.tokens.next.id === "{") {\n			advance("{");\n			line = state.tokens.curr.line;\n			if (state.tokens.next.id !== "}") {\n				indent += state.option.indent;\n				while (!ordinary && state.tokens.next.from > indent) {\n					indent += state.option.indent;\n				}\n\n				if (isfunc) {\n					m = {};\n					for (d in state.directive) {\n						if (_.has(state.directive, d)) {\n							m[d] = state.directive[d];\n						}\n					}\n					directives();\n\n					if (state.option.strict && funct["(context)"]["(global)"]) {\n						if (!m["use strict"] && !state.directive["use strict"]) {\n							warning("E007");\n						}\n					}\n				}\n\n				a = statements(line);\n\n				metrics.statementCount += a.length;\n\n				if (isfunc) {\n					state.directive = m;\n				}\n\n				indent -= state.option.indent;\n				if (line !== state.tokens.next.line) {\n					indentation();\n				}\n			} else if (line !== state.tokens.next.line) {\n				indentation();\n			}\n			advance("}", t);\n			indent = old_indent;\n		} else if (!ordinary) {\n			error("E021", state.tokens.next, "{", state.tokens.next.value);\n		} else {\n			if (!stmt || state.option.curly) {\n				warning("W116", state.tokens.next, "{", state.tokens.next.value);\n			}\n\n			noreach = true;\n			indent += state.option.indent;\n			// test indentation only if statement is in new line\n			a = [statement(state.tokens.next.line === state.tokens.curr.line)];\n			indent -= state.option.indent;\n			noreach = false;\n		}\n		funct["(verb)"] = null;\n		if (!ordinary || !state.option.funcscope) scope = s;\n		inblock = b;\n		if (ordinary && state.option.noempty && (!a || a.length === 0)) {\n			warning("W035");\n		}\n		metrics.nestedBlockDepth -= 1;\n		return a;\n	}\n\n\n	function countMember(m) {\n		if (membersOnly && typeof membersOnly[m] !== "boolean") {\n			warning("W036", state.tokens.curr, m);\n		}\n		if (typeof member[m] === "number") {\n			member[m] += 1;\n		} else {\n			member[m] = 1;\n		}\n	}\n\n\n	function note_implied(tkn) {\n		var name = tkn.value, line = tkn.line, a = implied[name];\n		if (typeof a === "function") {\n			a = false;\n		}\n\n		if (!a) {\n			a = [line];\n			implied[name] = a;\n		} else if (a[a.length - 1] !== line) {\n			a.push(line);\n		}\n	}\n\n\n	// Build the syntax table by declaring the syntactic elements of the language.\n\n	type("(number)", function () {\n		return this;\n	});\n\n	type("(string)", function () {\n		return this;\n	});\n\n	state.syntax["(identifier)"] = {\n		type: "(identifier)",\n		lbp: 0,\n		identifier: true,\n		nud: function () {\n			var v = this.value,\n				s = scope[v],\n				f;\n\n			if (typeof s === "function") {\n				// Protection against accidental inheritance.\n				s = undefined;\n			} else if (typeof s === "boolean") {\n				f = funct;\n				funct = functions[0];\n				addlabel(v, "var");\n				s = funct;\n				funct = f;\n			}\n\n			// The name is in scope and defined in the current function.\n			if (funct === s) {\n				// Change \'unused\' to \'var\', and reject labels.\n				switch (funct[v]) {\n				case "unused":\n					funct[v] = "var";\n					break;\n				case "unction":\n					funct[v] = "function";\n					this["function"] = true;\n					break;\n				case "function":\n					this["function"] = true;\n					break;\n				case "label":\n					warning("W037", state.tokens.curr, v);\n					break;\n				}\n			} else if (funct["(global)"]) {\n				// The name is not defined in the function.  If we are in the global\n				// scope, then we have an undefined variable.\n				//\n				// Operators typeof and delete do not raise runtime errors even if\n				// the base object of a reference is null so no need to display warning\n				// if we\'re inside of typeof or delete.\n\n				if (typeof predefined[v] !== "boolean") {\n					// Attempting to subscript a null reference will throw an\n					// error, even within the typeof and delete operators\n					if (!(anonname === "typeof" || anonname === "delete") ||\n						(state.tokens.next && (state.tokens.next.value === "." ||\n							state.tokens.next.value === "["))) {\n\n						isundef(funct, "W117", state.tokens.curr, v);\n					}\n				}\n\n				note_implied(state.tokens.curr);\n			} else {\n				// If the name is already defined in the current\n				// function, but not as outer, then there is a scope error.\n\n				switch (funct[v]) {\n				case "closure":\n				case "function":\n				case "var":\n				case "unused":\n					warning("W038", state.tokens.curr, v);\n					break;\n				case "label":\n					warning("W037", state.tokens.curr, v);\n					break;\n				case "outer":\n				case "global":\n					break;\n				default:\n					// If the name is defined in an outer function, make an outer entry,\n					// and if it was unused, make it var.\n					if (s === true) {\n						funct[v] = true;\n					} else if (s === null) {\n						warning("W039", state.tokens.curr, v);\n						note_implied(state.tokens.curr);\n					} else if (typeof s !== "object") {\n						// Operators typeof and delete do not raise runtime errors even\n						// if the base object of a reference is null so no need to\n						//\n						// display warning if we\'re inside of typeof or delete.\n						// Attempting to subscript a null reference will throw an\n						// error, even within the typeof and delete operators\n						if (!(anonname === "typeof" || anonname === "delete") ||\n							(state.tokens.next &&\n								(state.tokens.next.value === "." || state.tokens.next.value === "["))) {\n\n							isundef(funct, "W117", state.tokens.curr, v);\n						}\n						funct[v] = true;\n						note_implied(state.tokens.curr);\n					} else {\n						switch (s[v]) {\n						case "function":\n						case "unction":\n							this["function"] = true;\n							s[v] = "closure";\n							funct[v] = s["(global)"] ? "global" : "outer";\n							break;\n						case "var":\n						case "unused":\n							s[v] = "closure";\n							funct[v] = s["(global)"] ? "global" : "outer";\n							break;\n						case "closure":\n							funct[v] = s["(global)"] ? "global" : "outer";\n							break;\n						case "label":\n							warning("W037", state.tokens.curr, v);\n						}\n					}\n				}\n			}\n			return this;\n		},\n		led: function () {\n			error("E033", state.tokens.next, state.tokens.next.value);\n		}\n	};\n\n	type("(regexp)", function () {\n		return this;\n	});\n\n	// ECMAScript parser\n\n	delim("(endline)");\n	delim("(begin)");\n	delim("(end)").reach = true;\n	delim("(error)").reach = true;\n	delim("}").reach = true;\n	delim(")");\n	delim("]");\n	delim("\\"").reach = true;\n	delim("\'").reach = true;\n	delim(";");\n	delim(":").reach = true;\n	delim(",");\n	delim("#");\n\n	reserve("else");\n	reserve("case").reach = true;\n	reserve("catch");\n	reserve("default").reach = true;\n	reserve("finally");\n	reservevar("arguments", function (x) {\n		if (state.directive["use strict"] && funct["(global)"]) {\n			warning("E008", x);\n		}\n	});\n	reservevar("eval");\n	reservevar("false");\n	reservevar("Infinity");\n	reservevar("null");\n	reservevar("this", function (x) {\n		if (state.directive["use strict"] && !state.option.validthis && ((funct["(statement)"] &&\n				funct["(name)"].charAt(0) > "Z") || funct["(global)"])) {\n			warning("W040", x);\n		}\n	});\n	reservevar("true");\n	reservevar("undefined");\n\n	assignop("=", "assign", 20);\n	assignop("+=", "assignadd", 20);\n	assignop("-=", "assignsub", 20);\n	assignop("*=", "assignmult", 20);\n	assignop("/=", "assigndiv", 20).nud = function () {\n		error("E014");\n	};\n	assignop("%=", "assignmod", 20);\n\n	bitwiseassignop("&=", "assignbitand", 20);\n	bitwiseassignop("|=", "assignbitor", 20);\n	bitwiseassignop("^=", "assignbitxor", 20);\n	bitwiseassignop("<<=", "assignshiftleft", 20);\n	bitwiseassignop(">>=", "assignshiftright", 20);\n	bitwiseassignop(">>>=", "assignshiftrightunsigned", 20);\n	infix("?", function (left, that) {\n		that.left = left;\n		that.right = expression(10);\n		advance(":");\n		that["else"] = expression(10);\n		return that;\n	}, 30);\n\n	infix("||", "or", 40);\n	infix("&&", "and", 50);\n	bitwise("|", "bitor", 70);\n	bitwise("^", "bitxor", 80);\n	bitwise("&", "bitand", 90);\n	relation("==", function (left, right) {\n		var eqnull = state.option.eqnull && (left.value === "null" || right.value === "null");\n\n		if (!eqnull && state.option.eqeqeq)\n			warning("W116", this, "===", "==");\n		else if (isPoorRelation(left))\n			warning("W041", this, "===", left.value);\n		else if (isPoorRelation(right))\n			warning("W041", this, "===", right.value);\n\n		return this;\n	});\n	relation("===");\n	relation("!=", function (left, right) {\n		var eqnull = state.option.eqnull &&\n				(left.value === "null" || right.value === "null");\n\n		if (!eqnull && state.option.eqeqeq) {\n			warning("W116", this, "!==", "!=");\n		} else if (isPoorRelation(left)) {\n			warning("W041", this, "!==", left.value);\n		} else if (isPoorRelation(right)) {\n			warning("W041", this, "!==", right.value);\n		}\n		return this;\n	});\n	relation("!==");\n	relation("<");\n	relation(">");\n	relation("<=");\n	relation(">=");\n	bitwise("<<", "shiftleft", 120);\n	bitwise(">>", "shiftright", 120);\n	bitwise(">>>", "shiftrightunsigned", 120);\n	infix("in", "in", 120);\n	infix("instanceof", "instanceof", 120);\n	infix("+", function (left, that) {\n		var right = expression(130);\n		if (left && right && left.id === "(string)" && right.id === "(string)") {\n			left.value += right.value;\n			left.character = right.character;\n			if (!state.option.scripturl && reg.javascriptURL.test(left.value)) {\n				warning("W050", left);\n			}\n			return left;\n		}\n		that.left = left;\n		that.right = right;\n		return that;\n	}, 130);\n	prefix("+", "num");\n	prefix("+++", function () {\n		warning("W007");\n		this.right = expression(150);\n		this.arity = "unary";\n		return this;\n	});\n	infix("+++", function (left) {\n		warning("W007");\n		this.left = left;\n		this.right = expression(130);\n		return this;\n	}, 130);\n	infix("-", "sub", 130);\n	prefix("-", "neg");\n	prefix("---", function () {\n		warning("W006");\n		this.right = expression(150);\n		this.arity = "unary";\n		return this;\n	});\n	infix("---", function (left) {\n		warning("W006");\n		this.left = left;\n		this.right = expression(130);\n		return this;\n	}, 130);\n	infix("*", "mult", 140);\n	infix("/", "div", 140);\n	infix("%", "mod", 140);\n\n	suffix("++", "postinc");\n	prefix("++", "preinc");\n	state.syntax["++"].exps = true;\n\n	suffix("--", "postdec");\n	prefix("--", "predec");\n	state.syntax["--"].exps = true;\n	prefix("delete", function () {\n		var p = expression(0);\n		if (!p || (p.id !== "." && p.id !== "[")) {\n			warning("W051");\n		}\n		this.first = p;\n		return this;\n	}).exps = true;\n\n	prefix("~", function () {\n		if (state.option.bitwise) {\n			warning("W052", this, "~");\n		}\n		expression(150);\n		return this;\n	});\n\n	prefix("!", function () {\n		this.right = expression(150);\n		this.arity = "unary";\n\n		if (!this.right) { // \'!\' followed by nothing? Give up.\n			quit("E041", this.line || 0);\n		}\n\n		if (bang[this.right.id] === true) {\n			warning("W018", this, "!");\n		}\n		return this;\n	});\n\n	prefix("typeof", "typeof");\n	prefix("new", function () {\n		var c = expression(155), i;\n		if (c && c.id !== "function") {\n			if (c.identifier) {\n				c["new"] = true;\n				switch (c.value) {\n				case "Number":\n				case "String":\n				case "Boolean":\n				case "Math":\n				case "JSON":\n					warning("W053", state.tokens.prev, c.value);\n					break;\n				case "Function":\n					if (!state.option.evil) {\n						warning("W054");\n					}\n					break;\n				case "Date":\n				case "RegExp":\n					break;\n				default:\n					if (c.id !== "function") {\n						i = c.value.substr(0, 1);\n						if (state.option.newcap && (i < "A" || i > "Z") && !_.has(global, c.value)) {\n							warning("W055", state.tokens.curr);\n						}\n					}\n				}\n			} else {\n				if (c.id !== "." && c.id !== "[" && c.id !== "(") {\n					warning("W056", state.tokens.curr);\n				}\n			}\n		} else {\n			if (!state.option.supernew)\n				warning("W057", this);\n		}\n		adjacent(state.tokens.curr, state.tokens.next);\n		if (state.tokens.next.id !== "(" && !state.option.supernew) {\n			warning("W058", state.tokens.curr, state.tokens.curr.value);\n		}\n		this.first = c;\n		return this;\n	});\n	state.syntax["new"].exps = true;\n\n	prefix("void").exps = true;\n\n	infix(".", function (left, that) {\n		adjacent(state.tokens.prev, state.tokens.curr);\n		nobreak();\n		var m = identifier(false, true);\n\n		if (typeof m === "string") {\n			countMember(m);\n		}\n\n		that.left = left;\n		that.right = m;\n\n		if (m && m === "hasOwnProperty" && state.tokens.next.value === "=") {\n			warning("W001");\n		}\n\n		if (left && left.value === "arguments" && (m === "callee" || m === "caller")) {\n			if (state.option.noarg)\n				warning("W059", left, m);\n			else if (state.directive["use strict"])\n				error("E008");\n		} else if (!state.option.evil && left && left.value === "document" &&\n				(m === "write" || m === "writeln")) {\n			warning("W060", left);\n		}\n\n		if (!state.option.evil && (m === "eval" || m === "execScript")) {\n			warning("W061");\n		}\n\n		return that;\n	}, 160, true);\n\n	infix("(", function (left, that) {\n		if (state.tokens.prev.id !== "}" && state.tokens.prev.id !== ")") {\n			nobreak(state.tokens.prev, state.tokens.curr);\n		}\n\n		nospace();\n		if (state.option.immed && !left.immed && left.id === "function") {\n			warning("W062");\n		}\n\n		var n = 0;\n		var p = [];\n\n		if (left) {\n			if (left.type === "(identifier)") {\n				if (left.value.match(/^[A-Z]([A-Z0-9_$]*[a-z][A-Za-z0-9_$]*)?$/)) {\n					if ("Number String Boolean Date Object".indexOf(left.value) === -1) {\n						if (left.value === "Math") {\n							warning("W063", left);\n						} else if (state.option.newcap) {\n							warning("W064", left);\n						}\n					}\n				}\n			}\n		}\n\n		if (state.tokens.next.id !== ")") {\n			for (;;) {\n				p[p.length] = expression(10);\n				n += 1;\n				if (state.tokens.next.id !== ",") {\n					break;\n				}\n				comma();\n			}\n		}\n\n		advance(")");\n		nospace(state.tokens.prev, state.tokens.curr);\n\n		if (typeof left === "object") {\n			if (left.value === "parseInt" && n === 1) {\n				warning("W065", state.tokens.curr);\n			}\n			if (!state.option.evil) {\n				if (left.value === "eval" || left.value === "Function" ||\n						left.value === "execScript") {\n					warning("W061", left);\n\n					if (p[0] && [0].id === "(string)") {\n						addInternalSrc(left, p[0].value);\n					}\n				} else if (p[0] && p[0].id === "(string)" &&\n					   (left.value === "setTimeout" ||\n						left.value === "setInterval")) {\n					warning("W066", left);\n					addInternalSrc(left, p[0].value);\n\n				// window.setTimeout/setInterval\n				} else if (p[0] && p[0].id === "(string)" &&\n					   left.value === "." &&\n					   left.left.value === "window" &&\n					   (left.right === "setTimeout" ||\n						left.right === "setInterval")) {\n					warning("W066", left);\n					addInternalSrc(left, p[0].value);\n				}\n			}\n			if (!left.identifier && left.id !== "." && left.id !== "[" &&\n					left.id !== "(" && left.id !== "&&" && left.id !== "||" &&\n					left.id !== "?") {\n				warning("W067", left);\n			}\n		}\n\n		that.left = left;\n		return that;\n	}, 155, true).exps = true;\n\n	prefix("(", function () {\n		nospace();\n\n		if (state.tokens.next.id === "function") {\n			state.tokens.next.immed = true;\n		}\n\n		var exprs = [];\n\n		if (state.tokens.next.id !== ")") {\n			for (;;) {\n				exprs.push(expression(0));\n				if (state.tokens.next.id !== ",") {\n					break;\n				}\n				comma();\n			}\n		}\n\n		advance(")", this);\n		nospace(state.tokens.prev, state.tokens.curr);\n		if (state.option.immed && exprs[0].id === "function") {\n			if (state.tokens.next.id !== "(" &&\n			  (state.tokens.next.id !== "." || (peek().value !== "call" && peek().value !== "apply"))) {\n				warning("W068", this);\n			}\n		}\n\n		return exprs[0];\n	});\n\n	infix("[", function (left, that) {\n		nobreak(state.tokens.prev, state.tokens.curr);\n		nospace();\n		var e = expression(0), s;\n		if (e && e.type === "(string)") {\n			if (!state.option.evil && (e.value === "eval" || e.value === "execScript")) {\n				warning("W061", that);\n			}\n\n			countMember(e.value);\n			if (!state.option.sub && reg.identifier.test(e.value)) {\n				s = state.syntax[e.value];\n				if (!s || !isReserved(s)) {\n					warning("W069", state.tokens.prev, e.value);\n				}\n			}\n		}\n		advance("]", that);\n\n		if (e && e.value === "hasOwnProperty" && state.tokens.next.value === "=") {\n			warning("W001");\n		}\n\n		nospace(state.tokens.prev, state.tokens.curr);\n		that.left = left;\n		that.right = e;\n		return that;\n	}, 160, true);\n\n	prefix("[", function () {\n		var b = state.tokens.curr.line !== state.tokens.next.line;\n		this.first = [];\n		if (b) {\n			indent += state.option.indent;\n			if (state.tokens.next.from === indent + state.option.indent) {\n				indent += state.option.indent;\n			}\n		}\n		while (state.tokens.next.id !== "(end)") {\n			while (state.tokens.next.id === ",") {\n				if (!state.option.es5)\n					warning("W070");\n				advance(",");\n			}\n			if (state.tokens.next.id === "]") {\n				break;\n			}\n			if (b && state.tokens.curr.line !== state.tokens.next.line) {\n				indentation();\n			}\n			this.first.push(expression(10));\n			if (state.tokens.next.id === ",") {\n				comma({ allowTrailing: true });\n				if (state.tokens.next.id === "]" && !state.option.es5) {\n					warning("W070", state.tokens.curr);\n					break;\n				}\n			} else {\n				break;\n			}\n		}\n		if (b) {\n			indent -= state.option.indent;\n			indentation();\n		}\n		advance("]", this);\n		return this;\n	}, 160);\n\n\n	function property_name() {\n		var id = optionalidentifier(false, true);\n\n		if (!id) {\n			if (state.tokens.next.id === "(string)") {\n				id = state.tokens.next.value;\n				advance();\n			} else if (state.tokens.next.id === "(number)") {\n				id = state.tokens.next.value.toString();\n				advance();\n			}\n		}\n\n		if (id === "hasOwnProperty") {\n			warning("W001");\n		}\n\n		return id;\n	}\n\n\n	function functionparams() {\n		var next   = state.tokens.next;\n		var params = [];\n		var ident;\n\n		advance("(");\n		nospace();\n\n		if (state.tokens.next.id === ")") {\n			advance(")");\n			return;\n		}\n\n		for (;;) {\n			ident = identifier(true);\n			params.push(ident);\n			addlabel(ident, "unused", state.tokens.curr);\n			if (state.tokens.next.id === ",") {\n				comma();\n			} else {\n				advance(")", next);\n				nospace(state.tokens.prev, state.tokens.curr);\n				return params;\n			}\n		}\n	}\n\n\n	function doFunction(name, statement) {\n		var f;\n		var oldOption = state.option;\n		var oldScope  = scope;\n\n		state.option = Object.create(state.option);\n		scope  = Object.create(scope);\n\n		funct = {\n			"(name)"     : name || "\\"" + anonname + "\\"",\n			"(line)"     : state.tokens.next.line,\n			"(character)": state.tokens.next.character,\n			"(context)"  : funct,\n			"(breakage)" : 0,\n			"(loopage)"  : 0,\n			"(metrics)"  : createMetrics(state.tokens.next),\n			"(scope)"    : scope,\n			"(statement)": statement,\n			"(tokens)"   : {}\n		};\n\n		f = funct;\n		state.tokens.curr.funct = funct;\n\n		functions.push(funct);\n\n		if (name) {\n			addlabel(name, "function");\n		}\n\n		funct["(params)"] = functionparams();\n		funct["(metrics)"].verifyMaxParametersPerFunction(funct["(params)"]);\n\n		block(false, false, true);\n\n		funct["(metrics)"].verifyMaxStatementsPerFunction();\n		funct["(metrics)"].verifyMaxComplexityPerFunction();\n		funct["(unusedOption)"] = state.option.unused;\n\n		scope = oldScope;\n		state.option = oldOption;\n		funct["(last)"] = state.tokens.curr.line;\n		funct["(lastcharacter)"] = state.tokens.curr.character;\n		funct = funct["(context)"];\n\n		return f;\n	}\n\n	function createMetrics(functionStartToken) {\n		return {\n			statementCount: 0,\n			nestedBlockDepth: -1,\n			ComplexityCount: 1,\n			verifyMaxStatementsPerFunction: function () {\n				if (state.option.maxstatements &&\n					this.statementCount > state.option.maxstatements) {\n					warning("W071", functionStartToken, this.statementCount);\n				}\n			},\n\n			verifyMaxParametersPerFunction: function (params) {\n				params = params || [];\n\n				if (state.option.maxparams && params.length > state.option.maxparams) {\n					warning("W072", functionStartToken, params.length);\n				}\n			},\n\n			verifyMaxNestedBlockDepthPerFunction: function () {\n				if (state.option.maxdepth &&\n					this.nestedBlockDepth > 0 &&\n					this.nestedBlockDepth === state.option.maxdepth + 1) {\n					warning("W073", null, this.nestedBlockDepth);\n				}\n			},\n\n			verifyMaxComplexityPerFunction: function () {\n				var max = state.option.maxcomplexity;\n				var cc = this.ComplexityCount;\n				if (max && cc > max) {\n					warning("W074", functionStartToken, cc);\n				}\n			}\n		};\n	}\n\n	function increaseComplexityCount() {\n		funct["(metrics)"].ComplexityCount += 1;\n	}\n\n	// Parse assignments that were found instead of conditionals.\n	// For example: if (a = 1) { ... }\n\n	function parseCondAssignment() {\n		switch (state.tokens.next.id) {\n		case "=":\n		case "+=":\n		case "-=":\n		case "*=":\n		case "%=":\n		case "&=":\n		case "|=":\n		case "^=":\n		case "/=":\n			if (!state.option.boss) {\n				warning("W084");\n			}\n\n			advance(state.tokens.next.id);\n			expression(20);\n		}\n	}\n\n\n	(function (x) {\n		x.nud = function () {\n			var b, f, i, p, t;\n			var props = {}; // All properties, including accessors\n\n			function saveProperty(name, tkn) {\n				if (props[name] && _.has(props, name))\n					warning("W075", state.tokens.next, i);\n				else\n					props[name] = {};\n\n				props[name].basic = true;\n				props[name].basictkn = tkn;\n			}\n\n			function saveSetter(name, tkn) {\n				if (props[name] && _.has(props, name)) {\n					if (props[name].basic || props[name].setter)\n						warning("W075", state.tokens.next, i);\n				} else {\n					props[name] = {};\n				}\n\n				props[name].setter = true;\n				props[name].setterToken = tkn;\n			}\n\n			function saveGetter(name) {\n				if (props[name] && _.has(props, name)) {\n					if (props[name].basic || props[name].getter)\n						warning("W075", state.tokens.next, i);\n				} else {\n					props[name] = {};\n				}\n\n				props[name].getter = true;\n				props[name].getterToken = state.tokens.curr;\n			}\n\n			b = state.tokens.curr.line !== state.tokens.next.line;\n			if (b) {\n				indent += state.option.indent;\n				if (state.tokens.next.from === indent + state.option.indent) {\n					indent += state.option.indent;\n				}\n			}\n\n			for (;;) {\n				if (state.tokens.next.id === "}") {\n					break;\n				}\n\n				if (b) {\n					indentation();\n				}\n\n				if (state.tokens.next.value === "get" && peek().id !== ":") {\n					advance("get");\n\n					if (!state.option.es5) {\n						error("E034");\n					}\n\n					i = property_name();\n					if (!i) {\n						error("E035");\n					}\n\n					saveGetter(i);\n					t = state.tokens.next;\n					adjacent(state.tokens.curr, state.tokens.next);\n					f = doFunction();\n					p = f["(params)"];\n\n					if (p) {\n						warning("W076", t, p[0], i);\n					}\n\n					adjacent(state.tokens.curr, state.tokens.next);\n				} else if (state.tokens.next.value === "set" && peek().id !== ":") {\n					advance("set");\n\n					if (!state.option.es5) {\n						error("E034");\n					}\n\n					i = property_name();\n					if (!i) {\n						error("E035");\n					}\n\n					saveSetter(i, state.tokens.next);\n					t = state.tokens.next;\n					adjacent(state.tokens.curr, state.tokens.next);\n					f = doFunction();\n					p = f["(params)"];\n\n					if (!p || p.length !== 1) {\n						warning("W077", t, i);\n					}\n				} else {\n					i = property_name();\n					saveProperty(i, state.tokens.next);\n\n					if (typeof i !== "string") {\n						break;\n					}\n\n					advance(":");\n					nonadjacent(state.tokens.curr, state.tokens.next);\n					expression(10);\n				}\n\n				countMember(i);\n				if (state.tokens.next.id === ",") {\n					comma({ allowTrailing: true });\n					if (state.tokens.next.id === ",") {\n						warning("W070", state.tokens.curr);\n					} else if (state.tokens.next.id === "}" && !state.option.es5) {\n						warning("W070", state.tokens.curr);\n					}\n				} else {\n					break;\n				}\n			}\n			if (b) {\n				indent -= state.option.indent;\n				indentation();\n			}\n			advance("}", this);\n\n			// Check for lonely setters if in the ES5 mode.\n			if (state.option.es5) {\n				for (var name in props) {\n					if (_.has(props, name) && props[name].setter && !props[name].getter) {\n						warning("W078", props[name].setterToken);\n					}\n				}\n			}\n			return this;\n		};\n		x.fud = function () {\n			error("E036", state.tokens.curr);\n		};\n	}(delim("{")));\n\n	// This Function is called when esnext option is set to true\n	// it adds the `const` statement to JSHINT\n\n	useESNextSyntax = function () {\n		var conststatement = stmt("const", function (prefix) {\n			var id, name, value;\n\n			this.first = [];\n			for (;;) {\n				nonadjacent(state.tokens.curr, state.tokens.next);\n				id = identifier();\n				if (funct[id] === "const") {\n					warning("E011", null, id);\n				}\n				if (funct["(global)"] && predefined[id] === false) {\n					warning("W079", state.tokens.curr, id);\n				}\n				addlabel(id, "const");\n				if (prefix) {\n					break;\n				}\n				name = state.tokens.curr;\n				this.first.push(state.tokens.curr);\n\n				if (state.tokens.next.id !== "=") {\n					warning("E012", state.tokens.curr, id);\n				}\n\n				if (state.tokens.next.id === "=") {\n					nonadjacent(state.tokens.curr, state.tokens.next);\n					advance("=");\n					nonadjacent(state.tokens.curr, state.tokens.next);\n					if (state.tokens.next.id === "undefined") {\n						warning("W080", state.tokens.curr, id);\n					}\n					if (peek(0).id === "=" && state.tokens.next.identifier) {\n						error("E037", state.tokens.next, state.tokens.next.value);\n					}\n					value = expression(0);\n					name.first = value;\n				}\n\n				if (state.tokens.next.id !== ",") {\n					break;\n				}\n				comma();\n			}\n			return this;\n		});\n		conststatement.exps = true;\n	};\n\n	var varstatement = stmt("var", function (prefix) {\n		// JavaScript does not have block scope. It only has function scope. So,\n		// declaring a variable in a block can have unexpected consequences.\n		var id, name, value;\n\n		if (funct["(onevar)"] && state.option.onevar) {\n			warning("W081");\n		} else if (!funct["(global)"]) {\n			funct["(onevar)"] = true;\n		}\n\n		this.first = [];\n\n		for (;;) {\n			nonadjacent(state.tokens.curr, state.tokens.next);\n			id = identifier();\n\n			if (state.option.esnext && funct[id] === "const") {\n				warning("E011", null, id);\n			}\n\n			if (funct["(global)"] && predefined[id] === false) {\n				warning("W079", state.tokens.curr, id);\n			}\n\n			addlabel(id, "unused", state.tokens.curr);\n\n			if (prefix) {\n				break;\n			}\n\n			name = state.tokens.curr;\n			this.first.push(state.tokens.curr);\n\n			if (state.tokens.next.id === "=") {\n				nonadjacent(state.tokens.curr, state.tokens.next);\n				advance("=");\n				nonadjacent(state.tokens.curr, state.tokens.next);\n				if (state.tokens.next.id === "undefined") {\n					warning("W080", state.tokens.curr, id);\n				}\n				if (peek(0).id === "=" && state.tokens.next.identifier) {\n					error("E038", state.tokens.next, state.tokens.next.value);\n				}\n				value = expression(0);\n				name.first = value;\n			}\n			if (state.tokens.next.id !== ",") {\n				break;\n			}\n			comma();\n		}\n		return this;\n	});\n	varstatement.exps = true;\n\n	blockstmt("function", function () {\n		if (inblock) {\n			warning("W082", state.tokens.curr);\n\n		}\n		var i = identifier();\n		if (state.option.esnext && funct[i] === "const") {\n			warning("E011", null, i);\n		}\n		adjacent(state.tokens.curr, state.tokens.next);\n		addlabel(i, "unction", state.tokens.curr);\n\n		doFunction(i, { statement: true });\n		if (state.tokens.next.id === "(" && state.tokens.next.line === state.tokens.curr.line) {\n			error("E039");\n		}\n		return this;\n	});\n\n	prefix("function", function () {\n		var i = optionalidentifier();\n		if (i || state.option.gcl) {\n			adjacent(state.tokens.curr, state.tokens.next);\n		} else {\n			nonadjacent(state.tokens.curr, state.tokens.next);\n		}\n		doFunction(i);\n		if (!state.option.loopfunc && funct["(loopage)"]) {\n			warning("W083");\n		}\n		return this;\n	});\n\n	blockstmt("if", function () {\n		var t = state.tokens.next;\n		increaseComplexityCount();\n		advance("(");\n		nonadjacent(this, t);\n		nospace();\n		expression(20);\n		parseCondAssignment();\n		advance(")", t);\n		nospace(state.tokens.prev, state.tokens.curr);\n		block(true, true);\n		if (state.tokens.next.id === "else") {\n			nonadjacent(state.tokens.curr, state.tokens.next);\n			advance("else");\n			if (state.tokens.next.id === "if" || state.tokens.next.id === "switch") {\n				statement(true);\n			} else {\n				block(true, true);\n			}\n		}\n		return this;\n	});\n\n	blockstmt("try", function () {\n		var b;\n\n		function doCatch() {\n			var oldScope = scope;\n			var e;\n\n			advance("catch");\n			nonadjacent(state.tokens.curr, state.tokens.next);\n			advance("(");\n\n			scope = Object.create(oldScope);\n\n			e = state.tokens.next.value;\n			if (state.tokens.next.type !== "(identifier)") {\n				e = null;\n				warning("E030", state.tokens.next, e);\n			}\n\n			advance();\n			advance(")");\n\n			funct = {\n				"(name)"     : "(catch)",\n				"(line)"     : state.tokens.next.line,\n				"(character)": state.tokens.next.character,\n				"(context)"  : funct,\n				"(breakage)" : funct["(breakage)"],\n				"(loopage)"  : funct["(loopage)"],\n				"(scope)"    : scope,\n				"(statement)": false,\n				"(metrics)"  : createMetrics(state.tokens.next),\n				"(catch)"    : true,\n				"(tokens)"   : {}\n			};\n\n			if (e) {\n				addlabel(e, "exception");\n			}\n\n			state.tokens.curr.funct = funct;\n			functions.push(funct);\n\n			block(false);\n\n			scope = oldScope;\n\n			funct["(last)"] = state.tokens.curr.line;\n			funct["(lastcharacter)"] = state.tokens.curr.character;\n			funct = funct["(context)"];\n		}\n\n		block(false);\n\n		if (state.tokens.next.id === "catch") {\n			increaseComplexityCount();\n			doCatch();\n			b = true;\n		}\n\n		if (state.tokens.next.id === "finally") {\n			advance("finally");\n			block(false);\n			return;\n		} else if (!b) {\n			error("E021", state.tokens.next, "catch", state.tokens.next.value);\n		}\n\n		return this;\n	});\n\n	blockstmt("while", function () {\n		var t = state.tokens.next;\n		funct["(breakage)"] += 1;\n		funct["(loopage)"] += 1;\n		increaseComplexityCount();\n		advance("(");\n		nonadjacent(this, t);\n		nospace();\n		expression(20);\n		parseCondAssignment();\n		advance(")", t);\n		nospace(state.tokens.prev, state.tokens.curr);\n		block(true, true);\n		funct["(breakage)"] -= 1;\n		funct["(loopage)"] -= 1;\n		return this;\n	}).labelled = true;\n\n	blockstmt("with", function () {\n		var t = state.tokens.next;\n		if (state.directive["use strict"]) {\n			error("E010", state.tokens.curr);\n		} else if (!state.option.withstmt) {\n			warning("W085", state.tokens.curr);\n		}\n\n		advance("(");\n		nonadjacent(this, t);\n		nospace();\n		expression(0);\n		advance(")", t);\n		nospace(state.tokens.prev, state.tokens.curr);\n		block(true, true);\n\n		return this;\n	});\n\n	blockstmt("switch", function () {\n		var t = state.tokens.next,\n			g = false;\n		funct["(breakage)"] += 1;\n		advance("(");\n		nonadjacent(this, t);\n		nospace();\n		this.condition = expression(20);\n		advance(")", t);\n		nospace(state.tokens.prev, state.tokens.curr);\n		nonadjacent(state.tokens.curr, state.tokens.next);\n		t = state.tokens.next;\n		advance("{");\n		nonadjacent(state.tokens.curr, state.tokens.next);\n		indent += state.option.indent;\n		this.cases = [];\n\n		for (;;) {\n			switch (state.tokens.next.id) {\n			case "case":\n				switch (funct["(verb)"]) {\n				case "break":\n				case "case":\n				case "continue":\n				case "return":\n				case "switch":\n				case "throw":\n					break;\n				default:\n					// You can tell JSHint that you don\'t use break intentionally by\n					// adding a comment /* falls through */ on a line just before\n					// the next `case`.\n					if (!reg.fallsThrough.test(state.lines[state.tokens.next.line - 2])) {\n						warning("W086", state.tokens.curr, "case");\n					}\n				}\n				indentation(-state.option.indent);\n				advance("case");\n				this.cases.push(expression(20));\n				increaseComplexityCount();\n				g = true;\n				advance(":");\n				funct["(verb)"] = "case";\n				break;\n			case "default":\n				switch (funct["(verb)"]) {\n				case "break":\n				case "continue":\n				case "return":\n				case "throw":\n					break;\n				default:\n					// Do not display a warning if \'default\' is the first statement or if\n					// there is a special /* falls through */ comment.\n					if (this.cases.length) {\n						if (!reg.fallsThrough.test(state.lines[state.tokens.next.line - 2])) {\n							warning("W086", state.tokens.curr, "default");\n						}\n					}\n				}\n				indentation(-state.option.indent);\n				advance("default");\n				g = true;\n				advance(":");\n				break;\n			case "}":\n				indent -= state.option.indent;\n				indentation();\n				advance("}", t);\n				funct["(breakage)"] -= 1;\n				funct["(verb)"] = undefined;\n				return;\n			case "(end)":\n				error("E023", state.tokens.next, "}");\n				return;\n			default:\n				if (g) {\n					switch (state.tokens.curr.id) {\n					case ",":\n						error("E040");\n						return;\n					case ":":\n						g = false;\n						statements();\n						break;\n					default:\n						error("E025", state.tokens.curr);\n						return;\n					}\n				} else {\n					if (state.tokens.curr.id === ":") {\n						advance(":");\n						error("E024", state.tokens.curr, ":");\n						statements();\n					} else {\n						error("E021", state.tokens.next, "case", state.tokens.next.value);\n						return;\n					}\n				}\n			}\n		}\n	}).labelled = true;\n\n	stmt("debugger", function () {\n		if (!state.option.debug) {\n			warning("W087");\n		}\n		return this;\n	}).exps = true;\n\n	(function () {\n		var x = stmt("do", function () {\n			funct["(breakage)"] += 1;\n			funct["(loopage)"] += 1;\n			increaseComplexityCount();\n\n			this.first = block(true);\n			advance("while");\n			var t = state.tokens.next;\n			nonadjacent(state.tokens.curr, t);\n			advance("(");\n			nospace();\n			expression(20);\n			parseCondAssignment();\n			advance(")", t);\n			nospace(state.tokens.prev, state.tokens.curr);\n			funct["(breakage)"] -= 1;\n			funct["(loopage)"] -= 1;\n			return this;\n		});\n		x.labelled = true;\n		x.exps = true;\n	}());\n\n	blockstmt("for", function () {\n		var s, t = state.tokens.next;\n		funct["(breakage)"] += 1;\n		funct["(loopage)"] += 1;\n		increaseComplexityCount();\n		advance("(");\n		nonadjacent(this, t);\n		nospace();\n		if (peek(state.tokens.next.id === "var" ? 1 : 0).id === "in") {\n			if (state.tokens.next.id === "var") {\n				advance("var");\n				varstatement.fud.call(varstatement, true);\n			} else {\n				switch (funct[state.tokens.next.value]) {\n				case "unused":\n					funct[state.tokens.next.value] = "var";\n					break;\n				case "var":\n					break;\n				default:\n					warning("W088", state.tokens.next, state.tokens.next.value);\n				}\n				advance();\n			}\n			advance("in");\n			expression(20);\n			advance(")", t);\n			s = block(true, true);\n			if (state.option.forin && s && (s.length > 1 || typeof s[0] !== "object" ||\n					s[0].value !== "if")) {\n				warning("W089", this);\n			}\n			funct["(breakage)"] -= 1;\n			funct["(loopage)"] -= 1;\n			return this;\n		} else {\n			if (state.tokens.next.id !== ";") {\n				if (state.tokens.next.id === "var") {\n					advance("var");\n					varstatement.fud.call(varstatement);\n				} else {\n					for (;;) {\n						expression(0, "for");\n						if (state.tokens.next.id !== ",") {\n							break;\n						}\n						comma();\n					}\n				}\n			}\n			nolinebreak(state.tokens.curr);\n			advance(";");\n			if (state.tokens.next.id !== ";") {\n				expression(20);\n				parseCondAssignment();\n			}\n			nolinebreak(state.tokens.curr);\n			advance(";");\n			if (state.tokens.next.id === ";") {\n				error("E021", state.tokens.next, ")", ";");\n			}\n			if (state.tokens.next.id !== ")") {\n				for (;;) {\n					expression(0, "for");\n					if (state.tokens.next.id !== ",") {\n						break;\n					}\n					comma();\n				}\n			}\n			advance(")", t);\n			nospace(state.tokens.prev, state.tokens.curr);\n			block(true, true);\n			funct["(breakage)"] -= 1;\n			funct["(loopage)"] -= 1;\n			return this;\n		}\n	}).labelled = true;\n\n\n	stmt("break", function () {\n		var v = state.tokens.next.value;\n\n		if (funct["(breakage)"] === 0)\n			warning("W052", state.tokens.next, this.value);\n\n		if (!state.option.asi)\n			nolinebreak(this);\n\n		if (state.tokens.next.id !== ";") {\n			if (state.tokens.curr.line === state.tokens.next.line) {\n				if (funct[v] !== "label") {\n					warning("W090", state.tokens.next, v);\n				} else if (scope[v] !== funct) {\n					warning("W091", state.tokens.next, v);\n				}\n				this.first = state.tokens.next;\n				advance();\n			}\n		}\n		reachable("break");\n		return this;\n	}).exps = true;\n\n\n	stmt("continue", function () {\n		var v = state.tokens.next.value;\n\n		if (funct["(breakage)"] === 0)\n			warning("W052", state.tokens.next, this.value);\n\n		if (!state.option.asi)\n			nolinebreak(this);\n\n		if (state.tokens.next.id !== ";") {\n			if (state.tokens.curr.line === state.tokens.next.line) {\n				if (funct[v] !== "label") {\n					warning("W090", state.tokens.next, v);\n				} else if (scope[v] !== funct) {\n					warning("W091", state.tokens.next, v);\n				}\n				this.first = state.tokens.next;\n				advance();\n			}\n		} else if (!funct["(loopage)"]) {\n			warning("W052", state.tokens.next, this.value);\n		}\n		reachable("continue");\n		return this;\n	}).exps = true;\n\n\n	stmt("return", function () {\n		if (this.line === state.tokens.next.line) {\n			if (state.tokens.next.id === "(regexp)")\n				warning("W092");\n\n			if (state.tokens.next.id !== ";" && !state.tokens.next.reach) {\n				nonadjacent(state.tokens.curr, state.tokens.next);\n				this.first = expression(0);\n\n				if (this.first.type === "(punctuator)" && this.first.value === "=" && !state.option.boss) {\n					warningAt("W093", this.first.line, this.first.character);\n				}\n			}\n		} else if (!state.option.asi) {\n			nolinebreak(this); // always warn (Line breaking error)\n		}\n		reachable("return");\n		return this;\n	}).exps = true;\n\n\n	stmt("throw", function () {\n		nolinebreak(this);\n		nonadjacent(state.tokens.curr, state.tokens.next);\n		this.first = expression(20);\n		reachable("throw");\n		return this;\n	}).exps = true;\n\n	// Future Reserved Words\n\n	FutureReservedWord("abstract");\n	FutureReservedWord("boolean");\n	FutureReservedWord("byte");\n	FutureReservedWord("char");\n	FutureReservedWord("class", { es5: true });\n	FutureReservedWord("double");\n	FutureReservedWord("enum", { es5: true });\n	FutureReservedWord("export", { es5: true });\n	FutureReservedWord("extends", { es5: true });\n	FutureReservedWord("final");\n	FutureReservedWord("float");\n	FutureReservedWord("goto");\n	FutureReservedWord("implements", { es5: true, strictOnly: true });\n	FutureReservedWord("import", { es5: true });\n	FutureReservedWord("int");\n	FutureReservedWord("interface");\n	FutureReservedWord("let", { es5: true, strictOnly: true });\n	FutureReservedWord("long");\n	FutureReservedWord("native");\n	FutureReservedWord("package", { es5: true, strictOnly: true });\n	FutureReservedWord("private", { es5: true, strictOnly: true });\n	FutureReservedWord("protected", { es5: true, strictOnly: true });\n	FutureReservedWord("public", { es5: true, strictOnly: true });\n	FutureReservedWord("short");\n	FutureReservedWord("static", { es5: true, strictOnly: true });\n	FutureReservedWord("super", { es5: true });\n	FutureReservedWord("synchronized");\n	FutureReservedWord("throws");\n	FutureReservedWord("transient");\n	FutureReservedWord("volatile");\n	FutureReservedWord("yield", { es5: true, strictOnly: true });\n\n	// Parse JSON\n\n	function jsonValue() {\n\n		function jsonObject() {\n			var o = {}, t = state.tokens.next;\n			advance("{");\n			if (state.tokens.next.id !== "}") {\n				for (;;) {\n					if (state.tokens.next.id === "(end)") {\n						error("E026", state.tokens.next, t.line);\n					} else if (state.tokens.next.id === "}") {\n						warning("W094", state.tokens.curr);\n						break;\n					} else if (state.tokens.next.id === ",") {\n						error("E028", state.tokens.next);\n					} else if (state.tokens.next.id !== "(string)") {\n						warning("W095", state.tokens.next, state.tokens.next.value);\n					}\n					if (o[state.tokens.next.value] === true) {\n						warning("W075", state.tokens.next, state.tokens.next.value);\n					} else if ((state.tokens.next.value === "__proto__" &&\n						!state.option.proto) || (state.tokens.next.value === "__iterator__" &&\n						!state.option.iterator)) {\n						warning("W096", state.tokens.next, state.tokens.next.value);\n					} else {\n						o[state.tokens.next.value] = true;\n					}\n					advance();\n					advance(":");\n					jsonValue();\n					if (state.tokens.next.id !== ",") {\n						break;\n					}\n					advance(",");\n				}\n			}\n			advance("}");\n		}\n\n		function jsonArray() {\n			var t = state.tokens.next;\n			advance("[");\n			if (state.tokens.next.id !== "]") {\n				for (;;) {\n					if (state.tokens.next.id === "(end)") {\n						error("E027", state.tokens.next, t.line);\n					} else if (state.tokens.next.id === "]") {\n						warning("W094", state.tokens.curr);\n						break;\n					} else if (state.tokens.next.id === ",") {\n						error("E028", state.tokens.next);\n					}\n					jsonValue();\n					if (state.tokens.next.id !== ",") {\n						break;\n					}\n					advance(",");\n				}\n			}\n			advance("]");\n		}\n\n		switch (state.tokens.next.id) {\n		case "{":\n			jsonObject();\n			break;\n		case "[":\n			jsonArray();\n			break;\n		case "true":\n		case "false":\n		case "null":\n		case "(number)":\n		case "(string)":\n			advance();\n			break;\n		case "-":\n			advance("-");\n			if (state.tokens.curr.character !== state.tokens.next.from) {\n				warning("W011", state.tokens.curr);\n			}\n			adjacent(state.tokens.curr, state.tokens.next);\n			advance("(number)");\n			break;\n		default:\n			error("E003", state.tokens.next);\n		}\n	}\n\n\n	// The actual JSHINT function itself.\n	var itself = function (s, o, g) {\n		var a, i, k, x;\n		var optionKeys;\n		var newOptionObj = {};\n\n		state.reset();\n\n		if (o && o.scope) {\n			JSHINT.scope = o.scope;\n		} else {\n			JSHINT.errors = [];\n			JSHINT.undefs = [];\n			JSHINT.internals = [];\n			JSHINT.blacklist = {};\n			JSHINT.scope = "(main)";\n		}\n\n		predefined = Object.create(null);\n		combine(predefined, vars.ecmaIdentifiers);\n		combine(predefined, vars.reservedVars);\n\n		combine(predefined, g || {});\n\n		declared = Object.create(null);\n		exported = Object.create(null);\n		ignored = Object.create(null);\n\n		if (o) {\n			a = o.predef;\n			if (a) {\n				if (!Array.isArray(a) && typeof a === "object") {\n					a = Object.keys(a);\n				}\n\n				a.forEach(function (item) {\n					var slice, prop;\n\n					if (item[0] === "-") {\n						slice = item.slice(1);\n						JSHINT.blacklist[slice] = slice;\n					} else {\n						prop = Object.getOwnPropertyDescriptor(o.predef, item);\n						predefined[item] = prop ? prop.value : false;\n					}\n				});\n			}\n\n			optionKeys = Object.keys(o);\n			for (x = 0; x < optionKeys.length; x++) {\n				if (/^-W\\d{3}$/g.test(optionKeys[x])) {\n					ignored[optionKeys[x].slice(1)] = true;\n				} else {\n					newOptionObj[optionKeys[x]] = o[optionKeys[x]];\n\n					if (optionKeys[x] === "newcap" && o[optionKeys[x]] === false)\n						newOptionObj["(explicitNewcap)"] = true;\n\n					if (optionKeys[x] === "indent")\n						newOptionObj["(explicitIndent)"] = true;\n				}\n			}\n		}\n\n		state.option = newOptionObj;\n\n		state.option.indent = state.option.indent || 4;\n		state.option.maxerr = state.option.maxerr || 50;\n\n		indent = 1;\n		global = Object.create(predefined);\n		scope = global;\n		funct = {\n			"(global)":   true,\n			"(name)":	  "(global)",\n			"(scope)":	  scope,\n			"(breakage)": 0,\n			"(loopage)":  0,\n			"(tokens)":   {},\n			"(metrics)":   createMetrics(state.tokens.next)\n		};\n		functions = [funct];\n		urls = [];\n		stack = null;\n		member = {};\n		membersOnly = null;\n		implied = {};\n		inblock = false;\n		lookahead = [];\n		warnings = 0;\n		unuseds = [];\n\n		if (!isString(s) && !Array.isArray(s)) {\n			errorAt("E004", 0);\n			return false;\n		}\n\n		var api = {\n			get isJSON() {\n				return state.jsonMode;\n			},\n\n			getOption: function (name) {\n				return state.option[name] || null;\n			},\n\n			getCache: function (name) {\n				return state.cache[name];\n			},\n\n			setCache: function (name, value) {\n				state.cache[name] = value;\n			},\n\n			warn: function (code, data) {\n				warningAt.apply(null, [ code, data.line, data.char ].concat(data.data));\n			},\n\n			on: function (names, listener) {\n				names.split(" ").forEach(function (name) {\n					emitter.on(name, listener);\n				}.bind(this));\n			}\n		};\n\n		emitter.removeAllListeners();\n		(extraModules || []).forEach(function (func) {\n			func(api);\n		});\n\n		state.tokens.prev = state.tokens.curr = state.tokens.next = state.syntax["(begin)"];\n\n		lex = new Lexer(s);\n\n		lex.on("warning", function (ev) {\n			warningAt.apply(null, [ ev.code, ev.line, ev.character].concat(ev.data));\n		});\n\n		lex.on("error", function (ev) {\n			errorAt.apply(null, [ ev.code, ev.line, ev.character ].concat(ev.data));\n		});\n\n		lex.on("fatal", function (ev) {\n			quit("E041", ev.line, ev.from);\n		});\n\n		lex.on("Identifier", function (ev) {\n			emitter.emit("Identifier", ev);\n		});\n\n		lex.on("String", function (ev) {\n			emitter.emit("String", ev);\n		});\n\n		lex.on("Number", function (ev) {\n			emitter.emit("Number", ev);\n		});\n\n		lex.start();\n\n		// Check options\n		for (var name in o) {\n			if (_.has(o, name)) {\n				checkOption(name, state.tokens.curr);\n			}\n		}\n\n		assume();\n\n		// combine the passed globals after we\'ve assumed all our options\n		combine(predefined, g || {});\n\n		//reset values\n		comma.first = true;\n\n		try {\n			advance();\n			switch (state.tokens.next.id) {\n			case "{":\n			case "[":\n				state.option.laxbreak = true;\n				state.jsonMode = true;\n				jsonValue();\n				break;\n			default:\n				directives();\n\n				if (state.directive["use strict"]) {\n					if (!state.option.globalstrict && !state.option.node) {\n						warning("W097", state.tokens.prev);\n					}\n				}\n\n				statements();\n			}\n			advance((state.tokens.next && state.tokens.next.value !== ".")	? "(end)" : undefined);\n\n			var markDefined = function (name, context) {\n				do {\n					if (typeof context[name] === "string") {\n						// JSHINT marks unused variables as \'unused\' and\n						// unused function declaration as \'unction\'. This\n						// code changes such instances back \'var\' and\n						// \'closure\' so that the code in JSHINT.data()\n						// doesn\'t think they\'re unused.\n\n						if (context[name] === "unused")\n							context[name] = "var";\n						else if (context[name] === "unction")\n							context[name] = "closure";\n\n						return true;\n					}\n\n					context = context["(context)"];\n				} while (context);\n\n				return false;\n			};\n\n			var clearImplied = function (name, line) {\n				if (!implied[name])\n					return;\n\n				var newImplied = [];\n				for (var i = 0; i < implied[name].length; i += 1) {\n					if (implied[name][i] !== line)\n						newImplied.push(implied[name][i]);\n				}\n\n				if (newImplied.length === 0)\n					delete implied[name];\n				else\n					implied[name] = newImplied;\n			};\n\n			var warnUnused = function (name, tkn, type, unused_opt) {\n				var line = tkn.line;\n				var chr  = tkn.character;\n\n				if (unused_opt === undefined) {\n					unused_opt = state.option.unused;\n				}\n\n				if (unused_opt === true) {\n					unused_opt = "last-param";\n				}\n\n				var warnable_types = {\n					"vars": ["var"],\n					"last-param": ["var", "last-param"],\n					"strict": ["var", "param", "last-param"]\n				};\n\n				if (unused_opt) {\n					if (warnable_types[unused_opt] && warnable_types[unused_opt].indexOf(type) !== -1) {\n						warningAt("W098", line, chr, name);\n					}\n				}\n\n				unuseds.push({\n					name: name,\n					line: line,\n					character: chr\n				});\n			};\n\n			var checkUnused = function (func, key) {\n				var type = func[key];\n				var tkn = func["(tokens)"][key];\n\n				if (key.charAt(0) === "(")\n					return;\n\n				if (type !== "unused" && type !== "unction")\n					return;\n\n				// Params are checked separately from other variables.\n				if (func["(params)"] && func["(params)"].indexOf(key) !== -1)\n					return;\n\n				// Variable is in global scope and defined as exported.\n				if (func["(global)"] && _.has(exported, key)) {\n					return;\n				}\n\n				warnUnused(key, tkn, "var");\n			};\n\n			// Check queued \'x is not defined\' instances to see if they\'re still undefined.\n			for (i = 0; i < JSHINT.undefs.length; i += 1) {\n				k = JSHINT.undefs[i].slice(0);\n\n				if (markDefined(k[2].value, k[0])) {\n					clearImplied(k[2].value, k[2].line);\n				} else if (state.option.undef) {\n					warning.apply(warning, k.slice(1));\n				}\n			}\n\n			functions.forEach(function (func) {\n				if (func["(unusedOption)"] === false) {\n					return;\n				}\n\n				for (var key in func) {\n					if (_.has(func, key)) {\n						checkUnused(func, key);\n					}\n				}\n\n				if (!func["(params)"])\n					return;\n\n				var params = func["(params)"].slice();\n				var param  = params.pop();\n				var type, unused_type;\n\n				while (param) {\n					type = func[param];\n					unused_type = (params.length === func["(params)"].length - 1 ? "last-param" : "param");\n\n					// \'undefined\' is a special case for (function (window, undefined) { ... })();\n					// patterns.\n\n					if (param === "undefined")\n						return;\n\n					if (type === "unused" || type === "unction") {\n						warnUnused(param, func["(tokens)"][param], unused_type, func["(unusedOption)"]);\n					}\n\n					param = params.pop();\n				}\n			});\n\n			for (var key in declared) {\n				if (_.has(declared, key) && !_.has(global, key)) {\n					warnUnused(key, declared[key], "var");\n				}\n			}\n\n		} catch (err) {\n			if (err && err.name === "JSHintError") {\n				var nt = state.tokens.next || {};\n				JSHINT.errors.push({\n					scope     : "(main)",\n					raw       : err.raw,\n					reason    : err.message,\n					line      : err.line || nt.line,\n					character : err.character || nt.from\n				}, null);\n			} else {\n				throw err;\n			}\n		}\n\n		// Loop over the listed "internals", and check them as well.\n\n		if (JSHINT.scope === "(main)") {\n			o = o || {};\n\n			for (i = 0; i < JSHINT.internals.length; i += 1) {\n				k = JSHINT.internals[i];\n				o.scope = k.elem;\n				itself(k.value, o, g);\n			}\n		}\n\n		return JSHINT.errors.length === 0;\n	};\n\n	// Modules.\n	itself.addModule = function (func) {\n		extraModules.push(func);\n	};\n\n	itself.addModule(style.register);\n\n	// Data summary.\n	itself.data = function () {\n		var data = {\n			functions: [],\n			options: state.option\n		};\n		var implieds = [];\n		var members = [];\n		var fu, f, i, j, n, globals;\n\n		if (itself.errors.length) {\n			data.errors = itself.errors;\n		}\n\n		if (state.jsonMode) {\n			data.json = true;\n		}\n\n		for (n in implied) {\n			if (_.has(implied, n)) {\n				implieds.push({\n					name: n,\n					line: implied[n]\n				});\n			}\n		}\n\n		if (implieds.length > 0) {\n			data.implieds = implieds;\n		}\n\n		if (urls.length > 0) {\n			data.urls = urls;\n		}\n\n		globals = Object.keys(scope);\n		if (globals.length > 0) {\n			data.globals = globals;\n		}\n\n		for (i = 1; i < functions.length; i += 1) {\n			f = functions[i];\n			fu = {};\n\n			for (j = 0; j < functionicity.length; j += 1) {\n				fu[functionicity[j]] = [];\n			}\n\n			for (j = 0; j < functionicity.length; j += 1) {\n				if (fu[functionicity[j]].length === 0) {\n					delete fu[functionicity[j]];\n				}\n			}\n\n			fu.name = f["(name)"];\n			fu.param = f["(params)"];\n			fu.line = f["(line)"];\n			fu.character = f["(character)"];\n			fu.last = f["(last)"];\n			fu.lastcharacter = f["(lastcharacter)"];\n			data.functions.push(fu);\n		}\n\n		if (unuseds.length > 0) {\n			data.unused = unuseds;\n		}\n\n		members = [];\n		for (n in member) {\n			if (typeof member[n] === "number") {\n				data.member = member;\n				break;\n			}\n		}\n\n		return data;\n	};\n\n	itself.jshint = itself;\n\n	return itself;\n}());\n\n// Make JSHINT a Node module, if possible.\nif (typeof exports === "object" && exports) {\n	exports.JSHINT = JSHINT;\n}\n\n//@ sourceURL=/src/stable/jshint.js'));
require("/src/stable/jshint.js");JSHINT=require("/src/stable/jshint.js").JSHINT})();
/* END INSERT */

realExports.JSHINT = JSHINT;
exports = realExports;

// jshint-endignore

})(typeof exports == "undefined" ? (typeof doctest == "undefined" ? doctest = {} : doctest) : exports);
