/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "./storage", "./windowing", "jquery"], function (require, exports, storage_1, windowing_1, jquery_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.startup = void 0;
    jquery_1 = __importDefault(jquery_1);
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
    let session; // TODO potentially uninitialized, why does TSC doesn't catch that?
    const STEPS = [
        "browserBroken",
        "browserUnsupported",
        "sessionIntro",
        "walkthrough",
        // Look in the share() below if you add anything after here:
        "share"
    ];
    let currentStep = null;
    class Handlers {
        browserBroken(next) {
            if (window.WebSocket) {
                next();
                return;
            }
            windowing_1.windowing.show("#togetherjs-browser-broken", {
                onClose: function () {
                    session.close();
                }
            });
            if (jquery_1.default.browser.msie) {
                (0, jquery_1.default)("#togetherjs-browser-broken-is-ie").show();
            }
        }
        browserUnsupported(next) {
            next();
        }
        sessionIntro(next) {
            if ((!session.isClient) || !session.firstRun) {
                next();
                return;
            }
            TogetherJS.config.close("suppressJoinConfirmation");
            if (TogetherJS.config.get("suppressJoinConfirmation")) {
                next();
                return;
            }
            let cancelled = false;
            windowing_1.windowing.show("#togetherjs-intro", {
                onClose: function () {
                    if (!cancelled) {
                        next();
                    }
                }
            });
            (0, jquery_1.default)("#togetherjs-intro .togetherjs-modal-dont-join").click(function () {
                cancelled = true;
                windowing_1.windowing.hide();
                session.close("declined-join");
            });
        }
        walkthrough(next) {
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
        }
        share(next) {
            TogetherJS.config.close("suppressInvite");
            if (session.isClient || (!session.firstRun) ||
                TogetherJS.config.get("suppressInvite")) {
                next();
                return;
            }
            require(["windowing"], function ({ windowing }) {
                windowing.show("#togetherjs-share");
                // FIXME: no way to detect when the window is closed
                // If there was a next() step then it would not work
            });
        }
    }
    const handlers = new Handlers();
    class Statup {
        start() {
            if (!session) {
                require(["session"], (sessionModule) => {
                    session = sessionModule.session;
                    this.start();
                });
                return;
            }
            let index = -1;
            if (currentStep) {
                index = STEPS.indexOf(currentStep);
            }
            index++;
            if (index >= STEPS.length) {
                session.emit("startup-ready");
                return;
            }
            currentStep = STEPS[index];
            handlers[currentStep](this.start.bind(this)); // TODO is the bind really necessary?
        }
    }
    exports.startup = new Statup();
});
//return startup;
//define(["util", "require", "jquery", "windowing", "storage"], startupMain);
