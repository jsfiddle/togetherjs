/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
import { provide } from "../core/registry.js";
import $ from "../dom/dom.js";
import { slideIn, popinWindow, fadeOutWindow } from "../dom/animate.js";
import util from "../core/util.js";
import peers from "../core/peers.js";
import session from "../core/session.js";
import { dockPosition } from "./dock-position.js";

var assert = util.assert;
var windowing = util.Module("windowing");
var $window = $(window);
// Matches the .togetherjs-color-pulse keyframes in togetherjs.css
var ANIMATION_DURATION = 1000;
// Clearance between a panel and the viewport edge
var EDGE_MARGIN = 10;

/* Displays one window.  A window must already exist.  This hides other windows, and
   positions the window according to its data-bound-to attributes */
windowing.show = function (element, options) {
  element = $(element);
  options = options || {};
  options.bind = options.bind || element.attr("data-bind-to");
  var notification = element.hasClass("togetherjs-notification");
  var modal = element.hasClass("togetherjs-modal");
  if (options.bind) {
    options.bind = $(options.bind);
  }
  windowing.hide();
  element.stop();
  element.show();
  // In addition to being hidden, the window can be faded out, which we want to undo:
  element.css({opacity: "1"});
  if (options.bind) {
    assert(! modal, "Binding does not currently work with modals");
    bind(element, options.bind);
  }
  if (notification) {
    slideIn(element);
  } else if (! modal) {
    popinWindow(element);
  }
  if (modal) {
    getModalBackground().show();
    modalEscape.bind();
    focusTrap.capture(element);
  }
  onClose = options.onClose || null;
  session.emit("display-window", element.attr("id"), element);
};

var onClose = null;

var POINTERS = "#togetherjs-window-pointer-right, #togetherjs-window-pointer-left, " +
               "#togetherjs-window-pointer-top, #togetherjs-window-pointer-bottom";

/* Moves a window to be attached to data-bind-to, e.g., the button
   that opened the window. Or you can provide an element that it should bind to. */
function bind(win, bound) {
  if ($.isMobile()) {
    return;
  }
  win = $(win);
  assert(bound.length, "Cannot find binding:", bound.selector, "from:", win.selector);
  /* Which side of the bound element the panel goes on. This used to be
     hardcoded to "right" with the real lookup commented out next to it, so a
     dock dragged to the left grew its panels off the edge of the screen --
     one of the reasons dragging was switched off in the first place. */
  var ifacePos = dockPosition();
  var boundPos = bound.offset();
  boundPos.height = bound.height();
  boundPos.width = bound.width();
  var windowHeight = $window.height();
  boundPos.top -= $window.scrollTop();
  boundPos.left -= $window.scrollLeft();
  // FIXME: I appear to have to add the padding to the width to get a "true"
  // width.  But it's still not entirely consistent.
  var height = win.height() + 5;
  var width = win.width() + 20;
  var left, top;
  if (ifacePos == "right") {
    left = boundPos.left - 11 - width;
    top = boundPos.top + (boundPos.height / 2) - (height / 2);
  } else if (ifacePos == "left") {
    left = boundPos.left + boundPos.width + 15;
    top = boundPos.top + (boundPos.height / 2) - (height / 2);
  } else if (ifacePos == "bottom") {
    left = (boundPos.left + boundPos.width / 2) - (width / 2);
    top = boundPos.top - 10 - height;
  } else if (ifacePos == "top") {
    left = (boundPos.left + boundPos.width / 2) - (width / 2);
    top = boundPos.top + boundPos.height + 10;
  }
  top = Math.min(windowHeight - EDGE_MARGIN - height, Math.max(EDGE_MARGIN, top));
  // The original clamped only the top, so a panel beside a dock near either
  // side edge could still run off the viewport horizontally.
  left = Math.min($window.width() - EDGE_MARGIN - width, Math.max(EDGE_MARGIN, left));
  win.css({
    top: top + "px",
    left: left + "px"
  });
  if (win.hasClass("togetherjs-window")) {
    $(POINTERS).hide();
    var pointer = $("#togetherjs-window-pointer-" + ifacePos);
    pointer.show();
    if (ifacePos == "right") {
      pointer.css({
        top: boundPos.top + Math.floor(boundPos.height / 2) + "px",
        left: left + win.width() + 9 + "px"
      });
    } else if (ifacePos == "left") {
      pointer.css({
        top: boundPos.top + Math.floor(boundPos.height / 2) + "px",
        left: (left - 5) + "px"
      });
    } else if (ifacePos == "bottom") {
      pointer.css({
        top: (top + win.height() + 9) + "px",
        left: boundPos.left + Math.floor(boundPos.width / 2) + "px"
      });
    } else {
      pointer.css({
        top: (top - 5) + "px",
        left: boundPos.left + Math.floor(boundPos.width / 2) + "px"
      });
    }
  }
  win.data("boundTo", bound.selector || "#" + bound.attr("id"));
  bound.addClass("togetherjs-active");
}

