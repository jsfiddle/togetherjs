/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { elementFinder, CannotFind } from "./elementFinder";
import { eventMaker } from "./eventMaker";
import { peers } from "./peers";
import { session } from "./session";
import { templating } from "./templating";
import { util } from "./util";
import $ from "jquery";

// Cursor viewing support

//function cursorMain($: JQueryStatic, _ui: TogetherJSNS.Ui, util: TogetherJSNS.Util, session: TogetherJSNS.Session, elementFinder: TogetherJSNS.ElementFinder, eventMaker: TogetherJSNS.EventMaker, peers: TogetherJSNS.Peers, templating: TogetherJSNS.Templating) {
const assert: typeof util.assert = util.assert.bind(util);
const CURSOR_HEIGHT = 50;
const CURSOR_ANGLE = (35 / 180) * Math.PI;
const CURSOR_WIDTH = Math.ceil(Math.sin(CURSOR_ANGLE) * CURSOR_HEIGHT);

// FIXME: should check for a peer leaving and remove the cursor object
class Cursor {
    // How long after receiving a setKeydown call that we should show the user typing.  This should be more than MIN_KEYDOWN_TIME:
    KEYDOWN_WAIT_TIME = 2000;
    element: JQuery;
    elementClass: string;
    lastTop: number | null = null;
    lastLeft: number | null = null;
    keydownTimeout: number | null = null;
    atOtherUrl = false;
    static _cursors: { [id: string]: Cursor } = {};

    constructor(private clientId: string) {
        this.element = templating.clone("cursor");
        this.elementClass = "togetherjs-scrolled-normal";
        this.element.addClass(this.elementClass);
        const peer = peers.getPeer(this.clientId);
        if(peer !== null) {
            this.updatePeer(peer);
        }
        else {
            console.error("Could not find a peer with id", this.clientId);
        }
        $(document.body).append(this.element);
        this.element.animateCursorEntry();
    }

