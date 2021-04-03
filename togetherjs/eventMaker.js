/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "jquery"], function (require, exports, jquery_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.eventMaker = void 0;
    jquery_1 = __importDefault(jquery_1);
    function createTogetherjsMouseEvent() {
        var event = document.createEvent("MouseEvents");
        // FIXME: I'm not sure this custom attribute always propagates?
        // seems okay in Firefox/Chrome, but I've had problems with
        // setting attributes on keyboard events in the past.
        event.togetherjsInternal = true;
        return event;
    }
    var EventMaker = /** @class */ (function () {
        function EventMaker() {
        }
        EventMaker.prototype.performClick = function (target) {
            // FIXME: should accept other parameters, like Ctrl/Alt/etc
            var event = createTogetherjsMouseEvent();
            event.initMouseEvent("click", // type
            true, // canBubble
            true, // cancelable
            window, // view
            0, // detail
            0, // screenX
            0, // screenY
            0, // clientX
            0, // clientY
            false, // ctrlKey
            false, // altKey
            false, // shiftKey
            false, // metaKey
            0, // button
            null // relatedTarget
            );
            target = jquery_1.default(target)[0];
            var cancelled = target.dispatchEvent(event);
            if (cancelled) {
                return;
            }
            if (target.tagName == "A") {
                var href = target.href;
                if (href) {
                    location.href = href;
                    return;
                }
            }
            // FIXME: should do button clicks (like a form submit)
            // FIXME: should run .onclick() as well
        };
        EventMaker.prototype.fireChange = function (target) {
            target = jquery_1.default(target)[0];
            var event = document.createEvent("HTMLEvents");
            event.initEvent("change", true, true);
            target.dispatchEvent(event);
        };
        return EventMaker;
    }());
    exports.eventMaker = new EventMaker();
});
//return eventMaker;
//define(["jquery", "util"], eventMakerMain);