session.on("resize", function () {
  var win = $(".togetherjs-modal:visible, .togetherjs-window:visible");
  if (! win.length) {
    return;
  }
  var boundTo = win.data("boundTo");
  if (! boundTo) {
    return;
  }
  boundTo = $(boundTo);
  bind(win, boundTo);
});

windowing.hide = function (els) {
  // FIXME: also hide modals?
  els = els || ".togetherjs-window, .togetherjs-modal, .togetherjs-notification";
  els = $(els);
  els = els.filter(":visible");
  els.filter(":not(.togetherjs-notification)").hide();
  getModalBackground().hide();
  var windows = [];
  els.each(function (index, element) {
    element = $(element);
    windows.push(element);
    var bound = element.data("boundTo");
    if (! bound) {
      return;
    }
    bound = $(bound);
    bound.addClass("togetherjs-animated").addClass("togetherjs-color-pulse");
    setTimeout(function () {
      bound.removeClass("togetherjs-color-pulse").removeClass("togetherjs-animated");
    }, ANIMATION_DURATION+10);
    element.data("boundTo", null);
    bound.removeClass("togetherjs-active");
    if (element.hasClass("togetherjs-notification")) {
      fadeOutWindow(element).then(function () {
        element.hide();
      });
    }
  });
  $(POINTERS).hide();
  focusTrap.release();
  if (onClose) {
    onClose();
    onClose = null;
  }
  if (windows.length) {
    session.emit("hide-window", windows);
  }
};

windowing.toggle = function (el) {
  el = $(el);
  if (el.is(":visible")) {
    windowing.hide(el);
  } else {
    windowing.show(el);
  }
};

function bindEvents(el) {
  el.find(".togetherjs-close, .togetherjs-dismiss").click(function (event) {
    var w = $(event.target).closest(".togetherjs-window, .togetherjs-modal, .togetherjs-notification");
    windowing.hide(w);
    event.stopPropagation();
    return false;
  });
}

function getModalBackground() {
  if (getModalBackground.element) {
    return getModalBackground.element;
  }
  var background = $("#togetherjs-modal-background");
  assert(background.length);
  getModalBackground.element = background;
  background.click(function () {
    windowing.hide();
  });
  return background;
}

/* Keeping focus inside an open modal, and putting it back afterwards.
   Without this, Tab from a TogetherJS dialog walked straight into the host
   page behind the backdrop, and dismissing the dialog left focus on <body>,
   so a keyboard user had to tab in from the top of the document again. */
var focusTrap = {
  previous: null,
  element: null,

  selector: 'a[href], button:not([disabled]), input:not([disabled]), ' +
            'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',

  capture: function (element) {
    focusTrap.previous = document.activeElement;
    focusTrap.element = element;
    var focusable = focusTrap.focusable();
    (focusable[0] || element[0]).focus();
    document.addEventListener("keydown", focusTrap.onKeydown, true);
  },

  release: function () {
    if (! focusTrap.element) {
      return;
    }
    document.removeEventListener("keydown", focusTrap.onKeydown, true);
    focusTrap.element = null;
    var previous = focusTrap.previous;
    focusTrap.previous = null;
    if (previous && document.contains(previous)) {
      previous.focus();
    }
  },

  focusable: function () {
    if (! focusTrap.element) {
      return [];
    }
    return Array.prototype.filter.call(
      focusTrap.element[0].querySelectorAll(focusTrap.selector),
      function (el) {
        return el.offsetParent !== null;
      });
  },

  onKeydown: function (event) {
    if (event.key !== "Tab" || ! focusTrap.element) {
      return;
    }
    var focusable = focusTrap.focusable();
    if (! focusable.length) {
      event.preventDefault();
      return;
    }
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (! event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    } else if (! focusTrap.element[0].contains(document.activeElement)) {
      first.focus();
      event.preventDefault();
    }
  }
};

var modalEscape = {
  bind: function () {
    $(document).keydown(modalEscape.onKeydown);
  },
  unbind: function () {
    $(document).off("keydown", modalEscape.onKeydown);
  },
  onKeydown: function (event) {
    if (event.which == 27) {
      windowing.hide();
    }
  }
};

session.on("close", function () {
  modalEscape.unbind();
  focusTrap.release();
});

session.on("new-element", function (el) {
  bindEvents(el);
});

provide("windowing", windowing);

export default windowing;
