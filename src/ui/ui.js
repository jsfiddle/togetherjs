/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import TogetherJS from "../core/togetherjs.js";
import { provide, need } from "../core/registry.js";
import $ from "../dom/dom.js";
import { animateDockEntry, animateDockExit, easeTo } from "../dom/animate.js";
import util from "../core/util.js";
import session from "../core/session.js";
import templates from "../templates/templates.js";
import templating from "../dom/templating.js";
import linkify from "../dom/linkify.js";
import peers from "../core/peers.js";
import windowing from "./windowing.js";
import elementFinder from "../dom/elementFinder.js";
import visibilityApi from "./visibility.js";
import { icon, expandIcons } from "./icons.js";
import { setDockPosition } from "./dock-position.js";
import storage from "../core/storage.js";
import { PALETTE, normalizeColor } from "./palette.js";

var ui = util.Module('ui');
var assert = util.assert;
var $window = $(window);
// chat TextArea
var TEXTAREA_LINE_HEIGHT = 20; // in pixels
var TEXTAREA_MAX_LINES = 5;
// This is set when an animation will keep the UI from being ready
// (until this time):
var finishedAt = null;
// Time in milliseconds for the dock to animate out:
var DOCK_ANIMATION_TIME = 300;
// If two chat messages come from the same person in this time
// (milliseconds) then they are collapsed into one message:
var COLLAPSE_MESSAGE_LIMIT = 5000;


// The UI inherits the host page's font by default. TogetherJSConfig_baseFont
// overrides that with any CSS font-family value, including a reference to a
// custom property the host page already defines (e.g. "var(--font-base)").
TogetherJS.config.track("baseFont", function (font) {
  if (font) {
    document.documentElement.style.setProperty("--tj-font", font);
  } else {
    document.documentElement.style.removeProperty("--tj-font");
  }
});

// Circular import (chat needs ui, ui needs chat), so it is looked up on use.
function chat() {
  return need("chat");
}

/* Displays some toggleable element; toggleable elements have a
   data-toggles attribute that indicates what other elements should
   be hidden when this element is shown. */
ui.displayToggle = function (el) {
  el = $(el);
  assert(el.length, "No element", arguments[0]);
  var other = $(el.attr("data-toggles"));
  assert(other.length, "Cannot toggle", el[0], "selector", other.selector);
  other.hide();
  el.show();
};

/* ---------------------------------------------------------------------------
   Dragging the dock.

   The 2013 version shipped a drag handler that could never run: its first
   statement reassigned the handle to `container.find("#togetherjs-dock-anchor
   -disabled")`, an element that does not exist, under a comment saying this
   was "in place to temporarily disable dock dragging". The assert on the line
   above it passed only because it ran before that reassignment. The CSS
   agreed, carrying its own FIXME and deliberately omitting `cursor: move`,
   while the markup went on advertising a "Move the dock" tooltip.

   What it disabled was also not really dragging: it swapped a CSS class to
   snap the dock to an edge, never wrote coordinates, and hardcoded the
   distance to the bottom edge at 10000px so the bottom could never win --
   because `togetherjs-dock-bottom` had no CSS behind it. Nothing was saved,
   so the dock reset to the right on every page load.

   This version tracks the pointer, clamps to the viewport, snaps to the
   nearest edge on release, and remembers where it was left.
   --------------------------------------------------------------------------- */

/* Light, dark, or follow the system. The stylesheet's dark rules are written
   so that an explicit data-tj-theme wins over the prefers-color-scheme media
   query in either direction. */
function applyTheme() {
  /* The attribute goes on <html> rather than on the container, because the
     cursors, click ripples and focus rings are appended to <body> and read
     the same tokens; an attribute on the container would never reach them. */
  TogetherJS.config.track("theme", function (theme) {
    var root = document.documentElement;
    if (theme === "light" || theme === "dark") {
      root.setAttribute("data-tj-theme", theme);
    } else {
      if (theme && theme !== "auto") {
        console.warn("Unknown TogetherJSConfig_theme:", theme, "(expected light, dark or auto)");
      }
      root.removeAttribute("data-tj-theme");
    }
  });
}

var DOCK_MARGIN = 12;
// How far the keyboard moves the dock per arrow press.
var DOCK_NUDGE = 24;

function dockEdgeFor(rect) {
  /* The nearest edge, measured from the dock's centre so that a dock dropped
     in a corner goes to whichever edge it is actually closest to. */
  var cx = rect.left + rect.width / 2;
  var cy = rect.top + rect.height / 2;
  var distances = {
    left: cx,
    right: window.innerWidth - cx,
    top: cy,
    bottom: window.innerHeight - cy
  };
  var best = "right";
  Object.keys(distances).forEach(function (edge) {
    if (distances[edge] < distances[best]) {
      best = edge;
    }
  });
  return best;
}

function placeDockAt(dock, left, top) {
  /* Position the dock freely, clamped so it can never be dragged out of
     reach. While free-floating it carries togetherjs-dock-free, which drops
     the centring transform the edge classes rely on. */
  var rect = dock.getBoundingClientRect();
  var maxLeft = window.innerWidth - rect.width - DOCK_MARGIN;
  var maxTop = window.innerHeight - rect.height - DOCK_MARGIN;
  left = Math.max(DOCK_MARGIN, Math.min(maxLeft, left));
  top = Math.max(DOCK_MARGIN, Math.min(maxTop, top));
  dock.classList.add("togetherjs-dock-free");
  dock.style.left = left + "px";
  dock.style.top = top + "px";
  dock.style.right = "auto";
  dock.style.bottom = "auto";
}

function snapDockToEdge(dock, edge) {
  /* Hand positioning back to CSS: the edge classes carry the layout for each
     side, including the row direction for top and bottom. */
  dock.classList.remove("togetherjs-dock-free");
  dock.style.left = dock.style.top = dock.style.right = dock.style.bottom = "";
  ["left", "right", "top", "bottom"].forEach(function (name) {
    dock.classList.toggle("togetherjs-dock-" + name, name === edge);
  });
  setDockPosition(edge);
  storage.settings.set("dockPosition", edge);
  // The open panel is laid out relative to the dock, so it has to move too.
  session.emit("resize");
}

function restoreDockPosition(container) {
  storage.settings.get("dockPosition").then(function (edge) {
    if (!edge) {
      return;
    }
    var dock = container.find("#togetherjs-dock")[0];
    if (dock) {
      snapDockToEdge(dock, edge);
    }
  });
}