    updatePeer(peer: TogetherJSNS.AnyPeer) {
        // FIXME: can I use peer.setElement()?
        this.element.css({ color: peer.color });
        const img = this.element.find("img.togetherjs-cursor-img");
        img.attr("src", makeCursor(peer.color));
        const name = this.element.find(".togetherjs-cursor-name");
        const nameContainer = this.element.find(".togetherjs-cursor-container");
        assert(name.length);
        name.text(peer.name!); // TODO !
        nameContainer.css({
            backgroundColor: peer.color,
            color: "#000000" // TODO was tinycolor.mostReadable(peer.color, FOREGROUND_COLORS).toHex()
        });
        const path = this.element.find("svg path");
        path.attr("fill", peer.color);
        // FIXME: should I just remove the element?
        if(peer.status != "live") {
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
    }

    setClass(name: string) {
        if(name != this.elementClass) {
            this.element.removeClass(this.elementClass).addClass(name);
            this.elementClass = name;
        }
    }

    updatePosition(pos: TogetherJSNS.SessionSend.CursorClick | TogetherJSNS.On.CursorUpdate) {
        let top, left;
        if (this.atOtherUrl) {
            this.element.show();
            this.atOtherUrl = false;
        }
        if ("element" in pos) {
            try {
                const target = $(elementFinder.findElement(pos.element));
                const offset = target.offset()!; // TODO !
                top = offset.top + pos.offsetY;
                left = offset.left + pos.offsetX;
            } catch (error: any) {
                if (error instanceof CannotFind) {
                    top = pos.top;
                    left = pos.left;
                } else
                    throw error;
            }
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
        if(this.atOtherUrl) {
            return;
        }
        this.atOtherUrl = true;
        // FIXME: should show away status better:
        this.element.hide();
    }

    // place Cursor rotate function down here FIXME: this doesnt do anything anymore.  This is in the CSS as an animation
    rotateCursorDown() {
        const e = $(this.element).find('svg');
        e.animate(
            { borderSpacing: -150, opacity: 1 },
            {
                step: function(now: number, fx: Tween) {
                    if(fx.prop == "borderSpacing") {
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
            },
            'linear'
        ).promise().then(function() {
            e.css('-webkit-transform', '').css('-moz-transform', '').css('-ms-transform', '').css('-o-transform', '').css('transform', '').css("opacity", "");
        });
    }

    setPosition(top: number, left: number) {
        const wTop = $(window).scrollTop();
        const height = $(window).height();

        if(top < wTop) {
            // FIXME: this is a totally arbitrary number, but is meant to be big enough
            // to keep the cursor name from being off the top of the screen.
            top = 25;
            this.setClass("togetherjs-scrolled-above");
        }
        else if(top > wTop + height - CURSOR_HEIGHT) {
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
    }

    refresh() {
        if(this.lastTop !== null && this.lastLeft !== null) {
            this.setPosition(this.lastTop, this.lastLeft);
        }
    }

    setKeydown() {
        if(this.keydownTimeout) {
            clearTimeout(this.keydownTimeout);
        }
        else {
            this.element.find(".togetherjs-cursor-typing").show().animateKeyboard();
        }
        this.keydownTimeout = setTimeout(() => this.clearKeydown(), this.KEYDOWN_WAIT_TIME);
    }

    clearKeydown() {
        this.keydownTimeout = null;
        this.element.find(".togetherjs-cursor-typing").hide().stopKeyboardAnimation();
    }

    _destroy() {
        this.element.remove();
        //this.element = null; // TODO I think we don't need to do that since the only time we call _destroy we also remove this element from memory
    }

    static getClient(clientId: string) {
        let c = Cursor._cursors[clientId];
        if(!c) {
            c = Cursor._cursors[clientId] = new Cursor(clientId);
        }
        return c;
    }

    static forEach(callback: (c: Cursor, id: string) => void, context: Cursor | null = null) {
        for(const a in Cursor._cursors) {
            if(Object.prototype.hasOwnProperty.call(Cursor._cursors, a)) {
                callback.call(context, Cursor._cursors[a], a);
            }
        }
    }

    static destroy(clientId: string) {
        Cursor._cursors[clientId]._destroy();
        delete Cursor._cursors[clientId];
    }
}

session.hub.on("cursor-update", function(msg) {
    if(msg.sameUrl) {
        Cursor.getClient(msg.clientId).updatePosition(msg);
    }
    else {
        // FIXME: This should be caught even before the cursor-update message,
        // when the peer goes to another URL
        Cursor.getClient(msg.clientId).hideOtherUrl();
    }
});

export function getClient(clientId: string): Cursor {
    return Cursor.getClient(clientId);
}

function cbCursor(peer: TogetherJSNS.PeerClass | TogetherJSNS.PeerSelf) {
    const c = Cursor.getClient(peer.id);
    c.updatePeer(peer);
}

peers.on("new-peer", cbCursor);
peers.on("identity-updated", cbCursor);
peers.on("status-updated", cbCursor);

let lastTime = 0;
const MIN_TIME_BETWEEN_MOUSE_MOVE = 100;
let lastPosX = -1;
let lastPosY = -1;
let lastMessage: TogetherJSNS.On.CursorUpdate | null = null;
function mousemove(event: JQueryMouseEventObject) {
    const now = Date.now();
    if(now - lastTime < MIN_TIME_BETWEEN_MOUSE_MOVE) {
        return;
    }
    lastTime = now;
    const pageX = event.pageX;
    const pageY = event.pageY;
    if(Math.abs(lastPosX - pageX) < 3 && Math.abs(lastPosY - pageY) < 3) {
        // Not a substantial enough change
        return;
    }
    lastPosX = pageX;
    lastPosY = pageY;
    let target: HTMLElement | null = event.target as HTMLElement;
    const parent = $(target).closest(".togetherjs-window, .togetherjs-popup, #togetherjs-dock");
    if(parent.length) {
        target = parent[0];
    }
    else if(elementFinder.ignoreElement(target)) {
        target = null;
    }
    if((!target) || target == document.documentElement || target == document.body) {
        lastMessage = {
            type: "cursor-update",
            top: pageY,
            left: pageX
        };
        session.send(lastMessage);
        return;
    }
    const $target = $(target);
    const offset = $target.offset();
    if(!offset) {
        // FIXME: this really is walkabout.js's problem to fire events on the
        // document instead of a specific element
        console.warn("Could not get offset of element:", $target[0]);
        return;
    }
    const offsetX = pageX - offset.left;
    const offsetY = pageY - offset.top;
    lastMessage = {
        type: "cursor-update",
        top: pageY,
        left: pageX,
        element: elementFinder.elementLocation($target),
        offsetX: Math.floor(offsetX),
        offsetY: Math.floor(offsetY)
    };
    session.send(lastMessage);
}

function makeCursor(color: string) {
    const canvas = $("<canvas></canvas>");
    canvas.attr("height", CURSOR_HEIGHT);
    canvas.attr("width", CURSOR_WIDTH);
    const canvas0 = canvas[0] as HTMLCanvasElement;
    const context = canvas0.getContext('2d')!; // ! ok
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

let scrollTimeout: number | null = null;
let scrollTimeoutSet = 0;
const SCROLL_DELAY_TIMEOUT = 75;
const SCROLL_DELAY_LIMIT = 300;
function scroll() {
    const now = Date.now();
    if(scrollTimeout) {
        if(now - scrollTimeoutSet < SCROLL_DELAY_LIMIT) {
            clearTimeout(scrollTimeout);
        }
        else {
            // Just let it progress anyway
            return;
        }
    }
    scrollTimeout = setTimeout(_scrollRefresh, SCROLL_DELAY_TIMEOUT);
    if(!scrollTimeoutSet) {
        scrollTimeoutSet = now;
    }
}

let lastScrollMessage: TogetherJSNS.SessionSend.ScrollUpdate | null = null;
function _scrollRefresh() {
    scrollTimeout = null;
    scrollTimeoutSet = 0;
    Cursor.forEach(function(c) {
        c.refresh();
    });
    lastScrollMessage = {
        type: "scroll-update",
        position: elementFinder.elementByPixel($(window).scrollTop())
    };
    session.send(lastScrollMessage);
}

// FIXME: do the same thing for cursor position?  And give up on the ad hoc update-on-hello?
session.on("prepare-hello", function(helloMessage) {
    if(lastScrollMessage) {
        helloMessage.scrollPosition = lastScrollMessage.position;
    }
});

session.hub.on("scroll-update", function(msg) {
    msg.peer.scrollPosition = msg.position;
    if(msg.peer.following) {
        msg.peer.view.scrollTo();
    }
});

// In case there are multiple peers, we track that we've accepted one of their hello-based scroll updates, just so we don't bounce around (we don't intelligently choose which one to use, just the first that comes in)
let acceptedScrollUpdate = false;
// Number of milliseconds after page load in which a scroll-update related hello-back message will be processed:
const SCROLL_UPDATE_CUTOFF = 2000;
function cbHelloHelloback(msg: TogetherJSNS.On.Hello2 | TogetherJSNS.On.HelloBack2) {
    if(msg.type == "hello") {
        // Once a hello comes in, a bunch of hello-backs not intended for us will also
        // come in, and we should ignore them
        acceptedScrollUpdate = true;
    }
    if(!msg.scrollPosition) {
        return;
    }
    msg.peer.scrollPosition = msg.scrollPosition;
    if((!acceptedScrollUpdate) &&
        msg.sameUrl &&
        Date.now() - session.timeHelloSent < SCROLL_UPDATE_CUTOFF) {
        acceptedScrollUpdate = true;
        msg.peer.view.scrollTo();
    }
}
session.hub.on("hello-back", cbHelloHelloback);
session.hub.on("hello", cbHelloHelloback);

session.on("ui-ready", function() {
    $(document).mousemove(mousemove);
    document.addEventListener("click", documentClick, true);
    document.addEventListener("keydown", documentKeydown, true);
    $(window).scroll(scroll);
    scroll();
});

session.on("close", function() {
    Cursor.forEach(function(_c, clientId) {
        Cursor.destroy(clientId);
    });
    $(document).unbind("mousemove", mousemove);
    document.removeEventListener("click", documentClick, true);
    document.removeEventListener("keydown", documentKeydown, true);
    $(window).unbind("scroll", scroll);
});

session.hub.on("hello", function() {
    // Immediately get our cursor onto this new person's screen:
    if(lastMessage) {
        session.send(lastMessage);
    }
    if(lastScrollMessage) {
        session.send(lastScrollMessage);
    }
});

function documentClick(event: MouseEvent & { togetherjsInternal?: boolean }) {
    if(event.togetherjsInternal) {
        // This is an artificial internal event
        return;
    }
    // FIXME: this might just be my imagination, but somehow I just
    // really don't want to do anything at this stage of the event
    // handling (since I'm catching every click), and I'll just do
    // something real soon:
    setTimeout(function() {
        if(!TogetherJS.running) {
            // This can end up running right after TogetherJS has been closed, often
            // because TogetherJS was closed with a click...
            return;
        }
        let element = event.target as HTMLElement;
        if(element == document.documentElement) {
            // For some reason clicking on <body> gives the <html> element here
            element = document.body;
        }
        if(elementFinder.ignoreElement(element)) {
            return;
        }
        //Prevent click events on video objects to avoid conflicts with
        //togetherjs's own video events
        if(element.nodeName.toLowerCase() === 'video') {
            return;
        }

        const dontShowClicks = TogetherJS.config.get("dontShowClicks");
        const cloneClicks = TogetherJS.config.get("cloneClicks");
        // If you dont want to clone the click for this element
        // and you dont want to show the click for this element or you dont want to show any clicks
        // then return to avoid sending a useless click
        if((!util.matchElement(element, cloneClicks)) && util.matchElement(element, dontShowClicks)) {
            return;
        }
        const location = elementFinder.elementLocation(element);
        const offset = $(element).offset()!; // TODO !
        const offsetX = event.pageX - offset.left;
        const offsetY = event.pageY - offset.top;
        session.send({
            type: "cursor-click",
            element: location,
            offsetX: offsetX,
            offsetY: offsetY
        });
        if(util.matchElement(element, dontShowClicks)) {
            return;
        }
        displayClick({ top: event.pageY, left: event.pageX }, peers.Self.color);
    });
}

session.hub.on("cursor-click", function(pos) {
    // When the click is calculated isn't always the same as how the
    // last cursor update was calculated, so we force the cursor to
    // the last location during a click:
    if(!pos.sameUrl) {
        // FIXME: if we *could have* done a local click, but we follow along
        // later, we'll be in different states if that click was important.
        // Mostly click cloning just won't work.
        return;
    }
    Cursor.getClient(pos.clientId).updatePosition(pos);
    const target = $(elementFinder.findElement(pos.element));
    const offset = target.offset()!; // TODO !
    const top = offset.top + pos.offsetY;
    const left = offset.left + pos.offsetX;
    const cloneClicks = TogetherJS.config.get("cloneClicks");
    if(util.matchElement(target, cloneClicks)) {
        eventMaker.performClick(target);
    }
    const dontShowClicks = TogetherJS.config.get("dontShowClicks");
    if(util.matchElement(target, dontShowClicks)) {
        return;
    }
    displayClick({ top: top, left: left }, pos.peer.color);
});

const CLICK_TRANSITION_TIME = 3000;
function displayClick(pos: { top: number, left: number }, color: string) {
    // FIXME: should we hide the local click if no one else is going to see it?
    // That means tracking who might be able to see our screen.
    const element = templating.clone("click");
    $(document.body).append(element);
    element.css({
        top: pos.top,
        left: pos.left,
        borderColor: color
    });
    setTimeout(function() {
        element.addClass("togetherjs-clicking");
    }, 100);
    setTimeout(function() {
        element.remove();
    }, CLICK_TRANSITION_TIME);
}

let lastKeydown = 0;
const MIN_KEYDOWN_TIME = 500;
function documentKeydown() {
    setTimeout(function() {
        const now = Date.now();
        if(now - lastKeydown < MIN_KEYDOWN_TIME) {
            return;
        }
        lastKeydown = now;
        // FIXME: is event.target interesting here?  That is, *what* the user is typing into, not just that the user is typing? Also I'm assuming we don't care if the user it typing into a togetherjs-related field, since chat activity is as interesting as any other activity.
        session.send({ type: "keydown" });
    });
}

session.hub.on("keydown", function(msg) {
    // FIXME: when the cursor is hidden there's nothing to show with setKeydown().
    const cursor = Cursor.getClient(msg.clientId);
    cursor.setKeydown();
});

util.testExpose({ Cursor: Cursor });

//    return cursor;

//define(["jquery", "ui", "util", "session", "elementFinder", "eventMaker", "peers", "templating"], cursorMain);
