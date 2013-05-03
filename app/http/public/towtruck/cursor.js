/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Cursor viewing support

define(["jquery", "ui", "util", "session", "elementFinder", "tinycolor", "eventMaker", "peers"], function ($, ui, util, session, elementFinder, tinycolor, eventMaker, peers) {
  var assert = util.assert;

  var FOREGROUND_COLORS = ["#111", "#eee"];
  var CURSOR_HEIGHT = 50;
  var CURSOR_ANGLE = (35 / 180) * Math.PI;
  var CURSOR_WIDTH = Math.ceil(Math.sin(CURSOR_ANGLE) * CURSOR_HEIGHT);

  session.hub.on("cursor-update", function (msg) {
    if (msg.sameUrl) {
      Cursor.getClient(msg.clientId).updatePosition(msg);
    } else {
      // FIXME: This should be caught even before the cursor-update message,
      // when the peer goes to another URL
      Cursor.getClient(msg.clientId).hideOtherUrl(msg);
    }
  });

  // FIXME: should check for a peer leaving and remove the cursor object

  var Cursor = util.Class({

    constructor: function (clientId) {
      this.clientId = clientId;
      this.element = ui.cloneTemplate("cursor");
      this.elementClass = "towtruck-scrolled-normal";
      this.element.addClass(this.elementClass);
      this.updatePeer(peers.getPeer(clientId));
      this.lastTop = this.lastLeft = null;
      $(document.body).append(this.element);
      this.keydownTimeout = null;
      this.clearKeydown = this.clearKeydown.bind(this);
      this.atOtherUrl = false;
    },

    // How long after receiving a setKeydown call that we should show the
    // user typing.  This should be more than MIN_KEYDOWN_TIME:
    KEYDOWN_WAIT_TIME: 2000,

    updatePeer: function (peer) {
      // FIXME: can I use peer.setElement()?
      this.element.css({color: peer.color});
      var img = this.element.find("img.towtruck-cursor-img");
      img.attr("src", makeCursor(peer.color));
      var name = this.element.find(".towtruck-cursor-name");
      var nameContainer = this.element.find(".towtruck-cursor-container");
      assert(name.length);
      name.text(peer.name);
      nameContainer.css({
        backgroundColor: peer.color,
        color: tinycolor.mostReadable(peer.color, FOREGROUND_COLORS)
      });
      // FIXME: should I just remove the element?
      if (peer.status != "live") {
        this.element.hide();
      } else {
        this.element.show();
      }
    },

    setClass: function (name) {
      if (name != this.elementClass) {
        this.element.removeClass(this.elementClass).addClass(name);
        this.elementClass = name;
      }
    },

    updatePosition: function (pos) {
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
    },

    hideOtherUrl: function (msg) {
      if (this.atOtherUrl) {
        return;
      }
      this.atOtherUrl = true;
      // FIXME: should show away status better:
      this.element.hide();
    },

    setPosition: function (top, left) {
      var wTop = $(window).scrollTop();
      var height = $(window).height();
      if (top < wTop) {
        // FIXME: this is a totally arbitrary number, but is meant to be big enough
        // to keep the cursor name from being off the top of the screen.
        top = 25;
        this.setClass("towtruck-scrolled-above");
      } else if (top > wTop + height - CURSOR_HEIGHT) {
        top = height - CURSOR_HEIGHT - 5;
        this.setClass("towtruck-scrolled-below");
      } else {
        this.setClass("towtruck-scrolled-normal");
      }
      this.element.css({
        top: top,
        left: left
      });
    },

    refresh: function () {
      if (this.lastTop !== null) {
        this.setPosition(this.lastTop, this.lastLeft);
      }
    },

    setKeydown: function () {
      if (this.keydownTimeout) {
        clearTimeout(this.keydownTimeout);
      } else {
        this.element.find(".towtruck-cursor-typing").show();
      }
      this.keydownTimeout = setTimeout(this.clearKeydown, this.KEYDOWN_WAIT_TIME);
    },

    clearKeydown: function () {
      this.keydownTimeout = null;
      this.element.find(".towtruck-cursor-typing").hide();
    },

    _destroy: function () {
      this.element.remove();
      this.element = null;
    }
  });

  Cursor._cursors = {};

  Cursor.getClient = function (clientId) {
    var c = Cursor._cursors[clientId];
    if (! c) {
      c = Cursor._cursors[clientId] = Cursor(clientId);
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
    var parent = $(target).closest(".towtruck-window, .towtruck-popup, #towtruck-interface");
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

  function makeCursor(color) {
    var canvas = $("<canvas></canvas>");
    canvas.attr("height", CURSOR_HEIGHT);
    canvas.attr("width", CURSOR_WIDTH);
    var context = canvas[0].getContext('2d');
    context.fillStyle = color;
    context.moveTo(0, 0);
    context.beginPath();
    context.lineTo(0, CURSOR_HEIGHT/1.2);
    context.lineTo(Math.sin(CURSOR_ANGLE/2) * CURSOR_HEIGHT / 1.5,
                   Math.cos(CURSOR_ANGLE/2) * CURSOR_HEIGHT / 1.5);
    context.lineTo(Math.sin(CURSOR_ANGLE) * CURSOR_HEIGHT / 1.2,
                   Math.cos(CURSOR_ANGLE) * CURSOR_HEIGHT / 1.2);
    context.lineTo(0, 0);
    context.shadowColor = 'rgba(0,0,0,0.3)';
    context.shadowBlur = 2;
    context.shadowOffsetX = 1;
    context.shadowOffsetY = 2;
	context.strokeStyle = "#ffffff";
	context.stroke();
    context.fill();
    return canvas[0].toDataURL("image/png");
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

  session.hub.on("scroll-update", function (msg) {
    msg.peer.scrollPosition = msg.position;
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
    $(document).unbind("mousemove", mousemove);
    document.removeEventListener("click", documentClick, true);
    document.removeEventListener("keydown", documentKeydown, true);
    $(window).unbind("scroll", scroll);
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
    if (event.towtruckInternal) {
      // This is an artificial internal event
      return;
    }
    // FIXME: this might just be my imagination, but somehow I just
    // really don't want to do anything at this stage of the event
    // handling (since I'm catching every click), and I'll just do
    // something real soon:
    setTimeout(function () {
      if (! TowTruck.running) {
        // This can end up running right after TowTruck has been closed, often
        // because TowTruck was closed with a click...
        return;
      }
      if (elementFinder.ignoreElement(event.target)) {
        return;
      }
      var location = elementFinder.elementLocation(event.target);
      var offset = $(event.target).offset();
      var offsetX = event.pageX - offset.left;
      var offsetY = event.pageY - offset.top;
      session.send({
        type: "cursor-click",
        element: location,
        offsetX: offsetX,
        offsetY: offsetY
      });
      displayClick({top: event.pageY, left: event.pageX});
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
    var element = ui.cloneTemplate("click");
    var target = $(elementFinder.findElement(pos.element));
    var offset = target.offset();
    var top = offset.top + pos.offsetY;
    var left = offset.left + pos.offsetX;
    displayClick({top: top, left: left});
    var cloneClicks = TowTruck.getConfig("cloneClicks");
    if (cloneClicks && target.is(cloneClicks)) {
      eventMaker.performClick(target);
    }
  });

  function displayClick(pos) {
    // FIXME: should we hide the local click if no one else is going to see it?
    // That means tracking who might be able to see our screen.
    var element = ui.cloneTemplate("click");
    $(document.body).append(element);
    element.css({
      top: pos.top,
      left: pos.left
    });
    setTimeout(function () {
      element.addClass("towtruck-clicking");
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
      // towtruck-related field, since chat activity is as interesting
      // as any other activity.
      session.send({type: "keydown"});
    });
  }

  session.hub.on("keydown", function (msg) {
    // FIXME: when the cursor is hidden there's nothing to show with setKeydown().
    var cursor = Cursor.getClient(msg.clientId);
    cursor.setKeydown();
  });

  if (TowTruckTestSpy) {
    TowTruckTestSpy.Cursor = Cursor;
  }

});