function setupDockDragging(container) {
  var dock = container.find("#togetherjs-dock")[0];
  var handle = container.find("#togetherjs-dock-anchor")[0];
  assert(dock && handle, "Cannot find the dock or its drag handle");

  var dragging = null;

  /* Pointer events rather than mouse events: one code path covers mouse,
     touch and pen, and setPointerCapture means the drag survives the pointer
     leaving the handle -- which is how the old code lost mouseup and left the
     dock stuck to the cursor. */
  handle.addEventListener("pointerdown", function (event) {
    if (event.button !== 0 && event.pointerType === "mouse") {
      return;
    }
    var rect = dock.getBoundingClientRect();
    dragging = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false
    };
    handle.setPointerCapture(event.pointerId);
    dock.classList.add("togetherjs-dragging");
    event.preventDefault();
  });

  handle.addEventListener("pointermove", function (event) {
    if (!dragging || event.pointerId !== dragging.pointerId) {
      return;
    }
    if (!dragging.moved) {
      dragging.moved = true;
      // An open panel is anchored to the dock's old spot; drop it rather than
      // drag a disconnected pointer around with us.
      windowing.hide();
    }
    placeDockAt(dock, event.clientX - dragging.offsetX, event.clientY - dragging.offsetY);
  });

  function endDrag(event) {
    if (!dragging || event.pointerId !== dragging.pointerId) {
      return;
    }
    var moved = dragging.moved;
    dragging = null;
    dock.classList.remove("togetherjs-dragging");
    if (moved) {
      snapDockToEdge(dock, dockEdgeFor(dock.getBoundingClientRect()));
    }
  }

  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);

  /* Keyboard equivalent. The handle is a real button, so it is already in the
     tab order; arrow keys move the dock and release snaps it, which gives the
     same outcome as a drag without needing a pointer. */
  handle.addEventListener("keydown", function (event) {
    var deltas = {
      ArrowLeft: [-DOCK_NUDGE, 0],
      ArrowRight: [DOCK_NUDGE, 0],
      ArrowUp: [0, -DOCK_NUDGE],
      ArrowDown: [0, DOCK_NUDGE]
    };
    var delta = deltas[event.key];
    if (!delta) {
      return;
    }
    var rect = dock.getBoundingClientRect();
    placeDockAt(dock, rect.left + delta[0], rect.top + delta[1]);
    event.preventDefault();
  });

  /* Snapping on keyup would undo each nudge the moment the key came back up,
     so the dock could never travel further than one press. Wait for the
     presses to stop instead. */
  var nudgeTimer = null;
  handle.addEventListener("keyup", function (event) {
    if (event.key.indexOf("Arrow") !== 0 || !dock.classList.contains("togetherjs-dock-free")) {
      return;
    }
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(function () {
      if (dock.classList.contains("togetherjs-dock-free")) {
        snapDockToEdge(dock, dockEdgeFor(dock.getBoundingClientRect()));
      }
    }, 500);
  });

  // A dock pinned to an edge is re-pinned on resize; a viewport that shrank
  // could otherwise leave it off-screen.
  session.on("resize", function () {
    if (dock.classList.contains("togetherjs-dock-free")) {
      var rect = dock.getBoundingClientRect();
      placeDockAt(dock, rect.left, rect.top);
    }
  });
}

/* Text for something the JS builds rather than the templates.
   #togetherjs-strings carries these as data attributes so they go through the
   same build-time translation as everything else; there is no gettext at
   runtime. */
function uiString(name) {
  var el = ui.container && ui.container.find("#togetherjs-strings");
  var value = el && el.length ? el.attr("data-" + name) : null;
  if (!value) {
    console.warn("No UI string named", name);
    return "";
  }
  return value;
}

ui.container = null;

// This is used for some signalling when ui.prepareUI and/or
// ui.activateUI is called before the DOM is fully loaded:
var deferringPrepareUI = null;

/* Calls func once ui.container exists: right now if it already does, and
   otherwise on the next "ui-ready". No return value, since the call may
   become asynchronous.

   This used to fall through after calling func, so a call made with the UI
   already up *also* registered a "ui-ready" listener that was never removed.
   Each of those replayed on every later ui.activateUI() with its original
   arguments, which is why reopening a session resurrected old chat
   messages. */
function whenContainerReady(self, func, args) {
  if (ui.container) {
    func.apply(self, args);
    return;
  }
  session.once("ui-ready", function () {
    func.apply(self, args);
  });
}

/* Wraps a function so that calls made before the UI exists are deferred.
   Use like:

     method: deferForContainer(function (args) {...})
   */
function deferForContainer(func) {
  return function () {
    whenContainerReady(this, func, Array.prototype.slice.call(arguments));
  };
}

