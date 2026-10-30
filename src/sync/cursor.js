/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Cursor viewing support

import { provide } from "../core/registry.js";
import TogetherJS from "../core/togetherjs.js";
import $ from "../dom/dom.js";
import { animateKeyboard, stopKeyboardAnimation } from "../dom/animate.js";
import util from "../core/util.js";
import session from "../core/session.js";
import elementFinder from "../dom/elementFinder.js";
import eventMaker from "../dom/eventMaker.js";
import peers from "../core/peers.js";
import templating from "../dom/templating.js";
import { foregroundFor } from "../ui/palette.js";

var assert = util.assert;
var cursor = util.Module("cursor");

var CURSOR_HEIGHT = 50;
// Number of milliseconds after page load in which a scroll-update
// related hello-back message will be processed:
var SCROLL_UPDATE_CUTOFF = 2000;
// How long after receiving a setKeydown call we should keep showing the user
// as typing. Must be more than MIN_KEYDOWN_TIME, below.
var KEYDOWN_WAIT_TIME = 2000;

session.hub.on("cursor-update", function (msg) {
  if (msg.sameUrl) {
    Cursor.getClient(msg.clientId).updatePosition(msg);
  } else {
    // FIXME: This should be caught even before the cursor-update message,
    // when the peer goes to another URL
    Cursor.getClient(msg.clientId).hideOtherUrl();
  }
});

// FIXME: should check for a peer leaving and remove the cursor object
class Cursor {

  constructor(clientId) {
    this.clientId = clientId;
    this.element = templating.clone("cursor");
    this.elementClass = "togetherjs-scrolled-normal";
    this.element.addClass(this.elementClass);
    this.updatePeer(peers.getPeer(clientId));
    this.lastTop = this.lastLeft = null;
    $(document.body).append(this.element);

    this.keydownTimeout = null;
    this.speaking = false;
    this.clearKeydown = this.clearKeydown.bind(this);
    this.atOtherUrl = false;
  }

  updatePeer(peer) {
    // FIXME: can I use peer.setElement()?
    /* One custom property carries the peer's colour to both the arrow's fill
       and the name bubble's ring; the bubble's own fill and text come from
       the theme, so a label is legible whatever colour the peer picked. */
    this.element.css({
      color: peer.color,
      "--tj-peer-color": peer.color,
      // The bubble is filled with the peer's colour, so its text has to be
      // whichever of black or white reads against that particular colour.
      "--tj-peer-text": foregroundFor(peer.color),
    });
    var name = this.element.find(".togetherjs-cursor-label");
    assert(name.length);
    name.text(peer.name);
    // FIXME: should I just remove the element?
    /* A peer that is no longer live fades out whole. The original animated
       the label's width, height and padding down to zero in two steps, which
       collapsed it sideways; now that the label is a flex row with a border
       that read as a squashing pill rather than a departure. */
    if (peer.status != "live") {
      this.element.animate({opacity: 0}, 350);
    } else {
      this.element.animate({opacity: 1}, 200);
    }
  }

  setClass(name) {
    if (name != this.elementClass) {
      this.element.removeClass(this.elementClass).addClass(name);
      this.elementClass = name;
    }
  }

  updatePosition(pos) {
    var top, left;
    if (this.atOtherUrl) {
      this.element.show();
      this.atOtherUrl = false;
    }
    if (pos.element) {
      var target = $(elementFinder.findElement(pos.element));
      var offset = target.offset();
      top = offset.top + pos.offsetY;
      left = offset.left + pos.offsetX;
    } else {
      // No anchor, just an absolute position
      top = pos.top;
      left = pos.left;
    }
    // These are saved for use by .refresh():
    this.lastTop = top;
    this.lastLeft = left;
    this.setPosition(top, left);
  }

  hideOtherUrl() {
    if (this.atOtherUrl) {
      return;
    }
    this.atOtherUrl = true;
    // FIXME: should show away status better:
    this.element.hide();
  }


