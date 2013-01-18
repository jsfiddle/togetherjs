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
      this.result = this.runner.evaller(this.expr, globs);
    } catch (e) {
      if (e['doctest.abort']) {
        return;
      }
      this.write('Error: ' + e + '\n');
      // FIXME: doesn't format nicely:
      if (e.stack) {
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
    var num = parseInt(this.successEl.innerHTML, 10);
    num++;
    this.successEl.innerHTML = num+'';
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

  repr: function (o, indentString) {
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
      } else if (typeof o.repr == 'function' && o.repr != arguments.callee &&
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
    var s = '<' + el.tagName.toLowerCase();
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
       return o instanceof XMLHttpRequest;
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
    var self = this;
    this.logGrouped = false;
    this._abortCalled = false;
    var globs = {
      write: this.write.bind(this),
      writeln: this.writeln.bind(this),
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
      info: this.logFactory(null, console.info)
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
      return globs;
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
      window.print = undefined;
      window.wait = undefined;
      window.onerror = undefined;
      window.jshint = undefined;
      window.console.log = window.console.log.origFunc;
      window.console.warn = window.console.warn.origFunc;
      window.console.error = window.console.error.origFunc;
      window.console.info = window.console.info.origFunc;
    }
  },

  evaller: function (expr, context) {
    var e = eval;
    var result;
    if (context) {
      if (typeof global != "undefined") {
        extend(global, context);
        var vm = require('vm');
        vm.runInThisContext(expr);
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
      if (this._exampleWait) {
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
  makeExample: function (text, expected) {
    return new this.Example(this, text, expected, this.exampleOptions);
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
  this.selector = selector || 'pre.doctest, pre.commenttest';
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
    } else if (hasClass(el, 'commenttest')) {
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
        makeElement('span', {className: 'doctest-expr'}, [rawExample + '\n']),
            makeElement('span', {className: 'doctest-output'}, [rawOutput + '\n'])
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
      result.push([example, output, example, orig]);
      pos = end;
    }
    var last = contents.substr(pos, contents.length-pos);
    if (strip(last)) {
      result.push([last, '', last, '']);
    }
    return result;
  },

  loadRemotes: function (callback, selector) {
    if (! selector) {
      var els = this.findEls();
    } else {
      var els = document.querySelectorAll(selector);
    }
    var pending = 0;
    argsToArray(els).forEach(function (el) {
      var href = el.getAttribute('data-href-pattern');
      if (href) {
        try {
          href = this.fillPattern(href);
        } catch (e) {
          var text = '// Error resolving data-href-pattern"' + href + '":\n';
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
        if (req.status != 200 && !(req.status == 0 && document.location.protocol == "file:")) {
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
      var restriction = "^[\\w_\\-\\.]+$";;
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
    if (hasClass(el, 'commenttest')) {
      var texts = this.splitText(text);
      if (texts && texts.length) {
        text = texts[0].body;
        if (texts[0].header) {
          h3 = document.createElement('h3');
          h3.className = 'doctest-section-header';
          h3.appendChild(document.createTextNode(texts[0].header));
          el.parentNode.insertBefore(h3, el);
        }
        // Ignore first header I guess
        for (var i=1; i<texts.length; i++) {
          var pre = document.createElement('pre');
          pre.className = el.className;
          pre.appendChild(document.createTextNode(texts[i].body));
          el.parentNode.insertBefore(pre, el.nextSibling);
          if (texts[i].header) {
            var h3 = document.createElement('h3');
            h3.className = 'doctest-section-header';
            h3.appendChild(document.createTextNode(texts[i].header));
            el.parentNode.insertBefore(h3, el.nextSibling);
          }
        }
      }
    }
    el.appendChild(doc.createTextNode(text));
  },

  splitText: function (text) {
    try {
      var ast = esprima.parse(text, {
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
      if (! result.length) {
        if (strip(body)) {
          result.push({header: null, body: body});
        }
      } else {
        result[result.length-1].body = body;
      }
      result.push({header: header, body: null});
      pos = end;
    }
    if (! result.length) {
      // No sections
      return null;
    }
    var last = text.substr(pos, text.length-pos);
    result[result.length-1].body = last;
    return result;
  }

};

var TextParser = exports.TextParser = function (runner, text) {
  if (typeof esprima == "undefined") {
    if (typeof require != "undefined") {
      esprima = require("./esprima/esprima.js");
    } else {
      throw 'You must install or include esprima.js';
    }
  }
  this.runner = runner;
  this.text = text;
};

TextParser.fromFile = function (runner, filename) {
  if (typeof filename != "string") {
    throw "You did you give a filename for the second argument: " + filename;
  }
  if (typeof require == "undefined") {
    throw "This method only works in Node, with the presence of require()";
  }
  var fs = require('fs');
  var text = fs.readFileSync(filename, 'UTF-8');
  return new TextParser(runner, text);
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
      var ex = this.runner.makeExample(example, output);
      this.runner.examples.push(ex);
      pos = end;
    }
    var last = this.text.substr(pos, this.text.length-pos);
    if (strip(last)) {
      this.runner.examples.push(this.runner.makeExample(last, ''));
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
  return text;
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
      writeln(self.formatCall());
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
        console.error('Error in ' + this.repr() + '.applies:', e);
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
(function(e){"use strict";function m(e,t){if(!e)throw new Error("ASSERT: "+t)}function g(e,t){return u.slice(e,t)}function y(e){return"0123456789".indexOf(e)>=0}function b(e){return"0123456789abcdefABCDEF"
.indexOf(e)>=0}function w(e){return"01234567".indexOf(e)>=0}function E(e){return e===" "||e==="	"||e===""||e==="\f"||e===" "||e.charCodeAt(0)>=5760&&" ᠎             　﻿".indexOf(e)>=0}function S(e){return e==="\n"||
e==="\r"||e==="\u2028"||e==="\u2029"}function x(e){return e==="$"||e==="_"||e==="\\"||e>="a"&&e<="z"||e>="A"&&e<="Z"||e.charCodeAt(0)>=128&&o.NonAsciiIdentifierStart.test(e)}function T(e){return e==="$"||
e==="_"||e==="\\"||e>="a"&&e<="z"||e>="A"&&e<="Z"||e>="0"&&e<="9"||e.charCodeAt(0)>=128&&o.NonAsciiIdentifierPart.test(e)}function N(e){switch(e){case"class":case"enum":case"export":case"extends":case"import"
:case"super":return!0}return!1}function C(e){switch(e){case"implements":case"interface":case"package":case"private":case"protected":case"public":case"static":case"yield":case"let":return!0}return!1}function k
(e){return e==="eval"||e==="arguments"}function L(e){var t=!1;switch(e.length){case 2:t=e==="if"||e==="in"||e==="do";break;case 3:t=e==="var"||e==="for"||e==="new"||e==="try";break;case 4:t=e==="this"||
e==="else"||e==="case"||e==="void"||e==="with";break;case 5:t=e==="while"||e==="break"||e==="catch"||e==="throw";break;case 6:t=e==="return"||e==="typeof"||e==="delete"||e==="switch";break;case 7:t=e==="default"||
e==="finally";break;case 8:t=e==="function"||e==="continue"||e==="debugger";break;case 10:t=e==="instanceof"}if(t)return!0;switch(e){case"const":return!0;case"yield":case"let":return!0}return a&&C(e)?!0
:N(e)}function A(){return u[f++]}function O(){var e,t,n;t=!1,n=!1;while(f<h){e=u[f];if(n)e=A(),S(e)&&(n=!1,e==="\r"&&u[f]==="\n"&&++f,++l,c=f);else if(t)S(e)?(e==="\r"&&u[f+1]==="\n"&&++f,++l,++f,c=f,f>=
h&&U({},s.UnexpectedToken,"ILLEGAL")):(e=A(),f>=h&&U({},s.UnexpectedToken,"ILLEGAL"),e==="*"&&(e=u[f],e==="/"&&(++f,t=!1)));else if(e==="/"){e=u[f+1];if(e==="/")f+=2,n=!0;else{if(e!=="*")break;f+=2,t=!0
,f>=h&&U({},s.UnexpectedToken,"ILLEGAL")}}else if(E(e))++f;else{if(!S(e))break;++f,e==="\r"&&u[f]==="\n"&&++f,++l,c=f}}}function M(e){var t,n,r,i=0;n=e==="u"?4:2;for(t=0;t<n;++t){if(!(f<h&&b(u[f])))return""
;r=A(),i=i*16+"0123456789abcdef".indexOf(r.toLowerCase())}return String.fromCharCode(i)}function _(){var e,n,r,i;e=u[f];if(!x(e))return;n=f;if(e==="\\"){++f;if(u[f]!=="u")return;++f,i=f,e=M("u");if(e){
if(e==="\\"||!x(e))return;r=e}else f=i,r="u"}else r=A();while(f<h){e=u[f];if(!T(e))break;if(e==="\\"){++f;if(u[f]!=="u")return;++f,i=f,e=M("u");if(e){if(e==="\\"||!T(e))return;r+=e}else f=i,r+="u"}else r+=
A()}return r.length===1?{type:t.Identifier,value:r,lineNumber:l,lineStart:c,range:[n,f]}:L(r)?{type:t.Keyword,value:r,lineNumber:l,lineStart:c,range:[n,f]}:r==="null"?{type:t.NullLiteral,value:r,lineNumber
:l,lineStart:c,range:[n,f]}:r==="true"||r==="false"?{type:t.BooleanLiteral,value:r,lineNumber:l,lineStart:c,range:[n,f]}:{type:t.Identifier,value:r,lineNumber:l,lineStart:c,range:[n,f]}}function D(){var e=
f,n=u[f],r,i,s;if(n===";"||n==="{"||n==="}")return++f,{type:t.Punctuator,value:n,lineNumber:l,lineStart:c,range:[e,f]};if(n===","||n==="("||n===")")return++f,{type:t.Punctuator,value:n,lineNumber:l,lineStart
:c,range:[e,f]};r=u[f+1];if(n==="."&&!y(r))return{type:t.Punctuator,value:A(),lineNumber:l,lineStart:c,range:[e,f]};i=u[f+2],s=u[f+3];if(n===">"&&r===">"&&i===">"&&s==="=")return f+=4,{type:t.Punctuator
,value:">>>=",lineNumber:l,lineStart:c,range:[e,f]};if(n==="="&&r==="="&&i==="=")return f+=3,{type:t.Punctuator,value:"===",lineNumber:l,lineStart:c,range:[e,f]};if(n==="!"&&r==="="&&i==="=")return f+=3
,{type:t.Punctuator,value:"!==",lineNumber:l,lineStart:c,range:[e,f]};if(n===">"&&r===">"&&i===">")return f+=3,{type:t.Punctuator,value:">>>",lineNumber:l,lineStart:c,range:[e,f]};if(n==="<"&&r==="<"&&
i==="=")return f+=3,{type:t.Punctuator,value:"<<=",lineNumber:l,lineStart:c,range:[e,f]};if(n===">"&&r===">"&&i==="=")return f+=3,{type:t.Punctuator,value:">>=",lineNumber:l,lineStart:c,range:[e,f]};if(
r==="="&&"<>=!+-*%&|^/".indexOf(n)>=0)return f+=2,{type:t.Punctuator,value:n+r,lineNumber:l,lineStart:c,range:[e,f]};if(n===r&&"+-<>&|".indexOf(n)>=0&&"+-<>&|".indexOf(r)>=0)return f+=2,{type:t.Punctuator
,value:n+r,lineNumber:l,lineStart:c,range:[e,f]};if("[]<>+-*%&|^!~?:=/".indexOf(n)>=0)return{type:t.Punctuator,value:A(),lineNumber:l,lineStart:c,range:[e,f]}}function P(){var e,n,r;r=u[f],m(y(r)||r==="."
,"Numeric literal must start with a decimal digit or a decimal point"),n=f,e="";if(r!=="."){e=A(),r=u[f];if(e==="0"){if(r==="x"||r==="X"){e+=A();while(f<h){r=u[f];if(!b(r))break;e+=A()}return e.length<=2&&
U({},s.UnexpectedToken,"ILLEGAL"),f<h&&(r=u[f],x(r)&&U({},s.UnexpectedToken,"ILLEGAL")),{type:t.NumericLiteral,value:parseInt(e,16),lineNumber:l,lineStart:c,range:[n,f]}}if(w(r)){e+=A();while(f<h){r=u[
f];if(!w(r))break;e+=A()}return f<h&&(r=u[f],(x(r)||y(r))&&U({},s.UnexpectedToken,"ILLEGAL")),{type:t.NumericLiteral,value:parseInt(e,8),octal:!0,lineNumber:l,lineStart:c,range:[n,f]}}y(r)&&U({},s.UnexpectedToken
,"ILLEGAL")}while(f<h){r=u[f];if(!y(r))break;e+=A()}}if(r==="."){e+=A();while(f<h){r=u[f];if(!y(r))break;e+=A()}}if(r==="e"||r==="E"){e+=A(),r=u[f];if(r==="+"||r==="-")e+=A();r=u[f];if(y(r)){e+=A();while(
f<h){r=u[f];if(!y(r))break;e+=A()}}else r="character "+r,f>=h&&(r="<end>"),U({},s.UnexpectedToken,"ILLEGAL")}return f<h&&(r=u[f],x(r)&&U({},s.UnexpectedToken,"ILLEGAL")),{type:t.NumericLiteral,value:parseFloat
(e),lineNumber:l,lineStart:c,range:[n,f]}}function H(){var e="",n,r,i,o,a,p,d=!1;n=u[f],m(n==="'"||n==='"',"String literal must starts with a quote"),r=f,++f;while(f<h){i=A();if(i===n){n="";break}if(i==="\\"
){i=A();if(!S(i))switch(i){case"n":e+="\n";break;case"r":e+="\r";break;case"t":e+="	";break;case"u":case"x":p=f,a=M(i),a?e+=a:(f=p,e+=i);break;case"b":e+="\b";break;case"f":e+="\f";break;case"v":e+=""
;break;default:w(i)?(o="01234567".indexOf(i),o!==0&&(d=!0),f<h&&w(u[f])&&(d=!0,o=o*8+"01234567".indexOf(A()),"0123".indexOf(i)>=0&&f<h&&w(u[f])&&(o=o*8+"01234567".indexOf(A()))),e+=String.fromCharCode(
o)):e+=i}else++l,i==="\r"&&u[f]==="\n"&&++f}else{if(S(i))break;e+=i}}return n!==""&&U({},s.UnexpectedToken,"ILLEGAL"),{type:t.StringLiteral,value:e,octal:d,lineNumber:l,lineStart:c,range:[r,f]}}function B
(){var e="",t,n,r,i,o,a=!1,l;p=null,O(),n=f,t=u[f],m(t==="/","Regular expression literal must start with a slash"),e=A();while(f<h){t=A(),e+=t;if(a)t==="]"&&(a=!1);else if(t==="\\")t=A(),S(t)&&U({},s.UnterminatedRegExp
),e+=t;else{if(t==="/")break;t==="["?a=!0:S(t)&&U({},s.UnterminatedRegExp)}}e.length===1&&U({},s.UnterminatedRegExp),r=e.substr(1,e.length-2),i="";while(f<h){t=u[f];if(!T(t))break;++f;if(t==="\\"&&f<h)
{t=u[f];if(t==="u"){++f,l=f,t=M("u");if(t){i+=t,e+="\\u";for(;l<f;++l)e+=u[l]}else f=l,i+="u",e+="\\u"}else e+="\\"}else i+=t,e+=t}try{o=new RegExp(r,i)}catch(c){U({},s.InvalidRegExp)}return{literal:e,
value:o,range:[n,f]}}function j(e){return e.type===t.Identifier||e.type===t.Keyword||e.type===t.BooleanLiteral||e.type===t.NullLiteral}function F(){var e,n;O();if(f>=h)return{type:t.EOF,lineNumber:l,lineStart
:c,range:[f,f]};n=D();if(typeof n!="undefined")return n;e=u[f];if(e==="'"||e==='"')return H();if(e==="."||y(e))return P();n=_();if(typeof n!="undefined")return n;U({},s.UnexpectedToken,"ILLEGAL")}function I
(){var e;return p?(f=p.range[1],l=p.lineNumber,c=p.lineStart,e=p,p=null,e):(p=null,F())}function q(){var e,t,n;return p!==null?p:(e=f,t=l,n=c,p=F(),f=e,l=t,c=n,p)}function R(){var e,t,n,r;return e=f,t=
l,n=c,O(),r=l!==t,f=e,l=t,c=n,r}function U(e,t){var n,r=Array.prototype.slice.call(arguments,2),i=t.replace(/%(\d)/g,function(e,t){return r[t]||""});throw typeof e.lineNumber=="number"?(n=new Error("Line "+
e.lineNumber+": "+i),n.index=e.range[0],n.lineNumber=e.lineNumber,n.column=e.range[0]-c+1):(n=new Error("Line "+l+": "+i),n.index=f,n.lineNumber=l,n.column=f-c+1),n}function z(){var e;try{U.apply(null,
arguments)}catch(t){if(!v.errors)throw t;v.errors.push(t)}}function W(e){var n;e.type===t.EOF&&U(e,s.UnexpectedEOS),e.type===t.NumericLiteral&&U(e,s.UnexpectedNumber),e.type===t.StringLiteral&&U(e,s.UnexpectedString
),e.type===t.Identifier&&U(e,s.UnexpectedIdentifier),e.type===t.Keyword&&(N(e.value)?U(e,s.UnexpectedReserved):a&&C(e.value)&&U(e,s.StrictReservedWord),U(e,s.UnexpectedToken,e.value)),U(e,s.UnexpectedToken
,e.value)}function X(e){var n=I();(n.type!==t.Punctuator||n.value!==e)&&W(n)}function V(e){var n=I();(n.type!==t.Keyword||n.value!==e)&&W(n)}function $(e){var n=q();return n.type===t.Punctuator&&n.value===
e}function J(e){var n=q();return n.type===t.Keyword&&n.value===e}function K(){var e=q(),n=e.value;return e.type!==t.Punctuator?!1:n==="="||n==="*="||n==="/="||n==="%="||n==="+="||n==="-="||n==="<<="||n===">>="||
n===">>>="||n==="&="||n==="^="||n==="|="}function Q(){var e,n;if(u[f]===";"){I();return}n=l,O();if(l!==n)return;if($(";")){I();return}e=q(),e.type!==t.EOF&&!$("}")&&W(e);return}function G(e){switch(e.type
){case r.Identifier:case r.MemberExpression:case r.CallExpression:return!0}return!1}function Y(){var e=[],t;X("[");while(!$("]"))$(",")?(I(),e.push(t)):(e.push(Nt()),$("]")||X(","));return X("]"),{type
:r.ArrayExpression,elements:e}}function Z(e,t){var n,i;return n=a,i=Yt(),t&&a&&k(e[0].name)&&U(t,s.StrictParamName),a=n,{type:r.FunctionExpression,id:null,params:e,body:i}}function et(){var e=I();return e
.type===t.StringLiteral||e.type===t.NumericLiteral?(a&&e.octal&&U(e,s.StrictOctalLiteral),fn(e)):{type:r.Identifier,name:e.value}}function tt(){var e,n,i,s;e=q();if(e.type===t.Identifier)return i=et(),
e.value==="get"&&!$(":")?(n=et(),X("("),X(")"),{type:r.Property,key:n,value:Z([]),kind:"get"}):e.value==="set"&&!$(":")?(n=et(),X("("),e=q(),e.type!==t.Identifier&&W(I()),s=[At()],X(")"),{type:r.Property
,key:n,value:Z(s,e),kind:"set"}):(X(":"),{type:r.Property,key:i,value:Nt(),kind:"init"});if(e.type!==t.EOF&&e.type!==t.Punctuator)return n=et(),X(":"),{type:r.Property,key:n,value:Nt(),kind:"init"};W(e
)}function nt(){var e,t=[],n,o,u,f={},l=String;X("{");while(!$("}"))n=tt(),n.key.type===r.Identifier?o=n.key.name:o=l(n.key.value),u=n.kind==="init"?i.Data:n.kind==="get"?i.Get:i.Set,Object.prototype.hasOwnProperty
.call(f,o)?(f[o]===i.Data?a&&u===i.Data?z({},s.StrictDuplicateProperty):u!==i.Data&&U({},s.AccessorDataProperty):u===i.Data?U({},s.AccessorDataProperty):f[o]&u&&U({},s.AccessorGetSet),f[o]|=u):f[o]=u,t
.push(n),$("}")||X(",");return X("}"),{type:r.ObjectExpression,properties:t}}function rt(){var e,n=q(),i=n.type;if(i===t.Identifier)return{type:r.Identifier,name:I().value};if(i===t.StringLiteral||i===
t.NumericLiteral)return a&&n.octal&&z(n,s.StrictOctalLiteral),fn(I());if(i===t.Keyword){if(J("this"))return I(),{type:r.ThisExpression};if(J("function"))return en()}return i===t.BooleanLiteral?(I(),n.value=
n.value==="true",fn(n)):i===t.NullLiteral?(I(),n.value=null,fn(n)):$("[")?Y():$("{")?nt():$("(")?(I(),d.lastParenthesized=e=Ct(),X(")"),e):$("/")||$("/=")?fn(B()):W(I())}function it(){var e=[];X("(");if(!
$(")"))while(f<h){e.push(Nt());if($(")"))break;X(",")}return X(")"),e}function st(){var e=I();return j(e)||W(e),{type:r.Identifier,name:e.value}}function ot(e){return{type:r.MemberExpression,computed:!1
,object:e,property:st()}}function ut(e){var t,n;return X("["),t=Ct(),n={type:r.MemberExpression,computed:!0,object:e,property:t},X("]"),n}function at(e){return{type:r.CallExpression,callee:e,arguments:
it()}}function ft(){var e;return V("new"),e={type:r.NewExpression,callee:ct(),arguments:[]},$("(")&&(e.arguments=it()),e}function lt(){var e,t;e=J("new"),t=e?ft():rt();while(f<h)if($("."))I(),t=ot(t);else if(
$("["))t=ut(t);else{if(!$("("))break;t=at(t)}return t}function ct(){var e,t;e=J("new"),t=e?ft():rt();while(f<h)if($("."))I(),t=ot(t);else{if(!$("["))break;t=ut(t)}return t}function ht(){var e=lt();return(
$("++")||$("--"))&&!R()&&(a&&e.type===r.Identifier&&k(e.name)&&U({},s.StrictLHSPostfix),G(e)||U({},s.InvalidLHSInAssignment),e={type:r.UpdateExpression,operator:I().value,argument:e,prefix:!1}),e}function pt
(){var e,t;return $("++")||$("--")?(e=I(),t=pt(),a&&t.type===r.Identifier&&k(t.name)&&U({},s.StrictLHSPrefix),G(t)||U({},s.InvalidLHSInAssignment),t={type:r.UpdateExpression,operator:e.value,argument:t
,prefix:!0},t):$("+")||$("-")||$("~")||$("!")?(t={type:r.UnaryExpression,operator:I().value,argument:pt()},t):J("delete")||J("void")||J("typeof")?(t={type:r.UnaryExpression,operator:I().value,argument:
pt()},a&&t.operator==="delete"&&t.argument.type===r.Identifier&&z({},s.StrictDelete),t):ht()}function dt(){var e=pt();while($("*")||$("/")||$("%"))e={type:r.BinaryExpression,operator:I().value,left:e,right
:pt()};return e}function vt(){var e=dt();while($("+")||$("-"))e={type:r.BinaryExpression,operator:I().value,left:e,right:dt()};return e}function mt(){var e=vt();while($("<<")||$(">>")||$(">>>"))e={type
:r.BinaryExpression,operator:I().value,left:e,right:vt()};return e}function gt(){var e,t;return t=d.allowIn,d.allowIn=!0,e=mt(),d.allowIn=t,$("<")||$(">")||$("<=")||$(">=")?e={type:r.BinaryExpression,operator
:I().value,left:e,right:gt()}:d.allowIn&&J("in")?(I(),e={type:r.BinaryExpression,operator:"in",left:e,right:gt()}):J("instanceof")&&(I(),e={type:r.BinaryExpression,operator:"instanceof",left:e,right:gt
()}),e}function yt(){var e=gt();while($("==")||$("!=")||$("===")||$("!=="))e={type:r.BinaryExpression,operator:I().value,left:e,right:gt()};return e}function bt(){var e=yt();while($("&"))I(),e={type:r.
BinaryExpression,operator:"&",left:e,right:yt()};return e}function wt(){var e=bt();while($("^"))I(),e={type:r.BinaryExpression,operator:"^",left:e,right:bt()};return e}function Et(){var e=wt();while($("|"
))I(),e={type:r.BinaryExpression,operator:"|",left:e,right:wt()};return e}function St(){var e=Et();while($("&&"))I(),e={type:r.LogicalExpression,operator:"&&",left:e,right:Et()};return e}function xt(){
var e=St();while($("||"))I(),e={type:r.LogicalExpression,operator:"||",left:e,right:St()};return e}function Tt(){var e,t,n;return e=xt(),$("?")&&(I(),t=d.allowIn,d.allowIn=!0,n=Nt(),d.allowIn=t,X(":"),
e={type:r.ConditionalExpression,test:e,consequent:n,alternate:Nt()}),e}function Nt(){var e;return e=Tt(),K()&&(G(e)||U({},s.InvalidLHSInAssignment),a&&e.type===r.Identifier&&k(e.name)&&U({},s.StrictLHSAssignment
),e={type:r.AssignmentExpression,operator:I().value,left:e,right:Nt()}),e}function Ct(){var e=Nt();if($(",")){e={type:r.SequenceExpression,expressions:[e]};while(f<h){if(!$(","))break;I(),e.expressions
.push(Nt())}}return e}function kt(){var e=[],t;while(f<h){if($("}"))break;t=tn();if(typeof t=="undefined")break;e.push(t)}return e}function Lt(){var e;return X("{"),e=kt(),X("}"),{type:r.BlockStatement
,body:e}}function At(){var e=I();return e.type!==t.Identifier&&W(e),{type:r.Identifier,name:e.value}}function Ot(e){var t=At(),n=null;return a&&k(t.name)&&z({},s.StrictVarName),e==="const"?(X("="),n=Nt
()):$("=")&&(I(),n=Nt()),{type:r.VariableDeclarator,id:t,init:n}}function Mt(e){var t=[];while(f<h){t.push(Ot(e));if(!$(","))break;I()}return t}function _t(){var e;return V("var"),e=Mt(),Q(),{type:r.VariableDeclaration
,declarations:e,kind:"var"}}function Dt(e){var t;return V(e),t=Mt(e),Q(),{type:r.VariableDeclaration,declarations:t,kind:e}}function Pt(){return X(";"),{type:r.EmptyStatement}}function Ht(){var e=Ct();
return Q(),{type:r.ExpressionStatement,expression:e}}function Bt(){var e,t,n;return V("if"),X("("),e=Ct(),X(")"),t=Gt(),J("else")?(I(),n=Gt()):n=null,{type:r.IfStatement,test:e,consequent:t,alternate:n
}}function jt(){var e,t,n;return V("do"),n=d.inIteration,d.inIteration=!0,e=Gt(),d.inIteration=n,V("while"),X("("),t=Ct(),X(")"),$(";")&&I(),{type:r.DoWhileStatement,body:e,test:t}}function Ft(){var e,
t,n;return V("while"),X("("),e=Ct(),X(")"),n=d.inIteration,d.inIteration=!0,t=Gt(),d.inIteration=n,{type:r.WhileStatement,test:e,body:t}}function It(){var e=I();return{type:r.VariableDeclaration,declarations
:Mt(),kind:e.value}}function qt(){var e,t,n,i,o,u,a;return e=t=n=null,V("for"),X("("),$(";")?I():(J("var")||J("let")?(d.allowIn=!1,e=It(),d.allowIn=!0,e.declarations.length===1&&J("in")&&(I(),i=e,o=Ct(
),e=null)):(d.allowIn=!1,e=Ct(),d.allowIn=!0,J("in")&&(G(e)||U({},s.InvalidLHSInForIn),I(),i=e,o=Ct(),e=null)),typeof i=="undefined"&&X(";")),typeof i=="undefined"&&($(";")||(t=Ct()),X(";"),$(")")||(n=
Ct())),X(")"),a=d.inIteration,d.inIteration=!0,u=Gt(),d.inIteration=a,typeof i=="undefined"?{type:r.ForStatement,init:e,test:t,update:n,body:u}:{type:r.ForInStatement,left:i,right:o,body:u,each:!1}}function Rt
(){var e,n=null;return V("continue"),u[f]===";"?(I(),d.inIteration||U({},s.IllegalContinue),{type:r.ContinueStatement,label:null}):R()?(d.inIteration||U({},s.IllegalContinue),{type:r.ContinueStatement,
label:null}):(e=q(),e.type===t.Identifier&&(n=At(),Object.prototype.hasOwnProperty.call(d.labelSet,n.name)||U({},s.UnknownLabel,n.name)),Q(),n===null&&!d.inIteration&&U({},s.IllegalContinue),{type:r.ContinueStatement
,label:n})}function Ut(){var e,n=null;return V("break"),u[f]===";"?(I(),!d.inIteration&&!d.inSwitch&&U({},s.IllegalBreak),{type:r.BreakStatement,label:null}):R()?(!d.inIteration&&!d.inSwitch&&U({},s.IllegalBreak
),{type:r.BreakStatement,label:null}):(e=q(),e.type===t.Identifier&&(n=At(),Object.prototype.hasOwnProperty.call(d.labelSet,n.name)||U({},s.UnknownLabel,n.name)),Q(),n===null&&!d.inIteration&&!d.inSwitch&&
U({},s.IllegalBreak),{type:r.BreakStatement,label:n})}function zt(){var e,n=null;return V("return"),d.inFunctionBody||z({},s.IllegalReturn),u[f]===" "&&x(u[f+1])?(n=Ct(),Q(),{type:r.ReturnStatement,argument
:n}):R()?{type:r.ReturnStatement,argument:null}:($(";")||(e=q(),!$("}")&&e.type!==t.EOF&&(n=Ct())),Q(),{type:r.ReturnStatement,argument:n})}function Wt(){var e,t;return a&&z({},s.StrictModeWith),V("with"
),X("("),e=Ct(),X(")"),t=Gt(),{type:r.WithStatement,object:e,body:t}}function Xt(){var e,t=[],n;J("default")?(I(),e=null):(V("case"),e=Ct()),X(":");while(f<h){if($("}")||J("default")||J("case"))break;n=
Gt();if(typeof n=="undefined")break;t.push(n)}return{type:r.SwitchCase,test:e,consequent:t}}function Vt(){var e,t,n;V("switch"),X("("),e=Ct(),X(")"),X("{");if($("}"))return I(),{type:r.SwitchStatement,
discriminant:e};t=[],n=d.inSwitch,d.inSwitch=!0;while(f<h){if($("}"))break;t.push(Xt())}return d.inSwitch=n,X("}"),{type:r.SwitchStatement,discriminant:e,cases:t}}function $t(){var e;return V("throw"),
R()&&U({},s.NewlineAfterThrow),e=Ct(),Q(),{type:r.ThrowStatement,argument:e}}function Jt(){var e;return V("catch"),X("("),$(")")||(e=Ct(),a&&e.type===r.Identifier&&k(e.name)&&z({},s.StrictCatchVariable
)),X(")"),{type:r.CatchClause,param:e,guard:null,body:Lt()}}function Kt(){var e,t=[],n=null;return V("try"),e=Lt(),J("catch")&&t.push(Jt()),J("finally")&&(I(),n=Lt()),t.length===0&&!n&&U({},s.NoCatchOrFinally
),{type:r.TryStatement,block:e,handlers:t,finalizer:n}}function Qt(){return V("debugger"),Q(),{type:r.DebuggerStatement}}function Gt(){var e=q(),n,i;e.type===t.EOF&&W(e);if(e.type===t.Punctuator)switch(
e.value){case";":return Pt();case"{":return Lt();case"(":return Ht();default:}if(e.type===t.Keyword)switch(e.value){case"break":return Ut();case"continue":return Rt();case"debugger":return Qt();case"do"
:return jt();case"for":return qt();case"function":return Zt();case"if":return Bt();case"return":return zt();case"switch":return Vt();case"throw":return $t();case"try":return Kt();case"var":return _t();
case"while":return Ft();case"with":return Wt();default:}return n=Ct(),n.type===r.Identifier&&$(":")?(I(),Object.prototype.hasOwnProperty.call(d.labelSet,n.name)&&U({},s.Redeclaration,"Label",n.name),d.
labelSet[n.name]=!0,i=Gt(),delete d.labelSet[n.name],{type:r.LabeledStatement,label:n,body:i}):(Q(),{type:r.ExpressionStatement,expression:n})}function Yt(){var e,n=[],i,o,u,l,c,p,v;X("{");while(f<h){i=
q();if(i.type!==t.StringLiteral)break;e=tn(),n.push(e);if(e.expression.type!==r.Literal)break;o=g(i.range[0]+1,i.range[1]-1),o==="use strict"?(a=!0,u&&U(u,s.StrictOctalLiteral)):!u&&i.octal&&(u=i)}l=d.
labelSet,c=d.inIteration,p=d.inSwitch,v=d.inFunctionBody,d.labelSet={},d.inIteration=!1,d.inSwitch=!1,d.inFunctionBody=!0;while(f<h){if($("}"))break;e=tn();if(typeof e=="undefined")break;n.push(e)}return X
("}"),d.labelSet=l,d.inIteration=c,d.inSwitch=p,d.inFunctionBody=v,{type:r.BlockStatement,body:n}}function Zt(){var e,t,n=[],i,o,u,l,c,p;V("function"),o=q(),e=At(),a?k(o.value)&&U(o,s.StrictFunctionName
):k(o.value)?(u=o,l=s.StrictFunctionName):C(o.value)&&(u=o,l=s.StrictReservedWord),X("(");if(!$(")")){p={};while(f<h){o=q(),t=At(),a?(k(o.value)&&U(o,s.StrictParamName),Object.prototype.hasOwnProperty.
call(p,o.value)&&U(o,s.StrictParamDupe)):u||(k(o.value)?(u=o,l=s.StrictParamName):C(o.value)?(u=o,l=s.StrictReservedWord):Object.prototype.hasOwnProperty.call(p,o.value)&&(u=o,l=s.StrictParamDupe)),n.push
(t),p[t.name]=!0;if($(")"))break;X(",")}}return X(")"),c=a,i=Yt(),a&&u&&U(u,l),a=c,{type:r.FunctionDeclaration,id:e,params:n,body:i}}function en(){var e,t=null,n,i,o,u=[],l,c,p;V("function"),$("(")||(e=
q(),t=At(),a?k(e.value)&&U(e,s.StrictFunctionName):k(e.value)?(n=e,i=s.StrictFunctionName):C(e.value)&&(n=e,i=s.StrictReservedWord)),X("(");if(!$(")")){p={};while(f<h){e=q(),o=At(),a?(k(e.value)&&U(e,s
.StrictParamName),Object.prototype.hasOwnProperty.call(p,e.value)&&U(e,s.StrictParamDupe)):n||(k(e.value)?(n=e,i=s.StrictParamName):C(e.value)?(n=e,i=s.StrictReservedWord):Object.prototype.hasOwnProperty
.call(p,e.value)&&(n=e,i=s.StrictParamDupe)),u.push(o),p[o.name]=!0;if($(")"))break;X(",")}}return X(")"),c=a,l=Yt(),a&&n&&U(n,i),a=c,{type:r.FunctionExpression,id:t,params:u,body:l}}function tn(){var e=
q();if(e.type===t.Keyword)switch(e.value){case"const":case"let":return Dt(e.value);case"function":return Zt();default:return Gt()}if(e.type!==t.EOF)return Gt()}function nn(){var e,n=[],i,o,u;while(f<h)
{i=q();if(i.type!==t.StringLiteral)break;e=tn(),n.push(e);if(e.expression.type!==r.Literal)break;o=g(i.range[0]+1,i.range[1]-1),o==="use strict"?(a=!0,u&&U(u,s.StrictOctalLiteral)):!u&&i.octal&&(u=i)}while(
f<h){e=tn();if(typeof e=="undefined")break;n.push(e)}return n}function rn(){var e;return a=!1,e={type:r.Program,body:nn()},e}function sn(e,t,n,r){m(typeof e=="number","Comment must have valid position"
);if(v.comments.length>0&&v.comments[v.comments.length-1].range[1]>e)return;v.comments.push({range:[e,t],type:n,value:r})}function on(){var e,t,n,r,i;e="",r=!1,i=!1;while(f<h){t=u[f];if(i)t=A(),f>=h?(i=!1
,e+=t,sn(n,f,"Line",e)):S(t)?(i=!1,sn(n,f,"Line",e),t==="\r"&&u[f]==="\n"&&++f,++l,c=f,e=""):e+=t;else if(r)S(t)?(t==="\r"&&u[f+1]==="\n"?(++f,e+="\r\n"):e+=t,++l,++f,c=f,f>=h&&U({},s.UnexpectedToken,"ILLEGAL"
)):(t=A(),f>=h&&U({},s.UnexpectedToken,"ILLEGAL"),e+=t,t==="*"&&(t=u[f],t==="/"&&(e=e.substr(0,e.length-1),r=!1,++f,sn(n,f,"Block",e),e="")));else if(t==="/"){t=u[f+1];if(t==="/")n=f,f+=2,i=!0;else{if(
t!=="*")break;n=f,f+=2,r=!0,f>=h&&U({},s.UnexpectedToken,"ILLEGAL")}}else if(E(t))++f;else{if(!S(t))break;++f,t==="\r"&&u[f]==="\n"&&++f,++l,c=f}}}function un(){var e=v.advance(),r,i;return e.type!==t.
EOF&&(r=[e.range[0],e.range[1]],i=g(e.range[0],e.range[1]),v.tokens.push({type:n[e.type],value:i,range:r})),e}function an(){var e,t,n;return O(),e=f,t=v.scanRegExp(),v.tokens.length>0&&(n=v.tokens[v.tokens
.length-1],n.range[0]===e&&n.type==="Punctuator"&&(n.value==="/"||n.value==="/=")&&v.tokens.pop()),v.tokens.push({type:"RegularExpression",value:t.literal,range:[e,f]}),t}function fn(e){return{type:r.Literal
,value:e.value}}function ln(e){return{type:r.Literal,value:e.value,raw:g(e.range[0],e.range[1])}}function cn(e,t){return function(n){function i(e){return e.type===r.LogicalExpression||e.type===r.BinaryExpression
}function s(n){i(n.left)&&s(n.left),i(n.right)&&s(n.right),e&&typeof n.range=="undefined"&&(n.range=[n.left.range[0],n.right.range[1]]),t&&typeof n.loc=="undefined"&&(n.loc={start:n.left.loc.start,end:
n.right.loc.end})}return function(){var o,u,a;O(),u=[f,0],a={start:{line:l,column:f-c}},o=n.apply(null,arguments);if(typeof o!="undefined")return e&&(u[1]=f,o.range=u),t&&(a.end={line:l,column:f-c},o.loc=
a),i(o)&&s(o),o.type===r.MemberExpression&&(typeof o.object.range!="undefined"&&(o.range[0]=o.object.range[0]),typeof o.object.loc!="undefined"&&(o.loc.start=o.object.loc.start)),o}}}function hn(){var e
;v.comments&&(v.skipComment=O,O=on),v.raw&&(v.createLiteral=fn,fn=ln);if(v.range||v.loc)e=cn(v.range,v.loc),v.parseAdditiveExpression=vt,v.parseAssignmentExpression=Nt,v.parseBitwiseANDExpression=bt,v.
parseBitwiseORExpression=Et,v.parseBitwiseXORExpression=wt,v.parseBlock=Lt,v.parseFunctionSourceElements=Yt,v.parseCallMember=at,v.parseCatchClause=Jt,v.parseComputedMember=ut,v.parseConditionalExpression=
Tt,v.parseConstLetDeclaration=Dt,v.parseEqualityExpression=yt,v.parseExpression=Ct,v.parseForVariableDeclaration=It,v.parseFunctionDeclaration=Zt,v.parseFunctionExpression=en,v.parseLogicalANDExpression=
St,v.parseLogicalORExpression=xt,v.parseMultiplicativeExpression=dt,v.parseNewExpression=ft,v.parseNonComputedMember=ot,v.parseNonComputedProperty=st,v.parseObjectProperty=tt,v.parseObjectPropertyKey=et
,v.parsePostfixExpression=ht,v.parsePrimaryExpression=rt,v.parseProgram=rn,v.parsePropertyFunction=Z,v.parseRelationalExpression=gt,v.parseStatement=Gt,v.parseShiftExpression=mt,v.parseSwitchCase=Xt,v.
parseUnaryExpression=pt,v.parseVariableDeclaration=Ot,v.parseVariableIdentifier=At,vt=e(v.parseAdditiveExpression),Nt=e(v.parseAssignmentExpression),bt=e(v.parseBitwiseANDExpression),Et=e(v.parseBitwiseORExpression
),wt=e(v.parseBitwiseXORExpression),Lt=e(v.parseBlock),Yt=e(v.parseFunctionSourceElements),at=e(v.parseCallMember),Jt=e(v.parseCatchClause),ut=e(v.parseComputedMember),Tt=e(v.parseConditionalExpression
),Dt=e(v.parseConstLetDeclaration),yt=e(v.parseEqualityExpression),Ct=e(v.parseExpression),It=e(v.parseForVariableDeclaration),Zt=e(v.parseFunctionDeclaration),en=e(v.parseFunctionExpression),St=e(v.parseLogicalANDExpression
),xt=e(v.parseLogicalORExpression),dt=e(v.parseMultiplicativeExpression),ft=e(v.parseNewExpression),ot=e(v.parseNonComputedMember),st=e(v.parseNonComputedProperty),tt=e(v.parseObjectProperty),et=e(v.parseObjectPropertyKey
),ht=e(v.parsePostfixExpression),rt=e(v.parsePrimaryExpression),rn=e(v.parseProgram),Z=e(v.parsePropertyFunction),gt=e(v.parseRelationalExpression),Gt=e(v.parseStatement),mt=e(v.parseShiftExpression),Xt=
e(v.parseSwitchCase),pt=e(v.parseUnaryExpression),Ot=e(v.parseVariableDeclaration),At=e(v.parseVariableIdentifier);typeof v.tokens!="undefined"&&(v.advance=F,v.scanRegExp=B,F=un,B=an)}function pn(){typeof
v.skipComment=="function"&&(O=v.skipComment),v.raw&&(fn=v.createLiteral);if(v.range||v.loc)vt=v.parseAdditiveExpression,Nt=v.parseAssignmentExpression,bt=v.parseBitwiseANDExpression,Et=v.parseBitwiseORExpression
,wt=v.parseBitwiseXORExpression,Lt=v.parseBlock,Yt=v.parseFunctionSourceElements,at=v.parseCallMember,Jt=v.parseCatchClause,ut=v.parseComputedMember,Tt=v.parseConditionalExpression,Dt=v.parseConstLetDeclaration
,yt=v.parseEqualityExpression,Ct=v.parseExpression,It=v.parseForVariableDeclaration,Zt=v.parseFunctionDeclaration,en=v.parseFunctionExpression,St=v.parseLogicalANDExpression,xt=v.parseLogicalORExpression
,dt=v.parseMultiplicativeExpression,ft=v.parseNewExpression,ot=v.parseNonComputedMember,st=v.parseNonComputedProperty,tt=v.parseObjectProperty,et=v.parseObjectPropertyKey,rt=v.parsePrimaryExpression,ht=
v.parsePostfixExpression,rn=v.parseProgram,Z=v.parsePropertyFunction,gt=v.parseRelationalExpression,Gt=v.parseStatement,mt=v.parseShiftExpression,Xt=v.parseSwitchCase,pt=v.parseUnaryExpression,Ot=v.parseVariableDeclaration
,At=v.parseVariableIdentifier;typeof v.scanRegExp=="function"&&(F=v.advance,B=v.scanRegExp)}function dn(e){var t=e.length,n=[],r;for(r=0;r<t;++r)n[r]=e.charAt(r);return n}function vn(e,t){var n,r;r=String
,typeof e!="string"&&!(e instanceof String)&&(e=r(e)),u=e,f=0,l=u.length>0?1:0,c=0,h=u.length,p=null,d={allowIn:!0,labelSet:{},lastParenthesized:null,inFunctionBody:!1,inIteration:!1,inSwitch:!1},v={},typeof
t!="undefined"&&(v.range=typeof t.range=="boolean"&&t.range,v.loc=typeof t.loc=="boolean"&&t.loc,v.raw=typeof t.raw=="boolean"&&t.raw,typeof t.tokens=="boolean"&&t.tokens&&(v.tokens=[]),typeof t.comment=="boolean"&&
t.comment&&(v.comments=[]),typeof t.tolerant=="boolean"&&t.tolerant&&(v.errors=[])),h>0&&typeof u[0]=="undefined"&&(e instanceof String&&(u=e.valueOf()),typeof u[0]=="undefined"&&(u=dn(e))),hn();try{n=
rn(),typeof v.comments!="undefined"&&(n.comments=v.comments),typeof v.tokens!="undefined"&&(n.tokens=v.tokens),typeof v.errors!="undefined"&&(n.errors=v.errors)}catch(i){throw i}finally{pn(),v={}}return n
}var t,n,r,i,s,o,u,a,f,l,c,h,p,d,v;t={BooleanLiteral:1,EOF:2,Identifier:3,Keyword:4,NullLiteral:5,NumericLiteral:6,Punctuator:7,StringLiteral:8},n={},n[t.BooleanLiteral]="Boolean",n[t.EOF]="<end>",n[t.
Identifier]="Identifier",n[t.Keyword]="Keyword",n[t.NullLiteral]="Null",n[t.NumericLiteral]="Numeric",n[t.Punctuator]="Punctuator",n[t.StringLiteral]="String",r={AssignmentExpression:"AssignmentExpression"
,ArrayExpression:"ArrayExpression",BlockStatement:"BlockStatement",BinaryExpression:"BinaryExpression",BreakStatement:"BreakStatement",CallExpression:"CallExpression",CatchClause:"CatchClause",ConditionalExpression
:"ConditionalExpression",ContinueStatement:"ContinueStatement",DoWhileStatement:"DoWhileStatement",DebuggerStatement:"DebuggerStatement",EmptyStatement:"EmptyStatement",ExpressionStatement:"ExpressionStatement"
,ForStatement:"ForStatement",ForInStatement:"ForInStatement",FunctionDeclaration:"FunctionDeclaration",FunctionExpression:"FunctionExpression",Identifier:"Identifier",IfStatement:"IfStatement",Literal:"Literal"
,LabeledStatement:"LabeledStatement",LogicalExpression:"LogicalExpression",MemberExpression:"MemberExpression",NewExpression:"NewExpression",ObjectExpression:"ObjectExpression",Program:"Program",Property
:"Property",ReturnStatement:"ReturnStatement",SequenceExpression:"SequenceExpression",SwitchStatement:"SwitchStatement",SwitchCase:"SwitchCase",ThisExpression:"ThisExpression",ThrowStatement:"ThrowStatement"
,TryStatement:"TryStatement",UnaryExpression:"UnaryExpression",UpdateExpression:"UpdateExpression",VariableDeclaration:"VariableDeclaration",VariableDeclarator:"VariableDeclarator",WhileStatement:"WhileStatement"
,WithStatement:"WithStatement"},i={Data:1,Get:2,Set:4},s={UnexpectedToken:"Unexpected token %0",UnexpectedNumber:"Unexpected number",UnexpectedString:"Unexpected string",UnexpectedIdentifier:"Unexpected identifier"
,UnexpectedReserved:"Unexpected reserved word",UnexpectedEOS:"Unexpected end of input",NewlineAfterThrow:"Illegal newline after throw",InvalidRegExp:"Invalid regular expression",UnterminatedRegExp:"Invalid regular expression: missing /"
,InvalidLHSInAssignment:"Invalid left-hand side in assignment",InvalidLHSInForIn:"Invalid left-hand side in for-in",NoCatchOrFinally:"Missing catch or finally after try",UnknownLabel:"Undefined label '%0'"
,Redeclaration:"%0 '%1' has already been declared",IllegalContinue:"Illegal continue statement",IllegalBreak:"Illegal break statement",IllegalReturn:"Illegal return statement",StrictModeWith:"Strict mode code may not include a with statement"
,StrictCatchVariable:"Catch variable may not be eval or arguments in strict mode",StrictVarName:"Variable name may not be eval or arguments in strict mode",StrictParamName:"Parameter name eval or arguments is not allowed in strict mode"
,StrictParamDupe:"Strict mode function may not have duplicate parameter names",StrictFunctionName:"Function name may not be eval or arguments in strict mode",StrictOctalLiteral:"Octal literals are not allowed in strict mode."
,StrictDelete:"Delete of an unqualified identifier in strict mode.",StrictDuplicateProperty:"Duplicate data property in object literal not allowed in strict mode",AccessorDataProperty:"Object literal may not have data and accessor property with the same name"
,AccessorGetSet:"Object literal may not have multiple get/set accessors with the same name",StrictLHSAssignment:"Assignment to eval or arguments is not allowed in strict mode",StrictLHSPostfix:"Postfix increment/decrement may not have eval or arguments operand in strict mode"
,StrictLHSPrefix:"Prefix increment/decrement may not have eval or arguments operand in strict mode",StrictReservedWord:"Use of future reserved word in strict mode"},o={NonAsciiIdentifierStart:new RegExp
("[ªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶͷͺ-ͽΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԧԱ-Ֆՙա-ևא-תװ-ײؠ-يٮٯٱ-ۓەۥۦۮۯۺ-ۼۿܐܒ-ܯݍ-ޥޱߊ-ߪߴߵߺࠀ-ࠕࠚࠤࠨࡀ-ࡘࢠࢢ-ࢬऄ-हऽॐक़-ॡॱ-ॷॹ-ॿঅ-ঌএঐও-নপ-রলশ-হঽৎড়ঢ়য়-ৡৰৱਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਖ਼-ੜਫ਼ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽૐૠૡଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽଡ଼ଢ଼ୟ-ୡୱஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹௐఅ-ఌఎ-ఐఒ-నప-ళవ-హఽౘౙౠౡಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽೞೠೡೱೲഅ-ഌഎ-ഐഒ-ഺഽൎൠൡൺ-ൿඅ-ඖක-නඳ-රලව-ෆก-ะาำเ-ๆກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ະາຳຽເ-ໄໆໜ-ໟༀཀ-ཇཉ-ཬྈ-ྌက-ဪဿၐ-ၕၚ-ၝၡၥၦၮ-ၰၵ-ႁႎႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚᎀ-ᎏᎠ-Ᏼᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛰᜀ-ᜌᜎ-ᜑᜠ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜᠠ-ᡷᢀ-ᢨᢪᢰ-ᣵᤀ-ᤜᥐ-ᥭᥰ-ᥴᦀ-ᦫᧁ-ᧇᨀ-ᨖᨠ-ᩔᪧᬅ-ᬳᭅ-ᭋᮃ-ᮠᮮᮯᮺ-ᯥᰀ-ᰣᱍ-ᱏᱚ-ᱽᳩ-ᳬᳮ-ᳱᳵᳶᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⸯ々-〇〡-〩〱-〵〸-〼ぁ-ゖゝ-ゟァ-ヺー-ヿㄅ-ㄭㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-鿌ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙿ-ꚗꚠ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢꡀ-ꡳꢂ-ꢳꣲ-ꣷꣻꤊ-ꤥꤰ-ꥆꥠ-ꥼꦄ-ꦲꧏꨀ-ꨨꩀ-ꩂꩄ-ꩋꩠ-ꩶꩺꪀ-ꪯꪱꪵꪶꪹ-ꪽꫀꫂꫛ-ꫝꫠ-ꫪꫲ-ꫴꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꯀ-ꯢ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ]"
),NonAsciiIdentifierPart:new RegExp("[ªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮ̀-ʹͶͷͺ-ͽΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁ҃-҇Ҋ-ԧԱ-Ֆՙա-և֑-ׇֽֿׁׂׅׄא-תװ-ײؐ-ؚؠ-٩ٮ-ۓە-ۜ۟-۪ۨ-ۼۿܐ-݊ݍ-ޱ߀-ߵߺࠀ-࠭ࡀ-࡛ࢠࢢ-ࢬࣤ-ࣾऀ-ॣ०-९ॱ-ॷॹ-ॿঁ-ঃঅ-ঌএঐও-নপ-রলশ-হ়-ৄেৈো-ৎৗড়ঢ়য়-ৣ০-ৱਁ-ਃਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹ਼ਾ-ੂੇੈੋ-੍ੑਖ਼-ੜਫ਼੦-ੵઁ-ઃઅ-ઍએ-ઑઓ-નપ-રલળવ-હ઼-ૅે-ૉો-્ૐૠ-ૣ૦-૯ଁ-ଃଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହ଼-ୄେୈୋ-୍ୖୗଡ଼ଢ଼ୟ-ୣ୦-୯ୱஂஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹா-ூெ-ைொ-்ௐௗ௦-௯ఁ-ఃఅ-ఌఎ-ఐఒ-నప-ళవ-హఽ-ౄె-ైొ-్ౕౖౘౙౠ-ౣ౦-౯ಂಃಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹ಼-ೄೆ-ೈೊ-್ೕೖೞೠ-ೣ೦-೯ೱೲംഃഅ-ഌഎ-ഐഒ-ഺഽ-ൄെ-ൈൊ-ൎൗൠ-ൣ൦-൯ൺ-ൿංඃඅ-ඖක-නඳ-රලව-ෆ්ා-ුූෘ-ෟෲෳก-ฺเ-๎๐-๙ກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ູົ-ຽເ-ໄໆ່-ໍ໐-໙ໜ-ໟༀ༘༙༠-༩༹༵༷༾-ཇཉ-ཬཱ-྄྆-ྗྙ-ྼ࿆က-၉ၐ-ႝႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚ፝-፟ᎀ-ᎏᎠ-Ᏼᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛰᜀ-ᜌᜎ-᜔ᜠ-᜴ᝀ-ᝓᝠ-ᝬᝮ-ᝰᝲᝳក-៓ៗៜ៝០-៩᠋-᠍᠐-᠙ᠠ-ᡷᢀ-ᢪᢰ-ᣵᤀ-ᤜᤠ-ᤫᤰ-᤻᥆-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉ᧐-᧙ᨀ-ᨛᨠ-ᩞ᩠-᩿᩼-᪉᪐-᪙ᪧᬀ-ᭋ᭐-᭙᭫-᭳ᮀ-᯳ᰀ-᰷᱀-᱉ᱍ-ᱽ᳐-᳔᳒-ᳶᴀ-ᷦ᷼-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼ‌‍‿⁀⁔ⁱⁿₐ-ₜ⃐-⃥⃜⃡-⃰ℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯ⵿-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⷠ-ⷿⸯ々-〇〡-〯〱-〵〸-〼ぁ-ゖ゙゚ゝ-ゟァ-ヺー-ヿㄅ-ㄭㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-鿌ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘫꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟ-꛱ꜗ-ꜟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꠧꡀ-ꡳꢀ-꣄꣐-꣙꣠-ꣷꣻ꤀-꤭ꤰ-꥓ꥠ-ꥼꦀ-꧀ꧏ-꧙ꨀ-ꨶꩀ-ꩍ꩐-꩙ꩠ-ꩶꩺꩻꪀ-ꫂꫛ-ꫝꫠ-ꫯꫲ-꫶ꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꯀ-ꯪ꯬꯭꯰-꯹가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻ︀-️︠-︦︳︴﹍-﹏ﹰ-ﹴﹶ-ﻼ０-９Ａ-Ｚ＿ａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ]"
)},typeof "esprima"[0]=="undefined"&&(g=function(t,n){return u.slice(t,n).join("")}),e.version="1.0.0-dev",e.parse=vn,e.Syntax=function(){var e,t={};typeof Object.create=="function"&&(t=Object.create(null
));for(e in r)r.hasOwnProperty(e)&&(t[e]=r[e]);return typeof Object.freeze=="function"&&Object.freeze(t),t}()})(typeof exports=="undefined"?esprima={}:exports);
/* END INSERT */

realExports.esprima = exports;
var esprima = exports;
/* Includes a minified jshint: http://www.jshint.com/ */
// Avoid clobber:
exports = {};

/* INSERT jshint.js */
var JSHINT=function(){"use strict";function it(){}function st(e,t){return Object.prototype.hasOwnProperty.call(e,t)}function ot(e,t){r[e]===undefined&&n[e]===undefined&&ht("Bad option: '"+e+"'.",t)}function ut
(e){return Object.prototype.toString.call(e)==="[object String]"}function at(e,t){var n;for(n in t)st(t,n)&&(e[n]=t[n])}function ft(){L.couch&&at(A,u),L.rhino&&at(A,P),L.prototypejs&&at(A,_),L.node&&(at
(A,C),L.globalstrict=!0),L.devel&&at(A,a),L.dojo&&at(A,f),L.browser&&at(A,o),L.nonstandard&&at(A,F),L.jquery&&at(A,b),L.mootools&&at(A,T),L.worker&&at(A,$),L.wsh&&at(A,J),L.esnext&&X(),L.globalstrict&&
L.strict!==!1&&(L.strict=!0)}function lt(e,t,n){var r=Math.floor(t/w.length*100);throw{name:"JSHintError",line:t,character:n,message:e+" ("+r+"% scanned).",raw:e}}function ct(e,t,n,r){return JSHINT.undefs
.push([e,t,n,r])}function ht(e,t,n,r,i,s){var o,u,a;return t=t||N,t.id==="(end)"&&(t=z),u=t.line||0,o=t.from||0,a={id:"(error)",raw:e,evidence:w[u-1]||"",line:u,character:o,a:n,b:r,c:i,d:s},a.reason=e.
supplant(a),JSHINT.errors.push(a),L.passfail&&lt("Stopping. ",u,o),V+=1,V>=L.maxerr&&lt("Too many errors.",u,o),a}function pt(e,t,n,r,i,s,o){return ht(e,{line:t,from:n},r,i,s,o)}function dt(e,t,n,r,i,s
){var o=ht(e,t,n,r,i,s)}function vt(e,t,n,r,i,s,o){return dt(e,{line:t,from:n},r,i,s,o)}function gt(e,t){e==="hasOwnProperty"&&ht("'hasOwnProperty' is a really bad name."),st(c,e)&&!c["(global)"]&&(c[e
]===!0?L.latedef&&ht("'{a}' was used before it was defined.",N,e):!L.shadow&&t!=="exception"&&ht("'{a}' is already defined.",N,e)),c[e]=t,c["(global)"]?(d[e]=c,st(v,e)&&(L.latedef&&ht("'{a}' was used before it was defined."
,N,e),delete v[e])):H[e]=c}function yt(){var e,t,r,o=N.value,u,a,f;switch(o){case"*/":dt("Unbegun comment.");break;case"/*members":case"/*member":o="/*members",x||(x={}),t=x;break;case"/*jshint":case"/*jslint"
:t=L,r=n;break;case"/*global":t=A;break;default:dt("What?")}u=mt.token();e:for(;;){for(;;){if(u.type==="special"&&u.value==="*/")break e;if(u.id!=="(endline)"&&u.id!==",")break;u=mt.token()}u.type!=="(string)"&&
u.type!=="(identifier)"&&o!=="/*members"&&dt("Bad option.",u),f=mt.token(),f.id===":"?(f=mt.token(),t===x&&dt("Expected '{a}' and instead saw '{b}'.",u,"*/",":"),o==="/*jshint"&&ot(u.value,u),u.value!=="indent"||
o!=="/*jshint"&&o!=="/*jslint"?u.value!=="maxerr"||o!=="/*jshint"&&o!=="/*jslint"?u.value!=="maxlen"||o!=="/*jshint"&&o!=="/*jslint"?u.value==="validthis"?c["(global)"]?dt("Option 'validthis' can't be used in a global scope."
):f.value==="true"||f.value==="false"?t[u.value]=f.value==="true":dt("Bad option value.",f):f.value==="true"||f.value==="false"?o==="/*jslint"?(a=s[u.value]||u.value,t[a]=f.value==="true",i[a]!==undefined&&
(t[a]=!t[a])):t[u.value]=f.value==="true":dt("Bad option value.",f):(e=+f.value,(typeof e!="number"||!isFinite(e)||e<=0||Math.floor(e)!==e)&&dt("Expected a small integer and instead saw '{a}'.",f,f.value
),t.maxlen=e):(e=+f.value,(typeof e!="number"||!isFinite(e)||e<=0||Math.floor(e)!==e)&&dt("Expected a small integer and instead saw '{a}'.",f,f.value),t.maxerr=e):(e=+f.value,(typeof e!="number"||!isFinite
(e)||e<=0||Math.floor(e)!==e)&&dt("Expected a small integer and instead saw '{a}'.",f,f.value),t.white=!0,t.indent=e),u=mt.token()):((o==="/*jshint"||o==="/*jslint")&&dt("Missing option value.",u),t[u.
value]=!1,u=f)}r&&ft()}function bt(e){var t=e||0,n=0,r;while(n<=t)r=E[n],r||(r=E[n]=mt.token()),n+=1;return r}function wt(t,n){switch(z.id){case"(number)":N.id==="."&&ht("A dot following a number can be confused with a decimal point."
,z);break;case"-":(N.id==="-"||N.id==="--")&&ht("Confusing minusses.");break;case"+":(N.id==="+"||N.id==="++")&&ht("Confusing plusses.")}if(z.type==="(string)"||z.identifier)e=z.value;t&&N.id!==t&&(n?N
.id==="(end)"?ht("Unmatched '{a}'.",n,n.id):ht("Expected '{a}' to match '{b}' from line {c} and instead saw '{d}'.",N,t,n.id,n.line,N.value):(N.type!=="(identifier)"||N.value!==t)&&ht("Expected '{a}' and instead saw '{b}'."
,N,t,N.value)),M=z,z=N;for(;;){N=E.shift()||mt.token();if(N.id==="(end)"||N.id==="(error)")return;if(N.type==="special")yt();else if(N.id!=="(endline)")break}}function Et(t,n){var r,i=!1,s=!1;N.id==="(end)"&&
dt("Unexpected early end of program.",z),wt(),n&&(e="anonymous",c["(verb)"]=z.value);if(n===!0&&z.fud)r=z.fud();else{if(z.nud)r=z.nud();else{if(N.type==="(number)"&&z.id===".")return ht("A leading decimal point can be confused with a dot: '.{a}'."
,z,N.value),wt(),z;dt("Expected an identifier and instead saw '{a}'.",z,z.id)}while(t<N.lbp)i=z.value==="Array",s=z.value==="Object",r&&(r.value||r.first&&r.first.value)&&(r.value!=="new"||r.first&&r.first
.value&&r.first.value===".")&&(i=!1,r.value!==z.value&&(s=!1)),wt(),i&&z.id==="("&&N.id===")"&&ht("Use the array literal notation [].",z),s&&z.id==="("&&N.id===")"&&ht("Use the object literal notation {}."
,z),z.led?r=z.led(r):dt("Expected an operator and instead saw '{a}'.",z,z.id)}return r}function St(e,t){e=e||z,t=t||N,L.white&&e.character!==t.from&&e.line===t.line&&(e.from+=e.character-e.from,ht("Unexpected space after '{a}'."
,e,e.value))}function xt(e,t){e=e||z,t=t||N,L.white&&(e.character!==t.from||e.line!==t.line)&&ht("Unexpected space before '{a}'.",t,t.value)}function Tt(e,t){e=e||z,t=t||N,L.white&&!e.comment&&e.line===
t.line&&St(e,t)}function Nt(e,t){L.white&&(e=e||z,t=t||N,e.line===t.line&&e.character===t.from&&(e.from+=e.character-e.from,ht("Missing space after '{a}'.",e,e.value)))}function Ct(e,t){e=e||z,t=t||N,!
L.laxbreak&&e.line!==t.line?ht("Bad line breaking before '{a}'.",t,t.id):L.white&&(e=e||z,t=t||N,e.character===t.from&&(e.from+=e.character-e.from,ht("Missing space after '{a}'.",e,e.value)))}function kt
(e){var t;L.white&&N.id!=="(end)"&&(t=g+(e||0),N.from!==t&&ht("Expected '{a}' to have an indentation at {b} instead at {c}.",N,N.value,t,N.from))}function Lt(e){e=e||z,e.line!==N.line&&ht("Line breaking error '{a}'."
,e,e.value)}function At(){z.line!==N.line?L.laxcomma||(At.first&&(ht("Comma warnings can be turned off with 'laxcomma'"),At.first=!1),ht("Bad line breaking before '{a}'.",z,N.id)):!z.comment&&z.character!==
N.from&&L.white&&(z.from+=z.character-z.from,ht("Unexpected space after '{a}'.",z,z.value)),wt(","),Nt(z,N)}function Ot(e,t){var n=R[e];if(!n||typeof n!="object")R[e]=n={id:e,lbp:t,value:e};return n}function Mt
(e){return Ot(e,0)}function _t(e,t){var n=Mt(e);return n.identifier=n.reserved=!0,n.fud=t,n}function Dt(e,t){var n=_t(e,t);return n.block=!0,n}function Pt(e){var t=e.id.charAt(0);if(t>="a"&&t<="z"||t>="A"&&
t<="Z")e.identifier=e.reserved=!0;return e}function Ht(e,t){var n=Ot(e,150);return Pt(n),n.nud=typeof t=="function"?t:function(){this.right=Et(150),this.arity="unary";if(this.id==="++"||this.id==="--")
L.plusplus?ht("Unexpected use of '{a}'.",this,this.id):(!this.right.identifier||this.right.reserved)&&this.right.id!=="."&&this.right.id!=="["&&ht("Bad operand.",this);return this},n}function Bt(e,t){var n=
Mt(e);return n.type=e,n.nud=t,n}function jt(e,t){var n=Bt(e,t);return n.identifier=n.reserved=!0,n}function Ft(e,t){return jt(e,function(){return typeof t=="function"&&t(this),this})}function It(e,t,n,
r){var i=Ot(e,n);return Pt(i),i.led=function(i){return r||(Ct(M,z),Nt(z,N)),e==="in"&&i.id==="!"&&ht("Confusing use of '{a}'.",i,"!"),typeof t=="function"?t(i,this):(this.left=i,this.right=Et(n),this)}
,i}function qt(e,t){var n=Ot(e,100);return n.led=function(e){Ct(M,z),Nt(z,N);var n=Et(100);return e&&e.id==="NaN"||n&&n.id==="NaN"?ht("Use the isNaN function to compare with NaN.",this):t&&t.apply(this
,[e,n]),e.id==="!"&&ht("Confusing use of '{a}'.",e,"!"),n.id==="!"&&ht("Confusing use of '{a}'.",n,"!"),this.left=e,this.right=n,this},n}function Rt(e){return e&&(e.type==="(number)"&&+e.value===0||e.type==="(string)"&&
e.value===""||e.type==="null"&&!L.eqnull||e.type==="true"||e.type==="false"||e.type==="undefined")}function Ut(e,t){return Ot(e,20).exps=!0,It(e,function(e,t){var n;t.left=e,A[e.value]===!1&&H[e.value]
["(global)"]===!0?ht("Read only.",e):e["function"]&&ht("'{a}' is a function.",e,e.value);if(e){L.esnext&&c[e.value]==="const"&&ht("Attempting to override '{a}' which is a constant",e,e.value);if(e.id==="."||
e.id==="[")return(!e.left||e.left.value==="arguments")&&ht("Bad assignment.",t),t.right=Et(19),t;if(e.identifier&&!e.reserved)return c[e.value]==="exception"&&ht("Do not assign to the exception parameter."
,e),t.right=Et(19),t;e===R["function"]&&ht("Expected an identifier in an assignment and instead saw a function invocation.",z)}dt("Bad assignment.",t)},20)}function zt(e,t,n){var r=Ot(e,n);return Pt(r)
,r.led=typeof t=="function"?t:function(e){return L.bitwise&&ht("Unexpected use of '{a}'.",this,this.id),this.left=e,this.right=Et(n),this},r}function Wt(e){return Ot(e,20).exps=!0,It(e,function(e,t){L.
bitwise&&ht("Unexpected use of '{a}'.",t,t.id),Nt(M,z),Nt(z,N);if(e)return e.id==="."||e.id==="["||e.identifier&&!e.reserved?(Et(19),t):(e===R["function"]&&ht("Expected an identifier in an assignment, and instead saw a function invocation."
,z),t);dt("Bad assignment.",t)},20)}function Xt(e,t){var n=Ot(e,150);return n.led=function(e){return L.plusplus?ht("Unexpected use of '{a}'.",this,this.id):(!e.identifier||e.reserved)&&e.id!=="."&&e.id!=="["&&
ht("Bad operand.",this),this.left=e,this},n}function Vt(e){if(N.identifier)return wt(),z.reserved&&!L.es5&&(!e||z.value!=="undefined")&&ht("Expected an identifier and instead saw '{a}' (a reserved word)."
,z,z.id),z.value}function $t(e){var t=Vt(e);if(t)return t;z.id==="function"&&N.id==="("?ht("Missing name in function declaration."):dt("Expected an identifier and instead saw '{a}'.",N,N.value)}function Jt
(e){var t=0,n;if(N.id!==";"||k)return;for(;;){n=bt(t);if(n.reach)return;if(n.id!=="(endline)"){if(n.id==="function"){if(!L.latedef)break;ht("Inner functions should be listed at the top of the outer function."
,n);break}ht("Unreachable '{a}' after '{b}'.",n,n.value,e);break}t+=1}}function Kt(e){var t=g,n,r=H,i=N;if(i.id===";"){wt(";");return}i.identifier&&!i.reserved&&bt().id===":"&&(wt(),wt(":"),H=Object.create
(r),gt(i.value,"label"),N.labelled||ht("Label '{a}' on {b} statement.",N,i.value,N.value),nt.test(i.value+":")&&ht("Label '{a}' looks like a javascript url.",i,i.value),N.label=i.value,i=N),e||kt(),n=Et
(0,!0);if(!i.block){!L.expr&&(!n||!n.exps)?ht("Expected an assignment or function call and instead saw an expression.",z):L.nonew&&n.id==="("&&n.left.id==="new"&&ht("Do not use 'new' for side effects."
);if(N.id===",")return At();N.id!==";"?L.asi||(!L.lastsemic||N.id!=="}"||N.line!==z.line)&&pt("Missing semicolon.",z.line,z.character):(St(z,N),wt(";"),Nt(z,N))}return g=t,H=r,n}function Qt(e){var t=[]
,n,r;while(!N.reach&&N.id!=="(end)")N.id===";"?(r=bt(),(!r||r.id!=="(")&&ht("Unnecessary semicolon."),wt(";")):t.push(Kt(e===N.line));return t}function Gt(){var e,t,n;for(;;){if(N.id==="(string)"){t=bt
(0);if(t.id==="(endline)"){e=1;do n=bt(e),e+=1;while(n.id==="(endline)");if(n.id!==";"){if(n.id!=="(string)"&&n.id!=="(number)"&&n.id!=="(regexp)"&&n.identifier!==!0&&n.id!=="}")break;ht("Missing semicolon."
,N)}else t=n}else if(t.id==="}")ht("Missing semicolon.",t);else if(t.id!==";")break;kt(),wt(),q[z.value]&&ht('Unnecessary directive "{a}".',z,z.value),z.value==="use strict"&&(L.newcap=!0,L.undef=!0),q
[z.value]=!0,t.id===";"&&wt(";");continue}break}}function Yt(e,t,n){var r,i=m,s=g,o,u=H,a,f,l;m=e;if(!e||!L.funcscope)H=Object.create(H);Nt(z,N),a=N;if(N.id==="{"){wt("{"),f=z.line;if(N.id!=="}"){g+=L.
indent;while(!e&&N.from>g)g+=L.indent;if(n){o={};for(l in q)st(q,l)&&(o[l]=q[l]);Gt(),L.strict&&c["(context)"]["(global)"]&&!o["use strict"]&&!q["use strict"]&&ht('Missing "use strict" statement.')}r=Qt
(f),n&&(q=o),g-=L.indent,f!==N.line&&kt()}else f!==N.line&&kt();wt("}",a),g=s}else e?((!t||L.curly)&&ht("Expected '{a}' and instead saw '{b}'.",N,"{",N.value),k=!0,g+=L.indent,r=[Kt(N.line===z.line)],g-=
L.indent,k=!1):dt("Expected '{a}' and instead saw '{b}'.",N,"{",N.value);c["(verb)"]=null;if(!e||!L.funcscope)H=u;return m=i,e&&L.noempty&&(!r||r.length===0)&&ht("Empty block."),r}function Zt(e){x&&typeof
x[e]!="boolean"&&ht("Unexpected /*member '{a}'.",z,e),typeof S[e]=="number"?S[e]+=1:S[e]=1}function en(e){var t=e.value,n=e.line,r=v[t];typeof r=="function"&&(r=!1),r?r[r.length-1]!==n&&r.push(n):(r=[n
],v[t]=r)}function tn(){var e=Vt(!0);return e||(N.id==="(string)"?(e=N.value,wt()):N.id==="(number)"&&(e=N.value.toString(),wt())),e}function nn(){var e,t=N,n=[];wt("("),Tt();if(N.id===")"){wt(")");return}
for(;;){e=$t(!0),n.push(e),gt(e,"parameter");if(N.id!==",")return wt(")",t),Tt(M,z),n;At()}}function rn(t,n){var r,i=L,s=H;return L=Object.create(L),H=Object.create(H),c={"(name)":t||'"'+e+'"',"(line)"
:N.line,"(character)":N.character,"(context)":c,"(breakage)":0,"(loopage)":0,"(scope)":H,"(statement)":n},r=c,z.funct=c,p.push(c),t&&gt(t,"function"),c["(params)"]=nn(),Yt(!1,!1,!0),H=s,L=i,c["(last)"]=
z.line,c["(lastcharacter)"]=z.character,c=c["(context)"],r}function on(){function e(){var e={},t=N;wt("{");if(N.id!=="}")for(;;){if(N.id==="(end)")dt("Missing '}' to match '{' from line {a}.",N,t.line)
;else{if(N.id==="}"){ht("Unexpected comma.",z);break}N.id===","?dt("Unexpected comma.",N):N.id!=="(string)"&&ht("Expected a string and instead saw {a}.",N,N.value)}e[N.value]===!0?ht("Duplicate key '{a}'."
,N,N.value):N.value==="__proto__"&&!L.proto||N.value==="__iterator__"&&!L.iterator?ht("The '{a}' key may produce unexpected results.",N,N.value):e[N.value]=!0,wt(),wt(":"),on();if(N.id!==",")break;wt(","
)}wt("}")}function t(){var e=N;wt("[");if(N.id!=="]")for(;;){if(N.id==="(end)")dt("Missing ']' to match '[' from line {a}.",N,e.line);else{if(N.id==="]"){ht("Unexpected comma.",z);break}N.id===","&&dt("Unexpected comma."
,N)}on();if(N.id!==",")break;wt(",")}wt("]")}switch(N.id){case"{":e();break;case"[":t();break;case"true":case"false":case"null":case"(number)":case"(string)":wt();break;case"-":wt("-"),z.character!==N.
from&&ht("Unexpected space after '-'.",z),St(z,N),wt("(number)");break;default:dt("Expected a JSON value.",N)}}var e,t={"<":!0,"<=":!0,"==":!0,"===":!0,"!==":!0,"!=":!0,">":!0,">=":!0,"+":!0,"-":!0,"*"
:!0,"/":!0,"%":!0},n={asi:!0,bitwise:!0,boss:!0,browser:!0,camelcase:!0,couch:!0,curly:!0,debug:!0,devel:!0,dojo:!0,eqeqeq:!0,eqnull:!0,es5:!0,esnext:!0,evil:!0,expr:!0,forin:!0,funcscope:!0,globalstrict
:!0,immed:!0,iterator:!0,jquery:!0,lastsemic:!0,latedef:!0,laxbreak:!0,laxcomma:!0,loopfunc:!0,mootools:!0,multistr:!0,newcap:!0,noarg:!0,node:!0,noempty:!0,nonew:!0,nonstandard:!0,nomen:!0,onevar:!0,onecase
:!0,passfail:!0,plusplus:!0,proto:!0,prototypejs:!0,regexdash:!0,regexp:!0,rhino:!0,undef:!0,scripturl:!0,shadow:!0,smarttabs:!0,strict:!0,sub:!0,supernew:!0,trailing:!0,validthis:!0,withstmt:!0,white:!0
,worker:!0,wsh:!0},r={maxlen:!1,indent:!1,maxerr:!1,predef:!1,quotmark:!1},i={bitwise:!0,forin:!0,newcap:!0,nomen:!0,plusplus:!0,regexp:!0,undef:!0,white:!0,eqeqeq:!0,onevar:!0},s={eqeq:"eqeqeq",vars:"onevar"
,windows:"wsh"},o={ArrayBuffer:!1,ArrayBufferView:!1,Audio:!1,addEventListener:!1,applicationCache:!1,atob:!1,blur:!1,btoa:!1,clearInterval:!1,clearTimeout:!1,close:!1,closed:!1,DataView:!1,DOMParser:!1
,defaultStatus:!1,document:!1,event:!1,FileReader:!1,Float32Array:!1,Float64Array:!1,FormData:!1,focus:!1,frames:!1,getComputedStyle:!1,HTMLElement:!1,HTMLAnchorElement:!1,HTMLBaseElement:!1,HTMLBlockquoteElement
:!1,HTMLBodyElement:!1,HTMLBRElement:!1,HTMLButtonElement:!1,HTMLCanvasElement:!1,HTMLDirectoryElement:!1,HTMLDivElement:!1,HTMLDListElement:!1,HTMLFieldSetElement:!1,HTMLFontElement:!1,HTMLFormElement
:!1,HTMLFrameElement:!1,HTMLFrameSetElement:!1,HTMLHeadElement:!1,HTMLHeadingElement:!1,HTMLHRElement:!1,HTMLHtmlElement:!1,HTMLIFrameElement:!1,HTMLImageElement:!1,HTMLInputElement:!1,HTMLIsIndexElement
:!1,HTMLLabelElement:!1,HTMLLayerElement:!1,HTMLLegendElement:!1,HTMLLIElement:!1,HTMLLinkElement:!1,HTMLMapElement:!1,HTMLMenuElement:!1,HTMLMetaElement:!1,HTMLModElement:!1,HTMLObjectElement:!1,HTMLOListElement
:!1,HTMLOptGroupElement:!1,HTMLOptionElement:!1,HTMLParagraphElement:!1,HTMLParamElement:!1,HTMLPreElement:!1,HTMLQuoteElement:!1,HTMLScriptElement:!1,HTMLSelectElement:!1,HTMLStyleElement:!1,HTMLTableCaptionElement
:!1,HTMLTableCellElement:!1,HTMLTableColElement:!1,HTMLTableElement:!1,HTMLTableRowElement:!1,HTMLTableSectionElement:!1,HTMLTextAreaElement:!1,HTMLTitleElement:!1,HTMLUListElement:!1,HTMLVideoElement:!1
,history:!1,Int16Array:!1,Int32Array:!1,Int8Array:!1,Image:!1,length:!1,localStorage:!1,location:!1,MessageChannel:!1,MessageEvent:!1,MessagePort:!1,moveBy:!1,moveTo:!1,MutationObserver:!1,name:!1,Node
:!1,NodeFilter:!1,navigator:!1,onbeforeunload:!0,onblur:!0,onerror:!0,onfocus:!0,onload:!0,onresize:!0,onunload:!0,open:!1,openDatabase:!1,opener:!1,Option:!1,parent:!1,print:!1,removeEventListener:!1,
resizeBy:!1,resizeTo:!1,screen:!1,scroll:!1,scrollBy:!1,scrollTo:!1,sessionStorage:!1,setInterval:!1,setTimeout:!1,SharedWorker:!1,status:!1,top:!1,Uint16Array:!1,Uint32Array:!1,Uint8Array:!1,WebSocket
:!1,window:!1,Worker:!1,XMLHttpRequest:!1,XMLSerializer:!1,XPathEvaluator:!1,XPathException:!1,XPathExpression:!1,XPathNamespace:!1,XPathNSResolver:!1,XPathResult:!1},u={require:!1,respond:!1,getRow:!1
,emit:!1,send:!1,start:!1,sum:!1,log:!1,exports:!1,module:!1,provides:!1},a={alert:!1,confirm:!1,console:!1,Debug:!1,opera:!1,prompt:!1},f={dojo:!1,dijit:!1,dojox:!1,define:!1,require:!1},l={"\b":"\\b"
,"	":"\\t","\n":"\\n","\f":"\\f","\r":"\\r",'"':'\\"',"/":"\\/","\\":"\\\\"},c,h=["closure","exception","global","label","outer","unused","var"],p,d,v,m,g,y,b={$:!1,jQuery:!1},w,E,S,x,T={$:!1,$$:!1,Assets
:!1,Browser:!1,Chain:!1,Class:!1,Color:!1,Cookie:!1,Core:!1,Document:!1,DomReady:!1,DOMReady:!1,Drag:!1,Element:!1,Elements:!1,Event:!1,Events:!1,Fx:!1,Group:!1,Hash:!1,HtmlTable:!1,Iframe:!1,IframeShim
:!1,InputValidator:!1,instanceOf:!1,Keyboard:!1,Locale:!1,Mask:!1,MooTools:!1,Native:!1,Options:!1,OverText:!1,Request:!1,Scroller:!1,Slick:!1,Slider:!1,Sortables:!1,Spinner:!1,Swiff:!1,Tips:!1,Type:!1
,typeOf:!1,URI:!1,Window:!1},N,C={__filename:!1,__dirname:!1,Buffer:!1,console:!1,exports:!1,GLOBAL:!1,global:!1,module:!1,process:!1,require:!1,setTimeout:!1,clearTimeout:!1,setInterval:!1,clearInterval
:!1},k,L,A,O,M,_={$:!1,$$:!1,$A:!1,$F:!1,$H:!1,$R:!1,$break:!1,$continue:!1,$w:!1,Abstract:!1,Ajax:!1,Class:!1,Enumerable:!1,Element:!1,Event:!1,Field:!1,Form:!1,Hash:!1,Insertion:!1,ObjectRange:!1,PeriodicalExecuter
:!1,Position:!1,Prototype:!1,Selector:!1,Template:!1,Toggle:!1,Try:!1,Autocompleter:!1,Builder:!1,Control:!1,Draggable:!1,Draggables:!1,Droppables:!1,Effect:!1,Sortable:!1,SortableObserver:!1,Sound:!1,
Scriptaculous:!1},D,P={defineClass:!1,deserialize:!1,gc:!1,help:!1,importPackage:!1,java:!1,load:!1,loadClass:!1,print:!1,quit:!1,readFile:!1,readUrl:!1,runCommand:!1,seal:!1,serialize:!1,spawn:!1,sync
:!1,toint32:!1,version:!1},H,B,j={Array:!1,Boolean:!1,Date:!1,decodeURI:!1,decodeURIComponent:!1,encodeURI:!1,encodeURIComponent:!1,Error:!1,eval:!1,EvalError:!1,Function:!1,hasOwnProperty:!1,isFinite:!1
,isNaN:!1,JSON:!1,Math:!1,Number:!1,Object:!1,parseInt:!1,parseFloat:!1,RangeError:!1,ReferenceError:!1,RegExp:!1,String:!1,SyntaxError:!1,TypeError:!1,URIError:!1},F={escape:!1,unescape:!1},I={E:!0,LN2
:!0,LN10:!0,LOG2E:!0,LOG10E:!0,MAX_VALUE:!0,MIN_VALUE:!0,NEGATIVE_INFINITY:!0,PI:!0,POSITIVE_INFINITY:!0,SQRT1_2:!0,SQRT2:!0},q,R={},U,z,W,X,V,$={importScripts:!0,postMessage:!0,self:!0},J={ActiveXObject
:!0,Enumerator:!0,GetObject:!0,ScriptEngine:!0,ScriptEngineBuildVersion:!0,ScriptEngineMajorVersion:!0,ScriptEngineMinorVersion:!0,VBArray:!0,WSH:!0,WScript:!0,XDomainRequest:!0},K,Q,G,Y,Z,et,tt,nt,rt;
(function(){K=/@cc|<\/?|script|\]\s*\]|<\s*!|&lt/i,Q=/[\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/,G=/^\s*([(){}\[.,:;'"~\?\]#@]|==?=?|\/(\*(jshint|jslint|members?|global)?|=|\/)?|\*[\/=]?|\+(?:=|\++)?|-(?:=|-+)?|%=?|&[&=]?|\|[|=]?|>>?>?=?|<([\/=!]|\!(\[|--)?|<=?)?|\^=?|\!=?=?|[a-zA-Z_$][a-zA-Z0-9_$]*|[0-9]+([xX][0-9a-fA-F]+|\.[0-9]*)?([eE][+\-]?[0-9]+)?)/
,Y=/[\u0000-\u001f&<"\/\\\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/,Z=/[\u0000-\u001f&<"\/\\\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g
,et=/\*\/|\/\*/,tt=/^([a-zA-Z_$][a-zA-Z0-9_$]*)$/,nt=/^(?:javascript|jscript|ecmascript|vbscript|mocha|livescript)\s*:/i,rt=/^\s*\/\*\s*falls\sthrough\s*\*\/\s*$/})(),typeof Array.isArray!="function"&&
(Array.isArray=function(e){return Object.prototype.toString.apply(e)==="[object Array]"}),typeof Object.create!="function"&&(Object.create=function(e){return it.prototype=e,new it}),typeof Object.keys!="function"&&
(Object.keys=function(e){var t=[],n;for(n in e)st(e,n)&&t.push(n);return t}),typeof String.prototype.entityify!="function"&&(String.prototype.entityify=function(){return this.replace(/&/g,"&amp;").replace
(/</g,"&lt;").replace(/>/g,"&gt;")}),typeof String.prototype.isAlpha!="function"&&(String.prototype.isAlpha=function(){return this>="a"&&this<="z￿"||this>="A"&&this<="Z￿"}),typeof String.prototype.isDigit!="function"&&
(String.prototype.isDigit=function(){return this>="0"&&this<="9"}),typeof String.prototype.supplant!="function"&&(String.prototype.supplant=function(e){return this.replace(/\{([^{}]*)\}/g,function(t,n)
{var r=e[n];return typeof r=="string"||typeof r=="number"?r:t})}),typeof String.prototype.name!="function"&&(String.prototype.name=function(){return tt.test(this)?this:Y.test(this)?'"'+this.replace(Z,function(
e){var t=l[e];return t?t:"\\u"+("0000"+e.charCodeAt().toString(16)).slice(-4)})+'"':'"'+this+'"'});var mt=function(){function s(){var e,n;return r>=w.length?!1:(t=1,i=w[r],r+=1,L.smarttabs?e=i.search(/ \t/
):e=i.search(/ \t|\t [^\*]/),e>=0&&pt("Mixed spaces and tabs.",r,e+1),i=i.replace(/\t/g,U),e=i.search(Q),e>=0&&pt("Unsafe character.",r,e),L.maxlen&&L.maxlen<i.length&&pt("Line too long.",r,i.length),n=
L.trailing&&i.match(/^(.*?)\s+$/),n&&!/^\s+$/.test(i)&&pt("Trailing whitespace.",r,n[1].length+1),!0)}function o(e,i){var s,o;return e==="(color)"||e==="(range)"?o={type:e}:e==="(punctuator)"||e==="(identifier)"&&
st(R,i)?o=R[i]||R["(error)"]:o=R[e],o=Object.create(o),(e==="(string)"||e==="(range)")&&!L.scripturl&&nt.test(i)&&pt("Script URL.",r,n),e==="(identifier)"&&(o.identifier=!0,i==="__proto__"&&!L.proto?pt
("The '{a}' property is deprecated.",r,n,i):i==="__iterator__"&&!L.iterator?pt("'{a}' is only available in JavaScript 1.7.",r,n,i):!L.nomen||i.charAt(0)!=="_"&&i.charAt(i.length-1)!=="_"?L.camelcase&&i
.indexOf("_")>-1&&!i.match(/^[A-Z0-9_]*$/)&&pt("Identifier '{a}' is not in camel case.",r,n,i):(!L.node||z.id==="."||i!=="__dirname"&&i!=="__filename")&&pt("Unexpected {a} in '{b}'.",r,n,"dangling '_'"
,i)),o.value=i,o.line=r,o.character=t,o.from=n,s=o.id,s!=="(endline)"&&(O=s&&("(,=:[!&|?{};".indexOf(s.charAt(s.length-1))>=0||s==="return"||s==="case")),o}var t,n,r,i;return{init:function(e){typeof e=="string"?
w=e.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n"):w=e,w[0]&&w[0].substr(0,2)==="#!"&&(w[0]=""),r=0,s(),n=1},range:function(e,s){var u,a="";n=t,i.charAt(0)!==e&&vt("Expected '{a}' and instead saw '{b}'."
,r,t,e,i.charAt(0));for(;;){i=i.slice(1),t+=1,u=i.charAt(0);switch(u){case"":vt("Missing '{a}'.",r,t,u);break;case s:return i=i.slice(1),t+=1,o("(range)",a);case"\\":pt("Unexpected '{a}'.",r,t,u)}a+=u}
},token:function(){function E(e){var r=e.exec(i),s;if(r)return p=r[0].length,s=r[1],u=s.charAt(0),i=i.substr(p),n=t+p-s.length,t+=p,s}function S(e){function c(e){var n=parseInt(i.substr(a+1,e),16);a+=e
,n>=32&&n<=126&&n!==34&&n!==92&&n!==39&&pt("Unnecessary escapement.",r,t),t+=e,u=String.fromCharCode(n)}var u,a,f="",l=!1;y&&e!=='"'&&pt("Strings must use doublequote.",r,t),L.quotmark&&(L.quotmark==="single"&&
e!=="'"?pt("Strings must use singlequote.",r,t):L.quotmark==="double"&&e!=='"'?pt("Strings must use doublequote.",r,t):L.quotmark===!0&&(D=D||e,D!==e&&pt("Mixed double and single quotes.",r,t))),a=0;e:
for(;;){while(a>=i.length){a=0;var h=r,p=n;if(!s()){vt("Unclosed string.",h,p);break e}l?l=!1:pt("Unclosed string.",h,p)}u=i.charAt(a);if(u===e)return t+=1,i=i.substr(a+1),o("(string)",f,e);if(u<" "){if(
u==="\n"||u==="\r")break;pt("Control character in string: {a}.",r,t+a,i.slice(0,a))}else if(u==="\\"){a+=1,t+=1,u=i.charAt(a),w=i.charAt(a+1);switch(u){case"\\":case'"':case"/":break;case"'":y&&pt("Avoid \\'."
,r,t);break;case"b":u="\b";break;case"f":u="\f";break;case"n":u="\n";break;case"r":u="\r";break;case"t":u="	";break;case"0":u="\0",w>=0&&w<=7&&q["use strict"]&&pt("Octal literals are not allowed in strict mode."
,r,t);break;case"u":c(4);break;case"v":y&&pt("Avoid \\v.",r,t),u="";break;case"x":y&&pt("Avoid \\x-.",r,t),c(2);break;case"":l=!0;if(L.multistr){y&&pt("Avoid EOL escapement.",r,t),u="",t-=1;break}pt("Bad escapement of EOL. Use option multistr if needed."
,r,t);break;default:pt("Bad escapement.",r,t)}}f+=u,t+=1,a+=1}}var e,u,a,f,l,c,h,p,d,v,m,g,b,w;for(;;){if(!i)return o(s()?"(endline)":"(end)","");m=E(G);if(!m){m="",u="";while(i&&i<"!")i=i.substr(1);i&&
(vt("Unexpected '{a}'.",r,t,i.substr(0,1)),i="")}else{if(u.isAlpha()||u==="_"||u==="$")return o("(identifier)",m);if(u.isDigit())return isFinite(Number(m))||pt("Bad number '{a}'.",r,t,m),i.substr(0,1).
isAlpha()&&pt("Missing space after '{a}'.",r,t,m),u==="0"&&(f=m.substr(1,1),f.isDigit()?z.id!=="."&&pt("Don't use extra leading zeros '{a}'.",r,t,m):y&&(f==="x"||f==="X")&&pt("Avoid 0x-. '{a}'.",r,t,m)
),m.substr(m.length-1)==="."&&pt("A trailing decimal point can be confused with a dot '{a}'.",r,t,m),o("(number)",m);switch(m){case'"':case"'":return S(m);case"//":i="",z.comment=!0;break;case"/*":for(
;;){h=i.search(et);if(h>=0)break;s()||vt("Unclosed comment.",r,t)}t+=h+2,i.substr(h,1)==="/"&&vt("Nested comment.",r,t),i=i.substr(h+2),z.comment=!0;break;case"/*members":case"/*member":case"/*jshint":
case"/*jslint":case"/*global":case"*/":return{value:m,type:"special",line:r,character:t,from:n};case"":break;case"/":z.id==="/="&&vt("A regular expression literal can be confused with '/='.",r,n);if(O)
{l=0,a=0,p=0;for(;;){e=!0,u=i.charAt(p),p+=1;switch(u){case"":return vt("Unclosed regular expression.",r,n),lt("Stopping.",r,n);case"/":l>0&&pt("{a} unterminated regular expression group(s).",r,n+p,l),
u=i.substr(0,p-1),v={g:!0,i:!0,m:!0};while(v[i.charAt(p)]===!0)v[i.charAt(p)]=!1,p+=1;return t+=p,i=i.substr(p),v=i.charAt(0),(v==="/"||v==="*")&&vt("Confusing regular expression.",r,n),o("(regexp)",u)
;case"\\":u=i.charAt(p),u<" "?pt("Unexpected control character in regular expression.",r,n+p):u==="<"&&pt("Unexpected escaped character '{a}' in regular expression.",r,n+p,u),p+=1;break;case"(":l+=1,e=!1
;if(i.charAt(p)==="?"){p+=1;switch(i.charAt(p)){case":":case"=":case"!":p+=1;break;default:pt("Expected '{a}' and instead saw '{b}'.",r,n+p,":",i.charAt(p))}}else a+=1;break;case"|":e=!1;break;case")":
l===0?pt("Unescaped '{a}'.",r,n+p,")"):l-=1;break;case" ":v=1;while(i.charAt(p)===" ")p+=1,v+=1;v>1&&pt("Spaces are hard to count. Use {{a}}.",r,n+p,v);break;case"[":u=i.charAt(p),u==="^"&&(p+=1,L.regexp?
pt("Insecure '{a}'.",r,n+p,u):i.charAt(p)==="]"&&vt("Unescaped '{a}'.",r,n+p,"^")),u==="]"&&pt("Empty class.",r,n+p-1),g=!1,b=!1;e:do{u=i.charAt(p),p+=1;switch(u){case"[":case"^":pt("Unescaped '{a}'.",
r,n+p,u),b?b=!1:g=!0;break;case"-":g&&!b?(g=!1,b=!0):b?b=!1:i.charAt(p)==="]"?b=!0:(L.regexdash!==(p===2||p===3&&i.charAt(1)==="^")&&pt("Unescaped '{a}'.",r,n+p-1,"-"),g=!0);break;case"]":b&&!L.regexdash&&
pt("Unescaped '{a}'.",r,n+p-1,"-");break e;case"\\":u=i.charAt(p),u<" "?pt("Unexpected control character in regular expression.",r,n+p):u==="<"&&pt("Unexpected escaped character '{a}' in regular expression."
,r,n+p,u),p+=1,/[wsd]/i.test(u)?(b&&(pt("Unescaped '{a}'.",r,n+p,"-"),b=!1),g=!1):b?b=!1:g=!0;break;case"/":pt("Unescaped '{a}'.",r,n+p-1,"/"),b?b=!1:g=!0;break;case"<":b?b=!1:g=!0;break;default:b?b=!1
:g=!0}}while(u);break;case".":L.regexp&&pt("Insecure '{a}'.",r,n+p,u);break;case"]":case"?":case"{":case"}":case"+":case"*":pt("Unescaped '{a}'.",r,n+p,u)}if(e)switch(i.charAt(p)){case"?":case"+":case"*"
:p+=1,i.charAt(p)==="?"&&(p+=1);break;case"{":p+=1,u=i.charAt(p),(u<"0"||u>"9")&&pt("Expected a number and instead saw '{a}'.",r,n+p,u),p+=1,d=+u;for(;;){u=i.charAt(p);if(u<"0"||u>"9")break;p+=1,d=+u+d*10
}c=d;if(u===","){p+=1,c=Infinity,u=i.charAt(p);if(u>="0"&&u<="9"){p+=1,c=+u;for(;;){u=i.charAt(p);if(u<"0"||u>"9")break;p+=1,c=+u+c*10}}}i.charAt(p)!=="}"?pt("Expected '{a}' and instead saw '{b}'.",r,n+
p,"}",u):p+=1,i.charAt(p)==="?"&&(p+=1),d>c&&pt("'{a}' should not be greater than '{b}'.",r,n+p,d,c)}}return u=i.substr(0,p-1),t+=p,i=i.substr(p),o("(regexp)",u)}return o("(punctuator)",m);case"#":return o
("(punctuator)",m);default:return o("(punctuator)",m)}}}}}}();Bt("(number)",function(){return this}),Bt("(string)",function(){return this}),R["(identifier)"]={type:"(identifier)",lbp:0,identifier:!0,nud
:function(){var t=this.value,n=H[t],r;typeof n=="function"?n=undefined:typeof n=="boolean"&&(r=c,c=p[0],gt(t,"var"),n=c,c=r);if(c===n)switch(c[t]){case"unused":c[t]="var";break;case"unction":c[t]="function"
,this["function"]=!0;break;case"function":this["function"]=!0;break;case"label":ht("'{a}' is a statement label.",z,t)}else if(c["(global)"])L.undef&&typeof A[t]!="boolean"&&(e!=="typeof"&&e!=="delete"||
N&&(N.value==="."||N.value==="["))&&ct(c,"'{a}' is not defined.",z,t),en(z);else switch(c[t]){case"closure":case"function":case"var":case"unused":ht("'{a}' used out of scope.",z,t);break;case"label":ht
("'{a}' is a statement label.",z,t);break;case"outer":case"global":break;default:if(n===!0)c[t]=!0;else if(n===null)ht("'{a}' is not allowed.",z,t),en(z);else if(typeof n!="object")L.undef&&(e!=="typeof"&&
e!=="delete"||N&&(N.value==="."||N.value==="["))&&ct(c,"'{a}' is not defined.",z,t),c[t]=!0,en(z);else switch(n[t]){case"function":case"unction":this["function"]=!0,n[t]="closure",c[t]=n["(global)"]?"global"
:"outer";break;case"var":case"unused":n[t]="closure",c[t]=n["(global)"]?"global":"outer";break;case"closure":case"parameter":c[t]=n["(global)"]?"global":"outer";break;case"label":ht("'{a}' is a statement label."
,z,t)}}return this},led:function(){dt("Expected an operator and instead saw '{a}'.",N,N.value)}},Bt("(regexp)",function(){return this}),Mt("(endline)"),Mt("(begin)"),Mt("(end)").reach=!0,Mt("</").reach=!0
,Mt("<!"),Mt("<!--"),Mt("-->"),Mt("(error)").reach=!0,Mt("}").reach=!0,Mt(")"),Mt("]"),Mt('"').reach=!0,Mt("'").reach=!0,Mt(";"),Mt(":").reach=!0,Mt(","),Mt("#"),Mt("@"),jt("else"),jt("case").reach=!0,
jt("catch"),jt("default").reach=!0,jt("finally"),Ft("arguments",function(e){q["use strict"]&&c["(global)"]&&ht("Strict violation.",e)}),Ft("eval"),Ft("false"),Ft("Infinity"),Ft("NaN"),Ft("null"),Ft("this"
,function(e){q["use strict"]&&!L.validthis&&(c["(statement)"]&&c["(name)"].charAt(0)>"Z"||c["(global)"])&&ht("Possible strict violation.",e)}),Ft("true"),Ft("undefined"),Ut("=","assign",20),Ut("+=","assignadd"
,20),Ut("-=","assignsub",20),Ut("*=","assignmult",20),Ut("/=","assigndiv",20).nud=function(){dt("A regular expression literal can be confused with '/='.")},Ut("%=","assignmod",20),Wt("&=","assignbitand"
,20),Wt("|=","assignbitor",20),Wt("^=","assignbitxor",20),Wt("<<=","assignshiftleft",20),Wt(">>=","assignshiftright",20),Wt(">>>=","assignshiftrightunsigned",20),It("?",function(e,t){return t.left=e,t.
right=Et(10),wt(":"),t["else"]=Et(10),t},30),It("||","or",40),It("&&","and",50),zt("|","bitor",70),zt("^","bitxor",80),zt("&","bitand",90),qt("==",function(e,t){var n=L.eqnull&&(e.value==="null"||t.value==="null"
);return!n&&L.eqeqeq?ht("Expected '{a}' and instead saw '{b}'.",this,"===","=="):Rt(e)?ht("Use '{a}' to compare with '{b}'.",this,"===",e.value):Rt(t)&&ht("Use '{a}' to compare with '{b}'.",this,"===",
t.value),this}),qt("==="),qt("!=",function(e,t){var n=L.eqnull&&(e.value==="null"||t.value==="null");return!n&&L.eqeqeq?ht("Expected '{a}' and instead saw '{b}'.",this,"!==","!="):Rt(e)?ht("Use '{a}' to compare with '{b}'."
,this,"!==",e.value):Rt(t)&&ht("Use '{a}' to compare with '{b}'.",this,"!==",t.value),this}),qt("!=="),qt("<"),qt(">"),qt("<="),qt(">="),zt("<<","shiftleft",120),zt(">>","shiftright",120),zt(">>>","shiftrightunsigned"
,120),It("in","in",120),It("instanceof","instanceof",120),It("+",function(e,t){var n=Et(130);return e&&n&&e.id==="(string)"&&n.id==="(string)"?(e.value+=n.value,e.character=n.character,!L.scripturl&&nt
.test(e.value)&&ht("JavaScript URL.",e),e):(t.left=e,t.right=n,t)},130),Ht("+","num"),Ht("+++",function(){return ht("Confusing pluses."),this.right=Et(150),this.arity="unary",this}),It("+++",function(e
){return ht("Confusing pluses."),this.left=e,this.right=Et(130),this},130),It("-","sub",130),Ht("-","neg"),Ht("---",function(){return ht("Confusing minuses."),this.right=Et(150),this.arity="unary",this
}),It("---",function(e){return ht("Confusing minuses."),this.left=e,this.right=Et(130),this},130),It("*","mult",140),It("/","div",140),It("%","mod",140),Xt("++","postinc"),Ht("++","preinc"),R["++"].exps=!0
,Xt("--","postdec"),Ht("--","predec"),R["--"].exps=!0,Ht("delete",function(){var e=Et(0);return(!e||e.id!=="."&&e.id!=="[")&&ht("Variables should not be deleted."),this.first=e,this}).exps=!0,Ht("~",function(
){return L.bitwise&&ht("Unexpected '{a}'.",this,"~"),Et(150),this}),Ht("!",function(){return this.right=Et(150),this.arity="unary",t[this.right.id]===!0&&ht("Confusing use of '{a}'.",this,"!"),this}),Ht
("typeof","typeof"),Ht("new",function(){var e=Et(155),t;if(e&&e.id!=="function")if(e.identifier){e["new"]=!0;switch(e.value){case"Number":case"String":case"Boolean":case"Math":case"JSON":ht("Do not use {a} as a constructor."
,z,e.value);break;case"Function":L.evil||ht("The Function constructor is eval.");break;case"Date":case"RegExp":break;default:e.id!=="function"&&(t=e.value.substr(0,1),L.newcap&&(t<"A"||t>"Z")&&ht("A constructor name should start with an uppercase letter."
,z))}}else e.id!=="."&&e.id!=="["&&e.id!=="("&&ht("Bad constructor.",z);else L.supernew||ht("Weird construction. Delete 'new'.",this);return St(z,N),N.id!=="("&&!L.supernew&&ht("Missing '()' invoking a constructor."
),this.first=e,this}),R["new"].exps=!0,Ht("void").exps=!0,It(".",function(e,t){St(M,z),xt();var n=$t();return typeof n=="string"&&Zt(n),t.left=e,t.right=n,!e||e.value!=="arguments"||n!=="callee"&&n!=="caller"?!
L.evil&&e&&e.value==="document"&&(n==="write"||n==="writeln")&&ht("document.write can be a form of eval.",e):L.noarg?ht("Avoid arguments.{a}.",e,n):q["use strict"]&&dt("Strict violation."),!L.evil&&(n==="eval"||
n==="execScript")&&ht("eval is evil."),t},160,!0),It("(",function(e,t){M.id!=="}"&&M.id!==")"&&xt(M,z),Tt(),L.immed&&!e.immed&&e.id==="function"&&ht("Wrap an immediate function invocation in parentheses to assist the reader in understanding that the expression is the result of a function, and not the function itself."
);var n=0,r=[];e&&e.type==="(identifier)"&&e.value.match(/^[A-Z]([A-Z0-9_$]*[a-z][A-Za-z0-9_$]*)?$/)&&e.value!=="Number"&&e.value!=="String"&&e.value!=="Boolean"&&e.value!=="Date"&&(e.value==="Math"?ht
("Math is not a function.",e):L.newcap&&ht("Missing 'new' prefix when invoking a constructor.",e));if(N.id!==")")for(;;){r[r.length]=Et(10),n+=1;if(N.id!==",")break;At()}return wt(")"),Tt(M,z),typeof e=="object"&&
(e.value==="parseInt"&&n===1&&ht("Missing radix parameter.",e),L.evil||(e.value==="eval"||e.value==="Function"||e.value==="execScript"?ht("eval is evil.",e):r[0]&&r[0].id==="(string)"&&(e.value==="setTimeout"||
e.value==="setInterval")&&ht("Implied eval is evil. Pass a function instead of a string.",e)),!e.identifier&&e.id!=="."&&e.id!=="["&&e.id!=="("&&e.id!=="&&"&&e.id!=="||"&&e.id!=="?"&&ht("Bad invocation."
,e)),t.left=e,t},155,!0).exps=!0,Ht("(",function(){Tt(),N.id==="function"&&(N.immed=!0);var e=Et(0);return wt(")",this),Tt(M,z),L.immed&&e.id==="function"&&(N.id==="("||N.id==="."&&(bt().value==="call"||
bt().value==="apply")?ht("Move the invocation into the parens that contain the function.",N):ht("Do not wrap function literals in parens unless they are to be immediately invoked.",this)),e}),It("[",function(
e,t){xt(M,z),Tt();var n=Et(0),r;return n&&n.type==="(string)"&&(!L.evil&&(n.value==="eval"||n.value==="execScript")&&ht("eval is evil.",t),Zt(n.value),!L.sub&&tt.test(n.value)&&(r=R[n.value],(!r||!r.reserved
)&&ht("['{a}'] is better written in dot notation.",n,n.value))),wt("]",t),Tt(M,z),t.left=e,t.right=n,t},160,!0),Ht("[",function(){var e=z.line!==N.line;this.first=[],e&&(g+=L.indent,N.from===g+L.indent&&
(g+=L.indent));while(N.id!=="(end)"){while(N.id===",")ht("Extra comma."),wt(",");if(N.id==="]")break;e&&z.line!==N.line&&kt(),this.first.push(Et(10));if(N.id!==",")break;At();if(N.id==="]"&&!L.es5){ht("Extra comma."
,z);break}}return e&&(g-=L.indent,kt()),wt("]",this),this},160),function(e){e.nud=function(){function u(e,t){o[e]&&st(o,e)?ht("Duplicate member '{a}'.",N,n):o[e]={},o[e].basic=!0,o[e].basicToken=t}function a
(e,t){o[e]&&st(o,e)?(o[e].basic||o[e].setter)&&ht("Duplicate member '{a}'.",N,n):o[e]={},o[e].setter=!0,o[e].setterToken=t}function f(e){o[e]&&st(o,e)?(o[e].basic||o[e].getter)&&ht("Duplicate member '{a}'."
,N,n):o[e]={},o[e].getter=!0,o[e].getterToken=z}var e,t,n,r,i,s,o={};e=z.line!==N.line,e&&(g+=L.indent,N.from===g+L.indent&&(g+=L.indent));for(;;){if(N.id==="}")break;e&&kt();if(N.value==="get"&&bt().id!==":"
)wt("get"),L.es5||dt("get/set are ES5 features."),n=tn(),n||dt("Missing property name."),f(n),s=N,St(z,N),t=rn(),i=t["(params)"],i&&ht("Unexpected parameter '{a}' in get {b} function.",s,i[0],n),St(z,N
);else if(N.value==="set"&&bt().id!==":")wt("set"),L.es5||dt("get/set are ES5 features."),n=tn(),n||dt("Missing property name."),a(n,N),s=N,St(z,N),t=rn(),i=t["(params)"],(!i||i.length!==1)&&ht("Expected a single parameter in set {a} function."
,s,n);else{n=tn(),u(n,N);if(typeof n!="string")break;wt(":"),Nt(z,N),Et(10)}Zt(n);if(N.id!==",")break;At(),N.id===","?ht("Extra comma.",z):N.id==="}"&&!L.es5&&ht("Extra comma.",z)}e&&(g-=L.indent,kt())
,wt("}",this);if(L.es5)for(var l in o)st(o,l)&&o[l].setter&&!o[l].getter&&ht("Setter is defined without getter.",o[l].setterToken);return this},e.fud=function(){dt("Expected to see a statement and instead saw a block."
,z)}}(Mt("{")),X=function(){var e=_t("const",function(e){var t,n,r;this.first=[];for(;;){Nt(z,N),t=$t(),c[t]==="const"&&ht("const '"+t+"' has already been declared"),c["(global)"]&&A[t]===!1&&ht("Redefinition of '{a}'."
,z,t),gt(t,"const");if(e)break;n=z,this.first.push(z),N.id!=="="&&ht("const '{a}' is initialized to 'undefined'.",z,t),N.id==="="&&(Nt(z,N),wt("="),Nt(z,N),N.id==="undefined"&&ht("It is not necessary to initialize '{a}' to 'undefined'."
,z,t),bt(0).id==="="&&N.identifier&&dt("Constant {a} was not declared correctly.",N,N.value),r=Et(0),n.first=r);if(N.id!==",")break;At()}return this});e.exps=!0};var sn=_t("var",function(e){var t,n,r;c
["(onevar)"]&&L.onevar?ht("Too many var statements."):c["(global)"]||(c["(onevar)"]=!0),this.first=[];for(;;){Nt(z,N),t=$t(),L.esnext&&c[t]==="const"&&ht("const '"+t+"' has already been declared"),c["(global)"
]&&A[t]===!1&&ht("Redefinition of '{a}'.",z,t),gt(t,"unused");if(e)break;n=z,this.first.push(z),N.id==="="&&(Nt(z,N),wt("="),Nt(z,N),N.id==="undefined"&&ht("It is not necessary to initialize '{a}' to 'undefined'."
,z,t),bt(0).id==="="&&N.identifier&&dt("Variable {a} was not declared correctly.",N,N.value),r=Et(0),n.first=r);if(N.id!==",")break;At()}return this});sn.exps=!0,Dt("function",function(){m&&ht("Function declarations should not be placed in blocks. Use a function expression or move the statement to the top of the outer function."
,z);var e=$t();return L.esnext&&c[e]==="const"&&ht("const '"+e+"' has already been declared"),St(z,N),gt(e,"unction"),rn(e,!0),N.id==="("&&N.line===z.line&&dt("Function declarations are not invocable. Wrap the whole function invocation in parens."
),this}),Ht("function",function(){var e=Vt();return e?St(z,N):Nt(z,N),rn(e),!L.loopfunc&&c["(loopage)"]&&ht("Don't make functions within a loop."),this}),Dt("if",function(){var e=N;return wt("("),Nt(this
,e),Tt(),Et(20),N.id==="="&&(L.boss||ht("Expected a conditional expression and instead saw an assignment."),wt("="),Et(20)),wt(")",e),Tt(M,z),Yt(!0,!0),N.id==="else"&&(Nt(z,N),wt("else"),N.id==="if"||N
.id==="switch"?Kt(!0):Yt(!0,!0)),this}),Dt("try",function(){var e,t,n;Yt(!1),N.id==="catch"&&(wt("catch"),Nt(z,N),wt("("),n=H,H=Object.create(n),t=N.value,N.type!=="(identifier)"?ht("Expected an identifier and instead saw '{a}'."
,N,t):gt(t,"exception"),wt(),wt(")"),Yt(!1),e=!0,H=n);if(N.id==="finally"){wt("finally"),Yt(!1);return}return e||dt("Expected '{a}' and instead saw '{b}'.",N,"catch",N.value),this}),Dt("while",function(
){var e=N;return c["(breakage)"]+=1,c["(loopage)"]+=1,wt("("),Nt(this,e),Tt(),Et(20),N.id==="="&&(L.boss||ht("Expected a conditional expression and instead saw an assignment."),wt("="),Et(20)),wt(")",e
),Tt(M,z),Yt(!0,!0),c["(breakage)"]-=1,c["(loopage)"]-=1,this}).labelled=!0,Dt("with",function(){var e=N;return q["use strict"]?dt("'with' is not allowed in strict mode.",z):L.withstmt||ht("Don't use 'with'."
,z),wt("("),Nt(this,e),Tt(),Et(0),wt(")",e),Tt(M,z),Yt(!0,!0),this}),Dt("switch",function(){var e=N,t=!1;c["(breakage)"]+=1,wt("("),Nt(this,e),Tt(),this.condition=Et(20),wt(")",e),Tt(M,z),Nt(z,N),e=N,wt
("{"),Nt(z,N),g+=L.indent,this.cases=[];for(;;)switch(N.id){case"case":switch(c["(verb)"]){case"break":case"case":case"continue":case"return":case"switch":case"throw":break;default:rt.test(w[N.line-2])||
ht("Expected a 'break' statement before 'case'.",z)}kt(-L.indent),wt("case"),this.cases.push(Et(20)),t=!0,wt(":"),c["(verb)"]="case";break;case"default":switch(c["(verb)"]){case"break":case"continue":case"return"
:case"throw":break;default:rt.test(w[N.line-2])||ht("Expected a 'break' statement before 'default'.",z)}kt(-L.indent),wt("default"),t=!0,wt(":");break;case"}":g-=L.indent,kt(),wt("}",e);if(this.cases.length===1||
this.condition.id==="true"||this.condition.id==="false")L.onecase||ht("This 'switch' should be an 'if'.",this);c["(breakage)"]-=1,c["(verb)"]=undefined;return;case"(end)":dt("Missing '{a}'.",N,"}");return;
default:if(t)switch(z.id){case",":dt("Each value should have its own case label.");return;case":":t=!1,Qt();break;default:dt("Missing ':' on a case clause.",z);return}else{if(z.id!==":"){dt("Expected '{a}' and instead saw '{b}'."
,N,"case",N.value);return}wt(":"),dt("Unexpected '{a}'.",z,":"),Qt()}}}).labelled=!0,_t("debugger",function(){return L.debug||ht("All 'debugger' statements should be removed."),this}).exps=!0,function(
){var e=_t("do",function(){c["(breakage)"]+=1,c["(loopage)"]+=1,this.first=Yt(!0),wt("while");var e=N;return Nt(z,e),wt("("),Tt(),Et(20),N.id==="="&&(L.boss||ht("Expected a conditional expression and instead saw an assignment."
),wt("="),Et(20)),wt(")",e),Tt(M,z),c["(breakage)"]-=1,c["(loopage)"]-=1,this});e.labelled=!0,e.exps=!0}(),Dt("for",function(){var e,t=N;c["(breakage)"]+=1,c["(loopage)"]+=1,wt("("),Nt(this,t),Tt();if(
bt(N.id==="var"?1:0).id==="in"){if(N.id==="var")wt("var"),sn.fud.call(sn,!0);else{switch(c[N.value]){case"unused":c[N.value]="var";break;case"var":break;default:ht("Bad for in variable '{a}'.",N,N.value
)}wt()}return wt("in"),Et(20),wt(")",t),e=Yt(!0,!0),L.forin&&e&&(e.length>1||typeof e[0]!="object"||e[0].value!=="if")&&ht("The body of a for in should be wrapped in an if statement to filter unwanted properties from the prototype."
,this),c["(breakage)"]-=1,c["(loopage)"]-=1,this}if(N.id!==";")if(N.id==="var")wt("var"),sn.fud.call(sn);else for(;;){Et(0,"for");if(N.id!==",")break;At()}Lt(z),wt(";"),N.id!==";"&&(Et(20),N.id==="="&&
(L.boss||ht("Expected a conditional expression and instead saw an assignment."),wt("="),Et(20))),Lt(z),wt(";"),N.id===";"&&dt("Expected '{a}' and instead saw '{b}'.",N,")",";");if(N.id!==")")for(;;){Et
(0,"for");if(N.id!==",")break;At()}return wt(")",t),Tt(M,z),Yt(!0,!0),c["(breakage)"]-=1,c["(loopage)"]-=1,this}).labelled=!0,_t("break",function(){var e=N.value;return c["(breakage)"]===0&&ht("Unexpected '{a}'."
,N,this.value),L.asi||Lt(this),N.id!==";"&&z.line===N.line&&(c[e]!=="label"?ht("'{a}' is not a statement label.",N,e):H[e]!==c&&ht("'{a}' is out of scope.",N,e),this.first=N,wt()),Jt("break"),this}).exps=!0
,_t("continue",function(){var e=N.value;return c["(breakage)"]===0&&ht("Unexpected '{a}'.",N,this.value),L.asi||Lt(this),N.id!==";"?z.line===N.line&&(c[e]!=="label"?ht("'{a}' is not a statement label."
,N,e):H[e]!==c&&ht("'{a}' is out of scope.",N,e),this.first=N,wt()):c["(loopage)"]||ht("Unexpected '{a}'.",N,this.value),Jt("continue"),this}).exps=!0,_t("return",function(){return this.line===N.line?(
N.id==="(regexp)"&&ht("Wrap the /regexp/ literal in parens to disambiguate the slash operator."),N.id!==";"&&!N.reach&&(Nt(z,N),bt().value==="="&&!L.boss&&pt("Did you mean to return a conditional instead of an assignment?"
,z.line,z.character+1),this.first=Et(0))):L.asi||Lt(this),Jt("return"),this}).exps=!0,_t("throw",function(){return Lt(this),Nt(z,N),this.first=Et(20),Jt("throw"),this}).exps=!0,jt("class"),jt("const"),
jt("enum"),jt("export"),jt("extends"),jt("import"),jt("super"),jt("let"),jt("yield"),jt("implements"),jt("interface"),jt("package"),jt("private"),jt("protected"),jt("public"),jt("static");var un=function(
e,t,n){var r,i,s,o,u,a={};JSHINT.errors=[],JSHINT.undefs=[],A=Object.create(j),at(A,n||{});if(!ut(e)&&!Array.isArray(e))return vt("Input is neither a string nor an array of strings.",0),!1;if(ut(e)&&/^\s*$/g
.test(e))return vt("Input is an empty string.",0),!1;if(e.length===0)return vt("Input is an empty array.",0),!1;if(t){r=t.predef;if(r)if(Array.isArray(r))for(i=0;i<r.length;i+=1)A[r[i]]=!0;else if(typeof
r=="object"){s=Object.keys(r);for(i=0;i<s.length;i+=1)A[s[i]]=!!r[s[i]]}u=Object.keys(t);for(o=0;o<u.length;o++)a[u[o]]=t[u[o]]}L=a,L.indent=L.indent||4,L.maxerr=L.maxerr||50,U="";for(i=0;i<L.indent;i+=1
)U+=" ";g=1,d=Object.create(A),H=d,c={"(global)":!0,"(name)":"(global)","(scope)":H,"(breakage)":0,"(loopage)":0},p=[c],W=[],B=null,S={},x=null,v={},m=!1,E=[],y=!1,V=0,mt.init(e),O=!0,q={},M=z=N=R["(begin)"
];for(var f in t)st(t,f)&&ot(f,z);ft(),at(A,n||{}),At.first=!0,D=undefined;try{wt();switch(N.id){case"{":case"[":L.laxbreak=!0,y=!0,on();break;default:Gt(),q["use strict"]&&!L.globalstrict&&ht('Use the function form of "use strict".'
,M),Qt()}wt(N&&N.value!=="."?"(end)":undefined);var l=function(e,t){do{if(typeof t[e]=="string")return t[e]==="unused"?t[e]="var":t[e]==="unction"&&(t[e]="closure"),!0;t=t["(context)"]}while(t);return!1
},h=function(e,t){if(!v[e])return;var n=[];for(var r=0;r<v[e].length;r+=1)v[e][r]!==t&&n.push(v[e][r]);n.length===0?delete v[e]:v[e]=n};for(i=0;i<JSHINT.undefs.length;i+=1)s=JSHINT.undefs[i].slice(0),l
(s[2].value,s[0])?h(s[2].value,s[2].line):ht.apply(ht,s.slice(1))}catch(b){if(b){var w=N||{};JSHINT.errors.push({raw:b.raw,reason:b.message,line:b.line||w.line,character:b.character||w.from},null)}}return JSHINT
.errors.length===0};return un.data=function(){var e={functions:[],options:L},t,n,r=[],i,s,o,u=[],a,f=[],l;un.errors.length&&(e.errors=un.errors),y&&(e.json=!0);for(a in v)st(v,a)&&r.push({name:a,line:v
[a]});r.length>0&&(e.implieds=r),W.length>0&&(e.urls=W),n=Object.keys(H),n.length>0&&(e.globals=n);for(s=1;s<p.length;s+=1){i=p[s],t={};for(o=0;o<h.length;o+=1)t[h[o]]=[];for(a in i)st(i,a)&&a.charAt(0
)!=="("&&(l=i[a],l==="unction"&&(l="unused"),Array.isArray(t[l])&&(t[l].push(a),l==="unused"&&f.push({name:a,line:i["(line)"],"function":i["(name)"]})));for(o=0;o<h.length;o+=1)t[h[o]].length===0&&delete
t[h[o]];t.name=i["(name)"],t.param=i["(params)"],t.line=i["(line)"],t.character=i["(character)"],t.last=i["(last)"],t.lastcharacter=i["(lastcharacter)"],e.functions.push(t)}f.length>0&&(e.unused=f),u=[
];for(a in S)if(typeof S[a]=="number"){e.member=S;break}return e},un.report=function(e){function d(e,t){var n,r,i;if(t){h.push("<div><i>"+e+"</i> "),t=t.sort();for(r=0;r<t.length;r+=1)t[r]!==i&&(i=t[r]
,h.push((n?", ":"")+i),n=!0);h.push("</div>")}}var t=un.data(),n=[],r,i,s,o,u,a,f,l="",c,h=[],p;if(t.errors||t.implieds||t.unused){s=!0,h.push("<div id=errors><i>Error:</i>");if(t.errors)for(u=0;u<t.errors
.length;u+=1)r=t.errors[u],r&&(i=r.evidence||"",h.push("<p>Problem"+(isFinite(r.line)?" at line "+r.line+" character "+r.character:"")+": "+r.reason.entityify()+"</p><p class=evidence>"+(i&&(i.length>80?
i.slice(0,77)+"...":i).entityify())+"</p>"));if(t.implieds){p=[];for(u=0;u<t.implieds.length;u+=1)p[u]="<code>"+t.implieds[u].name+"</code>&nbsp;<i>"+t.implieds[u].line+"</i>";h.push("<p><i>Implied global:</i> "+
p.join(", ")+"</p>")}if(t.unused){p=[];for(u=0;u<t.unused.length;u+=1)p[u]="<code><u>"+t.unused[u].name+"</u></code>&nbsp;<i>"+t.unused[u].line+"</i> <code>"+t.unused[u]["function"]+"</code>";h.push("<p><i>Unused variable:</i> "+
p.join(", ")+"</p>")}t.json&&h.push("<p>JSON: bad.</p>"),h.push("</div>")}if(!e){h.push("<br><div id=functions>"),t.urls&&d("URLs<br>",t.urls,"<br>"),t.json&&!s?h.push("<p>JSON: good.</p>"):t.globals?h
.push("<div><i>Global</i> "+t.globals.sort().join(", ")+"</div>"):h.push("<div><i>No new global variables introduced.</i></div>");for(u=0;u<t.functions.length;u+=1)o=t.functions[u],h.push("<br><div class=function><i>"+
o.line+"-"+o.last+"</i> "+(o.name||"")+"("+(o.param?o.param.join(", "):"")+")</div>"),d("<big><b>Unused</b></big>",o.unused),d("Closure",o.closure),d("Variable",o["var"]),d("Exception",o.exception),d("Outer"
,o.outer),d("Global",o.global),d("Label",o.label);if(t.member){n=Object.keys(t.member);if(n.length){n=n.sort(),l="<br><pre id=members>/*members ",f=10;for(u=0;u<n.length;u+=1)a=n[u],c=a.name(),f+c.length>72&&
(h.push(l+"<br>"),l="    ",f=1),f+=c.length+2,t.member[a]===1&&(c="<i>"+c+"</i>"),u<n.length-1&&(c+=", "),l+=c;h.push(l+"<br>*/</pre>")}h.push("</div>")}}return h.join("")},un.jshint=un,un}();typeof exports=="object"&&
exports&&(exports.JSHINT=JSHINT);
/* END INSERT */

var JSHINT = exports.JSHINT;
realExports.JSHINT = JSHINT;
exports = realExports;

// jshint-endignore

})(typeof exports == "undefined" ? (typeof doctest == "undefined" ? doctest = {} : doctest) : exports);