// This is called before activateUI; it doesn't bind anything, but does display
// the dock
// FIXME: because this module has lots of requirements we can't do
// this before those requirements are loaded.  Maybe worth splitting
// this out?  OTOH, in production we should have all the files
// combined so there's not much problem loading those modules.
ui.prepareUI = function () {
  if (! (document.readyState == "complete" || document.readyState == "interactive")) {
    // Too soon!  Wait a sec...
    deferringPrepareUI = "deferring";
    document.addEventListener("DOMContentLoaded", function () {
      var d = deferringPrepareUI;
      deferringPrepareUI = null;
      ui.prepareUI();
      // This happens when ui.activateUI is called before the document has been
      // loaded:
      if (d == "activate") {
        ui.activateUI();
      }
    });
    return;
  }
  var container = ui.container = $(templates("interface"));
  assert(container.length);
  expandIcons(container[0]);
  applyTheme();
  $("body").append(container);
  fixupAvatars(container);
  restoreDockPosition(container);
  if (session.firstRun && TogetherJS.startTarget) {
    // Time at which the UI will be fully ready:
    // (We have to do this because the offset won't be quite right
    // until the animation finishes - attempts to calculate the
    // offset without taking into account CSS transforms have so far
    // failed.)
    var timeoutSeconds = DOCK_ANIMATION_TIME / 1000;
    finishedAt = Date.now() + DOCK_ANIMATION_TIME + 50;
    setTimeout(function () {
      finishedAt = Date.now() + DOCK_ANIMATION_TIME + 40;
      var iface = container.find("#togetherjs-dock");
      var start = iface.offset();
      var pos = $(TogetherJS.startTarget).offset();
      pos.top = Math.floor(pos.top - start.top);
      pos.left = Math.floor(pos.left - start.left);
      var translate = "translate(" + pos.left + "px, " + pos.top + "px)";
      iface.css({
        MozTransform: translate,
        WebkitTransform: translate,
        transform: translate,
        opacity: "0.0"
      });
      setTimeout(function () {
        // We keep recalculating because the setTimeout times aren't always so accurate:
        finishedAt = Date.now() + DOCK_ANIMATION_TIME + 20;
        var transition = "transform " + timeoutSeconds + "s ease-out, ";
        transition += "opacity " + timeoutSeconds + "s ease-out";
        iface.css({
          opacity: "1.0",
          MozTransition: "-moz-" + transition,
          MozTransform: "translate(0, 0)",
          WebkitTransition: "-webkit-" + transition,
          WebkitTransform: "translate(0, 0)",
          transition: transition,
          transform: "translate(0, 0)"
        });
        setTimeout(function () {
          finishedAt = null;
          iface.attr("style", "");
        }, 510);
      }, 5);
    }, 5);
  }
  if (TogetherJS.startTarget) {
    var el = $(TogetherJS.startTarget);
    var text = el.text().toLowerCase().replace(/\s+/g, " ");
    text = text.replace(/^\s*/, "").replace(/\s*$/, "");
    if (text == "start togetherjs") {
      el.attr("data-end-togetherjs-html", "End TogetherJS");
    }
    if (el.attr("data-end-togetherjs-html")) {
      el.attr("data-start-togetherjs-html", el.html());
      el.html(el.attr("data-end-togetherjs-html"));
    }
    el.addClass("togetherjs-started");
  }
  /* Every panel gets a close button. It is a real <button> with an
     accessible name -- the injected one used to be an unlabelled <button>
     whose only content was a background image. */
  ui.container.find(".togetherjs-window > header, .togetherjs-modal > header").each(function () {
    var button = $('<button type="button" class="togetherjs-close"></button>');
    button.attr("aria-label", uiString("close"));
    button.html(icon("close"));
    $(this).append(button);
  });

  TogetherJS.config.track("disableWebRTC", function (hide, previous) {
    var buttons = "#togetherjs-audio-button, #togetherjs-video-button";
    if (hide && ! previous) {
      ui.container.find(buttons).hide();
    } else if ((! hide) && previous) {
      ui.container.find("#togetherjs-audio-button").show();
      if (TogetherJS.config.get("enableVideo")) {
        ui.container.find("#togetherjs-video-button").show();
      }
    }
  });

};

// After prepareUI, this actually makes the interface live.  We have
// to do this later because we call prepareUI when many components
// aren't initialized, so we don't even want the user to be able to
// interact with the interface.  But activateUI is called once
// everything is loaded and ready for interaction.
ui.activateUI = function () {
  if (deferringPrepareUI) {
    console.warn("ui.activateUI called before document is ready; waiting...");
    deferringPrepareUI = "activate";
    return;
  }
  if (! ui.container) {
    ui.prepareUI();
  }
  var container = ui.container;

  //create the overlay
  if($.isMobile()) {
    // $("body").append( "\x3cdiv class='overlay' style='position: absolute; top: 0; left: 0; background-color: rgba(0,0,0,0); width: 120%; height: 100%; z-index: 1000; margin: -10px'>\x3c/div>" );
  }

  // The share link:
  ui.prepareShareLink(container);
  container.find("input.togetherjs-share-link").on("keydown", function (event) {
    if (event.which == 27) {
      windowing.hide("#togetherjs-share");
      return false;
    }
    return undefined;
  });
  session.on("shareId", updateShareLink);

  // The chat input element:
  var input = container.find("#togetherjs-chat-input");
  input.on("keydown", function (event) {
    if (event.which == 13 && !event.shiftKey) { // Enter without Shift pressed
      submitChat();
      return false;
    }
    if (event.which == 27) { // Escape
      windowing.hide("#togetherjs-chat");
      return false;
    }
  });

  function submitChat() {
    var val = input.val();
    if (util.trim(val)) {
      input.val("");
      // triggering the event manually to avoid the addition of newline character to the textarea:
      input.trigger("input").trigger("propertychange");
      chat().submit(val);
    }
  }
  // auto-resize textarea:
  input.on("input propertychange", function () {
    var $this = $(this);
    var actualHeight = $this.height();
    // reset the height of textarea to remove trailing empty space (used for shrinking):
    $this.height(TEXTAREA_LINE_HEIGHT);
    this.scrollTop = 0;
    // scroll to bottom:
    this.scrollTop = 9999;
    var newHeight = this.scrollTop + $this.height();
    var maxHeight = TEXTAREA_MAX_LINES * TEXTAREA_LINE_HEIGHT;
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      this.style.overflowY = "scroll";
    } else {
      this.style.overflowY = "hidden";
    }
    this.style.height = newHeight + "px";
    var diff = newHeight - actualHeight;
    $("#togetherjs-chat-input-box").height($("#togetherjs-chat-input-box").height() + diff);
    $("#togetherjs-chat-messages").height($("#togetherjs-chat-messages").height() - diff);
    return false;
  });

  util.testExpose({submitChat: submitChat});

  setupDockDragging(container);

  // On a narrow viewport the dock is a compact bottom bar, so the profile
  // button opens the menu as a full panel instead of a popup.
  if ($.isMobile()) {
    $("#togetherjs-profile-button").click(function () {
      windowing.toggle("#togetherjs-menu-window");
    });
  }

  $("#togetherjs-share-button").click(function () {
    windowing.toggle("#togetherjs-share");
  });

  $("#togetherjs-profile-button").click(function (event) {
    if ($.isMobile()) {
      windowing.show("#togetherjs-menu-window");
      return false;
    }
    toggleMenu();
    event.stopPropagation();
    return false;
  });

  // Help is a plain link to the docs now; it just needs the menu to close.
  $("#togetherjs-menu-help, #togetherjs-menu-help-button").click(function () {
    hideMenu();
  });

  $("#togetherjs-menu-update-name").click(function () {
    var input = $("#togetherjs-menu .togetherjs-self-name");
    input.css({
      width: $("#togetherjs-menu").width() - 32 + "px"
    });
    ui.displayToggle("#togetherjs-menu .togetherjs-self-name");
    $("#togetherjs-menu .togetherjs-self-name").focus();
  });

  $("#togetherjs-menu-update-name-button").click(function () {
    windowing.show("#togetherjs-edit-name-window");
    $("#togetherjs-edit-name-window input").focus();
  });

  /* Both the popup menu's inline field and the narrow-screen window's field.
     The second one had no handler at all, so editing your name on a phone
     silently did nothing. */
  $("#togetherjs-menu .togetherjs-self-name, #togetherjs-edit-name-window .togetherjs-self-name")
    .on("keyup change", function (event) {
      if (event.which == 13) {
        ui.displayToggle("#togetherjs-self-name-display");
        windowing.hide("#togetherjs-edit-name-window");
        return;
      }
      var val = $(event.target).val();
      if (val) {
        peers.Self.update({name: val});
      }
    });

  $("#togetherjs-menu-update-avatar, #togetherjs-menu-update-avatar-button").click(function () {
    hideMenu();
    windowing.show("#togetherjs-avatar-edit");
  });

  $("#togetherjs-menu-end, #togetherjs-menu-end-button").click(function () {
    hideMenu();
    windowing.show("#togetherjs-confirm-end");
  });

  $("#togetherjs-end-session").click(function () {
    session.close();
    //$(".overlay").remove();

  });

  buildColorPicker(container);

  $("#togetherjs-chat-button").click(function () {
    windowing.toggle("#togetherjs-chat");
  });

  session.on("display-window", function (id, element) {
    if (id == "togetherjs-chat") {
      if (! $.isMobile()) {
        $("#togetherjs-chat-input").focus();
      }
    } else if (id == "togetherjs-share") {
      var link = element.find("input.togetherjs-share-link");
      if (link.is(":visible")) {
        link.focus().select();
      }
    }
  });

  container.find("#togetherjs-chat-notifier").click(function (event) {
    if ($(event.target).is("a") || container.is(".togetherjs-close")) {
      return;
    }
    windowing.show("#togetherjs-chat");
  });

  // FIXME: Don't think this makes sense
  $(".togetherjs header.togetherjs-title").each(function (index, item) {
    var button = $('<button class="togetherjs-minimize"></button>');
    button.click(function (event) {
      var window = button.closest(".togetherjs-window");
      windowing.hide(window);
    });
    $(item).append(button);
  });

  ui.activateAvatarEdit(container, {
    onSave: function () {
      windowing.hide("#togetherjs-avatar-edit");
    }
  });

  TogetherJS.config.track("inviteFromRoom", function (inviter, previous) {
    if (inviter) {
      container.find("#togetherjs-invite").show();
    } else {
      container.find("#togetherjs-invite").hide();
    }
  });

  container.find("#togetherjs-menu-refresh-invite").click(refreshInvite);
  container.find("#togetherjs-menu-invite-anyone").click(function () {
    invite(null);
  });

  // The following lines should be at the end of this function
  // (new code goes above)
  session.emit("new-element", ui.container);

  if (finishedAt && finishedAt > Date.now()) {
    setTimeout(function () {
      finishedAt = null;
      session.emit("ui-ready", ui);
    }, finishedAt - Date.now());
  } else {
    session.emit("ui-ready", ui);
  }

}; // End ui.activateUI()