  setPosition(top, left) {
    var wTop = $(window).scrollTop();
    var height = $(window).height();

    if (top < wTop) {
      // FIXME: this is a totally arbitrary number, but is meant to be big enough
      // to keep the cursor name from being off the top of the screen.
      top = 25;
      this.setClass("togetherjs-scrolled-above");
    } else if (top > wTop + height - CURSOR_HEIGHT) {
      top = height - CURSOR_HEIGHT - 5;
      this.setClass("togetherjs-scrolled-below");
    } else {
      this.setClass("togetherjs-scrolled-normal");
    }
    this.element.css({
      top: top,
      left: left
    });
  }

  refresh() {
    if (this.lastTop !== null) {
      this.setPosition(this.lastTop, this.lastLeft);
    }
  }

  setKeydown() {
    if (this.keydownTimeout) {
      clearTimeout(this.keydownTimeout);
    } else {
      animateKeyboard(this.element.find(".togetherjs-cursor-typing"));
    }
    this.keydownTimeout = setTimeout(this.clearKeydown, KEYDOWN_WAIT_TIME);
    this._refreshStatus();
  }

  clearKeydown() {
    this.keydownTimeout = null;
    stopKeyboardAnimation(this.element.find(".togetherjs-cursor-typing").hide());
    this._refreshStatus();
  }

  /* Whether this peer's microphone is currently carrying speech. Worked out
     locally from their incoming audio by rtc/speaking.js, so it only ever
     fires for peers whose audio we actually receive. */
  setSpeaking(isSpeaking) {
    this.speaking = !!isSpeaking;
    this._refreshStatus();
  }

  /* Only one mark at a time, and speaking wins: someone talking while they
     type is better described as talking. */
  _refreshStatus() {
    var speakingEl = this.element.find(".togetherjs-cursor-speaking");
    var typingEl = this.element.find(".togetherjs-cursor-typing");
    if (this.speaking) {
      speakingEl.show();
      typingEl.hide();
    } else {
      speakingEl.hide();
      if (this.keydownTimeout) {
        typingEl.show();
      }
    }
  }

  _destroy() {
    this.element.remove();
    this.element = null;
  }
};


Cursor._cursors = {};

cursor.getClient = Cursor.getClient = function (clientId) {
  var c = Cursor._cursors[clientId];
  if (! c) {
    c = Cursor._cursors[clientId] = new Cursor(clientId);
  }
  return c;
};

Cursor.forEach = function (callback, context) {
  context = context || null;
  for (var a in Cursor._cursors) {
    if (Cursor._cursors.hasOwnProperty(a)) {
      callback.call(context, Cursor._cursors[a], a);
    }
  }
};

Cursor.destroy = function (clientId) {
  Cursor._cursors[clientId]._destroy();
  delete Cursor._cursors[clientId];
};

peers.on("new-peer identity-updated status-updated", function (peer) {
  var c = Cursor.getClient(peer.id);
  c.updatePeer(peer);
});

var lastTime = 0;
var MIN_TIME = 100;
var lastPosX = -1;
var lastPosY = -1;
var lastMessage = null;
function mousemove(event) {
  var now = Date.now();
  if (now - lastTime < MIN_TIME) {
    return;
  }
  lastTime = now;
  var pageX = event.pageX;
  var pageY = event.pageY;
  if (Math.abs(lastPosX - pageX) < 3 && Math.abs(lastPosY - pageY) < 3) {
    // Not a substantial enough change
    return;
  }
  lastPosX = pageX;
  lastPosY = pageY;
  var target = event.target;
  var parent = $(target).closest(".togetherjs-window, .togetherjs-menu, #togetherjs-dock");
  if (parent.length) {
    target = parent[0];
  } else if (elementFinder.ignoreElement(target)) {
    target = null;
  }
  if ((! target) || target == document.documentElement || target == document.body) {
    lastMessage = {
      type: "cursor-update",
      top: pageY,
      left: pageX
    };
    session.send(lastMessage);
    return;
  }
  target = $(target);
  var offset = target.offset();
  if (! offset) {
    // FIXME: this really is walkabout.js's problem to fire events on the
    // document instead of a specific element
    console.warn("Could not get offset of element:", target[0]);
    return;
  }
  var offsetX = pageX - offset.left;
  var offsetY = pageY - offset.top;
  lastMessage = {
    type: "cursor-update",
    element: elementFinder.elementLocation(target),
    offsetX: Math.floor(offsetX),
    offsetY: Math.floor(offsetY)
  };
  session.send(lastMessage);
}

