(function() {
  
/** @preserve ShareJS v0.1.1
http://sharejs.org

Copyright 2011 Joseph Gentle

BSD licensed:
https://github.com/josephg/ShareJS/raw/master/LICENSE
*/
;  var Connection, Document, MicroEvent, WEB, append, bootstrapTransform, checkValidComponent, checkValidOp, compose, compress, connections, exports, getConnection, invertComponent, io, open, strInject, text, transformComponent, transformPosition, types;
  var __slice = Array.prototype.slice, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  exports = {};
  /**
   @const
   @type {boolean}
*/;
  WEB = true;
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
      var idx, _ref;
      this._events || (this._events = {});
      idx = (_ref = this._events[event]) != null ? _ref.indexOf(fct) : void 0;
      if ((idx != null) && idx >= 0) {
        this._events[event].splice(idx, 1);
      }
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
        fn.apply(this, args);
      }
      return this;
    };
    return MicroEvent;
  })();
  MicroEvent.mixin = function(obj) {
    var proto;
    proto = obj.prototype || obj;
    proto.on = proto['on'] = MicroEvent.prototype.on;
    proto.removeListener = proto['removeListener'] = MicroEvent.prototype.removeListener;
    proto.emit = MicroEvent.prototype.emit;
    return obj;
  };
  if (typeof module !== "undefined" && module !== null ? module.exports : void 0) {
    module.exports = MicroEvent;
  }
  bootstrapTransform = function(type, transformComponent, checkValidOp, append) {
    var transformComponentX, transformX;
    transformComponentX = function(server, client, destServer, destClient) {
      transformComponent(destServer, server, client, 'server');
      return transformComponent(destClient, client, server, 'client');
    };
    type.transformX = transformX = function(serverOp, clientOp) {
      var c, c_, clientComponent, k, newClientOp, newServerOp, nextC, s, s_, _i, _j, _k, _l, _len, _len2, _len3, _len4, _ref, _ref2;
      checkValidOp(serverOp);
      checkValidOp(clientOp);
      newClientOp = [];
      for (_i = 0, _len = clientOp.length; _i < _len; _i++) {
        clientComponent = clientOp[_i];
        newServerOp = [];
        k = 0;
        while (k < serverOp.length) {
          nextC = [];
          transformComponentX(serverOp[k], clientComponent, newServerOp, nextC);
          k++;
          if (nextC.length === 1) {
            clientComponent = nextC[0];
          } else if (nextC.length === 0) {
            _ref = serverOp.slice(k);
            for (_j = 0, _len2 = _ref.length; _j < _len2; _j++) {
              s = _ref[_j];
              append(newServerOp, s);
            }
            clientComponent = null;
            break;
          } else {
            _ref2 = transformX(serverOp.slice(k), nextC), s_ = _ref2[0], c_ = _ref2[1];
            for (_k = 0, _len3 = s_.length; _k < _len3; _k++) {
              s = s_[_k];
              append(newServerOp, s);
            }
            for (_l = 0, _len4 = c_.length; _l < _len4; _l++) {
              c = c_[_l];
              append(newClientOp, c);
            }
            clientComponent = null;
            break;
          }
        }
        if (clientComponent != null) {
          append(newClientOp, clientComponent);
        }
        serverOp = newServerOp;
      }
      return [serverOp, newClientOp];
    };
    return type.transform = function(op, otherOp, type) {
      var client, server, _, _ref, _ref2;
      if (!(type === 'server' || type === 'client')) {
        throw new Error("type must be 'server' or 'client'");
      }
      if (otherOp.length === 0) {
        return op;
      }
      if (op.length === 1 && otherOp.length === 1) {
        return transformComponent([], op[0], otherOp[0], type);
      }
      if (type === 'server') {
        _ref = transformX(op, otherOp), server = _ref[0], _ = _ref[1];
        return server;
      } else {
        _ref2 = transformX(otherOp, op), _ = _ref2[0], client = _ref2[1];
        return client;
      }
    };
  };
  if (WEB == null) {
    exports.bootstrapTransform = bootstrapTransform;
  }
  text = {};
  text.name = 'text';
  text.initialVersion = function() {
    return '';
  };
  strInject = function(s1, pos, s2) {
    return s1.slice(0, pos) + s2 + s1.slice(pos);
  };
  checkValidComponent = function(c) {
    var d_type, i_type;
    if (typeof c['p'] !== 'number') {
      throw new Error('component missing position field');
    }
    i_type = typeof c['i'];
    d_type = typeof c['d'];
    if (!((i_type === 'string') ^ (d_type === 'string'))) {
      throw new Error('component needs an i or d field');
    }
    if (!(c['p'] >= 0)) {
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
      if (component['i'] != null) {
        snapshot = strInject(snapshot, component['p'], component['i']);
      } else {
        deleted = snapshot.slice(component['p'], component['p'] + component['d'].length);
        if (component['d'] !== deleted) {
          throw new Error("Delete component '" + component['d'] + "' does not match deleted text '" + deleted + "'");
        }
        snapshot = snapshot.slice(0, component['p']) + snapshot.slice(component['p'] + component['d'].length);
      }
    }
    return snapshot;
  };
  text._append = append = function(newOp, c) {
    var last, _ref, _ref2;
    if (c['i'] === '' || c['d'] === '') {
      return;
    }
    if (newOp.length === 0) {
      return newOp.push(c);
    } else {
      last = newOp[newOp.length - 1];
      if ((last['i'] != null) && (c['i'] != null) && (last['p'] <= (_ref = c['p']) && _ref <= (last['p'] + last['i'].length))) {
        return newOp[newOp.length - 1] = {
          'i': strInject(last['i'], c['p'] - last['p'], c['i']),
          'p': last['p']
        };
      } else if ((last['d'] != null) && (c['d'] != null) && (c['p'] <= (_ref2 = last['p']) && _ref2 <= (c['p'] + c['d'].length))) {
        return newOp[newOp.length - 1] = {
          'd': strInject(c['d'], last['p'] - c['p'], last['d']),
          'p': c['p']
        };
      } else {
        return newOp.push(c);
      }
    }
  };
  text.compose = compose = function(op1, op2) {
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
  text.compress = compress = function(op) {
    return compose([], op);
  };
  text.normalize = function(op) {
    var c, newOp, _i, _len, _ref;
    newOp = [];
    if ((op['i'] != null) || (op['p'] != null)) {
      op = [op];
    }
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      c = op[_i];
            if ((_ref = c['p']) != null) {
        _ref;
      } else {
        c['p'] = 0;
      };
      append(newOp, c);
    }
    return newOp;
  };
  transformPosition = function(pos, c, insertAfter) {
    if (c['i'] != null) {
      if (c['p'] < pos || (c['p'] === pos && insertAfter)) {
        return pos + c['i'].length;
      } else {
        return pos;
      }
    } else {
      if (pos <= c['p']) {
        return pos;
      } else if (pos <= c['p'] + c['d'].length) {
        return c['p'];
      } else {
        return pos - c['d'].length;
      }
    }
  };
  text['transformCursor'] = function(position, op, insertAfter) {
    var c, _i, _len;
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      c = op[_i];
      position = transformPosition(position, c, insertAfter);
    }
    return position;
  };
  transformComponent = function(dest, c, otherC, type) {
    var cIntersect, intersectEnd, intersectStart, newC, otherIntersect, s;
    checkValidOp([c]);
    checkValidOp([otherC]);
    if (c['i'] != null) {
      append(dest, {
        'i': c['i'],
        'p': transformPosition(c['p'], otherC, type === 'server')
      });
    } else {
      if (otherC['i'] != null) {
        s = c['d'];
        if (c['p'] < otherC['p']) {
          append(dest, {
            'd': s.slice(0, otherC['p'] - c['p']),
            'p': c['p']
          });
          s = s.slice(otherC['p'] - c['p']);
        }
        if (s !== '') {
          append(dest, {
            'd': s,
            'p': c['p'] + otherC['i'].length
          });
        }
      } else {
        if (c['p'] >= otherC['p'] + otherC['d'].length) {
          append(dest, {
            'd': c['d'],
            'p': c['p'] - otherC['d'].length
          });
        } else if (c['p'] + c['d'].length <= otherC['p']) {
          append(dest, c);
        } else {
          newC = {
            'd': '',
            'p': c['p']
          };
          if (c['p'] < otherC['p']) {
            newC['d'] = c['d'].slice(0, otherC['p'] - c['p']);
          }
          if (c['p'] + c['d'].length > otherC['p'] + otherC['d'].length) {
            newC['d'] += c['d'].slice(otherC['p'] + otherC['d'].length - c['p']);
          }
          intersectStart = Math.max(c['p'], otherC['p']);
          intersectEnd = Math.min(c['p'] + c['d'].length, otherC['p'] + otherC['d'].length);
          cIntersect = c['d'].slice(intersectStart - c['p'], intersectEnd - c['p']);
          otherIntersect = otherC['d'].slice(intersectStart - otherC['p'], intersectEnd - otherC['p']);
          if (cIntersect !== otherIntersect) {
            throw new Error('Delete ops delete different text in the same region of the document');
          }
          if (newC['d'] !== '') {
            newC['p'] = transformPosition(newC['p'], otherC);
            append(dest, newC);
          }
        }
      }
    }
    return dest;
  };
  invertComponent = function(c) {
    if (c['i'] != null) {
      return {
        'd': c['i'],
        'p': c['p']
      };
    } else {
      return {
        'i': c['d'],
        'p': c['p']
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
  if (WEB != null) {
    exports.types || (exports.types = {});
    bootstrapTransform(text, transformComponent, checkValidOp, append);
    exports.types['text'] = text;
  } else {
    module.exports = text;
    require('./helpers').bootstrapTransform(text, transformComponent, checkValidOp, append);
  }
  if (WEB != null) {
    types || (types = exports.types);
    if (!window['io']) {
      throw new Error('Must load socket.io before this library');
    }
    io = window['io'];
  } else {
    types = require('../types');
    io = require('../../thirdparty/Socket.io-node-client').io;
    MicroEvent = require('./microevent');
  }
  Document = (function() {
    function Document(connection, name, version, type, snapshot) {
      this.connection = connection;
      this.name = name;
      this.version = version;
      this.type = type;
      this.onOpReceived = __bind(this.onOpReceived, this);
      this.tryFlushPendingOp = __bind(this.tryFlushPendingOp, this);
      if (this.type.compose == null) {
        throw new Error('Handling types without compose() defined is not currently implemented');
      }
      this['snapshot'] = snapshot;
      this.inflightOp = null;
      this.inflightCallbacks = [];
      this.pendingOp = null;
      this.pendingCallbacks = [];
      this.serverOps = {};
      this.listeners = [];
    }
    Document.prototype.tryFlushPendingOp = function() {
      if (this.inflightOp === null && this.pendingOp !== null) {
        this.inflightOp = this.pendingOp;
        this.inflightCallbacks = this.pendingCallbacks;
        this.pendingOp = null;
        this.pendingCallbacks = [];
        return this.connection.send({
          'doc': this.name,
          'op': this.inflightOp,
          'v': this.version
        }, __bind(function(response) {
          var callback, _i, _j, _len, _len2, _ref, _ref2;
          if (response['v'] === null) {
            _ref = this.inflightCallbacks;
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              callback = _ref[_i];
              callback(null);
            }
            this.inflightOp = null;
            throw new Error(response['error']);
          }
          if (response['v'] !== this.version) {
            throw new Error('Invalid version from server');
          }
          this.serverOps[this.version] = this.inflightOp;
          this.version++;
          _ref2 = this.inflightCallbacks;
          for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
            callback = _ref2[_j];
            callback(this.inflightOp, null);
          }
          this.inflightOp = null;
          return this.tryFlushPendingOp();
        }, this));
      }
    };
    Document.prototype.onOpReceived = function(msg) {
      var docOp, op, xf, _ref, _ref2;
      if (msg['v'] < this.version) {
        return;
      }
      if (msg['doc'] !== this.name) {
        throw new Error("Expected docName " + this.name + " but got " + msg['doc']);
      }
      if (msg['v'] !== this.version) {
        throw new Error("Expected version " + this.version + " but got " + msg['v']);
      }
      op = msg['op'];
      this.serverOps[this.version] = op;
      xf = this.type.transformX || __bind(function(server, client) {
        var client_, server_;
        server_ = this.type.transform(server, client, 'server');
        client_ = this.type.transform(client, server, 'client');
        return [server_, client_];
      }, this);
      docOp = op;
      if (this.inflightOp !== null) {
        _ref = xf(docOp, this.inflightOp), docOp = _ref[0], this.inflightOp = _ref[1];
      }
      if (this.pendingOp !== null) {
        _ref2 = xf(docOp, this.pendingOp), docOp = _ref2[0], this.pendingOp = _ref2[1];
      }
      this['snapshot'] = this.type.apply(this['snapshot'], docOp);
      this.version++;
      this.emit('remoteop', docOp);
      return this.emit('change', docOp);
    };
    Document.prototype.submitOp = function(op, v, callback) {
      var realOp, _ref;
      if (v == null) {
        v = this.version;
      }
      if (typeof v === 'function') {
        callback = v;
        v = this.version;
      }
      if (((_ref = this.type) != null ? _ref.normalize : void 0) != null) {
        op = this.type.normalize(op);
      }
      while (v < this.version) {
        realOp = this.recentOps[v];
        if (!realOp) {
          throw new Error('Op version too old');
        }
        op = this.type.transform(op, realOp, 'client');
        v++;
      }
      this['snapshot'] = this.type.apply(this['snapshot'], op);
      if (this.pendingOp !== null) {
        this.pendingOp = this.type.compose(this.pendingOp, op);
      } else {
        this.pendingOp = op;
      }
      if (callback) {
        this.pendingCallbacks.push(callback);
      }
      this.emit('change', op);
      return setTimeout(this.tryFlushPendingOp, 0);
    };
    Document.prototype.close = function(callback) {
      return this.connection.send({
        'doc': this.name,
        open: false
      }, __bind(function() {
        if (callback) {
          callback();
        }
        this.emit('closed');
      }, this));
    };
    return Document;
  })();
  MicroEvent.mixin(Document);
  Document.prototype['submitOp'] = Document.prototype.submitOp;
  Document.prototype['close'] = Document.prototype.close;
  Connection = (function() {
    function Connection(host, port, basePath) {
      this.onMessage = __bind(this.onMessage, this);
      this.connected = __bind(this.connected, this);
      this.disconnected = __bind(this.disconnected, this);      var resource;
      resource = basePath ? path + '/socket.io' : 'socket.io';
      this.socket = new io['Socket'](host, {
        port: port,
        resource: resource
      });
      this.socket['on']('connect', this.connected);
      this.socket['on']('disconnect', this.disconnected);
      this.socket['on']('message', this.onMessage);
      this.socket['connect']();
      this.lastReceivedDoc = null;
      this.lastSentDoc = null;
      this.docs = {};
      this.numDocs = 0;
    }
    Connection.prototype.disconnected = function() {
      return this.emit('disconnect');
    };
    Connection.prototype.connected = function() {
      return this.emit('connect');
    };
    Connection.prototype.send = function(msg, callback) {
      var docName, register;
      docName = msg['doc'];
      if (docName === this.lastSentDoc) {
        delete msg['doc'];
      } else {
        this.lastSentDoc = docName;
      }
      this.socket['send'](msg);
      if (callback) {
        register = __bind(function(type) {
          var cb;
          cb = __bind(function(response) {
            if (response['doc'] === docName) {
              this.removeListener(type, cb);
              return callback(response);
            }
          }, this);
          return this.on(type, cb);
        }, this);
        return register((msg['open'] === true ? 'open' : msg['open'] === false ? 'close' : msg['create'] ? 'create' : msg['snapshot'] === null ? 'snapshot' : msg['op'] ? 'op response' : void 0));
      }
    };
    Connection.prototype.onMessage = function(msg) {
      var doc, docName, type;
      docName = msg['doc'];
      if (docName !== void 0) {
        this.lastReceivedDoc = docName;
      } else {
        msg['doc'] = docName = this.lastReceivedDoc;
      }
      this.emit('message', msg);
      type = msg['open'] === true || (msg['open'] === false && msg['error']) ? 'open' : msg['open'] === false ? 'close' : msg['snapshot'] !== void 0 ? 'snapshot' : msg['create'] ? 'create' : msg['op'] ? 'op' : msg['v'] !== void 0 ? 'op response' : void 0;
      this.emit(type, msg);
      if (type === 'op') {
        doc = this.docs[docName];
        if (doc) {
          return doc.onOpReceived(msg);
        }
      }
    };
    Connection.prototype.makeDoc = function(params) {
      var doc, name, type;
      name = params['doc'];
      if (this.docs[name]) {
        throw new Error("Document " + name + " already followed");
      }
      type = params['type'];
      if (typeof type === 'string') {
        type = types[type];
      }
      doc = new Document(this, name, params['v'], type, params['snapshot']);
      doc['created'] = !!params['create'];
      this.docs[name] = doc;
      this.numDocs++;
      doc.on('closed', __bind(function() {
        delete this.docs[name];
        return this.numDocs--;
      }, this));
      return doc;
    };
    Connection.prototype['openExisting'] = function(docName, callback) {
      if (this.docs[docName] != null) {
        return this.docs[docName];
      }
      return this.send({
        'doc': docName,
        'open': true,
        'snapshot': null
      }, __bind(function(response) {
        if (response.error) {
          return callback(null, new Error(response.error));
        } else {
          return callback(this.makeDoc(response));
        }
      }, this));
    };
    Connection.prototype['open'] = function(docName, type, callback) {
      var doc;
      if (typeof type === 'function') {
        callback = type;
        type = 'text';
      }
      callback || (callback = function() {});
      if (typeof type === 'string') {
        type = types[type];
      }
      if (this.docs[docName] != null) {
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
      }, __bind(function(response) {
        if (response.error) {
          return callback(null, new Error(response.error));
        } else {
          if (response['snapshot'] === void 0) {
            response['snapshot'] = type.initialVersion();
          }
          response['type'] = type;
          return callback(this.makeDoc(response));
        }
      }, this));
    };
    Connection.prototype['create'] = function(type, callback) {
      return open(null, type, callback);
    };
    Connection.prototype['disconnect'] = function() {
      if (this.stream != null) {
        this.emit('disconnected');
        this.stream.disconnect();
        return this.stream = null;
      }
    };
    return Connection;
  })();
  MicroEvent.mixin(Connection);
  connections = {};
  getConnection = function(host, port, basePath) {
    var address, c;
    if (WEB != null) {
            if (host != null) {
        host;
      } else {
        host = window.location.hostname;
      };
            if (port != null) {
        port;
      } else {
        port = window.location.port;
      };
    }
    address = host;
    if (port != null) {
      address += ":" + port;
    }
    if (!connections[address]) {
      c = new Connection(host, port, basePath);
      c.on('disconnected', function() {
        return delete connections[address];
      });
      connections[address] = c;
    }
    return connections[address];
  };
  open = function(docName, type, options, callback) {
    var c;
    if (typeof options === 'function') {
      callback = options;
      options = null;
    }
        if (options != null) {
      options;
    } else {
      options = {};
    };
    c = getConnection(options.host, options.port, options.basePath);
    return c.open(docName, type, function(doc) {
      doc.on('closed', function() {
        return setTimeout(function() {
          if (c.numDocs === 0) {
            return c.disconnect();
          }
        }, 0);
      });
      return callback(doc);
    });
  };
  if (WEB != null) {
    exports['Connection'] = Connection;
    exports['Document'] = Document;
    exports['open'] = open;
    window['sharejs'] = exports;
  } else {
    exports.Connection = Connection;
    exports.open = open;
  }
}).call(this);
