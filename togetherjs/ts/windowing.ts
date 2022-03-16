/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { session } from "./session";
import { util } from "./util";
import { ui } from './ui';
import $ from "jquery";

interface ShowOptions {
    /** Selector or Element */
    bind: string | JQuery;
    onClose: null | (() => void);
}

//function windowingMain($: JQueryStatic, util: TogetherJSNS.Util, _peers: TogetherJSNS.Peers, session: TogetherJSNS.Session) {
const assert: typeof util.assert = util.assert.bind(util);
const $window = $(window);
// This is also in togetherjs.less, under .togetherjs-animated
const ANIMATION_DURATION = 1000;
let onClose: null | (() => void) = null;

class ModalEscape {
    constructor(private windowing: Windowing) { }
    bind() {
        $(document).keydown(this.onKeydown);
    }
    unbind() {
        $(document).unbind("keydown", this.onKeydown);
    }
    onKeydown(event: JQueryEventObject) {
        if(event.which == 27) {
            this.windowing.hide();
        }
    }
}

/* Displays one window.  A window must already exist.  This hides other windows, and
    positions the window according to its data-bound-to attributes */
export class Windowing {
    public readonly modalEscape: ModalEscape;
    constructor() {
        this.modalEscape = new ModalEscape(this);
    }
    show(el: HTMLElement | JQuery | string, options: Partial<ShowOptions> = {}): void {
        const element = $(el);
        options.bind = options.bind || element.attr("data-bind-to");
        const notification = element.hasClass("togetherjs-notification");
        const modal = element.hasClass("togetherjs-modal");
        let bindElement: JQuery | null = null;
        if(options.bind) {
            bindElement = $(options.bind);
        }
        this.hide();
        element.stop();
        element.show();
        // In addition to being hidden, the window can be faded out, which we want to undo:
        element.css({ opacity: "1" });
        if(bindElement) {
            assert(!modal, "Binding does not currently work with modals");
            bind(element, bindElement);
        }
        if(notification) {
            element.slideIn();
        }
        else if(!modal) {
            element.popinWindow();
        }
        if(modal) {
            getModalBackground().show();
            this.modalEscape.bind();
        }
        onClose = options.onClose || null;
        session.emit("display-window", element.attr("id"), element);
    }

    hide(selector: string | JQuery = ".togetherjs-window, .togetherjs-modal, .togetherjs-notification"): void {
        // FIXME: also hide modals?
        let els = $(selector);
        els = els.filter(":visible");
        els.filter(":not(.togetherjs-notification)").hide();
        getModalBackground().hide();
        const windows: JQuery[] = [];
        els.each(function(_index, el) {
            const element = $(el);
            windows.push(element);
            let bound = element.data("boundTo");
            if(!bound) {
                return;
            }
            bound = $(bound);
            bound.addClass("togetherjs-animated").addClass("togetherjs-color-pulse");
            setTimeout(function() {
                bound.removeClass("togetherjs-color-pulse").removeClass("togetherjs-animated");
            }, ANIMATION_DURATION + 10);
            element.data("boundTo", null);
            bound.removeClass("togetherjs-active");
            if(element.hasClass("togetherjs-notification")) {
                element.fadeOut().promise().then(function(this: typeof element) {
                    this.hide();
                });
            }
        });
        $("#togetherjs-window-pointer").hide();
        if(onClose) {
            onClose();
            onClose = null;
        }
        if(windows.length) {
            session.emit("hide-window", windows);
        }
    }

    toggle(el: HTMLElement | string): void {
        const element = $(el);
        if(element.is(":visible")) {
            this.hide(element);
        }
        else {
            this.show(element);
        }
    }
}

export const windowing = new Windowing();

/* Moves a window to be attached to data-bind-to, e.g., the button
    that opened the window. Or you can provide an element that it should bind to. */
