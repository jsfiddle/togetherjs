/**
 * MicroEvent - to make any js object an event emitter (server or browser)
 *
 * - pure javascript - server compatible, browser compatible
 * - dont rely on the browser doms
 * - super simple - you get it immediatly, no mistery, no magic involved
 *
 * - create a MicroEventDebug with goodies to debug
 *   - make it safer to use
*/

var MicroEvent	= function(){};
MicroEvent.prototype	= {
	subscribe	: function(event, fct){
		this._events = this._events || {};
		this._events[event] = this._events[event]	|| [];
		this._events[event].push(fct);
		return this;
	},
	unsubscribe	: function(event, fct){
		this._events = this._events || {};
		if( event in this._events === false  )	return this;
		this._events[event].splice(this._events[event].indexOf(fct), 1);
		return this;
	},
	publish	: function(event /* , args... */){
		this._events = this._events || {};
		if( event in this._events === false  )	return this;
		for(var i = 0; i < this._events[event].length; i++){
			this._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
		}
		return this;
	}
};

/**
 * mixin will delegate all MicroEvent.js function in the destination object
 *
 * - require('MicroEvent').mixin(Foobar) will make Foobar able to use MicroEvent
 *
 * @param {Object} the object which will support MicroEvent
*/
MicroEvent.mixin	= function(destObject){
	var props	= ['subscribe', 'unsubscribe', 'publish'];
	for(var i = 0; i < props.length; i ++){
		destObject.prototype[props[i]]	= MicroEvent.prototype[props[i]];
	}
};