ui.activateAvatarEdit = function (container, options) {
  options = options || {};
  var pendingImage = null;

  container.find(".togetherjs-avatar-save").prop("disabled", true);

  container.find(".togetherjs-avatar-save").click(function () {
    if (pendingImage) {
      peers.Self.update({avatar: pendingImage});
      container.find(".togetherjs-avatar-save").prop("disabled", true);
      if (options.onSave) {
        options.onSave();
      }
    }
  });

  container.find(".togetherjs-upload-avatar").on("change", function () {
    util.readFileImage(this).then(function (url) {
      sizeDownImage(url).then(function (smallUrl) {
        pendingImage = smallUrl;
        container.find(".togetherjs-avatar-preview").css({
          backgroundImage: 'url(' + pendingImage + ')'
        });
        container.find(".togetherjs-avatar-save").prop("disabled", false);
        if (options.onPending) {
          options.onPending();
        }
      });
    });
  });

};

/* Scales a picture down to a square avatar.
 *
 * Two things the original got wrong: it scaled by height alone, so a wide
 * picture overflowed the canvas and a tall one left a gutter down the side;
 * and it waited for the image with a bare setTimeout, which only worked when
 * the decode happened to have finished, and produced a blank avatar when it
 * had not. This covers the square and crops to the centre, and waits for the
 * image properly. */
function sizeDownImage(imageUrl) {
  return util.Deferred(function (def) {
    var size = session.AVATAR_SIZE;
    var canvas = $("<canvas>")[0];
    canvas.width = canvas.height = size;
    var context = canvas.getContext("2d");
    var img = new Image();

    function draw() {
      var width = img.naturalWidth || img.width;
      var height = img.naturalHeight || img.height;
      if (! width || ! height) {
        def.reject(new Error("Could not read the image's dimensions"));
        return;
      }
      // Cover: scale so the shorter side fills the square, then centre.
      var scale = Math.max(size / width, size / height);
      var drawWidth = width * scale;
      var drawHeight = height * scale;
      context.drawImage(img, (size - drawWidth) / 2, (size - drawHeight) / 2,
                        drawWidth, drawHeight);
      def.resolve(canvas.toDataURL("image/png"));
    }

    img.onerror = function () {
      def.reject(new Error("Could not load the image"));
    };
    img.onload = function () {
      // decode() resolves once the pixels are ready to draw; onload alone
      // does not promise that in every engine.
      if (img.decode) {
        img.decode().then(draw, draw);
      } else {
        draw();
      }
    };
    img.src = imageUrl;
  });
}

function fixupAvatars(container) {
  /* Every .togetherjs-person needs two children: the fallback person mark
     that shows when the peer has no picture, and the strip of their colour
     along the bottom. This runs over the whole container before anything is
     cloned from it, so the chat, notification and participant templates get
     them too -- they used to render as empty rings. */
  container.find(".togetherjs-person").each(function () {
    var $this = $(this);
    if (! $this.find("svg").length) {
      $this.append(icon("person"));
    }
    if (! $this.find(".togetherjs-person-avatar-swatch").length) {
      $this.append('<span class="togetherjs-person-avatar-swatch"></span>');
    }
  });
}

ui.prepareShareLink = function (container) {
  container.find("input.togetherjs-share-link").click(function () {
    $(this).select();
  }).change(function () {
    updateShareLink();
  });
  updateShareLink();
};

// Menu

function showMenu(event) {
  var el = $("#togetherjs-menu");
  assert(el.length);
  el.show();
  bindMenu();
  $(document).on("click", maybeHideMenu);
}

/* Keeps a popup inside the viewport. A popup anchored to a dock on the right
   has its left edge computed from the anchor, which can land it off either
   side once the dock can be dragged anywhere. */
function clampToViewport(el, top, left) {
  var margin = 8;
  var width = el.outerWidth();
  var height = el.outerHeight();
  left = Math.max(margin, Math.min($window.width() - width - margin, left));
  top = Math.max(margin, Math.min($window.height() - height - margin, top));
  el.css({top: top + "px", left: left + "px"});
}

