(function (doctest) {
  'use strict';

  // Function.bind is not defined in phantomjs (!) so polyfill it
  if (!Function.prototype.bind) {
    Function.prototype.bind = function (oThis) {
      if (typeof this !== "function") {
        // closest thing possible to the ECMAScript 5
        // internal IsCallable function
        throw new TypeError("can't bind");
      }

      var aArgs = Array.prototype.slice.call(arguments, 1),
        fToBind = this,
        fNOP = function () {},
        fBound = function () {
          return fToBind.apply(this instanceof fNOP && oThis
                 ? this
                 : oThis,
                 aArgs.concat(Array.prototype.slice.call(arguments)));
        };

      fNOP.prototype = this.prototype;
      fBound.prototype = new fNOP();

      return fBound;
    };
  }

  // default phantomjs background is transparent
  document.body.bgColor = 'white';

  // Send messages to the parent PhantomJS process via alert! Good times!!
  function sendMessage() {
    var args = [].slice.call(arguments);
    alert(JSON.stringify(args));
  }

  // doctestjs-specific stuff.  First, be sure we don't autostart:
  document.body.className = document.body.className.replace(/autodoctest/,'');

  // Now define a custom reporter which will pass the results up to grunt
  var PhantomReporter = function(runner) {
    this.runner = runner;
  };
  PhantomReporter.prototype.logSuccess = function(example, got) {
    this._send('doctestjs.pass', example, got);
  };
  PhantomReporter.prototype.logFailure = function(example, got) {
    this._send('doctestjs.fail', example, got);
  };
  PhantomReporter.prototype._send = function(msg, example, got) {
    sendMessage(msg, {
      example: {
        expr: example.expr,
        summary: example.textSummary(),
        expected: example.expected
      },
      got: got
    });
  };

  // Start/finish the doctest runner.
  window.doctestReporterHook = {
    finish: function() {
      sendMessage('doctestjs.end');
    }
  };
  window.addEventListener('load', function() {
    var runner = new doctest.Runner({
      Reporter: PhantomReporter
    });
    var parser = new doctest.HTMLParser(runner);
    parser.loadRemotes(function() {
      runner.init();
      parser.parse();
      sendMessage('doctestjs.start');
      runner.run();
    });
  });

})(window.doctest);