var scrollTimeout = null;
var scrollTimeoutSet = 0;
var SCROLL_DELAY_TIMEOUT = 75;
var SCROLL_DELAY_LIMIT = 300;

function scroll() {
  var now = Date.now();
  if (scrollTimeout) {
    if (now - scrollTimeoutSet < SCROLL_DELAY_LIMIT) {
      clearTimeout(scrollTimeout);
    } else {
      // Just let it progress anyway
      return;
    }
  }
  scrollTimeout = setTimeout(_scrollRefresh, SCROLL_DELAY_TIMEOUT);
  if (! scrollTimeoutSet) {
    scrollTimeoutSet = now;
  }
}

var lastScrollMessage = null;
function _scrollRefresh() {
  scrollTimeout = null;
  scrollTimeoutSet = 0;
  Cursor.forEach(function (c) {
    c.refresh();
  });
  lastScrollMessage = {
    type: "scroll-update",
    position: elementFinder.elementByPixel($(window).scrollTop())
  };
  session.send(lastScrollMessage);
}

// FIXME: do the same thing for cursor position?  And give up on the
// ad hoc update-on-hello?
session.on("prepare-hello", function (helloMessage) {
  if (lastScrollMessage) {
    helloMessage.scrollPosition = lastScrollMessage.position;
  }
});

session.hub.on("scroll-update", function (msg) {
  msg.peer.scrollPosition = msg.position;
  if (msg.peer.following) {
    msg.peer.view.scrollTo();
  }
});

// In case there are multiple peers, we track that we've accepted one of their
// hello-based scroll updates, just so we don't bounce around (we don't intelligently
// choose which one to use, just the first that comes in)
var acceptedScrollUpdate = false;
session.hub.on("hello-back hello", function (msg) {
  if (msg.type == "hello") {
    // Once a hello comes in, a bunch of hello-backs not intended for us will also
    // come in, and we should ignore them
    acceptedScrollUpdate = true;
  }
  if (! msg.scrollPosition) {
    return;
  }
  msg.peer.scrollPosition = msg.scrollPosition;
  if ((! acceptedScrollUpdate) &&
      msg.sameUrl &&
      Date.now() - session.timeHelloSent < SCROLL_UPDATE_CUTOFF) {
    acceptedScrollUpdate = true;
    msg.peer.view.scrollTo();
  }
});

session.on("ui-ready", function () {
  $(document).mousemove(mousemove);
  document.addEventListener("click", documentClick, true);
  document.addEventListener("keydown", documentKeydown, true);
  $(window).scroll(scroll);
  scroll();
});

session.on("close", function () {
  Cursor.forEach(function (c, clientId) {
    Cursor.destroy(clientId);
  });
  $(document).off("mousemove", mousemove);
  document.removeEventListener("click", documentClick, true);
  document.removeEventListener("keydown", documentKeydown, true);
  $(window).off("scroll", scroll);
});

session.hub.on("hello", function (msg) {
  // Immediately get our cursor onto this new person's screen:
  if (lastMessage) {
    session.send(lastMessage);
  }
  if (lastScrollMessage) {
    session.send(lastScrollMessage);
  }
});

