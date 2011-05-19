(function() {
  
/** @preserve ShareJS v0.2.0
http://sharejs.org

Copyright 2011 ShareJS Authors

BSD licensed:
https://github.com/josephg/ShareJS/raw/master/LICENSE
*/
;  var Connection, Document, MicroEvent, WEB, append, bootstrapTransform, checkValidComponent, checkValidOp, clone, compose, compress, connections, exports, getConnection, invertComponent, io, open, strInject, text, transformComponent, transformPosition, types;
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
  text._transformComponent = transformComponent = function(dest, c, otherC, type) {
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
  if (WEB == null) {
    text = require('./text');
  }
    if (typeof json !== "undefined" && json !== null) {
    json;
  } else {
    json = {};
  };
  json.name = 'json';
  json.initialVersion = function() {
    return null;
  };
  json.invertComponent = function(c) {
    var c_;
    c_ = {
      p: c['p']
    };
    if (c['si'] !== void 0) {
      c_['sd'] = c['si'];
    }
    if (c['sd'] !== void 0) {
      c_['si'] = c['sd'];
    }
    if (c['oi'] !== void 0) {
      c_['od'] = c['oi'];
    }
    if (c['od'] !== void 0) {
      c_['oi'] = c['od'];
    }
    if (c['li'] !== void 0) {
      c_['ld'] = c['li'];
    }
    if (c['ld'] !== void 0) {
      c_['li'] = c['ld'];
    }
    if (c['na'] !== void 0) {
      c_['na'] = -c['na'];
    }
    if (c['lm'] !== void 0) {
      c_['lm'] = c['p'][c['p'].length - 1];
      c_['p'] = c['p'].slice(0, c['p'].length - 1).concat([c['lm']]);
    }
    return c_;
  };
  json.invert = function(op) {
    var c, _i, _len, _ref, _results;
    _ref = op.slice().reverse();
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      c = _ref[_i];
      _results.push(json.invertComponent(c));
    }
    return _results;
  };
  json.checkValidOp = function(op) {};
  json.checkList = function(elem) {
    if (!(Array.isArray && Array.isArray(elem))) {
      throw new Error('Referenced element not a list');
    }
  };
  json.checkObj = function(elem) {
    if (elem.constructor !== Object) {
      throw new Error("Referenced element not an object (it was " + (JSON.stringify(elem)) + ")");
    }
  };
  json.apply = function(snapshot, op) {
    var c, container, e, elem, i, key, p, parent, parentkey, _i, _len, _len2, _ref;
    json.checkValidOp(op);
    op = clone(op);
    container = {
      data: clone(snapshot)
    };
    try {
      for (i = 0, _len = op.length; i < _len; i++) {
        c = op[i];
        parent = null;
        parentkey = null;
        elem = container;
        key = 'data';
        _ref = c['p'];
        for (_i = 0, _len2 = _ref.length; _i < _len2; _i++) {
          p = _ref[_i];
          parent = elem;
          parentkey = key;
          elem = elem[key];
          key = p;
          if (parent == null) {
            throw new Error('Path invalid');
          }
        }
        if (c['na'] !== void 0) {
          if (typeof elem[key] !== 'number') {
            throw new Error('Referenced element not a number');
          }
          elem[key] += c['na'];
        } else if (c['si'] !== void 0) {
          if (typeof elem !== 'string') {
            throw new Error("Referenced element not a string (it was " + (JSON.stringify(elem)) + ")");
          }
          parent[parentkey] = elem.slice(0, key) + c['si'] + elem.slice(key);
        } else if (c['sd'] !== void 0) {
          if (typeof elem !== 'string') {
            throw new Error('Referenced element not a string');
          }
          if (elem.slice(key, key + c['sd'].length) !== c['sd']) {
            throw new Error('Deleted string does not match');
          }
          parent[parentkey] = elem.slice(0, key) + elem.slice(key + c['sd'].length);
        } else if (c['li'] !== void 0 && c['ld'] !== void 0) {
          json.checkList(elem);
          elem[key] = c['li'];
        } else if (c['li'] !== void 0) {
          json.checkList(elem);
          elem.splice(key, 0, c['li']);
        } else if (c['ld'] !== void 0) {
          json.checkList(elem);
          elem.splice(key, 1);
        } else if (c['lm'] !== void 0) {
          json.checkList(elem);
          if (c['lm'] !== key) {
            e = elem[key];
            elem.splice(key, 1);
            elem.splice(c['lm'], 0, e);
          }
        } else if (c['oi'] !== void 0) {
          json.checkObj(elem);
          elem[key] = c['oi'];
        } else if (c['od'] !== void 0) {
          json.checkObj(elem);
          delete elem[key];
        }
      }
    } catch (e) {
      throw e;
    }
    return container['data'];
  };
  json.pathMatches = function(p1, p2, ignoreLast) {
    var i, p, _len;
    if (p1.length !== p2.length) {
      return false;
    }
    for (i = 0, _len = p1.length; i < _len; i++) {
      p = p1[i];
      if (p !== p2[i] && (!ignoreLast || i !== p1.length - 1)) {
        return false;
      }
    }
    return true;
  };
  json.append = function(dest, c) {
    var last;
    c = clone(c);
    if (dest.length !== 0 && json.pathMatches(c['p'], (last = dest[dest.length - 1]).p)) {
      if (last.na !== void 0 && c['na'] !== void 0) {
        return dest[dest.length - 1] = {
          p: last.p,
          na: last.na + c['na']
        };
      } else if (last.li !== void 0 && c['li'] === void 0 && c['ld'] === last.li) {
        if (last.ld !== void 0) {
          return delete last.li;
        } else {
          return dest.pop();
        }
      } else if (last.od !== void 0 && last.oi === void 0 && c['oi'] !== void 0 && c['od'] === void 0) {
        return last.oi = c['oi'];
      } else if (c['lm'] !== void 0 && c['p'][c['p'].length - 1] === c['lm']) {
        return null;
      } else {
        return dest.push(c);
      }
    } else {
      return dest.push(c);
    }
  };
  json.compose = function(op1, op2) {
    var c, newOp, _i, _len;
    json.checkValidOp(op1);
    json.checkValidOp(op2);
    newOp = clone(op1);
    for (_i = 0, _len = op2.length; _i < _len; _i++) {
      c = op2[_i];
      json.append(newOp, c);
    }
    return newOp;
  };
  json.normalize = function(op) {
    return op;
  };
  clone = function(o) {
    return JSON.parse(JSON.stringify(o));
  };
  json.commonPath = function(p1, p2) {
    var i;
    p1 = p1.slice();
    p2 = p2.slice();
    p1.unshift('data');
    p2.unshift('data');
    p1 = p1.slice(0, p1.length - 1);
    p2 = p2.slice(0, p2.length - 1);
    if (p2.length === 0) {
      return -1;
    }
    i = 0;
    while (p1[i] === p2[i] && i < p1.length) {
      i++;
      if (i === p2.length) {
        return i - 1;
      }
    }
  };
  json.transformComponent = function(dest, c, otherC, type) {
    var common, common2, commonOperand, cplength, from, jc, oc, otherCplength, otherFrom, otherTo, p, p1, p2, res, tc, tc1, tc2, to, _i, _len;
    c = clone(c);
    if (c['na'] !== void 0) {
      c['p'].push(0);
    }
    if (otherC['na'] !== void 0) {
      otherC['p'].push(0);
    }
    common = json.commonPath(c['p'], otherC['p']);
    common2 = json.commonPath(otherC['p'], c['p']);
    cplength = c['p'].length;
    otherCplength = otherC['p'].length;
    if (c['na'] !== void 0) {
      c['p'].pop();
    }
    if (otherC['na'] !== void 0) {
      otherC['p'].pop();
    }
    if (otherC['na']) {
      if ((common2 != null) && otherCplength >= cplength && otherC['p'][common2] === c['p'][common2]) {
        if (c['ld'] !== void 0) {
          oc = clone(otherC);
          oc.p = oc.p.slice(cplength);
          c['ld'] = json.apply(clone(c['ld']), [oc]);
        } else if (c['od'] !== void 0) {
          oc = clone(otherC);
          oc.p = oc.p.slice(cplength);
          c['od'] = json.apply(clone(c['od']), [oc]);
        }
      }
      json.append(dest, c);
      return dest;
    }
    if ((common2 != null) && otherCplength > cplength && c['p'][common2] === otherC['p'][common2]) {
      if (c['ld'] !== void 0) {
        oc = clone(otherC);
        oc.p = oc.p.slice(cplength);
        c['ld'] = json.apply(clone(c['ld']), [oc]);
      } else if (c['od'] !== void 0) {
        oc = clone(otherC);
        oc.p = oc.p.slice(cplength);
        c['od'] = json.apply(clone(c['od']), [oc]);
      }
    }
    if (common != null) {
      commonOperand = cplength === otherCplength;
      if (otherC['na'] !== void 0) {
        null;
      } else if (otherC['si'] !== void 0 || otherC['sd'] !== void 0) {
        if (c['si'] !== void 0 || c['sd'] !== void 0) {
          if (!commonOperand) {
            throw new Error("must be a string?");
          }
          p1 = c['p'][cplength - 1];
          p2 = otherC['p'][otherCplength - 1];
          tc1 = {
            p: p1
          };
          tc2 = {
            p: p2
          };
          if (c['si'] != null) {
            tc1['i'] = c['si'];
          }
          if (c['sd'] != null) {
            tc1['d'] = c['sd'];
          }
          if (otherC['si'] != null) {
            tc2['i'] = otherC['si'];
          }
          if (otherC['sd'] != null) {
            tc2['d'] = otherC['sd'];
          }
          res = [];
          text._transformComponent(res, tc1, tc2, type);
          for (_i = 0, _len = res.length; _i < _len; _i++) {
            tc = res[_i];
            jc = {
              p: c['p'].slice(0, common)
            };
            jc['p'].push(tc['p']);
            if (tc['i'] != null) {
              jc['si'] = tc['i'];
            }
            if (tc['d'] != null) {
              jc['sd'] = tc['d'];
            }
            json.append(dest, jc);
          }
          return dest;
        }
      } else if (otherC['li'] !== void 0 && otherC['ld'] !== void 0) {
        if (otherC['p'][common] === c['p'][common]) {
          if (!commonOperand) {
            return dest;
          } else if (c['ld'] !== void 0) {
            if (c['li'] !== void 0 && type === 'client') {
              c['ld'] = clone(otherC['li']);
            } else {
              return dest;
            }
          }
        }
      } else if (otherC['li'] !== void 0) {
        if (c['li'] !== void 0 && c['ld'] === void 0 && commonOperand && c['p'][common] === otherC['p'][common]) {
          if (type === 'server') {
            c['p'][common]++;
          }
        } else if (otherC['p'][common] <= c['p'][common]) {
          c['p'][common]++;
        }
        if (c['lm'] !== void 0) {
          if (commonOperand) {
            if (otherC['p'][common] <= c['lm']) {
              c['lm']++;
            }
          }
        }
      } else if (otherC['ld'] !== void 0) {
        if (c['lm'] !== void 0) {
          if (commonOperand) {
            if (otherC['p'][common] === c['p'][common]) {
              return dest;
            }
            p = otherC['p'][common];
            from = c['p'][common];
            to = c['lm'];
            if (p < to || (p === to && from < to)) {
              c['lm']--;
            }
          }
        }
        if (otherC['p'][common] < c['p'][common]) {
          c['p'][common]--;
        } else if (otherC['p'][common] === c['p'][common]) {
          if (otherCplength < cplength) {
            return dest;
          } else if (c['ld'] !== void 0) {
            if (c['li'] !== void 0) {
              delete c['ld'];
            } else {
              return dest;
            }
          }
        }
      } else if (otherC['lm'] !== void 0) {
        if (c['lm'] !== void 0 && cplength === otherCplength) {
          from = c['p'][common];
          to = c['lm'];
          otherFrom = otherC['p'][common];
          otherTo = otherC['lm'];
          if (otherFrom !== otherTo) {
            if (from === otherFrom) {
              if (type === 'client') {
                c['p'][common] = otherTo;
                if (from === to) {
                  c['lm'] = otherTo;
                }
              } else {
                return dest;
              }
            } else {
              if (from > otherFrom) {
                c['p'][common]--;
              }
              if (from > otherTo) {
                c['p'][common]++;
              } else if (from === otherTo) {
                if (otherFrom > otherTo) {
                  c['p'][common]++;
                  if (from === to) {
                    c['lm']++;
                  }
                }
              }
              if (to > otherFrom) {
                c['lm']--;
              } else if (to === otherFrom) {
                if (to > from) {
                  c['lm']--;
                }
              }
              if (to > otherTo) {
                c['lm']++;
              } else if (to === otherTo) {
                if ((otherTo > otherFrom && to > from) || (otherTo < otherFrom && to < from)) {
                  if (type === 'server') {
                    c['lm']++;
                  }
                } else {
                  if (to > from) {
                    c['lm']++;
                  } else if (to === otherFrom) {
                    c['lm']--;
                  }
                }
              }
            }
          }
        } else if (c['li'] !== void 0 && c['ld'] === void 0 && commonOperand) {
          from = otherC['p'][common];
          to = otherC['lm'];
          p = c['p'][common];
          if (p > from) {
            c['p'][common]--;
          }
          if (p > to) {
            c['p'][common]++;
          }
        } else {
          from = otherC['p'][common];
          to = otherC['lm'];
          p = c['p'][common];
          if (p === from) {
            c['p'][common] = to;
          } else {
            if (p > from) {
              c['p'][common]--;
            }
            if (p > to) {
              c['p'][common]++;
            } else if (p === to) {
              if (from > to) {
                c['p'][common]++;
              }
            }
          }
        }
      } else if (otherC['oi'] !== void 0 && otherC['od'] !== void 0) {
        if (c['p'][common] === otherC['p'][common]) {
          if (c['oi'] !== void 0 && commonOperand) {
            if (type === 'server') {
              return dest;
            } else {
              c['od'] = otherC['oi'];
            }
          } else {
            return dest;
          }
        }
      } else if (otherC['oi'] !== void 0) {
        if (c['oi'] !== void 0 && c['p'][common] === otherC['p'][common]) {
          if (type === 'client') {
            json.append(dest, {
              p: c['p'],
              od: otherC['oi']
            });
          } else {
            return dest;
          }
        }
      } else if (otherC['od'] !== void 0) {
        if (c['p'][common] === otherC['p'][common]) {
          if (!commonOperand) {
            return dest;
          }
          if (c['oi'] !== void 0) {
            delete c['od'];
          } else {
            return dest;
          }
        }
      }
    }
    json.append(dest, c);
    return dest;
  };
  if (WEB != null) {
    exports.types || (exports.types = {});
    bootstrapTransform(json, json.transformComponent, json.checkValidOp, json.append);
    exports.types['json'] = json;
  } else {
    module.exports = json;
    require('./helpers').bootstrapTransform(json, json.transformComponent, json.checkValidOp, json.append);
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
