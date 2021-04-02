/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
define(["require", "exports", "./elementFinder", "./eventMaker", "./peers", "./session", "./templating", "./util"], function (require, exports, elementFinder_1, eventMaker_1, peers_1, session_1, templating_1, util_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.cursor = void 0;
    // Cursor viewing support
    //function cursorMain($: JQueryStatic, _ui: TogetherJSNS.Ui, util: TogetherJSNS.Util, session: TogetherJSNS.Session, elementFinder: TogetherJSNS.ElementFinder, eventMaker: TogetherJSNS.EventMaker, peers: TogetherJSNS.Peers, templating: TogetherJSNS.Templating) {
    var assert = util_1.util.assert.bind(util_1.util);
    var CURSOR_HEIGHT = 50;
    var CURSOR_ANGLE = (35 / 180) * Math.PI;
    var CURSOR_WIDTH = Math.ceil(Math.sin(CURSOR_ANGLE) * CURSOR_HEIGHT);
    // Number of milliseconds after page load in which a scroll-update
    // related hello-back message will be processed:
    var SCROLL_UPDATE_CUTOFF = 2000;
    session_1.session.hub.on("cursor-update", function (msg) {
        if (msg.sameUrl) {
            Cursor.getClient(msg.clientId).updatePosition(msg);
        }
        else {
            // FIXME: This should be caught even before the cursor-update message,
            // when the peer goes to another URL
            Cursor.getClient(msg.clientId).hideOtherUrl();
        }
    });
    // FIXME: should check for a peer leaving and remove the cursor object
    var Cursor = /** @class */ (function () {
        function Cursor(clientId) {
            this.clientId = clientId;
            // How long after receiving a setKeydown call that we should show the user typing.  This should be more than MIN_KEYDOWN_TIME:
            this.KEYDOWN_WAIT_TIME = 2000;
            this.lastTop = null;
            this.lastLeft = null;
            this.keydownTimeout = null;
            this.atOtherUrl = false;
            this.element = templating_1.templating.clone("cursor");
            this.elementClass = "togetherjs-scrolled-normal";
            this.element.addClass(this.elementClass);
            var peer = peers_1.peers.getPeer(this.clientId);
            if (peer !== null) {
                this.updatePeer(peer);
            }
            else {
                console.error("Could not find a peer with id", this.clientId);
            }
            $(document.body).append(this.element);
            this.element.animateCursorEntry();
        }
        Cursor.prototype.updatePeer = function (peer) {
            // FIXME: can I use peer.setElement()?
            this.element.css({ color: peer.color });
            var img = this.element.find("img.togetherjs-cursor-img");
            img.attr("src", makeCursor(peer.color));
            var name = this.element.find(".togetherjs-cursor-name");
            var nameContainer = this.element.find(".togetherjs-cursor-container");
            assert(name.length);
            name.text(peer.name); // TODO !
            nameContainer.css({
                backgroundColor: peer.color,
                color: "#000000" // TODO was tinycolor.mostReadable(peer.color, FOREGROUND_COLORS).toHex()
            });
            var path = this.element.find("svg path");
            path.attr("fill", peer.color);
            // FIXME: should I just remove the element?
            if (peer.status != "live") {
                //this.element.hide();
                this.element.find("svg").animate({
                    opacity: 0
                }, 350);
                this.element.find(".togetherjs-cursor-container").animate({
                    width: 34,
                    height: 20,
                    padding: 12,
                    margin: 0
                }, 200).animate({
                    width: 0,
                    height: 0,
                    padding: 0,
                    opacity: 0
                }, 200);
            }
            else {
                //this.element.show();
                this.element.animate({
                    opacity: 0.3
                }).animate({
                    opacity: 1
                });
            }
        };
        Cursor.prototype.setClass = function (name) {
            if (name != this.elementClass) {
                this.element.removeClass(this.elementClass).addClass(name);
                this.elementClass = name;
            }
        };
        Cursor.prototype.updatePosition = function (pos) {
            var top, left;
            if (this.atOtherUrl) {
                this.element.show();
                this.atOtherUrl = false;
            }
            if ("element" in pos) {
                var target = $(elementFinder_1.elementFinder.findElement(pos.element));
                var offset = target.offset(); // TODO !
                top = offset.top + pos.offsetY;
                left = offset.left + pos.offsetX;
            }
            else {
                // No anchor, just an absolute position
                top = pos.top;
                left = pos.left;
            }
            // These are saved for use by .refresh():
            this.lastTop = top;
            this.lastLeft = left;
            this.setPosition(top, left);
        };
        Cursor.prototype.hideOtherUrl = function () {
            if (this.atOtherUrl) {
                return;
            }
            this.atOtherUrl = true;
            // FIXME: should show away status better:
            this.element.hide();
        };
        // place Cursor rotate function down here FIXME: this doesnt do anything anymore.  This is in the CSS as an animation
        Cursor.prototype.rotateCursorDown = function () {
            var e = $(this.element).find('svg');
            e.animate({ borderSpacing: -150, opacity: 1 }, {
                step: function (now, fx) {
                    if (fx.prop == "borderSpacing") {
                        e.css('-webkit-transform', 'rotate(' + now + 'deg)')
                            .css('-moz-transform', 'rotate(' + now + 'deg)')
                            .css('-ms-transform', 'rotate(' + now + 'deg)')
                            .css('-o-transform', 'rotate(' + now + 'deg)')
                            .css('transform', 'rotate(' + now + 'deg)');
                    }
                    else {
                        e.css(fx.prop, now);
                    }
                },
                duration: 500
            }, 'linear').promise().then(function () {
                e.css('-webkit-transform', '').css('-moz-transform', '').css('-ms-transform', '').css('-o-transform', '').css('transform', '').css("opacity", "");
            });
        };
        Cursor.prototype.setPosition = function (top, left) {
            var wTop = $(window).scrollTop();
            var height = $(window).height();
            if (top < wTop) {
                // FIXME: this is a totally arbitrary number, but is meant to be big enough
                // to keep the cursor name from being off the top of the screen.
                top = 25;
                this.setClass("togetherjs-scrolled-above");
            }
            else if (top > wTop + height - CURSOR_HEIGHT) {
                top = height - CURSOR_HEIGHT - 5;
                this.setClass("togetherjs-scrolled-below");
            }
            else {
                this.setClass("togetherjs-scrolled-normal");
            }
            this.element.css({
                top: top,
                left: left
            });
        };
        Cursor.prototype.refresh = function () {
            if (this.lastTop !== null && this.lastLeft !== null) {
                this.setPosition(this.lastTop, this.lastLeft);
            }
        };
        Cursor.prototype.setKeydown = function () {
            var _this = this;
            if (this.keydownTimeout) {
                clearTimeout(this.keydownTimeout);
            }
            else {
                this.element.find(".togetherjs-cursor-typing").show().animateKeyboard();
            }
            this.keydownTimeout = setTimeout(function () { return _this.clearKeydown(); }, this.KEYDOWN_WAIT_TIME);
        };
        Cursor.prototype.clearKeydown = function () {
            this.keydownTimeout = null;
            this.element.find(".togetherjs-cursor-typing").hide().stopKeyboardAnimation();
        };
        Cursor.prototype._destroy = function () {
            this.element.remove();
            //this.element = null; // TODO I think we don't need to do that since the only time we call _destroy we also remove this element from memory
        };
        Cursor.getClient = function (clientId) {
            return exports.cursor.getClient(clientId);
        };
        Cursor.forEach = function (callback, context) {
            if (context === void 0) { context = null; }
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
        Cursor._cursors = {};
        return Cursor;
    }());
    var cursor2 = /** @class */ (function () {
        function cursor2() {
        }
        cursor2.prototype.getClient = function (clientId) {
            var c = Cursor._cursors[clientId];
            if (!c) {
                c = Cursor._cursors[clientId] = new Cursor(clientId);
            }
            return c;
        };
        return cursor2;
    }());
    exports.cursor = new cursor2();
    function cbCursor(peer) {
        var c = Cursor.getClient(peer.id);
        c.updatePeer(peer);
    }
    peers_1.peers.on("new-peer", cbCursor);
    peers_1.peers.on("identity-updated", cbCursor);
    peers_1.peers.on("status-updated", cbCursor);
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
        var parent = $(target).closest(".togetherjs-window, .togetherjs-popup, #togetherjs-dock");
        if (parent.length) {
            target = parent[0];
        }
        else if (elementFinder_1.elementFinder.ignoreElement(target)) {
            target = null;
        }
        if ((!target) || target == document.documentElement || target == document.body) {
            lastMessage = {
                type: "cursor-update",
                top: pageY,
                left: pageX
            };
            session_1.session.send(lastMessage);
            return;
        }
        var $target = $(target);
        var offset = $target.offset();
        if (!offset) {
            // FIXME: this really is walkabout.js's problem to fire events on the
            // document instead of a specific element
            console.warn("Could not get offset of element:", $target[0]);
            return;
        }
        var offsetX = pageX - offset.left;
        var offsetY = pageY - offset.top;
        lastMessage = {
            type: "cursor-update",
            element: elementFinder_1.elementFinder.elementLocation($target),
            offsetX: Math.floor(offsetX),
            offsetY: Math.floor(offsetY)
        };
        session_1.session.send(lastMessage);
    }
    function makeCursor(color) {
        var canvas = $("<canvas></canvas>");
        canvas.attr("height", CURSOR_HEIGHT);
        canvas.attr("width", CURSOR_WIDTH);
        var canvas0 = canvas[0];
        var context = canvas0.getContext('2d'); // TODO !
        context.fillStyle = color;
        context.moveTo(0, 0);
        context.beginPath();
        context.lineTo(0, CURSOR_HEIGHT / 1.2);
        context.lineTo(Math.sin(CURSOR_ANGLE / 2) * CURSOR_HEIGHT / 1.5, Math.cos(CURSOR_ANGLE / 2) * CURSOR_HEIGHT / 1.5);
        context.lineTo(Math.sin(CURSOR_ANGLE) * CURSOR_HEIGHT / 1.2, Math.cos(CURSOR_ANGLE) * CURSOR_HEIGHT / 1.2);
        context.lineTo(0, 0);
        context.shadowColor = 'rgba(0,0,0,0.3)';
        context.shadowBlur = 2;
        context.shadowOffsetX = 1;
        context.shadowOffsetY = 2;
        context.strokeStyle = "#ffffff";
        context.stroke();
        context.fill();
        return canvas0.toDataURL("image/png");
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
            }
            else {
                // Just let it progress anyway
                return;
            }
        }
        scrollTimeout = setTimeout(_scrollRefresh, SCROLL_DELAY_TIMEOUT);
        if (!scrollTimeoutSet) {
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
            position: elementFinder_1.elementFinder.elementByPixel($(window).scrollTop())
        };
        session_1.session.send(lastScrollMessage);
    }
    // FIXME: do the same thing for cursor position?  And give up on the ad hoc update-on-hello?
    session_1.session.on("prepare-hello", function (helloMessage) {
        if (lastScrollMessage) {
            helloMessage.scrollPosition = lastScrollMessage.position;
        }
    });
    session_1.session.hub.on("scroll-update", function (msg) {
        msg.peer.scrollPosition = msg.position;
        if (msg.peer.following) {
            msg.peer.view.scrollTo();
        }
    });
    // In case there are multiple peers, we track that we've accepted one of their
    // hello-based scroll updates, just so we don't bounce around (we don't intelligently
    // choose which one to use, just the first that comes in)
    var acceptedScrollUpdate = false;
    function cbHelloHelloback(msg) {
        if (msg.type == "hello") {
            // Once a hello comes in, a bunch of hello-backs not intended for us will also
            // come in, and we should ignore them
            acceptedScrollUpdate = true;
        }
        if (!msg.scrollPosition) {
            return;
        }
        msg.peer.scrollPosition = msg.scrollPosition;
        if ((!acceptedScrollUpdate) &&
            msg.sameUrl &&
            Date.now() - session_1.session.timeHelloSent < SCROLL_UPDATE_CUTOFF) {
            acceptedScrollUpdate = true;
            msg.peer.view.scrollTo();
        }
    }
    session_1.session.hub.on("hello-back", cbHelloHelloback);
    session_1.session.hub.on("hello", cbHelloHelloback);
    session_1.session.on("ui-ready", function () {
        $(document).mousemove(mousemove);
        document.addEventListener("click", documentClick, true);
        document.addEventListener("keydown", documentKeydown, true);
        $(window).scroll(scroll);
        scroll();
    });
    session_1.session.on("close", function () {
        Cursor.forEach(function (_c, clientId) {
            Cursor.destroy(clientId);
        });
        $(document).unbind("mousemove", mousemove);
        document.removeEventListener("click", documentClick, true);
        document.removeEventListener("keydown", documentKeydown, true);
        $(window).unbind("scroll", scroll);
    });
    session_1.session.hub.on("hello", function () {
        // Immediately get our cursor onto this new person's screen:
        if (lastMessage) {
            session_1.session.send(lastMessage);
        }
        if (lastScrollMessage) {
            session_1.session.send(lastScrollMessage);
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
            if (!TogetherJS.running) {
                // This can end up running right after TogetherJS has been closed, often
                // because TogetherJS was closed with a click...
                return;
            }
            var element = event.target;
            if (element == document.documentElement) {
                // For some reason clicking on <body> gives the <html> element here
                element = document.body;
            }
            if (elementFinder_1.elementFinder.ignoreElement(element)) {
                return;
            }
            //Prevent click events on video objects to avoid conflicts with
            //togetherjs's own video events
            if (element.nodeName.toLowerCase() === 'video') {
                return;
            }
            var dontShowClicks = TogetherJS.config.get("dontShowClicks");
            var cloneClicks = TogetherJS.config.get("cloneClicks");
            // If you dont want to clone the click for this element
            // and you dont want to show the click for this element or you dont want to show any clicks
            // then return to avoid sending a useless click
            if ((!util_1.util.matchElement(element, cloneClicks)) && util_1.util.matchElement(element, dontShowClicks)) {
                return;
            }
            var location = elementFinder_1.elementFinder.elementLocation(element);
            var offset = $(element).offset(); // TODO !
            var offsetX = event.pageX - offset.left;
            var offsetY = event.pageY - offset.top;
            session_1.session.send({
                type: "cursor-click",
                element: location,
                offsetX: offsetX,
                offsetY: offsetY
            });
            if (util_1.util.matchElement(element, dontShowClicks)) {
                return;
            }
            displayClick({ top: event.pageY, left: event.pageX }, peers_1.peers.Self.color);
        });
    }
    var CLICK_TRANSITION_TIME = 3000;
    session_1.session.hub.on("cursor-click", function (pos) {
        // When the click is calculated isn't always the same as how the
        // last cursor update was calculated, so we force the cursor to
        // the last location during a click:
        if (!pos.sameUrl) {
            // FIXME: if we *could have* done a local click, but we follow along
            // later, we'll be in different states if that click was important.
            // Mostly click cloning just won't work.
            return;
        }
        Cursor.getClient(pos.clientId).updatePosition(pos);
        var target = $(elementFinder_1.elementFinder.findElement(pos.element));
        var offset = target.offset(); // TODO !
        var top = offset.top + pos.offsetY;
        var left = offset.left + pos.offsetX;
        var cloneClicks = TogetherJS.config.get("cloneClicks");
        if (util_1.util.matchElement(target, cloneClicks)) {
            eventMaker_1.eventMaker.performClick(target);
        }
        var dontShowClicks = TogetherJS.config.get("dontShowClicks");
        if (util_1.util.matchElement(target, dontShowClicks)) {
            return;
        }
        displayClick({ top: top, left: left }, pos.peer.color);
    });
    function displayClick(pos, color) {
        // FIXME: should we hide the local click if no one else is going to see it?
        // That means tracking who might be able to see our screen.
        var element = templating_1.templating.clone("click");
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
    function documentKeydown(_event) {
        setTimeout(function () {
            var now = Date.now();
            if (now - lastKeydown < MIN_KEYDOWN_TIME) {
                return;
            }
            lastKeydown = now;
            // FIXME: is event.target interesting here?  That is, *what* the user is typing into, not just that the user is typing? Also I'm assuming we don't care if the user it typing into a togetherjs-related field, since chat activity is as interesting as any other activity.
            session_1.session.send({ type: "keydown" });
        });
    }
    session_1.session.hub.on("keydown", function (msg) {
        // FIXME: when the cursor is hidden there's nothing to show with setKeydown().
        var cursor = Cursor.getClient(msg.clientId);
        cursor.setKeydown();
    });
    util_1.util.testExpose({ Cursor: Cursor });
});
//    return cursor;
//define(["jquery", "ui", "util", "session", "elementFinder", "eventMaker", "peers", "templating"], cursorMain);