// export in common js
if( typeof module !== "undefined" && ('exports' in module)){
	module.exports	= MicroEvent;
}
(function() {
  var Connection, Document, MicroEvent, OpStream, append, checkValidComponent, checkValidOp, compose, compress, connections, getConnection, i, inject, invertComponent, io, open, p, transformComponent, transformComponentX, transformPosition, transformX, types, _base;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  typeof exports != "undefined" && exports !== null ? exports : exports = {};
  exports.name = 'text';
  exports.initialVersion = function() {
    return '';
  };
  inject = function(s1, pos, s2) {
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
  exports.apply = function(snapshot, op) {
    var component, deleted, _i, _len;
    checkValidOp(op);
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      component = op[_i];
      if (component.i != null) {
        snapshot = inject(snapshot, component.p, component.i);
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
  exports._append = append = function(newOp, c) {
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
          i: inject(last.i, c.p - last.p, c.i),
          p: last.p
        };
      } else if ((last.d != null) && (c.d != null) && (c.p <= (_ref2 = last.p) && _ref2 <= (c.p + c.d.length))) {
        return newOp[newOp.length - 1] = {
          d: inject(c.d, last.p - c.p, last.d),
          p: c.p
        };
      } else {
        return newOp.push(c);
      }
    }
  };
  exports.compose = compose = function(op1, op2) {
    var c, newOp, _i, _len;
    checkValidOp(op1);
    checkValidOp(op2);
    newOp = op1.slice();
    for (_i = 0, _len = op2.length; _i < _len; _i++) {
      c = op2[_i];
      append(newOp, c);
    }
    checkValidOp(newOp);
    return newOp;
  };
  exports.compress = compress = function(op) {
    return compose([], op);
  };
  exports.normalize = function(op) {
    var c, newOp, _i, _len, _ref;
    newOp = [];
    if ((op.i != null) || (op.p != null)) {
      op = [op];
    }
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      c = op[_i];
      (_ref = c.p) != null ? _ref : c.p = 0;
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
  exports.transformCursor = function(position, op, insertAfter) {
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
    if (c.i != null) {
      return append(dest, {
        i: c.i,
        p: transformPosition(c.p, otherC, type === 'server')
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
          return append(dest, {
            d: s,
            p: c.p + otherC.i.length
          });
        }
      } else {
        if (c.p >= otherC.p + otherC.d.length) {
          return append(dest, {
            d: c.d,
            p: c.p - otherC.d.length
          });
        } else if (c.p + c.d.length <= otherC.p) {
          return append(dest, c);
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
            return append(dest, newC);
          }
        }
      }
    }
  };
  transformComponentX = function(server, client, destServer, destClient) {
    transformComponent(destServer, server, client, 'server');
    return transformComponent(destClient, client, server, 'client');
  };
  exports.transformX = transformX = function(serverOp, clientOp) {
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
  exports.transform = function(op, otherOp, type) {
    var client, server, _, _ref, _ref2;
    if (!(type === 'server' || type === 'client')) {
      throw new Error("type must be 'server' or 'client'");
    }
    if (type === 'server') {
      _ref = transformX(op, otherOp), server = _ref[0], _ = _ref[1];
      return server;
    } else {
      _ref2 = transformX(otherOp, op), _ = _ref2[0], client = _ref2[1];
      return client;
    }
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
  exports.invert = function(op) {
    var c, _i, _len, _ref, _results;
    _ref = op.slice().reverse();
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      c = _ref[_i];
      _results.push(invertComponent(c));
    }
    return _results;
  };
  if (typeof window != "undefined" && window !== null) {
    window.sharejs || (window.sharejs = {});
    (_base = window.sharejs).types || (_base.types = {});
    window.sharejs.types.text = exports;
  }
  if (typeof window != "undefined" && window !== null) {
    if (window.io == null) {
      throw new Error('Must load socket.io before this library');
    }
    io = window.io;
  } else {
    io = require('../../thirdparty/Socket.io-node-client').io;
  }
  p = function() {};
  OpStream = (function() {
    function OpStream(hostname, port, path) {
      var resource;
      this.hostname = hostname;
      this.port = port;
      this.onMessage = __bind(this.onMessage, this);;
      resource = path ? path + '/socket.io' : 'socket.io';
      this.socket = new io.Socket(this.hostname, {
        port: this.port,
        resource: resource
      });
      this.socket.on('connect', this.onConnect);
      this.socket.on('message', this.onMessage);
      this.socket.connect();
      this.callbacks = {};
      this.lastReceivedDoc = null;
      this.lastSentDoc = null;
    }
    OpStream.prototype.onConnect = function() {
      return p('connected');
    };
    OpStream.prototype.on = function(docName, type, callback) {
      var _base;
      (_base = this.callbacks)[docName] || (_base[docName] = {});
      if (this.callbacks[docName][type] != null) {
        throw new Error("Callback already exists for " + docName + ", " + type);
      }
      return this.callbacks[docName][type] = callback;
    };
    OpStream.prototype.removeListener = function(docName, type, listener) {
      var _ref;
      return (_ref = this.callbacks[docName]) != null ? delete _ref[type] : void 0;
    };
    OpStream.prototype.onMessage = function(data) {
      var emit;
      p('message');
      p(data);
      if (data.doc != null) {
        this.lastReceivedDoc = data.doc;
      } else {
        data.doc = this.lastReceivedDoc;
      }
      emit = __bind(function(type, clear) {
        var callback, _ref;
        p("emit " + data.doc + " " + type);
        callback = (_ref = this.callbacks[data.doc]) != null ? _ref[type] : void 0;
        if (callback != null) {
          if (clear) {
            this.callbacks[data.doc][type] = null;
          }
          return callback(data);
        }
      }, this);
      if (data.snapshot !== void 0) {
        return emit('snapshot', true);
      } else if (data.follow != null) {
        if (data.follow) {
          return emit('follow', true);
        } else {
          return emit('unfollow', true);
        }
      } else if (data.v !== void 0) {
        if (data.op != null) {
          return emit('op', false);
        } else {
          return emit('localop', true);
        }
      }
    };
    OpStream.prototype.send = function(msg) {
      if (msg.doc === this.lastSentDoc) {
        delete msg.doc;
      } else {
        this.lastSentDoc = msg.doc;
      }
      return this.socket.send(msg);
    };
    OpStream.prototype.follow = function(docName, v, callback) {
      var request;
      p("follow " + docName);
      request = {
        doc: docName,
        follow: true
      };
      if (v != null) {
        request.v = v;
      }
      this.send(request);
      return this.on(docName, 'follow', callback);
    };
    OpStream.prototype.get = function(docName, callback) {
      p("get " + docName);
      this.send({
        doc: docName,
        snapshot: null
      });
      return this.on(docName, 'snapshot', callback);
    };
    OpStream.prototype.submit = function(docName, op, version, callback) {
      p("submit");
      this.send({
        doc: docName,
        v: version,
        op: op
      });
      return this.on(docName, 'localop', callback);
    };
    OpStream.prototype.unfollow = function(docName, callback) {
      p("unfollow " + docName);
      this.send({
        doc: docName,
        follow: false
      });
      return this.on(docName, 'unfollow', callback);
    };
    OpStream.prototype.disconnect = function() {
      this.socket.disconnect();
      return this.socket = null;
    };
    return OpStream;
  })();
  if (typeof window != "undefined" && window !== null) {
    window.sharejs || (window.sharejs = {});
    window.sharejs.OpStream = OpStream;
  } else {
    exports.OpStream = OpStream;
  }
  OpStream = (typeof window != "undefined" && window !== null ? window.sharejs.OpStream : void 0) || require('./opstream').OpStream;
  types = (typeof window != "undefined" && window !== null ? window.sharejs.types : void 0) || require('../types');
  MicroEvent = (typeof window != "undefined" && window !== null ? window.MicroEvent : void 0) || require('../../thirdparty/microevent.js/microevent');
  exports || (exports = {});
  p = function() {};
  i = function() {};
  Document = (function() {
    function Document(stream, name, version, type, snapshot) {
      this.stream = stream;
      this.name = name;
      this.version = version;
      this.type = type;
      this.snapshot = snapshot;
      this.onOpReceived = __bind(this.onOpReceived, this);;
      this.tryFlushPendingOp = __bind(this.tryFlushPendingOp, this);;
      if (this.type.compose == null) {
        throw new Error('Handling types without compose() defined is not currently implemented');
      }
      this.inflightOp = null;
      this.inflightCallbacks = [];
      this.pendingOp = null;
      this.pendingCallbacks = [];
      this.serverOps = {};
      this.listeners = [];
      this.created = false;
      this.follow();
    }
    Document.prototype.follow = function(callback) {
      this.stream.on(this.name, 'op', this.onOpReceived);
      return this.stream.follow(this.name, this.version, __bind(function(msg) {
        if (msg.v !== this.version) {
          throw new Error("Expected version " + this.version + " but got " + msg.v);
        }
        if (callback != null) {
          return callback();
        }
      }, this));
    };
    Document.prototype.unfollow = function(callback) {
      this.stream.removeListener(this.name, 'op', this.onOpReceived);
      return this.stream.unfollow(this.name, callback);
    };
    Document.prototype.tryFlushPendingOp = function() {
      if (this.inflightOp === null && this.pendingOp !== null) {
        this.inflightOp = this.pendingOp;
        this.inflightCallbacks = this.pendingCallbacks;
        this.pendingOp = null;
        this.pendingCallbacks = [];
        return this.stream.submit(this.name, this.inflightOp, this.version, __bind(function(response) {
          var callback, _i, _j, _len, _len2, _ref, _ref2;
          if (response.v === null) {
            _ref = this.inflightCallbacks;
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              callback = _ref[_i];
              callback(null);
            }
            this.inflightOp = null;
            throw new Error(response.error);
          }
          if (response.v !== this.version) {
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
      if (msg.v < this.version) {
        return;
      }
      if (msg.doc !== this.name) {
        throw new Error("Expected docName " + this.name + " but got " + msg.doc);
      }
      if (msg.v !== this.version) {
        throw new Error("Expected version " + this.version + " but got " + msg.v);
      }
      op = msg.op;
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
      this.snapshot = this.type.apply(this.snapshot, docOp);
      this.version++;
      this.publish('remoteop', docOp);
      return this.publish('change', docOp);
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
      this.snapshot = this.type.apply(this.snapshot, op);
      if (this.pendingOp !== null) {
        this.pendingOp = this.type.compose(this.pendingOp, op);
      } else {
        this.pendingOp = op;
      }
      if (callback != null) {
        this.pendingCallbacks.push(callback);
      }
      this.publish('change', op);
      return setTimeout(this.tryFlushPendingOp, 0);
    };
    return Document;
  })();
  MicroEvent.mixin(Document);
  Connection = (function() {
    Connection.prototype.makeDoc = function(name, version, type, snapshot) {
      if (this.docs[name]) {
        throw new Error("Document " + name + " already followed");
      }
      return this.docs[name] = new Document(this.stream, name, version, type, snapshot);
    };
    function Connection(hostname, port, basePath) {
      this.stream = new OpStream(hostname, port, basePath);
      this.docs = {};
    }
    Connection.prototype.openExisting = function(docName, callback) {
      if (this.docs[docName] != null) {
        return this.docs[docName];
      }
      return this.stream.get(docName, __bind(function(response) {
        var type;
        if (response.snapshot === null) {
          return callback(null);
        } else {
          type = types[response.type];
          return callback(this.makeDoc(response.doc, response.v, type, response.snapshot));
        }
      }, this));
    };
    Connection.prototype.open = function(docName, type, callback) {
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
          callback(doc, 'Document already exists with type ' + doc.type.name);
        }
        return;
      }
      return this.stream.get(docName, __bind(function(response) {
        if (response.snapshot === null) {
          return this.stream.submit(docName, {
            type: type.name
          }, 0, __bind(function(response) {
            if (response.v != null) {
              doc = this.makeDoc(docName, 1, type, type.initialVersion());
              doc.created = true;
              return callback(doc);
            } else if (response.v === null && response.error === 'Type already set') {
              return this.open(docName, type, callback);
            } else {
              return callback(null, response.error);
            }
          }, this));
        } else if (response.type === type.name) {
          return callback(this.makeDoc(docName, response.v, type, response.snapshot));
        } else {
          return callback(null, "Document already exists with type " + response.type);
        }
      }, this));
    };
    Connection.prototype.create = function(type, prefix) {
      throw new Error('Not implemented');
    };
    Connection.prototype.disconnect = function() {
      if (this.stream != null) {
        this.stream.disconnect();
        return this.stream = null;
      }
    };
    return Connection;
  })();
  connections = {};
  getConnection = function(hostname, port, basePath) {
    var address;
    if (typeof window != "undefined" && window !== null) {
      hostname != null ? hostname : hostname = window.location.hostname;
      port != null ? port : port = window.location.port;
    }
    address = "" + hostname + ":" + port;
    return connections[address] || (connections[address] = new Connection(hostname, port, basePath));
  };
  open = function(docName, type, options, callback) {
    var c;
    if (typeof options === 'function') {
      callback = options;
      options = null;
    }
    options != null ? options : options = {};
    c = getConnection(options.hostname, options.port, options.basePath);
    return c.open(docName, type, callback);
  };
  if (typeof window != "undefined" && window !== null) {
    window.sharejs.Connection = Connection;
    window.sharejs.Document = Document;
    window.sharejs.open = open;
  } else {
    exports.Connection = Connection;
    exports.open = open;
  }
}).call(this);
