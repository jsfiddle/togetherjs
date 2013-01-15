(function () {
  if (! window.TowTruck) {
    window.TowTruck = {};
  }
  var TowTruck = window.TowTruck;
  var $ = window.jQuery;
  $.noConflict();
  TowTruck.$ = $;
  var _ = window._;
  _.noConflict();
  TowTruck._ = _;

  /* A simple class pattern, use like:

    var Foo = TowTruck.Class({
      constructor: function (a, b) {
        init the class
      },
      otherMethod: ...
    });

  You can also give a superclass as the optional first argument.

  Instantiation does not require "new"

  */
  TowTruck.Class = function (superClass, prototype) {
    if (prototype === undefined) {
      prototype = superClass;
    } else {
      var newPrototype = Object.create(superClass);
      for (var a in prototype) {
        newPrototype[a] = prototype[a];
      }
      prototype = newPrototype;
    }
    var ClassObject = function () {
      var obj = Object.create(prototype);
      obj.constructor.apply(obj, arguments);
      return obj;
    };
    ClassObject.prototype = prototype;
    if (prototype.constructor.name) {
      ClassObject.className = prototype.constructor.name;
    }
    return ClassObject;
  };

  /* Extends obj with other, or copies obj if no other is given. */
  TowTruck.extend = function (obj, other) {
    if (other === undefined) {
      other = obj;
      obj = {};
    }
    for (var a in other) {
      if (other.hasOwnProperty(a)) {
        obj[a] = other[a];
      }
    }
    return obj;
  };

  /* Trim whitespace from a string */
  TowTruck.trim = function trim(s) {
    return s.replace(/^\s+/, "").replace(/\s+$/, "");
  };

  /* Convert a string into something safe to use as an HTML class name */
  TowTruck.safeClassName = function safeClassName(name) {
    return name.replace(/[^a-zA-Z0-9_\-]/g, "_") || "class";
  };

  TowTruck.AssertionError = function (msg) {
    this.message = msg;
    this.toString = function () {
      return "Assertion error: " + (this.message || "?");
    };
  };

  TowTruck.assert = function (cond) {
    if (! cond) {
      var args = ["Assertion error:"].concat(Array.prototype.slice.call(arguments, 1));
      console.error.apply(console, args);
      if (console.trace) {
        console.trace();
      }
      throw new TowTruck.AssertionError(args.join(" "));
    }
  };

  /* Generates a random ID */
  TowTruck.generateId = function (length) {
    length = length || 10;
    var letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV0123456789';
    var s = '';
    for (var i=0; i<length; i++) {
      s += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return s;
  };

  TowTruck.mixinEvents = function (proto) {
    proto.on = function on(name, callback) {
      if (name.search(" ") != -1) {
        var names = name.split(/ +/g);
        names.forEach(function (n) {
          this.on(n, callback);
        }, this);
        return;
      }
      if (! this._listeners) {
        this._listeners = {};
      }
      if (! this._listeners[name]) {
        this._listeners[name] = [];
      }
      this._listeners[name].push(callback);
    };
    proto.off = proto.removeListener = function off(name, callback) {
      if (name.search(" ") != -1) {
        var names = name.split(/ +/g);
        names.forEach(function (n) {
          this.off(n, callback);
        }, this);
        return;
      }
      if ((! this._listeners) || ! this._listeners[name]) {
        return;
      }
      var l = this._listeners[name], _len = l.length;
      for (var i=0; i<_len; i++) {
        if (l[i] == callback) {
          l.splice(i, 1);
          break;
        }
      }
    };
    proto.emit = function emit(name) {
      if ((! this._listeners) || ! this._listeners[name]) {
        return;
      }
      var args = Array.prototype.slice.call(arguments, 1);
      var l = this._listeners[name], _len = l.length;
      for (var i=0; i<_len; i++) {
        l[i].apply(this, args);
      }
    };
    return proto;
  };

  TowTruck.mixinEvents(TowTruck);

})();
