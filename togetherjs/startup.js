/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
define(["require", "exports", "./storage", "./togetherjs", "./windowing"], function (require, exports, storage_1, togetherjs_1, windowing_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.startup = void 0;
    /* This module handles all the different UI that happens (sometimes in order) when
       TogetherJS is started:
    
       - Introduce the session when you've been invited
       - Show any browser compatibility indicators
       - Show the walkthrough the first time
       - Show the share link window
    
       When everything is done it fires session.emit("startup-ready")
    
    */
    //function startupMain (_util: TogetherJSNS.Util, require: Require, $: JQueryStatic, windowing: TogetherJSNS.Windowing, storage: TogetherJSNS.Storage) {
    // Avoid circular import:
    var session; // TODO potentially uninitialized, why does TSC doesn't catch that?
    var STEPS = [
        "browserBroken",
        "browserUnsupported",
        "sessionIntro",
        "walkthrough",
        // Look in the share() below if you add anything after here:
        "share"
    ];
    var currentStep = null;
    var Statup = /** @class */ (function () {
        function Statup() {
        }
        Statup.prototype.start = function () {
            if (!session) {
                require(["session"], function (sessionModule) {
                    session = sessionModule.session;
                    exports.startup.start();
                });
                return;
            }
            var index = -1;
            if (currentStep) {
                index = STEPS.indexOf(currentStep);
            }
            index++;
            if (index >= STEPS.length) {
                session.emit("startup-ready");
                return;
            }
            currentStep = STEPS[index];
            handlers[currentStep](exports.startup.start);
        };
        return Statup;
    }());
    exports.startup = new Statup();
    var Handlers = /** @class */ (function () {
        function Handlers() {
        }
        Handlers.prototype.browserBroken = function (next) {
            if (window.WebSocket) {
                next();
                return;
            }
            windowing_1.windowing.show("#togetherjs-browser-broken", {
                onClose: function () {
                    session.close();
                }
            });
            if ($.browser.msie) {
                $("#togetherjs-browser-broken-is-ie").show();
            }
        };
        Handlers.prototype.browserUnsupported = function (next) {
            next();
        };
        Handlers.prototype.sessionIntro = function (next) {
            if ((!session.isClient) || !session.firstRun) {
                next();
                return;
            }
            togetherjs_1.TogetherJS.config.close("suppressJoinConfirmation");
            if (togetherjs_1.TogetherJS.config.get("suppressJoinConfirmation")) {
                next();
                return;
            }
            var cancelled = false;
            windowing_1.windowing.show("#togetherjs-intro", {
                onClose: function () {
                    if (!cancelled) {
                        next();
                    }
                }
            });
            $("#togetherjs-intro .togetherjs-modal-dont-join").click(function () {
                cancelled = true;
                windowing_1.windowing.hide();
                session.close("declined-join");
            });
        };
        Handlers.prototype.walkthrough = function (next) {
            storage_1.storage.settings.get("seenIntroDialog").then(function (seenIntroDialog) {
                if (seenIntroDialog) {
                    next();
                    return;
                }
                require(["walkthrough"], function (walkthroughModule) {
                    walkthroughModule.walkthrough.start(true, function () {
                        storage_1.storage.settings.set("seenIntroDialog", true);
                        next();
                    });
                });
            });
        };
        Handlers.prototype.share = function (next) {
            togetherjs_1.TogetherJS.config.close("suppressInvite");
            if (session.isClient || (!session.firstRun) ||
                togetherjs_1.TogetherJS.config.get("suppressInvite")) {
                next();
                return;
            }
            require(["windowing"], function (_a) {
                var windowing = _a.windowing;
                windowing.show("#togetherjs-share");
                // FIXME: no way to detect when the window is closed
                // If there was a next() step then it would not work
            });
        };
        return Handlers;
    }());
    var handlers = new Handlers();
});
//return startup;
//define(["util", "require", "jquery", "windowing", "storage"], startupMain);