function documentClick(event) {
  if (event.togetherjsInternal) {
    // This is an artificial internal event
    return;
  }
  // FIXME: this might just be my imagination, but somehow I just
  // really don't want to do anything at this stage of the event
  // handling (since I'm catching every click), and I'll just do
  // something real soon:
  setTimeout(function () {
    if (! TogetherJS.running) {
      // This can end up running right after TogetherJS has been closed, often
      // because TogetherJS was closed with a click...
      return;
    }
    var element = event.target;
    if (element == document.documentElement) {
      // For some reason clicking on <body> gives the <html> element here
      element = document.body;
    }
    if (elementFinder.ignoreElement(element)) {
      return;
    }
    //Prevent click events on video objects to avoid conflicts with
    //togetherjs's own video events
    if (element.nodeName.toLowerCase() === 'video'){
      return;
    }

    var dontShowClicks = TogetherJS.config.get("dontShowClicks");
    var cloneClicks = TogetherJS.config.get("cloneClicks");
    // If you dont want to clone the click for this element
    // and you dont want to show the click for this element or you dont want to show any clicks
    // then return to avoid sending a useless click
    if ((! util.matchElement(element, cloneClicks)) && util.matchElement(element, dontShowClicks)) {
      return;
    }
    var location = elementFinder.elementLocation(element);
    var offset = $(element).offset();
    var offsetX = event.pageX - offset.left;
    var offsetY = event.pageY - offset.top;
    session.send({
      type: "cursor-click",
      element: location,
      offsetX: offsetX,
      offsetY: offsetY
    });
    if (util.matchElement(element, dontShowClicks)) {
      return;
    }
    displayClick({top: event.pageY, left: event.pageX}, peers.Self.color);
  });
}

var CLICK_TRANSITION_TIME = 3000;

session.hub.on("cursor-click", function (pos) {
  // When the click is calculated isn't always the same as how the
  // last cursor update was calculated, so we force the cursor to
  // the last location during a click:
  if (! pos.sameUrl) {
    // FIXME: if we *could have* done a local click, but we follow along
    // later, we'll be in different states if that click was important.
    // Mostly click cloning just won't work.
    return;
  }
  Cursor.getClient(pos.clientId).updatePosition(pos);
  var target = $(elementFinder.findElement(pos.element));
  var offset = target.offset();
  var top = offset.top + pos.offsetY;
  var left = offset.left + pos.offsetX;
  var cloneClicks = TogetherJS.config.get("cloneClicks");
  if (util.matchElement(target, cloneClicks)) {
    eventMaker.performClick(target);
  }
  var dontShowClicks = TogetherJS.config.get("dontShowClicks");
  if (util.matchElement(target, dontShowClicks)) {
    return;
  }
  displayClick({top: top, left: left}, pos.peer.color);
});

function displayClick(pos, color) {
  // FIXME: should we hide the local click if no one else is going to see it?
  // That means tracking who might be able to see our screen.
  var element = templating.clone("click");
  $(document.body).append(element);
  element.css({
    top: pos.top,
    left: pos.left,
    borderColor: color
  });
  setTimeout(function () {
    element.addClass("togetherjs-clicking");
  }, 100);
  setTimeout(function () {
    element.remove();
  }, CLICK_TRANSITION_TIME);
}

var lastKeydown = 0;
var MIN_KEYDOWN_TIME = 500;

function documentKeydown(event) {
  setTimeout(function () {
    var now = Date.now();
    if (now - lastKeydown < MIN_KEYDOWN_TIME) {
      return;
    }
    lastKeydown = now;
    // FIXME: is event.target interesting here?  That is, *what* the
    // user is typing into, not just that the user is typing?  Also
    // I'm assuming we don't care if the user it typing into a
    // togetherjs-related field, since chat activity is as interesting
    // as any other activity.
    session.send({type: "keydown"});
  });
}

session.on("peer-speaking", function (event) {
  if (event.peerId === session.clientId) {
    return;
  }
  Cursor.getClient(event.peerId).setSpeaking(event.speaking);
});

session.hub.on("keydown", function (msg) {
  // FIXME: when the cursor is hidden there's nothing to show with setKeydown().
  var cursor = Cursor.getClient(msg.clientId);
  cursor.setKeydown();
});

util.testExpose({Cursor: Cursor});

provide("cursor", cursor);

export default cursor;
