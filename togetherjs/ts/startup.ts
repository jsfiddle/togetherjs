/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This module handles all the different UI that happens (sometimes in order) when
   TogetherJS is started:

   - Introduce the session when you've been invited
   - Show any browser compatibility indicators
   - Show the walkthrough the first time
   - Show the share link window

   When everything is done it fires session.emit("startup-ready")

*/
define(["util", "require", "jquery", "windowing", "storage"], function(util: Util, require: Require, $: JQueryStatic, windowing: TogetherJSNS.Windowing, storage: TogetherJSNS.Storage) {
    var assert = util.assert;
    // Avoid circular import:
    var session: TogetherJSNS.Session | null = null;

    type StepKind = "browserBroken" | "browserUnsupported" | "sessionIntro" | "walkthrough" | "share";
    var STEPS: StepKind[] = [
        "browserBroken",
        "browserUnsupported",
        "sessionIntro",
        "walkthrough",
        // Look in the share() below if you add anything after here:
        "share"
    ];

    let currentStep: StepKind | null = null;
    type StepHandler = () => any;

    class Statup {
        start() {
            if(!session) {
                require(["session"], function(sessionModule: TogetherJSNS.Session) {
                    session = sessionModule;
                    startup.start();
                });
                return;
            }
            var index = -1;
            if(currentStep) {
                index = STEPS.indexOf(currentStep);
            }
            index++;
            if(index >= STEPS.length) {
                session.emit("startup-ready");
                return;
            }
            currentStep = STEPS[index];
            handlers[currentStep](startup.start);
        }
    }

    const startup = new Statup();

    class Handlers {
        browserBroken(next: StepHandler) {
            if(window.WebSocket) {
                next();
                return;
            }
            windowing.show("#togetherjs-browser-broken", {
                onClose: function() {
                    session.close();
                }
            });
            if($.browser.msie) {
                $("#togetherjs-browser-broken-is-ie").show();
            }
        }

        browserUnsupported(next: StepHandler) {
            next();
        }

        sessionIntro(next: StepHandler) {
            if((!session.isClient) || !session.firstRun) {
                next();
                return;
            }
            TogetherJS.config.close("suppressJoinConfirmation");
            if(TogetherJS.config.get("suppressJoinConfirmation")) {
                next();
                return;
            }
            var cancelled = false;
            windowing.show("#togetherjs-intro", {
                onClose: function() {
                    if(!cancelled) {
                        next();
                    }
                }
            });
            $("#togetherjs-intro .togetherjs-modal-dont-join").click(function() {
                cancelled = true;
                windowing.hide();
                session.close("declined-join");
            });
        }

        walkthrough(next: StepHandler) {
            storage.settings.get("seenIntroDialog").then(function(seenIntroDialog) {
                if(seenIntroDialog) {
                    next();
                    return;
                }
                require(["walkthrough"], function(walkthrough) {
                    walkthrough.start(true, function() {
                        storage.settings.set("seenIntroDialog", true);
                        next();
                    });
                });
            });
        }

        share(next: StepHandler) {
            TogetherJS.config.close("suppressInvite");
            if(session.isClient || (!session.firstRun) ||
                TogetherJS.config.get("suppressInvite")) {
                next();
                return;
            }
            require(["windowing"], function(windowing: TogetherJSNS.Windowing) {
                windowing.show("#togetherjs-share");
                // FIXME: no way to detect when the window is closed
                // If there was a next() step then it would not work
            });
        }
    }

    const handlers = new Handlers();

    return startup;
});