function bindMenu() {
  var el = $("#togetherjs-menu:visible");
  if (el.length) {
    var bound = $("#togetherjs-profile-button");
    var boundOffset = bound.offset();
    clampToViewport(el,
      boundOffset.top + bound.height() - $window.scrollTop(),
      boundOffset.left + bound.width() - 10 - el.width() - $window.scrollLeft());
  }
}

/* ---------------------------------------------------------------------------
   The colour picker.

   The old one was a row of eleven hand-picked swatches built from <div>s:
   not focusable, not announced, and unusable without a pointer. It was also
   broken outright on this branch -- the click handler used jQuery's
   delegation signature, `$(el).click(selector, fn)`, which the replacement
   dom.js shorthand does not accept, so the callback was dropped and every
   swatch click threw. The second handler still closed the popup, so it
   looked like the picker simply ignored you.

   This one is a radio group: arrow keys move between swatches, space or
   enter chooses, and the platform's own colour input handles anything not in
   the palette (and brings its eyedropper with it).
   --------------------------------------------------------------------------- */
function buildColorPicker(container) {
  var picker = container.find("#togetherjs-pick-color");
  var grid = container.find("#togetherjs-swatches");
  var custom = container.find("#togetherjs-custom-color");
  var swatches = [];

  PALETTE.forEach(function (color) {
    var el = templating.sub("swatch");
    el.attr("data-color", color);
    el.attr("aria-label", uiString("color-named") + " " + color);
    el.css({backgroundColor: color});
    // The tick inside the swatch is white under difference blending, so it
    // stays readable whatever the swatch colour is.
    grid.append(el);
    swatches.push(el[0]);
  });

  function choose(color) {
    color = normalizeColor(color);
    if (!color) {
      return;
    }
    peers.Self.update({color: color});
    highlight(color);
  }

  function highlight(color) {
    color = normalizeColor(color) || "";
    swatches.forEach(function (el) {
      // Compare normalized: the palette and a stored colour may differ only
      // in case, which used to stop the active swatch ever being marked.
      var active = normalizeColor(el.getAttribute("data-color")) === color;
      el.classList.toggle("togetherjs-swatch-active", active);
      el.setAttribute("aria-checked", active ? "true" : "false");
      // Roving tabindex: one stop for the whole group, as a radio group.
      el.tabIndex = active ? 0 : -1;
    });
    if (!swatches.some(function (el) { return el.tabIndex === 0; }) && swatches.length) {
      swatches[0].tabIndex = 0;
    }
    if (color) {
      custom.val(color);
    }
  }

  grid.on("click", function (event) {
    var el = event.target.closest(".togetherjs-swatch");
    if (!el) {
      return;
    }
    choose(el.getAttribute("data-color"));
    event.stopPropagation();
  });

  grid.on("keydown", function (event) {
    var step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[event.key];
    if (!step) {
      return;
    }
    var index = swatches.indexOf(event.target.closest(".togetherjs-swatch"));
    if (index == -1) {
      return;
    }
    var next = swatches[(index + step + swatches.length) % swatches.length];
    next.focus();
    choose(next.getAttribute("data-color"));
    event.preventDefault();
  });

  custom.on("input change", function () {
    choose(custom.val());
  });

  // Clicking anywhere else in the popup closes it, but not the controls.
  picker.on("click", function (event) {
    if (event.target === picker[0]) {
      hidePicker();
    }
  });

  function showPicker() {
    picker.show();
    bindPicker();
    highlight(peers.Self.color);
    container.find("#togetherjs-menu-update-color").attr("aria-expanded", "true");
    var active = swatches.filter(function (el) { return el.tabIndex === 0; })[0];
    if (active) {
      active.focus();
    }
  }

  function hidePicker() {
    picker.hide();
    container.find("#togetherjs-menu-update-color").attr("aria-expanded", "false");
  }

  container.find("#togetherjs-menu-update-color, #togetherjs-menu-update-color-button")
    .on("click", function (event) {
      if (picker.is(":visible")) {
        hidePicker();
      } else {
        showPicker();
      }
      event.stopPropagation();
      return false;
    });

  picker.on("keydown", function (event) {
    if (event.which == 27) {
      hidePicker();
      container.find("#togetherjs-menu-update-color").focus();
    }
  });

  peers.on("self-updated", function () {
    highlight(peers.Self.color);
  });

  highlight(peers.Self.color);
}

function bindPicker() {
  var picker = $("#togetherjs-pick-color:visible");
  if (! picker.length) {
    return;
  }
  // Anchored under whichever "Pick profile color" row is on screen.
  var row = $("#togetherjs-menu-update-color:visible");
  if (! row.length) {
    row = $("#togetherjs-menu-update-color-button:visible");
  }
  if (! row.length) {
    return;
  }
  var offset = row.offset();
  clampToViewport(picker,
    offset.top + row.height() - $window.scrollTop(),
    offset.left - $window.scrollLeft());
}

session.on("resize", function () {
  bindMenu();
  bindPicker();
});

function toggleMenu() {
  if ($("#togetherjs-menu").is(":visible")) {
    hideMenu();
  } else {
    showMenu();
  }
}

function hideMenu() {
  var el = $("#togetherjs-menu");
  el.hide();
  $(document).off("click", maybeHideMenu);
  ui.displayToggle("#togetherjs-self-name-display");
  $("#togetherjs-pick-color").hide();
}

function maybeHideMenu(event) {
  var t = event.target;
  while (t) {
    if (t.id == "togetherjs-menu") {
      // Click inside the menu, ignore this
      return;
    }
    t = t.parentNode;
  }
  hideMenu();
}

// Misc

function updateShareLink() {
  /* There used to be an <a class="togetherjs-share-link"> and a
     #togetherjs-session-id here too; neither exists in the markup. */
  $("input.togetherjs-share-link").val(session.shareId ? session.shareUrl() : "");
}

session.on("close", function () {

  if($.isMobile()) {
    // remove bg overlay
    //$(".overlay").remove();

    //after hitting End, reset window draggin
    $("body").css({
      "position": "",
      top: "",
      left: ""
    });

  }

  if (ui.container) {
    ui.container.remove();
    ui.container = null;
  }
  // Clear out any other spurious elements:
  $(".togetherjs").remove();
  if (TogetherJS.startTarget) {
    var el = $(TogetherJS.startTarget);
    if (el.attr("data-start-togetherjs-html")) {
      el.html(el.attr("data-start-togetherjs-html"));
    }
    el.removeClass("togetherjs-started");
  }
});

