/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "jquery"], function (require, exports, jquery_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.elementFinder = exports.ElementFinder = void 0;
    jquery_1 = __importDefault(jquery_1);
    function isJQuery(o) {
        return o instanceof jquery_1.default;
    }
    while (el) {
      if ($(el).hasClass("togetherjs")) {
        return true;
      }
      el = el.parentNode;
    }
    return false;
  };

  elementFinder.elementLocation = function elementLocation(el) {
    assert(el !== null, "Got null element");
    if (el instanceof $) {
      // a jQuery element
      el = el[0];
    }
    if (el[0] && el.attr && el[0].nodeType == 1) {
      // Or a jQuery element not made by us
      el = el[0];
    }
    if (el.id) {
      return "#" + el.id;
    }
    if (el.tagName == "BODY") {
      return "body";
    }
    if (el.tagName == "HEAD") {
      return "head";
    }
    if (el === document) {
      return "document";
    }
    var parent = el.parentNode;
    if ((! parent) || parent == el) {
      console.warn("elementLocation(", el, ") has null parent");
      throw new Error("No locatable parent found");
    }
    var parentLocation = elementLocation(parent);
    var children = parent.childNodes;
    var _len = children.length;
    var index = 0;
    for (var i=0; i<_len; i++) {
      if (children[i] == el) {
        break;
      }
      if (children[i].nodeType == document.ELEMENT_NODE) {
        if (children[i].className.indexOf && children[i].className.indexOf("togetherjs") != -1) {
          // Don't count our UI
          continue;
        }
        toString() {
            let loc;
            try {
                loc = "loc"; //elementFinder.elementLocation(this.context);
            }
            catch (e) {
                loc = this.context;
            }
            return ("[CannotFind " + this.prefix + "(" + this.location + "): " + this.reason + " in " + loc + "]");
        }
    }
    class ElementFinder {
        ignoreElement(element) {
            let el = element;
            if (isJQuery(el)) {
                el = el[0];
            }
            while (el) {
                if ((0, jquery_1.default)(el).hasClass("togetherjs")) {
                    return true;
                }
                el = el.parentNode;
            }
            return false;
        }
        elementLocation(element) {
            //assert(element !== null, "Got null element");
            let el = element;
            if (0 in el && "attr" in el && el[0].nodeType == 1) {
                // Or a jQuery element not made by us
                el = el[0];
            }
            if (isJQuery(el)) {
                // a jQuery element
                el = el[0];
            }
            if (el === document || el instanceof Document) {
                return "document";
            }
            if (el.id) {
                return "#" + el.id;
            }
            if (el.tagName == "BODY") {
                return "body";
            }
            if (el.tagName == "HEAD") {
                return "head";
            }
            const parent = el.parentNode;
            if ((!parent) || parent == el) {
                console.warn("elementLocation(", el, ") has null parent");
                throw new Error("No locatable parent found");
            }
            const parentLocation = this.elementLocation(parent);
            const children = parent.childNodes;
            const _len = children.length;
            let index = 0;
            for (let i = 0; i < _len; i++) {
                const child = children[i];
                if (child == el) {
                    break;
                }
                if (child.nodeType == document.ELEMENT_NODE) {
                    if (child.className.indexOf("togetherjs") != -1) {
                        // Don't count our UI
                        continue;
                    }
                    // Don't count text or comments
                    index++;
                }
            }
            return parentLocation + ":nth-child(" + (index + 1) + ")";
        }
      } else {
        return el;
      }
    } else if (loc.indexOf(":nth-child(") === 0) {
      loc = loc.substr((":nth-child(").length);
      if (loc.indexOf(")") == -1) {
        throw "Invalid location, missing ): " + loc;
      }
      var num = loc.substr(0, loc.indexOf(")"));
      num = parseInt(num, 10);
      var count = num;
      loc = loc.substr(loc.indexOf(")") + 1);
      var children = container.childNodes;
      el = null;
      for (var i=0; i<children.length; i++) {
        var child = children[i];
        if (child.nodeType == document.ELEMENT_NODE) {
          if (children[i].className.indexOf && children[i].className.indexOf("togetherjs") != -1) {
            continue;
          }
          count--;
          if (count === 0) {
            // this is the element
            el = child;
            break;
          }
        }
        elementByPixel(height) {
            const self = this;
            /* Returns {location: "...", offset: pixels}
            
            To get the pixel position back, you'd do:
            $(location).offset().top + offset
            */
            function search(start, height) {
                var _a, _b;
                let last = null;
                const children = start.children();
                children.each(function () {
                    const el = (0, jquery_1.default)(this);
                    if (el.hasClass("togetherjs") || el.css("position") == "fixed" || !el.is(":visible")) {
                        return;
                    }
                    const offset = el.offset();
                    if (offset && offset.top > height) {
                        return false;
                    }
                    last = el;
                    return;
                });
                if ((!children.length) || (!last)) {
                    // There are no children, or only inapplicable children
                    const start_offset_top = (_b = (_a = start.offset()) === null || _a === void 0 ? void 0 : _a.top) !== null && _b !== void 0 ? _b : 0;
                    return {
                        location: self.elementLocation(start[0]),
                        offset: height - start_offset_top,
                        absoluteTop: height,
                        documentHeight: (0, jquery_1.default)(document).height()
                    };
                }
                return search(last, height);
            }
            return search((0, jquery_1.default)(document.body), height);
        }
        pixelForPosition(position) {
            /* Inverse of elementFinder.elementByPixel */
            if (position.location == "body") {
                return position.offset;
            }
            let el;
            try {
                el = this.findElement(position.location);
                const el_offset = (0, jquery_1.default)(el).offset();
                if (el_offset === undefined) {
                    throw new Error("pixelForPosition called on element without offset");
                }
                // FIXME: maybe here we should test for sanity, like if an element is
                // hidden.  We can use position.absoluteTop to get a sense of where the
                // element roughly should be.  If the sanity check failed we'd use
                // absoluteTop
                return el_offset.top + position.offset;
            }
            catch (e) {
                if (e instanceof CannotFind && position.absoluteTop) {
                    // We don't trust absoluteTop to be quite right locally, so we adjust
                    // for the total document height differences:
                    const percent = position.absoluteTop / position.documentHeight;
                    return (0, jquery_1.default)(document).height() * percent;
                }
                throw e;
            }
        }
    }
    exports.ElementFinder = ElementFinder;
    exports.elementFinder = new ElementFinder();
});
//define(["util", "jquery"], elementFinderMain);