function bind(window: HTMLElement | JQuery, bound: JQuery) {
    if($.browser.mobile) {
        return;
    }
    const win = $(window);
    assert(bound.length, "Cannot find binding:", bound.selector, "from:", win.selector);
    const ifacePos = ui.panelPosition()
    const boundPos = bound.offset();
    boundPos.top -= $window.scrollTop();
    boundPos.left -= $window.scrollLeft();
    // FIXME: I appear to have to add the padding to the width to get a "true" width.  But it's still not entirely consistent.
    const height = win.height() + 5;
    const width = win.width() + 20;
    let left: number;
    let top: number;
    if (ifacePos == "left") {
        left = boundPos.left + bound.width() + 15;
        top = boundPos.top + (bound.height() / 2) - (height / 2);
    } else if (ifacePos == "right") {
        left = boundPos.left - 11 - width;
        top = boundPos.top + (bound.height() / 2) - (height / 2);
    } else if (ifacePos == "top") {
        left = (boundPos.left + bound.width() / 2) - (width / 2);
        top = boundPos.top + bound.width() + 15;
    } else {
        left = (boundPos.left + bound.width() / 2) - (width / 2);
        top = boundPos.top - 10 - height;
    }
    top = Math.min(window.height - 10 - height, Math.max(10, top));
    win.css({
        left: left + "px",
        right: "",
        top: top + "px",
        bottom: ""
    });
    if (parseInt(win.css("left")) < 5)
        win.css({
            left: "5px"
        })
    else if (parseInt(win.css("right")) < 5)
        win.css({
            left: "",
            right: "5px"
        })
    if (parseInt(win.css("top")) < 5)
        win.css({
            top: "5px"
        })
    else if (parseInt(win.css("bottom")) < 5)
        win.css({
            top: "",
            bottom: "5px"
        })
    if (win.hasClass("togetherjs-window")) {
        $("#togetherjs-window-pointer").hide();
        var pointer = $("#togetherjs-window-pointer")
        pointer.removeClass()
        pointer.addClass(ifacePos)
        pointer.show();
        if (ifacePos == "left") {
            pointer.css({
                left: (left - 30) + "px",
                top: (boundPos.top + Math.floor(boundPos.height / 2) - 13) + "px"
            });
        } else if (ifacePos == "right") {
            pointer.css({
                left: (left + win.width() + 14) + "px",
                top: (boundPos.top + Math.floor(boundPos.height / 2) - 13) + "px"
            });
        } else if (ifacePos == "top") {
            pointer.css({
                top: boundPos.top + Math.floor(bound.height() / 2) + "px",
                left: left + win.width() + 9 + "px"
            });
        } else if (ifacePos == "bottom") {
            pointer.css({
                left: (boundPos.left + Math.floor(boundPos.width / 2) - 13) + "px",
                top: (top + win.height()) + "px"
            });
        }
    }
    win.data("boundTo", bound.selector || "#" + bound.attr("id"));
    bound.addClass("togetherjs-active");
}

session.on("resize", function() {
    const win = $(".togetherjs-modal:visible, .togetherjs-window:visible");
    if(!win.length) {
        return;
    }
    let boundTo = win.data("boundTo");
    if(!boundTo) {
        return;
    }
    boundTo = $(boundTo);
    bind(win, boundTo);
});

function bindEvents(el: JQuery) {
    el.find(".togetherjs-close, .togetherjs-dismiss").click(function(event) {
        const w = $(event.target).closest(".togetherjs-window, .togetherjs-modal, .togetherjs-notification");
        windowing.hide(w);
        event.stopPropagation();
        return false;
    });
}

let getModalBackgroundElement: JQuery | null = null;
function getModalBackground() {
    if(getModalBackgroundElement) {
        return getModalBackgroundElement;
    }
    const background = $("#togetherjs-modal-background");
    assert(background.length);
    getModalBackgroundElement = background;
    background.click(function() {
        windowing.hide();
    });
    return background;
}

session.on("close", function() {
    windowing.modalEscape.unbind();
});

session.on("new-element", function(el) {
    bindEvents(el);
});

//return windowing;

//define(["jquery", "util", "peers", "session"], windowingMain);
