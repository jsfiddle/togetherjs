/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["jquery", "jqueryPlugins"], function ($) {
  var util = {};

  util.Deferred = $.Deferred;
  TogetherJS.$ = $;

  /* A simple class pattern, use like:

    var Foo = util.Class({
      constructor: function (a, b) {
        init the class
      },
      otherMethod: ...
    });

  You can also give a superclass as the optional first argument.

  Instantiation does not require "new"

  */
  util.Class = function (superClass, prototype) {
    var a;
    if (prototype === undefined) {
      prototype = superClass;
    } else {
      if (superClass.prototype) {
        superClass = superClass.prototype;
      }
      var newPrototype = Object.create(superClass);
      for (a in prototype) {
        if (prototype.hasOwnProperty(a)) {
          newPrototype[a] = prototype[a];
        }
      }
      prototype = newPrototype;
    }
    var ClassObject = function () {
      var obj = Object.create(prototype);
      obj.constructor.apply(obj, arguments);
      obj.constructor = ClassObject;
      return obj;
    };
    ClassObject.prototype = prototype;
    if (prototype.constructor.name) {
      ClassObject.className = prototype.constructor.name;
      ClassObject.toString = function () {
        return '[Class ' + this.className + ']';
      };
    }
    if (prototype.classMethods) {
      for (a in prototype.classMethods) {
        if (prototype.classMethods.hasOwnProperty(a)) {
          ClassObject[a] = prototype.classMethods[a];
        }
      }
    }
    return ClassObject;
  };

  /* Extends obj with other, or copies obj if no other is given. */
  util.extend = TogetherJS._extend;

  util.forEachAttr = function (obj, callback, context) {
    context = context || obj;
    for (var a in obj) {
      if (obj.hasOwnProperty(a)) {
        callback.call(context, obj[a], a);
      }
    }
  };

  /* Trim whitespace from a string */
  util.trim = function trim(s) {
    return s.replace(/^\s+/, "").replace(/\s+$/, "");
  };

  /* Convert a string into something safe to use as an HTML class name */
  util.safeClassName = function safeClassName(name) {
    return name.replace(/[^a-zA-Z0-9_\-]/g, "_") || "class";
  };

  util.AssertionError = function (message) {
    if (! this instanceof util.AssertionError) {
      return new util.AssertionError(message);
    }
    this.message = message;
    this.name = "AssertionError";
  };
  util.AssertionError.prototype = Error.prototype;

  util.assert = function (cond) {
    if (! cond) {
      var args = ["Assertion error:"].concat(Array.prototype.slice.call(arguments, 1));
      console.error.apply(console, args);
      if (console.trace) {
        console.trace();
      }
      throw new util.AssertionError(args.join(" "));
    }
  };

  /* Generates a random ID */
  util.generateId = function (length) {
    length = length || 10;
    var letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV0123456789';
    var s = '';
    for (var i=0; i<length; i++) {
      s += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return s;
  };

  util.pickRandom = function (array) {
    return array[Math.floor(Math.random() * array.length)];
  };

  util.mixinEvents = TogetherJS._mixinEvents;

  util.Module = util.Class({
    constructor: function (name) {
      this._name = name;
    },
    toString: function () {
      return '[Module ' + this._name + ']';
    }
  });

  util.blobToBase64 = function (blob) {
    // Oh this is just terrible
    var binary = '';
    var bytes = new Uint8Array(blob);
    var len = bytes.byteLength;
    for (var i=0; i<len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  util.truncateCommonDomain = function (url, base) {
    /* Remove the scheme and domain from url, if it matches the scheme and domain
       of base */
    if (! base) {
      return url;
    }
    var regex = /^https?:\/\/[^\/]*/i;
    var match = regex.exec(url);
    var matchBase = regex.exec(base);
    if (match && matchBase && match[0] == matchBase[0]) {
      // There is a common scheme and domain
      return url.substr(match[0].length);
    }
    return url;
  };

  util.makeUrlAbsolute = function (url, base) {
    if (url.search(/^(http|https|ws|wss):/i) === 0) {
      // Absolute URL
      return url;
    }
    if (url.search(/^\/\/[^\/]/) === 0) {
      var scheme = (/^(http|https|ws|wss):/i).exec(base);
      util.assert(scheme, "No scheme on base URL", base);
      return scheme[1] + ":" + url;
    }
    if (url.search(/^\//) === 0) {
      var domain = (/^(http|https|ws|wss):\/\/[^\/]+/i).exec(base);
      util.assert(domain, "No scheme/domain on base URL", base);
      return domain[0] + url;
    }
    var last = (/[^\/]+$/).exec(base);
    util.assert(last, "Does not appear to be a URL?", base);
    var lastBase = base.substr(0, last.index);
    return lastBase + url;
  };

  util.assertValidUrl = function (url) {
    /* This does some simple assertions that the url is valid:
       - it must be a string
       - it must be http(s)://... or data:...
       - it must not contain a space, quotation, or close paren
    */
    util.assert(typeof url == "string", "URLs must be a string:", url);
    util.assert(url.search(/^(http:\/\/|https:\/\/|\/\/|data:)/i) === 0,
                "URL must have an http, https, data, or // scheme:", url);
    util.assert(url.search(/[\)\'\"\ ]/) === -1,
                "URLs cannot contain ), ', \", or spaces:", JSON.stringify(url));
  };

  util.resolver = function (deferred, func) {
    util.assert(deferred.then, "Bad deferred:", deferred);
    util.assert(typeof func == "function", "Not a function:", func);
    return function () {
      var result;
      try {
        result = func.apply(this, arguments);
      } catch (e) {
        deferred.reject(e);
        throw e;
      }
      if (result && result.then) {
        result.then(function () {
          deferred.resolveWith(this, arguments);
        }, function () {
          deferred.rejectWith(this, arguments);
        });
        // FIXME: doesn't pass progress through
      } else if (result === undefined) {
        deferred.resolve();
      } else {
        deferred.resolve(result);
      }
      return result;
    };
  };

  /* Detects if a value is a promise.  Right now the presence of a
     `.then()` method is the best we can do.
  */
  util.isPromise = function (obj) {
    return typeof obj == "object" && obj.then;
  };

  /* Makes a value into a promise, by returning an already-resolved
     promise if a non-promise objectx is given.
  */
  util.makePromise = function (obj) {
    if (util.isPromise(obj)) {
      return obj;
    } else {
      return $.Deferred(function (def) {
        def.resolve(obj);
      });
    }
  };

  /* Resolves several promises (the promises are the arguments to the function)
     or the first argument may be an array of promises.

     Returns a promise that will resolve with the results of all the
     promises.  If any promise fails then the returned promise fails.

     FIXME: if a promise has more than one return value (like with
     promise.resolve(a, b)) then the latter arguments will be lost.
     */
  util.resolveMany = function () {
    var args;
    var oneArg = false;
    if (arguments.length == 1 && Array.isArray(arguments[0])) {
      oneArg = true;
      args = arguments[0];
    } else {
      args = Array.prototype.slice.call(arguments);
    }
    return util.Deferred(function (def) {
      var count = args.length;
      if (! count) {
        def.resolve();
        return;
      }
      var allResults = [];
      var anyError = false;
      args.forEach(function (arg, index) {
        arg.then(function (result) {
          allResults[index] = result;
          count--;
          check();
        }, function (error) {
          allResults[index] = error;
          anyError = true;
          count--;
          check();
        });
      });
      function check() {
        if (! count) {
          if (anyError) {
            if (oneArg) {
              def.reject(allResults);
            } else {
              def.reject.apply(def, allResults);
            }
          } else {
            if (oneArg) {
              def.resolve(allResults);
            } else {
              def.resolve.apply(def, allResults);
            }
          }
        }
      }
    });
  };

  util.readFileImage = function (el) {
    return util.Deferred(function (def) {
      var reader = new FileReader();
      reader.onload = function () {
        def.resolve("data:image/jpeg;base64," + util.blobToBase64(this.result));
      };
      reader.onerror = function () {
        def.reject(this.error);
      };
      reader.readAsArrayBuffer(el.files[0]);
    });
  };

  util.matchElement = function(el, selector) {
    var res = selector;
    if (selector === true || ! selector) {
      return !!selector;
    }
    try {
      return $(el).is(selector);
    } catch (e) {
      console.warn("Bad selector:", selector, "error:", e);
      return false;
    }

  };

  util.testExpose = function (objs) {
    if (typeof TogetherJSTestSpy == "undefined") {
      return;
    }
    util.forEachAttr(objs, function (value, attr) {
      TogetherJSTestSpy[attr] = value;
    });
  };

  return util;
});