ui.chat = {
  text: function (attrs) {
    assert(typeof attrs.text == "string");
    assert(attrs.peer);
    assert(attrs.messageId);
    var date = attrs.date || Date.now();
    var lastEl = ui.container.find("#togetherjs-chat .togetherjs-chat-message");
    if (lastEl.length) {
      lastEl = $(lastEl[lastEl.length-1]);
    }
    var lastDate = null;
    if (lastEl) {
      lastDate = parseInt(lastEl.attr("data-date"), 10);
    }
    if (lastEl && lastEl.attr("data-person") == attrs.peer.id &&
        lastDate && date < lastDate + COLLAPSE_MESSAGE_LIMIT) {
      lastEl.attr("data-date", date);
      var content = lastEl.find(".togetherjs-chat-content");
      assert(content.length);
      attrs.text = content.text() + "\n" + attrs.text;
      attrs.messageId = lastEl.attr("data-message-id");
      lastEl.remove();
    }
    var el = templating.sub("chat-message", {
      peer: attrs.peer,
      content: attrs.text,
      date: date
    });
    linkify(el.find(".togetherjs-chat-content"));
    el.attr("data-person", attrs.peer.id)
      .attr("data-date", date)
      .attr("data-message-id", attrs.messageId);
    ui.chat.add(el, attrs.messageId, attrs.notify);
  },

  joinedSession: function (attrs) {
    assert(attrs.peer);
    var date = attrs.date || Date.now();
    var el = templating.sub("chat-joined", {
      peer: attrs.peer,
      date: date
    });
    // FIXME: should bind the notification to the dock location
    ui.chat.add(el, attrs.peer.className("join-message-"), 4000);
  },

  leftSession: function (attrs) {
    assert(attrs.peer);
    var date = attrs.date || Date.now();
    var el = templating.sub("chat-left", {
      peer: attrs.peer,
      date: date,
      declinedJoin: attrs.declinedJoin
    });
    // FIXME: should bind the notification to the dock location
    ui.chat.add(el, attrs.peer.className("join-message-"), 4000);
  },

  system: function (attrs) {
    assert(! attrs.peer);
    assert(typeof attrs.text == "string");
    var date = attrs.date || Date.now();
    var el = templating.sub("chat-system", {
      content: attrs.text,
      date: date
    });
    ui.chat.add(el, undefined, true);
  },

  clear: deferForContainer(function () {
    var container = ui.container.find("#togetherjs-chat-messages");
    container.empty();
  }),

  urlChange: function (attrs) {
    assert(attrs.peer);
    assert(typeof attrs.url == "string");
    assert(typeof attrs.sameUrl == "boolean");
    var messageId = attrs.peer.className("url-change-");
    // FIXME: duplicating functionality in .add():
    var realId = "togetherjs-chat-" + messageId;
    var date = attrs.date || Date.now();
    var title;
    // FIXME: strip off common domain from msg.url?  E.g., if I'm on
    // http://example.com/foobar, and someone goes to http://example.com/baz then
    // show only /baz
    // FIXME: truncate long titles
    if (attrs.title) {
      title = attrs.title + " (" + attrs.url + ")";
    } else {
      title = attrs.url;
    }
    var el = templating.sub("chat-url-change", {
      peer: attrs.peer,
      date: date,
      href: attrs.url,
      title: title,
      sameUrl: attrs.sameUrl
    });
    el.find(".togetherjs-nudge").click(function () {
      attrs.peer.nudge();
      return false;
    });
    el.find(".togetherjs-follow").click(function () {
      var url = attrs.peer.url;
      if (attrs.peer.urlHash) {
        url += attrs.peer.urlHash;
      }
      location.href = url;
    });
    var notify = ! attrs.sameUrl;
    if (attrs.sameUrl && ! $("#" + realId).length) {
      // Don't bother showing a same-url notification, if no previous notification
      // had been shown
      return;
    }
    ui.chat.add(el, messageId, notify);
  },

  invite: function (attrs) {
    assert(attrs.peer);
    assert(typeof attrs.url == "string");
    var messageId = attrs.peer.className("invite-");
    var date = attrs.date || Date.now();
    var hrefTitle = attrs.url.replace(/\#?&togetherjs=.*/, "").replace(/^\w+:\/\//, "");
    var el = templating.sub("invite", {
      peer: attrs.peer,
      date: date,
      href: attrs.url,
      hrefTitle: hrefTitle,
      forEveryone: attrs.forEveryone
    });
    if (attrs.forEveryone) {
      el.find("a").click(function () {
        // FIXME: hacky way to do this:
        chat().submit("Followed link to " + attrs.url);
      });
    }
    ui.chat.add(el, messageId, true);
  },

  hideTimeout: null,

  add: deferForContainer(function (el, id, notify) {
    if (id) {
      el.attr("id", "togetherjs-chat-" + util.safeClassName(id));
    }
    var container = ui.container.find("#togetherjs-chat-messages");
    assert(container.length);
    var popup = ui.container.find("#togetherjs-chat-notifier");
    container.append(el);
    ui.chat.scroll();
    var doNotify = !! notify;
    var section = popup.find("#togetherjs-chat-notifier-message");
    if (notify && visibilityApi.hidden()) {
      ui.container.find("#togetherjs-notification")[0].play();
    }
    if (id && section.data("message-id") == id) {
      doNotify = true;
    }
    if (container.is(":visible")) {
      doNotify = false;
    }
    if (doNotify) {
      section.empty();
      section.append(el.clone(true, true));
      if (section.data("message-id") != id)  {
        section.data("message-id", id || "");
        windowing.show(popup);
      } else if (! popup.is(":visible")) {
        windowing.show(popup);
      }
      if (typeof notify == "number") {
        // This is the amount of time we're supposed to notify
        if (this.hideTimeout) {
          clearTimeout(this.hideTimeout);
          this.hideTimeout = null;
        }
        this.hideTimeout = setTimeout((function () {
          windowing.hide(popup);
          this.hideTimeout = null;
        }).bind(this), notify);
      }
    }
  }),

  scroll: deferForContainer(function () {
    var container = ui.container.find("#togetherjs-chat-messages")[0];
    container.scrollTop = container.scrollHeight;
  })

};

session.on("display-window", function (id, win) {
  if (id == "togetherjs-chat") {
    ui.chat.scroll();
    windowing.hide("#togetherjs-chat-notifier");
  }
});

/* This class is bound to peers.Peer instances as peer.view.
   The .update() method is regularly called by peer objects when info changes. */
ui.PeerView = class PeerView {

  constructor(peer) {
    assert(peer.isSelf !== undefined, "PeerView instantiated with non-Peer object");
    this.peer = peer;
    // Bound once, so that destroy()'s off() can match what dock() registered.
    this.maybeHideDetailWindow = this.maybeHideDetailWindow.bind(this);
  }

  /* Takes an element and sets any person-related attributes on the element
     Different from updates, which use the class names we set here: */
  setElement(el) {
    var count = 0;
    var classes = ["togetherjs-person", "togetherjs-person-status",
                   "togetherjs-person-name", "togetherjs-person-name-abbrev",
                   "togetherjs-person-bgcolor", "togetherjs-person-swatch",
                   "togetherjs-person-status", "togetherjs-person-role",
                   "togetherjs-person-url", "togetherjs-person-url-title",
                   "togetherjs-person-bordercolor"];
    classes.forEach(function (cls) {
      var els = el.find("." + cls);
      els.addClass(this.peer.className(cls + "-"));
      count += els.length;
    }, this);
    if (! count) {
      console.warn("setElement(", el, ") doesn't contain any person items");
    }
    this.updateDisplay(el);
  }

  updateDisplay(container) {
    whenContainerReady(this, this._updateDisplay, [container]);
  }

  _updateDisplay(container) {
    container = container || ui.container;
    var abbrev = this.peer.name;
    if (this.peer.isSelf) {
      abbrev = "me";
    }
    container.find("." + this.peer.className("togetherjs-person-name-")).text(this.peer.name || "");
    container.find("." + this.peer.className("togetherjs-person-name-abbrev-")).text(abbrev);
    var avatarEl = container.find("." + this.peer.className("togetherjs-person-"));
    if (this.peer.avatar) {
      util.assertValidUrl(this.peer.avatar);
      avatarEl.css({
        backgroundImage: "url(" + this.peer.avatar + ")"
      });
    }
    if (this.peer.idle == "inactive") {
      avatarEl.addClass("togetherjs-person-inactive");
    } else {
      avatarEl.removeClass("togetherjs-person-inactive");
    }
    avatarEl.attr("title", this.peer.name);
    if (this.peer.color) {
      avatarEl.css({
        borderColor: this.peer.color
      });
      avatarEl.find(".togetherjs-person-avatar-swatch").css({
        borderTopColor: this.peer.color,
        borderRightColor: this.peer.color
      });
    }
    if (this.peer.color) {
      var colors = container.find("." + this.peer.className("togetherjs-person-bgcolor-"));
      colors.css({
        backgroundColor: this.peer.color
      });
      colors = container.find("." + this.peer.className("togetherjs-person-bordercolor-"));
      colors.css({
        borderColor: this.peer.color
      });
    }
    container.find("." + this.peer.className("togetherjs-person-role-"))
      .text(this.peer.isCreator ? "Creator" : "Participant");
    var urlName = this.peer.title || "";
    if (this.peer.title) {
      urlName += " (";
    }
    urlName += util.truncateCommonDomain(this.peer.url, location.href);
    if (this.peer.title) {
      urlName += ")";
    }
    container.find("." + this.peer.className("togetherjs-person-url-title-"))
      .text(urlName);
    var url = this.peer.url;
    if (this.peer.urlHash) {
      url += this.peer.urlHash;
    }
    container.find("." + this.peer.className("togetherjs-person-url-"))
      .attr("href", url);
    // FIXME: should have richer status:
    container.find("." + this.peer.className("togetherjs-person-status-"))
      .text(this.peer.idle == "active" ? "Active" : "Inactive");
    if (this.peer.isSelf) {
      // FIXME: these could also have consistent/reliable class names:
      var selfName = $(".togetherjs-self-name");
      selfName.each((function (index, el) {
        el = $(el);
        if (el.val() != this.peer.name) {
          el.val(this.peer.name);
        }
      }).bind(this));
      var menuAvatar = $(".togetherjs-menu-avatar");
      if (this.peer.avatar) {
        menuAvatar.css({backgroundImage: "url(" + this.peer.avatar + ")"});
      } else {
        menuAvatar.css({backgroundImage: ""});
      }
      menuAvatar.css({borderColor: this.peer.color});
      if (! this.peer.name) {
        $("#togetherjs-menu .togetherjs-person-name-self").text(this.peer.defaultName);
      }
    }
    if (this.peer.url != session.currentUrl()) {
      container.find("." + this.peer.className("togetherjs-person-"))
          .addClass("togetherjs-person-other-url");
    } else {
      container.find("." + this.peer.className("togetherjs-person-"))
          .removeClass("togetherjs-person-other-url");
    }
    if (this.peer.following) {
      if (this.followCheckbox) {
        this.followCheckbox.prop("checked", true);
      }
    } else {
      if (this.followCheckbox) {
        this.followCheckbox.prop("checked", false);
      }
    }
    // FIXME: add some style based on following?
    updateChatParticipantList();
    this.updateFollow();
  }

  update() {
    if (! this.peer.isSelf) {
      if (this.peer.status == "live") {
        this.dock();
      } else {
        this.undock();
      }
    }
    this.updateDisplay();
    this.updateUrlDisplay();
  }

  updateUrlDisplay(force) {
    var url = this.peer.url;
    if ((! url) || (url == this._lastUpdateUrlDisplay && ! force)) {
      return;
    }
    this._lastUpdateUrlDisplay = url;
    var sameUrl = url == session.currentUrl();
    ui.chat.urlChange({
      peer: this.peer,
      url: this.peer.url,
      title: this.peer.title,
      sameUrl: sameUrl
    });
  }

  urlNudge() {
    // FIXME: do something more distinct here
    this.updateUrlDisplay(true);
  }

  notifyJoined() {
    ui.chat.joinedSession({
      peer: this.peer
    });
  }

  // when there are too many participants in the dock, consolidate the participants to one avatar, and on mouseOver, the dock expands down to reveal the rest of the participants
  // if there are X users in the session
  // then hide the users in the dock
  // and shrink the size of the dock
  // and if you rollover the dock, it expands and reveals the rest of the participants in the dock

  dock() {
    whenContainerReady(this, this._dock, []);
  }

  _dock() {
    if (this.dockElement) {
      return;
    }
    this.dockElement = templating.sub("dock-person", {
      peer: this.peer
    });
    this.dockElement.attr("id", this.peer.className("togetherjs-dock-element-"));
    ui.container.find("#togetherjs-dock-participants").append(this.dockElement);
    animateDockEntry(this.dockElement.find(".togetherjs-person"));
    this.detailElement = templating.sub("participant-window", {
      peer: this.peer
    });
    this.detailElement.find(".togetherjs-follow").click(function () {
      location.href = $(this).attr("href");
    });
    this.detailElement.find(".togetherjs-nudge").click((function () {
      this.peer.nudge();
    }).bind(this));
    /* The follow checkbox is found by class and labelled by the <label> that
       wraps it. The template used to give every peer's copy the same id, so
       each clone had to be renamed here to keep the document's ids unique --
       and the handler below ran with `this` bound to the checkbox element,
       where `this.peer` is undefined, so unchecking the box threw. */
    this.followCheckbox = this.detailElement.find(".togetherjs-person-status-follow");
    this.followCheckbox.change((function () {
      if (! this.followCheckbox[0].checked) {
        this.peer.unfollow();
      }
      // Following doesn't happen until the window is closed
    }).bind(this));
    /* Bound and registered in the constructor instead: this runs on every
       dock(), so an undock/dock cycle used to leave a dead listener behind
       each time -- bound to a different function object each round, so the
       off() in destroy() could never find them. */
    session.on("hide-window", this.maybeHideDetailWindow);
    ui.container.append(this.detailElement);
    this.dockElement.click((function () {
      if (this.detailElement.is(":visible")) {
        windowing.hide(this.detailElement);
      } else {
        windowing.show(this.detailElement, {bind: this.dockElement});
        this.scrollTo();
        this.cursor().element.animate({
          opacity:0.3
        }).animate({
          opacity:1
        }).animate({
          opacity:0.3
        }).animate({
          opacity:1
        });
      }
    }).bind(this));
    this.updateFollow();
  }

  undock() {
    if (! this.dockElement) {
      return;
    }
    animateDockExit(this.dockElement).then((function () {
      this.dockElement.remove();
      this.dockElement = null;
      this.detailElement.remove();
      this.detailElement = null;
    }).bind(this));
  }

  scrollTo() {
    if (this.peer.url != session.currentUrl()) {
      return;
    }
    var pos = this.peer.scrollPosition;
    if (! pos) {
      console.warn("Peer has no scroll position:", this.peer);
      return;
    }
    pos = elementFinder.pixelForPosition(pos);
    easeTo(pos);
  }

  updateFollow() {
    if (! this.peer.url) {
      return;
    }
    if (! this.detailElement) {
      return;
    }
    var same = this.detailElement.find(".togetherjs-same-url");
    var different = this.detailElement.find(".togetherjs-different-url");
    if (this.peer.url == session.currentUrl()) {
      same.show();
      different.hide();
    } else {
      same.hide();
      different.show();
    }
  }

  maybeHideDetailWindow(windows) {
    if (this.detailElement && windows[0] && windows[0][0] === this.detailElement[0]) {
      if (this.followCheckbox && this.followCheckbox[0] && this.followCheckbox[0].checked) {
        this.peer.follow();
      } else {
        this.peer.unfollow();
      }
    }
  }

  cursor() {
    return need("cursor").getClient(this.peer.id);
  }

  destroy() {
    // FIXME: should I get rid of the dockElement?
    session.off("hide-window", this.maybeHideDetailWindow);
  }
};


function updateChatParticipantList() {
  var live = peers.getAllPeers(true);
  if (live.length) {
    ui.displayToggle("#togetherjs-chat-participants");
    $("#togetherjs-chat-participant-list").text(
      live.map(function (p) {return p.name;}).join(", "));
  } else {
    ui.displayToggle("#togetherjs-chat-no-participants");
  }
}

function inviteHubUrl() {
  var base = TogetherJS.config.get("inviteFromRoom");
  assert(base);
  return util.makeUrlAbsolute(base, session.hubUrl());
}

var inRefresh = false;

function refreshInvite() {
  if (inRefresh) {
    return;
  }
  inRefresh = true;
  {
    var who = need("who");
    var def = who.getList(inviteHubUrl());
    function addUser(user, before) {
      var item = templating.sub("invite-user-item", {peer: user});
      item.attr("data-clientid", user.id);
      if (before) {
        item.insertBefore(before);
      } else {
        $("#togetherjs-invite-users").append(item);
      }
      item.click(function() {
        invite(user.clientId);
      });
    }
    function refresh(users, finished) {
      var sorted = [];
      for (var id in users) {
        if (users.hasOwnProperty(id)) {
          sorted.push(users[id]);
        }
      }
      sorted.sort(function (a, b) {
        return a.name < b.name ? -1 : 1;
      });
      var pos = 0;
      ui.container.find("#togetherjs-invite-users .togetherjs-menu-item").each(function () {
        var $this = $(this);
        if (finished && ! users[$this.attr("data-clientid")]) {
          $this.remove();
          return;
        }
        if (pos >= sorted.length) {
          return;
        }
        while (pos < sorted.length && $this.attr("data-clientid") !== sorted[pos].id) {
          addUser(sorted[pos], $this);
          pos++;
        }
        while (pos < sorted.length && $this.attr("data-clientid") == sorted[pos].id) {
          pos++;
        }
      });
      for (var i=pos; i<sorted.length; i++) {
        addUser(sorted[pos]);
      }
    }
    def.then(function (users) {
      refresh(users, true);
      inRefresh = false;
    });
    def.progress(refresh);
  }
}

session.hub.on("invite", function (msg) {
  if (msg.forClientId && msg.clientId != peers.Self.id) {
    return;
  }
  var peer = new (need("who").ExternalPeer)(msg.userInfo.clientId, msg.userInfo);
  ui.chat.invite({peer: peer, url: msg.url, forEveryone: ! msg.forClientId});
});

function invite(clientId) {
  // FIXME: use the return value of this to give a signal that
  // the invite has been successfully sent:
  need("who").invite(inviteHubUrl(), clientId).then(function () {
    hideMenu();
  });
}

ui.showUrlChangeMessage = deferForContainer(function (peer, url) {
  var window = templating.sub("url-change", {peer: peer});
  ui.container.append(window);
  windowing.show(window);
});

session.hub.on("url-change-nudge", function (msg) {
  if (msg.to && msg.to != session.clientId) {
    // Not directed to us
    return;
  }
  msg.peer.urlNudge();
});

session.on("new-element", function (el) {
  if (TogetherJS.config.get("toolName")) {
    ui.updateToolName(el);
  }
});

var setToolName = false;
ui.updateToolName = function (container) {
  container = container || $(document.body);
  var name = TogetherJS.config.get("toolName");
  if (setToolName && ! name) {
    name = "TogetherJS";
  }
  if (name) {
    container.find(".togetherjs-tool-name").text(name);
    setToolName = true;
  }
};

TogetherJS.config.track("toolName", function (name) {
  ui.updateToolName(ui.container);
});

provide("ui", ui);

export default ui;
