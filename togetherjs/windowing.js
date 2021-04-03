/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "./session", "./util", "jquery"], function (require, exports, session_1, util_1, jquery_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.windowing = void 0;
    jquery_1 = __importDefault(jquery_1);
    //function windowingMain($: JQueryStatic, util: TogetherJSNS.Util, _peers: TogetherJSNS.Peers, session: TogetherJSNS.Session) {
    var assert = util_1.util.assert.bind(util_1.util);
    var $window = jquery_1.default(window);
    // This is also in togetherjs.less, under .togetherjs-animated
    var ANIMATION_DURATION = 1000;
    var onClose = null;
    /* Displays one window.  A window must already exist.  This hides other windows, and
        positions the window according to its data-bound-to attributes */
    var Windowing = /** @class */ (function () {
        function Windowing() {
        }
        Windowing.prototype.show = function (el, options) {
            if (options === void 0) { options = {}; }
            var element = jquery_1.default(el);
            options.bind = options.bind || element.attr("data-bind-to");
            var notification = element.hasClass("togetherjs-notification");
            var modal = element.hasClass("togetherjs-modal");
            var bindElement = null;
            if (options.bind) {
                bindElement = jquery_1.default(options.bind);
            }
            this.hide();
            element.stop();
            element.show();
            // In addition to being hidden, the window can be faded out, which we want to undo:
            element.css({ opacity: "1" });
            if (bindElement) {
                assert(!modal, "Binding does not currently work with modals");
                bind(element, bindElement);
            }
            if (notification) {
                element.slideIn();
            }
            else if (!modal) {
                element.popinWindow();
            }
            if (modal) {
                getModalBackground().show();
                modalEscape.bind();
            }
            onClose = options.onClose || null;
            session_1.session.emit("display-window", element.attr("id"), element);
        };
        Windowing.prototype.hide = function (selector) {
            if (selector === void 0) { selector = ".togetherjs-window, .togetherjs-modal, .togetherjs-notification"; }
            // FIXME: also hide modals?
            var els = jquery_1.default(selector);
            els = els.filter(":visible");
            els.filter(":not(.togetherjs-notification)").hide();
            getModalBackground().hide();
            var windows = [];
            els.each(function (_index, el) {
                var element = jquery_1.default(el);
                windows.push(element);
                var bound = element.data("boundTo");
                if (!bound) {
                    return;
                }
                bound = jquery_1.default(bound);
                bound.addClass("togetherjs-animated").addClass("togetherjs-color-pulse");
                setTimeout(function () {
                    bound.removeClass("togetherjs-color-pulse").removeClass("togetherjs-animated");
                }, ANIMATION_DURATION + 10);
                element.data("boundTo", null);
                bound.removeClass("togetherjs-active");
                if (element.hasClass("togetherjs-notification")) {
                    element.fadeOut().promise().then(function () {
                        this.hide();
                    });
                }
            });
            jquery_1.default("#togetherjs-window-pointer-right, #togetherjs-window-pointer-left").hide();
            if (onClose) {
                onClose();
                onClose = null;
            }
            if (windows.length) {
                session_1.session.emit("hide-window", windows);
            }
        };
        Windowing.prototype.toggle = function (el) {
            var element = jquery_1.default(el);
            if (element.is(":visible")) {
                this.hide(element);
            }
            else {
                this.show(element);
            }
        };
        return Windowing;
    }());
    exports.windowing = new Windowing();
    /* Moves a window to be attached to data-bind-to, e.g., the button
        that opened the window. Or you can provide an element that it should bind to. */
    function bind(window, bound) {
        if (jquery_1.default.browser.mobile) {
            return;
        }
        var win = jquery_1.default(window);
        assert(bound.length, "Cannot find binding:", bound.selector, "from:", win.selector);
        // FIXME: hardcoding
        var ifacePos = "right";
        //var ifacePos = panelPosition();
        var boundPos = bound.offset(); // TODO ! deal with !
        var boundPosHeight = bound.height();
        var boundPosWidth = bound.width();
        var windowHeight = $window.height();
        boundPos.top -= $window.scrollTop();
        boundPos.left -= $window.scrollLeft();
        // FIXME: I appear to have to add the padding to the width to get a "true"
        // width.  But it's still not entirely consistent.
        var height = win.height() + 5;
        var width = win.width() + 20;
        var left;
        var top;
        if (ifacePos == "right") {
            left = boundPos.left - 11 - width;
            top = boundPos.top + (boundPosHeight / 2) - (height / 2);
        }
        else if (ifacePos == "left") {
            left = boundPos.left + boundPosWidth + 15;
            top = boundPos.top + (boundPosHeight / 2) - (height / 2);
        }
        else { // if(ifacePos == "bottom") {
            left = (boundPos.left + boundPosWidth / 2) - (width / 2);
            top = boundPos.top - 10 - height;
        }
        top = Math.min(windowHeight - 10 - height, Math.max(10, top));
        win.css({
            top: top + "px",
            left: left + "px"
        });
        if (win.hasClass("togetherjs-window")) {
            jquery_1.default("#togetherjs-window-pointer-right, #togetherjs-window-pointer-left").hide();
            var pointer = jquery_1.default("#togetherjs-window-pointer-" + ifacePos);
            pointer.show();
            if (ifacePos == "right") {
                pointer.css({
                    top: boundPos.top + Math.floor(boundPosHeight / 2) + "px",
                    left: left + win.width() + 9 + "px"
                });
            }
            else if (ifacePos == "left") {
                pointer.css({
                    top: boundPos.top + Math.floor(boundPosHeight / 2) + "px",
                    left: (left - 5) + "px"
                });
            }
            else {
                console.warn("don't know how to deal with position:", ifacePos);
            }
        }
        win.data("boundTo", bound.selector || "#" + bound.attr("id"));
        bound.addClass("togetherjs-active");
    }
    session_1.session.on("resize", function () {
        var win = jquery_1.default(".togetherjs-modal:visible, .togetherjs-window:visible");
        if (!win.length) {
            return;
        }
        var boundTo = win.data("boundTo");
        if (!boundTo) {
            return;
        }
        boundTo = jquery_1.default(boundTo);
        bind(win, boundTo);
    });
    function bindEvents(el) {
        el.find(".togetherjs-close, .togetherjs-dismiss").click(function (event) {
            var w = jquery_1.default(event.target).closest(".togetherjs-window, .togetherjs-modal, .togetherjs-notification");
            exports.windowing.hide(w);
            event.stopPropagation();
            return false;
        });
    }
    var getModalBackgroundElement = null;
    function getModalBackground() {
        if (getModalBackgroundElement) {
            return getModalBackgroundElement;
        }
        var background = jquery_1.default("#togetherjs-modal-background");
        assert(background.length);
        getModalBackgroundElement = background;
        background.click(function () {
            exports.windowing.hide();
        });
        return background;
    }
    var ModalEscape = /** @class */ (function () {
        function ModalEscape() {
        }
        ModalEscape.prototype.bind = function () {
            jquery_1.default(document).keydown(this.onKeydown);
        };
        ModalEscape.prototype.unbind = function () {
            jquery_1.default(document).unbind("keydown", this.onKeydown);
        };
        ModalEscape.prototype.onKeydown = function (event) {
            if (event.which == 27) {
                exports.windowing.hide();
            }
        };
        return ModalEscape;
    }());
    ;
    var modalEscape = new ModalEscape();
    session_1.session.on("close", function () {
        modalEscape.unbind();
    });
    session_1.session.on("new-element", function (el) {
        bindEvents(el);
    });
});
//return windowing;
//define(["jquery", "util", "peers", "session"], windowingMain);
