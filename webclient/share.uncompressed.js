(function() {
  var Connection, Doc, MicroEvent, append, bootstrapTransform, checkValidComponent, checkValidOp, connections, exports, getConnection, invertComponent, io, nextTick, open, strInject, text, transformComponent, transformPosition, types;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, __slice = Array.prototype.slice;
  window.sharejs = exports = {
    'version': '0.4.1'
  };
  if (typeof WEB === 'undefined') {
    window.WEB = true;
  }
  nextTick = typeof WEB !== "undefined" && WEB !== null ? function(fn) {
    return setTimeout(fn, 0);
  } : nextTick = process['nextTick'];
  MicroEvent = (function() {
    function MicroEvent() {}
    MicroEvent.prototype.on = function(event, fct) {
      var _base;
      this._events || (this._events = {});
      (_base = this._events)[event] || (_base[event] = []);
      this._events[event].push(fct);
      return this;
    };
    MicroEvent.prototype.removeListener = function(event, fct) {
      var i, listeners, _base;
      this._events || (this._events = {});
      listeners = ((_base = this._events)[event] || (_base[event] = []));
      i = 0;
      while (i < listeners.length) {
        if (listeners[i] === fct) {
          listeners[i] = void 0;
        }
        i++;
      }
      nextTick(__bind(function() {
        var x;
        return this._events[event] = (function() {
          var _i, _len, _ref, _results;
          _ref = this._events[event];
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            x = _ref[_i];
            if (x) {
              _results.push(x);
            }
          }
          return _results;
        }).call(this);
      }, this));
      return this;
    };
    MicroEvent.prototype.emit = function() {
      var args, event, fn, _i, _len, _ref, _ref2;
      event = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      if (!((_ref = this._events) != null ? _ref[event] : void 0)) {
        return this;
      }
      _ref2 = this._events[event];
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        fn = _ref2[_i];
        if (fn) {
          fn.apply(this, args);
        }
      }
      return this;
    };
    return MicroEvent;
  })();
  MicroEvent.mixin = function(obj) {
    var proto;
    proto = obj.prototype || obj;
    proto.on = MicroEvent.prototype.on;
    proto.removeListener = MicroEvent.prototype.removeListener;
    proto.emit = MicroEvent.prototype.emit;
    return obj;
  };
  if (typeof module !== "undefined" && module !== null ? module.exports : void 0) {
    module.exports = MicroEvent;
  }
  exports['_bt'] = bootstrapTransform = function(type, transformComponent, checkValidOp, append) {
    var transformComponentX, transformX;
    transformComponentX = function(left, right, destLeft, destRight) {
      transformComponent(destLeft, left, right, 'left');
      return transformComponent(destRight, right, left, 'right');
    };
    type.transformX = type['transformX'] = transformX = function(leftOp, rightOp) {
      var k, l, l_, newLeftOp, newRightOp, nextC, r, r_, rightComponent, _i, _j, _k, _l, _len, _len2, _len3, _len4, _ref, _ref2;
      checkValidOp(leftOp);
      checkValidOp(rightOp);
      newRightOp = [];
      for (_i = 0, _len = rightOp.length; _i < _len; _i++) {
        rightComponent = rightOp[_i];
        newLeftOp = [];
        k = 0;
        while (k < leftOp.length) {
          nextC = [];
          transformComponentX(leftOp[k], rightComponent, newLeftOp, nextC);
          k++;
          if (nextC.length === 1) {
            rightComponent = nextC[0];
          } else if (nextC.length === 0) {
            _ref = leftOp.slice(k);
            for (_j = 0, _len2 = _ref.length; _j < _len2; _j++) {
              l = _ref[_j];
              append(newLeftOp, l);
            }
            rightComponent = null;
            break;
          } else {
            _ref2 = transformX(leftOp.slice(k), nextC), l_ = _ref2[0], r_ = _ref2[1];
            for (_k = 0, _len3 = l_.length; _k < _len3; _k++) {
              l = l_[_k];
              append(newLeftOp, l);
            }
            for (_l = 0, _len4 = r_.length; _l < _len4; _l++) {
              r = r_[_l];
              append(newRightOp, r);
            }
            rightComponent = null;
            break;
          }
        }
        if (rightComponent != null) {
          append(newRightOp, rightComponent);
        }
        leftOp = newLeftOp;
      }
      return [leftOp, newRightOp];
    };
    return type.transform = type['transform'] = function(op, otherOp, type) {
      var left, right, _, _ref, _ref2;
      if (!(type === 'left' || type === 'right')) {
        throw new Error("type must be 'left' or 'right'");
      }
      if (otherOp.length === 0) {
        return op;
      }
      if (op.length === 1 && otherOp.length === 1) {
        return transformComponent([], op[0], otherOp[0], type);
      }
      if (type === 'left') {
        _ref = transformX(op, otherOp), left = _ref[0], _ = _ref[1];
        return left;
      } else {
        _ref2 = transformX(otherOp, op), _ = _ref2[0], right = _ref2[1];
        return right;
      }
    };
  };
  if (typeof WEB === 'undefined') {
    exports.bootstrapTransform = bootstrapTransform;
  }
  text = {};
  text.name = 'text';
  text.create = text.create = function() {
    return '';
  };
  strInject = function(s1, pos, s2) {
    return s1.slice(0, pos) + s2 + s1.slice(pos);
  };
  checkValidComponent = function(c) {
    var d_type, i_type;
    if (typeof c.p !== 'number') {
      throw new Error('component missing position field');
    }
    i_type = typeof c.i;
    d_type = typeof c.d;
    if (!((i_type === 'string') ^ (d_type === 'string'))) {
      throw new Error('component needs an i or d field');
    }
    if (!(c.p >= 0)) {
      throw new Error('position cannot be negative');
    }
  };
  checkValidOp = function(op) {
    var c, _i, _len;
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      c = op[_i];
      checkValidComponent(c);
    }
    return true;
  };
  text.apply = function(snapshot, op) {
    var component, deleted, _i, _len;
    checkValidOp(op);
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      component = op[_i];
      if (component.i != null) {
        snapshot = strInject(snapshot, component.p, component.i);
      } else {
        deleted = snapshot.slice(component.p, component.p + component.d.length);
        if (component.d !== deleted) {
          throw new Error("Delete component '" + component.d + "' does not match deleted text '" + deleted + "'");
        }
        snapshot = snapshot.slice(0, component.p) + snapshot.slice(component.p + component.d.length);
      }
    }
    return snapshot;
  };
  text._append = append = function(newOp, c) {
    var last, _ref, _ref2;
    if (c.i === '' || c.d === '') {
      return;
    }
    if (newOp.length === 0) {
      return newOp.push(c);
    } else {
      last = newOp[newOp.length - 1];
      if ((last.i != null) && (c.i != null) && (last.p <= (_ref = c.p) && _ref <= (last.p + last.i.length))) {
        return newOp[newOp.length - 1] = {
          i: strInject(last.i, c.p - last.p, c.i),
          p: last.p
        };
      } else if ((last.d != null) && (c.d != null) && (c.p <= (_ref2 = last.p) && _ref2 <= (c.p + c.d.length))) {
        return newOp[newOp.length - 1] = {
          d: strInject(c.d, last.p - c.p, last.d),
          p: c.p
        };
      } else {
        return newOp.push(c);
      }
    }
  };
  text.compose = function(op1, op2) {
    var c, newOp, _i, _len;
    checkValidOp(op1);
    checkValidOp(op2);
    newOp = op1.slice();
    for (_i = 0, _len = op2.length; _i < _len; _i++) {
      c = op2[_i];
      append(newOp, c);
    }
    return newOp;
  };
  text.compress = function(op) {
    return text.compose([], op);
  };
  text.normalize = function(op) {
    var c, newOp, _i, _len, _ref;
    newOp = [];
    if ((op.i != null) || (op.p != null)) {
      op = [op];
    }
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      c = op[_i];
      if ((_ref = c.p) == null) {
        c.p = 0;
      }
      append(newOp, c);
    }
    return newOp;
  };
  transformPosition = function(pos, c, insertAfter) {
    if (c.i != null) {
      if (c.p < pos || (c.p === pos && insertAfter)) {
        return pos + c.i.length;
      } else {
        return pos;
      }
    } else {
      if (pos <= c.p) {
        return pos;
      } else if (pos <= c.p + c.d.length) {
        return c.p;
      } else {
        return pos - c.d.length;
      }
    }
  };
  text.transformCursor = function(position, op, insertAfter) {
    var c, _i, _len;
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      c = op[_i];
      position = transformPosition(position, c, insertAfter);
    }
    return position;
  };
  text._tc = transformComponent = function(dest, c, otherC, type) {
    var cIntersect, intersectEnd, intersectStart, newC, otherIntersect, s;
    checkValidOp([c]);
    checkValidOp([otherC]);
    if (c.i != null) {
      append(dest, {
        i: c.i,
        p: transformPosition(c.p, otherC, type === 'right')
      });
    } else {
      if (otherC.i != null) {
        s = c.d;
        if (c.p < otherC.p) {
          append(dest, {
            d: s.slice(0, otherC.p - c.p),
            p: c.p
          });
          s = s.slice(otherC.p - c.p);
        }
        if (s !== '') {
          append(dest, {
            d: s,
            p: c.p + otherC.i.length
          });
        }
      } else {
        if (c.p >= otherC.p + otherC.d.length) {
          append(dest, {
            d: c.d,
            p: c.p - otherC.d.length
          });
        } else if (c.p + c.d.length <= otherC.p) {
          append(dest, c);
        } else {
          newC = {
            d: '',
            p: c.p
          };
          if (c.p < otherC.p) {
            newC.d = c.d.slice(0, otherC.p - c.p);
          }
          if (c.p + c.d.length > otherC.p + otherC.d.length) {
            newC.d += c.d.slice(otherC.p + otherC.d.length - c.p);
          }
          intersectStart = Math.max(c.p, otherC.p);
          intersectEnd = Math.min(c.p + c.d.length, otherC.p + otherC.d.length);
          cIntersect = c.d.slice(intersectStart - c.p, intersectEnd - c.p);
          otherIntersect = otherC.d.slice(intersectStart - otherC.p, intersectEnd - otherC.p);
          if (cIntersect !== otherIntersect) {
            throw new Error('Delete ops delete different text in the same region of the document');
          }
          if (newC.d !== '') {
            newC.p = transformPosition(newC.p, otherC);
            append(dest, newC);
          }
        }
      }
    }
    return dest;
  };
  invertComponent = function(c) {
    if (c.i != null) {
      return {
        d: c.i,
        p: c.p
      };
    } else {
      return {
        i: c.d,
        p: c.p
      };
    }
  };
  text.invert = function(op) {
    var c, _i, _len, _ref, _results;
    _ref = op.slice().reverse();
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      c = _ref[_i];
      _results.push(invertComponent(c));
    }
    return _results;
  };
  if (typeof WEB !== "undefined" && WEB !== null) {
    exports.types || (exports.types = {});
    bootstrapTransform(text, transformComponent, checkValidOp, append);
    exports.types.text = text;
  } else {
    module.exports = text;
    require('./helpers').bootstrapTransform(text, transformComponent, checkValidOp, append);
  }
  if (typeof WEB === 'undefined') {
    text = require('./text');
  }
  text['api'] = {
    'provides': {
      'text': true
    },
    'getLength': function() {
      return this.snapshot.length;
    },
    'getText': function() {
      return this.snapshot;
    },
    'insert': function(text, pos, callback) {
      var op;
      if (pos == null) {
        pos = 0;
      }
      op = [
        {
          'p': pos,
          'i': text
        }
      ];
      this.submitOp(op, callback);
      return op;
    },
    'del': function(length, pos, callback) {
      var op;
      op = [
        {
          'p': pos,
          'd': this.snapshot.slice(pos, pos + length)
        }
      ];
      this.submitOp(op, callback);
      return op;
    },
    '_register': function() {
      return this.on('remoteop', function(op) {
        var component, _i, _len, _results;
        _results = [];
        for (_i = 0, _len = op.length; _i < _len; _i++) {
          component = op[_i];
          _results.push(component['i'] !== void 0 ? this.emit('insert', component['i'], component['p']) : this.emit('delete', component['d'], component['p']));
        }
        return _results;
      });
    }
  };
  if (typeof WEB !== "undefined" && WEB !== null) {
    types || (types = exports.types);
    if (!window.io) {
      throw new Error('Must load socket.io before this library');
    }
    io = window.io;
  } else {
    types = require('../types');
    io = require('socket.io-client');
    MicroEvent = require('./microevent');
  }
  /** @constructor */;
  Doc = function(connection, name, version, type, snapshot) {
    var inflightCallbacks, inflightOp, k, otApply, pendingCallbacks, pendingOp, serverOps, setSnapshot, tryFlushPendingOp, v, xf, _ref;
    this.name = name;
    this.version = version;
    this.type = type;
    if (this.type.compose == null) {
      throw new Error('Handling types without compose() defined is not currently implemented');
    }
    setSnapshot = __bind(function(s) {
      return this.snapshot = s;
    }, this);
    setSnapshot(snapshot);
    inflightOp = null;
    inflightCallbacks = [];
    pendingOp = null;
    pendingCallbacks = [];
    serverOps = {};
    xf = this.type.transformX || __bind(function(client, server) {
      var client_, server_;
      client_ = this.type.transform(client, server, 'left');
      server_ = this.type.transform(server, client, 'right');
      return [client_, server_];
    }, this);
    otApply = __bind(function(docOp, isRemote) {
      var oldSnapshot;
      oldSnapshot = this.snapshot;
      setSnapshot(this.type.apply(this.snapshot, docOp));
      if (isRemote) {
        this.emit('remoteop', docOp, oldSnapshot);
      }
      return this.emit('change', docOp, oldSnapshot);
    }, this);
    tryFlushPendingOp = __bind(function() {
      if (inflightOp === null && pendingOp !== null) {
        inflightOp = pendingOp;
        inflightCallbacks = pendingCallbacks;
        pendingOp = null;
        pendingCallbacks = [];
        return connection.send({
          'doc': this.name,
          'op': inflightOp,
          'v': this.version
        }, __bind(function(response, error) {
          var callback, oldInflightOp, undo, _i, _j, _len, _len2, _ref;
          oldInflightOp = inflightOp;
          inflightOp = null;
          if (error) {
            if (type.invert) {
              undo = this.type.invert(oldInflightOp);
              if (pendingOp) {
                _ref = xf(pendingOp, undo), pendingOp = _ref[0], undo = _ref[1];
              }
              otApply(undo, true);
            } else {
              throw new Error("Op apply failed (" + response.error + ") and the OT type does not define an invert function.");
            }
            for (_i = 0, _len = inflightCallbacks.length; _i < _len; _i++) {
              callback = inflightCallbacks[_i];
              callback(null, error);
            }
          } else {
            if (response.v !== this.version) {
              throw new Error('Invalid version from server');
            }
            serverOps[this.version] = oldInflightOp;
            this.version++;
            for (_j = 0, _len2 = inflightCallbacks.length; _j < _len2; _j++) {
              callback = inflightCallbacks[_j];
              callback(oldInflightOp, null);
            }
          }
          return tryFlushPendingOp();
        }, this));
      }
    }, this);
    this._onOpReceived = function(msg) {
      var docOp, op, _ref, _ref2;
      if (msg.v < this.version) {
        return;
      }
      if (msg.doc !== this.name) {
        throw new Error("Expected docName '" + this.name + "' but got " + msg.doc);
      }
      if (msg.v !== this.version) {
        throw new Error("Expected version " + this.version + " but got " + msg.v);
      }
      op = msg.op;
      serverOps[this.version] = op;
      docOp = op;
      if (inflightOp !== null) {
        _ref = xf(inflightOp, docOp), inflightOp = _ref[0], docOp = _ref[1];
      }
      if (pendingOp !== null) {
        _ref2 = xf(pendingOp, docOp), pendingOp = _ref2[0], docOp = _ref2[1];
      }
      this.version++;
      return otApply(docOp, true);
    };
    this.submitOp = function(op, callback) {
      if (this.type.normalize != null) {
        op = this.type.normalize(op);
      }
      setSnapshot(this.type.apply(this.snapshot, op));
      if (pendingOp !== null) {
        pendingOp = this.type.compose(pendingOp, op);
      } else {
        pendingOp = op;
      }
      if (callback) {
        pendingCallbacks.push(callback);
      }
      this.emit('change', op);
      return setTimeout(tryFlushPendingOp, 0);
    };
    this.flush = function() {
      return tryFlushPendingOp();
    };
    this.close = function(callback) {
      return connection.send({
        'doc': this.name,
        open: false
      }, __bind(function() {
        if (callback) {
          callback();
        }
        this.emit('closed');
      }, this));
    };
    if (this.type.api) {
      _ref = this.type.api;
      for (k in _ref) {
        v = _ref[k];
        this[k] = v;
      }
      if (typeof this._register === "function") {
        this._register();
      }
    } else {
      this.provides = {};
    }
    return this;
  };
  MicroEvent.mixin(Doc);
  Connection = (function() {
    function Connection(origin) {
      this.onMessage = __bind(this.onMessage, this);
      this.connected = __bind(this.connected, this);
      this.disconnected = __bind(this.disconnected, this);      this.docs = {};
      this.numDocs = 0;
      this.handlers = {};
      this.socket = io.connect(origin, {
        'force new connection': true
      });
      this.socket.on('connect', this.connected);
      this.socket.on('disconnect', this.disconnected);
      this.socket.on('message', this.onMessage);
      this.socket.on('connect_failed', __bind(function(error) {
        var callback, callbacks, docName, h, t, _ref, _results;
        if (error === 'unauthorized') {
          error = 'forbidden';
        }
        this.socket = null;
        this.emit('connect failed', error);
        _ref = this.handlers;
        _results = [];
        for (docName in _ref) {
          h = _ref[docName];
          _results.push((function() {
            var _results2;
            _results2 = [];
            for (t in h) {
              callbacks = h[t];
              _results2.push((function() {
                var _i, _len, _results3;
                _results3 = [];
                for (_i = 0, _len = callbacks.length; _i < _len; _i++) {
                  callback = callbacks[_i];
                  _results3.push(callback(null, error));
                }
                return _results3;
              })());
            }
            return _results2;
          })());
        }
        return _results;
      }, this));
      if (this.socket.socket.connected) {
        setTimeout((__bind(function() {
          return this.connected();
        }, this)), 0);
      }
    }
    Connection.prototype.disconnected = function() {
      return this.emit('disconnect');
    };
    Connection.prototype.connected = function() {
      return this.emit('connect');
    };
    Connection.prototype.send = function(msg, callback) {
      var callbacks, docHandlers, docName, type, _base;
      if (this.socket === null) {
        throw new Error('Cannot send messages to a closed connection');
      }
      docName = msg.doc;
      if (docName === this.lastSentDoc) {
        delete msg.doc;
      } else {
        this.lastSentDoc = docName;
      }
      this.socket.json.send(msg);
      if (callback) {
        type = msg.open === true ? 'open' : msg.open === false ? 'close' : msg.create ? 'create' : msg.snapshot === null ? 'snapshot' : msg.op ? 'op response' : void 0;
        docHandlers = ((_base = this.handlers)[docName] || (_base[docName] = {}));
        callbacks = (docHandlers[type] || (docHandlers[type] = []));
        return callbacks.push(callback);
      }
    };
    Connection.prototype.onMessage = function(msg) {
      var c, callbacks, doc, docName, type, _i, _len, _ref;
      docName = msg.doc;
      if (docName !== void 0) {
        this.lastReceivedDoc = docName;
      } else {
        msg.doc = docName = this.lastReceivedDoc;
      }
      this.emit('message', msg);
      type = msg.open === true || (msg.open === false && msg.error) ? 'open' : msg.open === false ? 'close' : msg.snapshot !== void 0 ? 'snapshot' : msg.create ? 'create' : msg.op ? 'op' : msg.v !== void 0 ? 'op response' : void 0;
      callbacks = (_ref = this.handlers[docName]) != null ? _ref[type] : void 0;
      if (callbacks) {
        delete this.handlers[docName][type];
        for (_i = 0, _len = callbacks.length; _i < _len; _i++) {
          c = callbacks[_i];
          c(msg, msg.error);
        }
      }
      if (type === 'op') {
        doc = this.docs[docName];
        if (doc) {
          return doc._onOpReceived(msg);
        }
      }
    };
    Connection.prototype.makeDoc = function(params) {
      var doc, name, type;
      name = params.doc;
      if (this.docs[name]) {
        throw new Error("Doc " + name + " already open");
      }
      type = params.type;
      if (typeof type === 'string') {
        type = types[type];
      }
      doc = new Doc(this, name, params.v, type, params.snapshot);
      doc.created = !!params.create;
      this.docs[name] = doc;
      this.numDocs++;
      doc.on('closed', __bind(function() {
        delete this.docs[name];
        return this.numDocs--;
      }, this));
      return doc;
    };
    Connection.prototype['openExisting'] = function(docName, callback) {
      if (this.socket === null) {
        callback(null, 'connection closed');
        return;
      }
      if (this.docs[docName] != null) {
        return this.docs[docName];
      }
      return this.send({
        'doc': docName,
        'open': true,
        'snapshot': null
      }, __bind(function(response, error) {
        if (error) {
          return callback(null, error);
        } else {
          return callback(this.makeDoc(response));
        }
      }, this));
    };
    Connection.prototype.open = function(docName, type, callback) {
      var doc;
      if (this.socket === null) {
        callback(null, 'connection closed');
        return;
      }
      if (typeof type === 'function') {
        callback = type;
        type = 'text';
      }
      callback || (callback = function() {});
      if (typeof type === 'string') {
        type = types[type];
      }
      if (!type) {
        throw new Error("OT code for document type missing");
      }
      if ((docName != null) && (this.docs[docName] != null)) {
        doc = this.docs[docName];
        if (doc.type === type) {
          callback(doc);
        } else {
          callback(doc, 'Type mismatch');
        }
        return;
      }
      return this.send({
        'doc': docName,
        'open': true,
        'create': true,
        'snapshot': null,
        'type': type.name
      }, __bind(function(response, error) {
        if (error) {
          return callback(null, error);
        } else {
          if (response.snapshot === void 0) {
            response.snapshot = type.create();
          }
          response.type = type;
          return callback(this.makeDoc(response));
        }
      }, this));
    };
    Connection.prototype.create = function(type, callback) {
      return open(null, type, callback);
    };
    Connection.prototype.disconnect = function() {
      if (this.socket) {
        this.emit('disconnected');
        this.socket.disconnect();
        return this.socket = null;
      }
    };
    return Connection;
  })();
  MicroEvent.mixin(Connection);
  connections = {};
  getConnection = function(origin) {
    var c, location;
    if (typeof WEB !== "undefined" && WEB !== null) {
      location = window.location;
      if (origin == null) {
        origin = "" + location.protocol + "//" + location.hostname + "/sjs";
      }
    }
    if (!connections[origin]) {
      c = new Connection(origin);
      c.on('disconnected', function() {
        return delete connections[origin];
      });
      c.on('connect failed', function() {
        return delete connections[origin];
      });
      connections[origin] = c;
    }
    return connections[origin];
  };
  open = function(docName, type, origin, callback) {
    var c;
    if (typeof origin === 'function') {
      callback = origin;
      origin = null;
    }
    c = getConnection(origin);
    c.open(docName, type, function(doc, error) {
      if (doc === null) {
        if (c.numDocs === 0) {
          c.disconnect();
        }
        return callback(null, error);
      } else {
        doc.on('closed', function() {
          return setTimeout(function() {
            if (c.numDocs === 0) {
              return c.disconnect();
            }
          }, 0);
        });
        return callback(doc);
      }
    });
    return c.on('connect failed');
  };
  exports.Connection = Connection;
  exports.Doc = Doc;
  exports.open = open;
}).call(this);
