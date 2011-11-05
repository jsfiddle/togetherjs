(function() {
  /**
   @const
   @type {boolean}
*/
var WEB = true;
;
  var SubDoc, clone, depath, exports, isArray, json, pathEquals, text, traverse;
  var __slice = Array.prototype.slice;
  exports = window['sharejs'];
  if (typeof WEB !== "undefined" && WEB !== null) {
    text = exports.types.text;
  } else {
    text = require('./text');
  }
  json = {};
  json.name = 'json';
  json.create = function() {
    return null;
  };
  json.invertComponent = function(c) {
    var c_;
    c_ = {
      p: c.p
    };
    if (c.si !== void 0) {
      c_.sd = c.si;
    }
    if (c.sd !== void 0) {
      c_.si = c.sd;
    }
    if (c.oi !== void 0) {
      c_.od = c.oi;
    }
    if (c.od !== void 0) {
      c_.oi = c.od;
    }
    if (c.li !== void 0) {
      c_.ld = c.li;
    }
    if (c.ld !== void 0) {
      c_.li = c.ld;
    }
    if (c.na !== void 0) {
      c_.na = -c.na;
    }
    if (c.lm !== void 0) {
      c_.lm = c.p[c.p.length - 1];
      c_.p = c.p.slice(0, c.p.length - 1).concat([c.lm]);
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
  isArray = function(o) {
    return Object.prototype.toString.call(o) === '[object Array]';
  };
  json.checkList = function(elem) {
    if (!isArray(elem)) {
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
        _ref = c.p;
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
        if (c.na !== void 0) {
          if (typeof elem[key] !== 'number') {
            throw new Error('Referenced element not a number');
          }
          elem[key] += c.na;
        } else if (c.si !== void 0) {
          if (typeof elem !== 'string') {
            throw new Error("Referenced element not a string (it was " + (JSON.stringify(elem)) + ")");
          }
          parent[parentkey] = elem.slice(0, key) + c.si + elem.slice(key);
        } else if (c.sd !== void 0) {
          if (typeof elem !== 'string') {
            throw new Error('Referenced element not a string');
          }
          if (elem.slice(key, key + c.sd.length) !== c.sd) {
            throw new Error('Deleted string does not match');
          }
          parent[parentkey] = elem.slice(0, key) + elem.slice(key + c.sd.length);
        } else if (c.li !== void 0 && c.ld !== void 0) {
          json.checkList(elem);
          elem[key] = c.li;
        } else if (c.li !== void 0) {
          json.checkList(elem);
          elem.splice(key, 0, c.li);
        } else if (c.ld !== void 0) {
          json.checkList(elem);
          elem.splice(key, 1);
        } else if (c.lm !== void 0) {
          json.checkList(elem);
          if (c.lm !== key) {
            e = elem[key];
            elem.splice(key, 1);
            elem.splice(c.lm, 0, e);
          }
        } else if (c.oi !== void 0) {
          json.checkObj(elem);
          elem[key] = c.oi;
        } else if (c.od !== void 0) {
          json.checkObj(elem);
          delete elem[key];
        } else {
          throw new Error('invalid / missing instruction in op');
        }
      }
    } catch (error) {
      throw error;
    }
    return container.data;
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
    if (dest.length !== 0 && json.pathMatches(c.p, (last = dest[dest.length - 1]).p)) {
      if (last.na !== void 0 && c.na !== void 0) {
        return dest[dest.length - 1] = {
          p: last.p,
          na: last.na + c.na
        };
      } else if (last.li !== void 0 && c.li === void 0 && c.ld === last.li) {
        if (last.ld !== void 0) {
          return delete last.li;
        } else {
          return dest.pop();
        }
      } else if (last.od !== void 0 && last.oi === void 0 && c.oi !== void 0 && c.od === void 0) {
        return last.oi = c.oi;
      } else if (c.lm !== void 0 && c.p[c.p.length - 1] === c.lm) {
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
    var c, newOp, _i, _len, _ref;
    newOp = [];
    if (!isArray(op)) {
      op = [op];
    }
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      c = op[_i];
      if ((_ref = c.p) == null) {
        c.p = [];
      }
      json.append(newOp, c);
    }
    return newOp;
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
    var common, common2, commonOperand, convert, cplength, from, jc, oc, otherCplength, otherFrom, otherTo, p, res, tc, tc1, tc2, to, _i, _len;
    c = clone(c);
    if (c.na !== void 0) {
      c.p.push(0);
    }
    if (otherC.na !== void 0) {
      otherC.p.push(0);
    }
    common = json.commonPath(c.p, otherC.p);
    common2 = json.commonPath(otherC.p, c.p);
    cplength = c.p.length;
    otherCplength = otherC.p.length;
    if (c.na !== void 0) {
      c.p.pop();
    }
    if (otherC.na !== void 0) {
      otherC.p.pop();
    }
    if (otherC.na) {
      if ((common2 != null) && otherCplength >= cplength && otherC.p[common2] === c.p[common2]) {
        if (c.ld !== void 0) {
          oc = clone(otherC);
          oc.p = oc.p.slice(cplength);
          c.ld = json.apply(clone(c.ld), [oc]);
        } else if (c.od !== void 0) {
          oc = clone(otherC);
          oc.p = oc.p.slice(cplength);
          c.od = json.apply(clone(c.od), [oc]);
        }
      }
      json.append(dest, c);
      return dest;
    }
    if ((common2 != null) && otherCplength > cplength && c.p[common2] === otherC.p[common2]) {
      if (c.ld !== void 0) {
        oc = clone(otherC);
        oc.p = oc.p.slice(cplength);
        c.ld = json.apply(clone(c.ld), [oc]);
      } else if (c.od !== void 0) {
        oc = clone(otherC);
        oc.p = oc.p.slice(cplength);
        c.od = json.apply(clone(c.od), [oc]);
      }
    }
    if (common != null) {
      commonOperand = cplength === otherCplength;
      if (otherC.na !== void 0) {} else if (otherC.si !== void 0 || otherC.sd !== void 0) {
        if (c.si !== void 0 || c.sd !== void 0) {
          if (!commonOperand) {
            throw new Error("must be a string?");
          }
          convert = function(component) {
            var newC;
            newC = {
              p: component.p[component.p.length - 1]
            };
            if (component.si) {
              newC.i = component.si;
            } else {
              newC.d = component.sd;
            }
            return newC;
          };
          tc1 = convert(c);
          tc2 = convert(otherC);
          res = [];
          text._tc(res, tc1, tc2, type);
          for (_i = 0, _len = res.length; _i < _len; _i++) {
            tc = res[_i];
            jc = {
              p: c.p.slice(0, common)
            };
            jc.p.push(tc.p);
            if (tc.i != null) {
              jc.si = tc.i;
            }
            if (tc.d != null) {
              jc.sd = tc.d;
            }
            json.append(dest, jc);
          }
          return dest;
        }
      } else if (otherC.li !== void 0 && otherC.ld !== void 0) {
        if (otherC.p[common] === c.p[common]) {
          if (!commonOperand) {
            return dest;
          } else if (c.ld !== void 0) {
            if (c.li !== void 0 && type === 'left') {
              c.ld = clone(otherC.li);
            } else {
              return dest;
            }
          }
        }
      } else if (otherC.li !== void 0) {
        if (c.li !== void 0 && c.ld === void 0 && commonOperand && c.p[common] === otherC.p[common]) {
          if (type === 'right') {
            c.p[common]++;
          }
        } else if (otherC.p[common] <= c.p[common]) {
          c.p[common]++;
        }
        if (c.lm !== void 0) {
          if (commonOperand) {
            if (otherC.p[common] <= c.lm) {
              c.lm++;
            }
          }
        }
      } else if (otherC.ld !== void 0) {
        if (c.lm !== void 0) {
          if (commonOperand) {
            if (otherC.p[common] === c.p[common]) {
              return dest;
            }
            p = otherC.p[common];
            from = c.p[common];
            to = c.lm;
            if (p < to || (p === to && from < to)) {
              c.lm--;
            }
          }
        }
        if (otherC.p[common] < c.p[common]) {
          c.p[common]--;
        } else if (otherC.p[common] === c.p[common]) {
          if (otherCplength < cplength) {
            return dest;
          } else if (c.ld !== void 0) {
            if (c.li !== void 0) {
              delete c.ld;
            } else {
              return dest;
            }
          }
        }
      } else if (otherC.lm !== void 0) {
        if (c.lm !== void 0 && cplength === otherCplength) {
          from = c.p[common];
          to = c.lm;
          otherFrom = otherC.p[common];
          otherTo = otherC.lm;
          if (otherFrom !== otherTo) {
            if (from === otherFrom) {
              if (type === 'left') {
                c.p[common] = otherTo;
                if (from === to) {
                  c.lm = otherTo;
                }
              } else {
                return dest;
              }
            } else {
              if (from > otherFrom) {
                c.p[common]--;
              }
              if (from > otherTo) {
                c.p[common]++;
              } else if (from === otherTo) {
                if (otherFrom > otherTo) {
                  c.p[common]++;
                  if (from === to) {
                    c.lm++;
                  }
                }
              }
              if (to > otherFrom) {
                c.lm--;
              } else if (to === otherFrom) {
                if (to > from) {
                  c.lm--;
                }
              }
              if (to > otherTo) {
                c.lm++;
              } else if (to === otherTo) {
                if ((otherTo > otherFrom && to > from) || (otherTo < otherFrom && to < from)) {
                  if (type === 'right') {
                    c.lm++;
                  }
                } else {
                  if (to > from) {
                    c.lm++;
                  } else if (to === otherFrom) {
                    c.lm--;
                  }
                }
              }
            }
          }
        } else if (c.li !== void 0 && c.ld === void 0 && commonOperand) {
          from = otherC.p[common];
          to = otherC.lm;
          p = c.p[common];
          if (p > from) {
            c.p[common]--;
          }
          if (p > to) {
            c.p[common]++;
          }
        } else {
          from = otherC.p[common];
          to = otherC.lm;
          p = c.p[common];
          if (p === from) {
            c.p[common] = to;
          } else {
            if (p > from) {
              c.p[common]--;
            }
            if (p > to) {
              c.p[common]++;
            } else if (p === to) {
              if (from > to) {
                c.p[common]++;
              }
            }
          }
        }
      } else if (otherC.oi !== void 0 && otherC.od !== void 0) {
        if (c.p[common] === otherC.p[common]) {
          if (c.oi !== void 0 && commonOperand) {
            if (type === 'right') {
              return dest;
            } else {
              c.od = otherC.oi;
            }
          } else {
            return dest;
          }
        }
      } else if (otherC.oi !== void 0) {
        if (c.oi !== void 0 && c.p[common] === otherC.p[common]) {
          if (type === 'left') {
            json.append(dest, {
              p: c.p,
              od: otherC.oi
            });
          } else {
            return dest;
          }
        }
      } else if (otherC.od !== void 0) {
        if (c.p[common] === otherC.p[common]) {
          if (!commonOperand) {
            return dest;
          }
          if (c.oi !== void 0) {
            delete c.od;
          } else {
            return dest;
          }
        }
      }
    }
    json.append(dest, c);
    return dest;
  };
  if (typeof WEB !== "undefined" && WEB !== null) {
    exports.types || (exports.types = {});
    exports._bt(json, json.transformComponent, json.checkValidOp, json.append);
    exports.types.json = json;
  } else {
    module.exports = json;
    require('./helpers').bootstrapTransform(json, json.transformComponent, json.checkValidOp, json.append);
  }
  if (typeof WEB === 'undefined') {
    json = require('./json');
  }
  depath = function(path) {
    if (path.length === 1 && path[0].constructor === Array) {
      return path[0];
    } else {
      return path;
    }
  };
  SubDoc = (function() {
    function SubDoc(doc, path) {
      this.doc = doc;
      this.path = path;
    }
    SubDoc.prototype.at = function() {
      var path;
      path = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return this.doc.at(this.path.concat(depath(path)));
    };
    SubDoc.prototype.get = function() {
      return this.doc.getAt(this.path);
    };
    SubDoc.prototype.set = function(value, cb) {
      return this.doc.setAt(this.path, value, cb);
    };
    SubDoc.prototype.insert = function(pos, value, cb) {
      return this.doc.insertAt(this.path, pos, value, cb);
    };
    SubDoc.prototype.del = function(pos, length, cb) {
      return this.doc.deleteTextAt(this.path, length, pos, cb);
    };
    SubDoc.prototype.remove = function(cb) {
      return this.doc.removeAt(this.path, cb);
    };
    SubDoc.prototype.push = function(value, cb) {
      return this.insert(this.get().length, value, cb);
    };
    SubDoc.prototype.move = function(from, to, cb) {
      return this.doc.moveAt(this.path, from, to, cb);
    };
    SubDoc.prototype.add = function(amount, cb) {
      return this.doc.addAt(this.path, amount, cb);
    };
    SubDoc.prototype.on = function(event, cb) {
      return this.doc.addListener(this.path, event, cb);
    };
    SubDoc.prototype.removeListener = function(l) {
      return this.doc.removeListener(l);
    };
    SubDoc.prototype.getLength = function() {
      return this.get().length;
    };
    SubDoc.prototype.getText = function() {
      return this.get();
    };
    return SubDoc;
  })();
  traverse = function(snapshot, path) {
    var container, elem, key, p, _i, _len;
    container = {
      data: snapshot
    };
    key = 'data';
    elem = container;
    for (_i = 0, _len = path.length; _i < _len; _i++) {
      p = path[_i];
      elem = elem[key];
      key = p;
      if (typeof elem === 'undefined') {
        throw new Error('bad path');
      }
    }
    return {
      elem: elem,
      key: key
    };
  };
  pathEquals = function(p1, p2) {
    var e, i, _len;
    if (p1.length !== p2.length) {
      return false;
    }
    for (i = 0, _len = p1.length; i < _len; i++) {
      e = p1[i];
      if (e !== p2[i]) {
        return false;
      }
    }
    return true;
  };
  json.api = {
    provides: {
      json: true
    },
    at: function() {
      var path;
      path = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return new SubDoc(this, depath(path));
    },
    get: function() {
      return this.snapshot;
    },
    set: function(value, cb) {
      return this.setAt([], value, cb);
    },
    getAt: function(path) {
      var elem, key, _ref;
      _ref = traverse(this.snapshot, path), elem = _ref.elem, key = _ref.key;
      return elem[key];
    },
    setAt: function(path, value, cb) {
      var elem, key, op, _ref;
      _ref = traverse(this.snapshot, path), elem = _ref.elem, key = _ref.key;
      op = {
        p: path
      };
      if (elem.constructor === Array) {
        op.li = value;
        if (typeof elem[key] !== 'undefined') {
          op.ld = elem[key];
        }
      } else if (typeof elem === 'object') {
        op.oi = value;
        if (typeof elem[key] !== 'undefined') {
          op.od = elem[key];
        }
      } else {
        throw new Error('bad path');
      }
      return this.submitOp([op], cb);
    },
    removeAt: function(path, cb) {
      var elem, key, op, _ref;
      _ref = traverse(this.snapshot, path), elem = _ref.elem, key = _ref.key;
      if (typeof elem[key] === 'undefined') {
        throw new Error('no element at that path');
      }
      op = {
        p: path
      };
      if (elem.constructor === Array) {
        op.ld = elem[key];
      } else if (typeof elem === 'object') {
        op.od = elem[key];
      } else {
        throw new Error('bad path');
      }
      return this.submitOp([op], cb);
    },
    insertAt: function(path, pos, value, cb) {
      var elem, key, op, _ref;
      _ref = traverse(this.snapshot, path), elem = _ref.elem, key = _ref.key;
      op = {
        p: path.concat(pos)
      };
      if (elem[key].constructor === Array) {
        op.li = value;
      } else if (typeof elem[key] === 'string') {
        op.si = value;
      }
      return this.submitOp([op], cb);
    },
    moveAt: function(path, from, to, cb) {
      var op;
      op = [
        {
          p: path.concat(from),
          lm: to
        }
      ];
      return this.submitOp(op, cb);
    },
    addAt: function(path, amount, cb) {
      var op;
      op = [
        {
          p: path,
          na: amount
        }
      ];
      return this.submitOp(op, cb);
    },
    deleteTextAt: function(path, length, pos, cb) {
      var elem, key, op, _ref;
      _ref = traverse(this.snapshot, path), elem = _ref.elem, key = _ref.key;
      op = [
        {
          p: path.concat(pos),
          sd: elem[key].slice(pos, pos + length)
        }
      ];
      return this.submitOp(op, cb);
    },
    addListener: function(path, event, cb) {
      var l;
      l = {
        path: path,
        event: event,
        cb: cb
      };
      this._listeners.push(l);
      return l;
    },
    removeListener: function(l) {
      var i;
      i = this._listeners.indexOf(l);
      if (i < 0) {
        return false;
      }
      this._listeners.splice(i, 1);
      return true;
    },
    _register: function() {
      this._listeners = [];
      this.on('change', function(op) {
        var c, dummy, i, l, to_remove, xformed, _i, _len, _len2, _ref, _results;
        _results = [];
        for (_i = 0, _len = op.length; _i < _len; _i++) {
          c = op[_i];
          if (c.na !== void 0 || c.si !== void 0 || c.sd !== void 0) {
            continue;
          }
          to_remove = [];
          _ref = this._listeners;
          for (i = 0, _len2 = _ref.length; i < _len2; i++) {
            l = _ref[i];
            dummy = {
              p: l.path,
              na: 0
            };
            xformed = this.type.transformComponent([], dummy, c, 'left');
            if (xformed.length === 0) {
              to_remove.push(i);
            } else if (xformed.length === 1) {
              l.path = xformed[0].p;
            } else {
              throw new Error("Bad assumption in json-api: xforming an 'si' op will always result in 0 or 1 components.");
            }
          }
          to_remove.sort(function(a, b) {
            return b - a;
          });
          _results.push((function() {
            var _j, _len3, _results2;
            _results2 = [];
            for (_j = 0, _len3 = to_remove.length; _j < _len3; _j++) {
              i = to_remove[_j];
              _results2.push(this._listeners.splice(i, 1));
            }
            return _results2;
          }).call(this));
        }
        return _results;
      });
      return this.on('remoteop', function(op) {
        var c, cb, child_path, common, event, match_path, path, _i, _len, _results;
        _results = [];
        for (_i = 0, _len = op.length; _i < _len; _i++) {
          c = op[_i];
          match_path = c.na === void 0 ? c.p.slice(0, c.p.length - 1) : c.p;
          _results.push((function() {
            var _j, _len2, _ref, _ref2, _results2;
            _ref = this._listeners;
            _results2 = [];
            for (_j = 0, _len2 = _ref.length; _j < _len2; _j++) {
              _ref2 = _ref[_j], path = _ref2.path, event = _ref2.event, cb = _ref2.cb;
              _results2.push((function() {
                if (pathEquals(path, match_path)) {
                  switch (event) {
                    case 'insert':
                      if (c.li !== void 0 && c.ld === void 0) {
                        return cb(c.p[c.p.length - 1], c.li);
                      } else if (c.oi !== void 0 && c.od === void 0) {
                        return cb(c.p[c.p.length - 1], c.oi);
                      } else if (c.si !== void 0) {
                        return cb(c.p[c.p.length - 1], c.si);
                      }
                      break;
                    case 'delete':
                      if (c.li === void 0 && c.ld !== void 0) {
                        return cb(c.p[c.p.length - 1], c.ld);
                      } else if (c.oi === void 0 && c.od !== void 0) {
                        return cb(c.p[c.p.length - 1], c.od);
                      } else if (c.sd !== void 0) {
                        return cb(c.p[c.p.length - 1], c.sd);
                      }
                      break;
                    case 'replace':
                      if (c.li !== void 0 && c.ld !== void 0) {
                        return cb(c.p[c.p.length - 1], c.ld, c.li);
                      } else if (c.oi !== void 0 && c.od !== void 0) {
                        return cb(c.p[c.p.length - 1], c.od, c.oi);
                      }
                      break;
                    case 'move':
                      if (c.lm !== void 0) {
                        return cb(c.p[c.p.length - 1], c.lm);
                      }
                      break;
                    case 'add':
                      if (c.na !== void 0) {
                        return cb(c.na);
                      }
                  }
                } else if ((common = this.type.commonPath(match_path, path)) != null) {
                  if (event === 'child op') {
                    if (match_path.length === path.length) {
                      throw new Error("paths match length and have commonality, but aren't equal?");
                    }
                    child_path = c.p.slice(common + 1);
                    return cb(child_path, c);
                  }
                }
              }).call(this));
            }
            return _results2;
          }).call(this));
        }
        return _results;
      });
    }
  };
}).call(this);
