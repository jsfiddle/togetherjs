(function() {
  /**
   @const
   @type {boolean}
*/
var WEB = true;
;
  var clone, exports, isArray, json, text;
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
}).call(this);
