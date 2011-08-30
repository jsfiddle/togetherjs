/// # Google Closure Compiler Service #
///
/// Compress javascript with Node.js using the Closure Compiler
/// Service.
///
/// By Ben Weaver:
/// http://www.benweaver.com/blog/use-the-google-closure-service-with-nodejs.html

var sys = require('sys'),
	qs = require('querystring'),
	http = require('http');

exports.compile = compile;

// Use the Google Closure Compiler Service to compress Javascript
// code.
//
// + code - String of javascript to compress
// + next - Function callback that accepts.
//
// This method will POST the `code` to the compiler service.  If an
// error occurs, `next()` will be called with an `Error` object as the
// first argument.  Otherwise, the `next()` will be called with `null`
// as the first argument and a String of compressed javascript as the
// second argument.
//
//     compile('... javascript ...', function(err, result) {
//       if (err) throw err;
//
//       ... do something with result ...
//     });
//
// Returns nothing.
function compile(code, opts, next) {
  try {
	  var host = 'closure-compiler.appspot.com';
	  var data = {
          js_code: code.toString('utf-8'),
          compilation_level: 'ADVANCED_OPTIMIZATIONS',
          output_format: 'json',
          output_info: ['errors', 'warnings', 'compiled_code', 'statistics'],
          warning_level: 'VERBOSE'

          // Uncomment this to enable pretty-printing of the compiled output
          //, formatting: 'pretty_print'
        }
	  if (typeof(opts) !== 'object') {
		  next = opts;
		  opts = {};
	  }
	  for (var k in opts) {
		  data[k] = opts[k];
	  }
      var body = qs.stringify(data),
        client = http.createClient(80, host).on('error', next),
        req = client.request('POST', '/compile', {
          'Host': host,
          'Content-Length': body.length,
          'Content-Type': 'application/x-www-form-urlencoded'
        });

    req.on('error', next).end(body);

    req.on('response', function(res) {
      if (res.statusCode != 200)
        next(new Error('Unexpected HTTP response: ' + res.statusCode));
      else
        capture(res, 'utf8', parseResponse);
    });

    function parseResponse(err, data) {
      err ? next(err) : loadJSON(data, function(err, obj) {
        var error;
        if (err) {
          next(err);
        } else if (obj.serverErrors) {
          next(new Error('Failed to compile due to server error: ' + sys.inspect(error)));
        } else if (obj.errors) {
          printErrors(code, opts.js_externs, obj.errors);
          next(new Error('Failed to compile due to JS errors (see above)'));
        } else {
          if (obj.warnings) {
            printErrors(code, opts.js_externs, obj.warnings);
          }
          next(null, obj.compiledCode);
        }
      });
    }
  } catch (err) {
    next(err);
  }
}

String.prototype.repeat = function(num) {
  return new Array(isNaN(num)? 1 : ++num).join(this);
}

function printErrors(code, externs, errors) {
  var lines = code.split('\n');
  var extern_lines;
  if (externs) {
    extern_lines = externs.split('\n');
  }
  ignored = {'JSC_INEXISTENT_PROPERTY':true, 'JSC_WRONG_ARGUMENT_COUNT':true};
  errors = errors.filter(function(e) {
    return !ignored[e.type]
  });
  if (errors.length === 0) {
    return;
  }

  console.log(errors.length + ' problem(s):');
  for (var i = 0; i < errors.length; i++) {
    var e = errors[i];
    console.error((e.error ? 'ERROR: ' : 'WARNING: ') + (e.error || e.warning) + ' of type ' + e.type + ' in ' + e.file + ':' + e.lineno);
	if (e.file.match(/^Externs/)) {
		console.error(extern_lines[e.lineno - 1]);
	} else {
		console.error(lines[e.lineno - 1]);
	}
    console.error('-'.repeat(e.charno) + '^');
    console.error();
  }
}

// Convert a Stream to a String.
//
// + input    - Stream object
// + encoding - String input encoding
// + next     - Function error/success callback
//
// Returns nothing.
function capture(input, encoding, next) {
  var buffer = '';

  input.setEncoding(encoding);
  input.on('data', function(chunk) {
    buffer += chunk;
  });

  input.on('end', function() {
    next(null, buffer);
  });

  input.on('error', next);
}

// Convert JSON.load() to callback-style.
//
// + data - String value to load
// + next - Function error/success callback
//
// Returns nothing.
function loadJSON(data, next) {
  var err, obj;

  try {
    obj = JSON.parse(data);
  } catch (x) {
    err = x;
  }
  next(err, obj);
}
