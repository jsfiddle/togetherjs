/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
define(["require", "exports", "./session"], function (require, exports, session_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.visibilityApi = void 0;
    // Loading this module will cause, when TogetherJS is active, the session object to emit visibility-change with a `hidden` argument whenever the visibility changes, on browsers where we can detect it.
    //function visibilityApiMain(_util: TogetherJSNS.Util, session: TogetherJSNS.On) {
    let hiddenProp;
    let visibilityChange;
    if (document.hidden !== undefined) { // Opera 12.10 and Firefox 18 and later support
        hiddenProp = "hidden";
        visibilityChange = "visibilitychange";
    }
    else if (document.mozHidden !== undefined) {
        hiddenProp = "mozHidden";
        visibilityChange = "mozvisibilitychange";
    }
    else if (document.msHidden !== undefined) {
        hiddenProp = "msHidden";
        visibilityChange = "msvisibilitychange";
    }
    else if (document.webkitHidden !== undefined) {
        hiddenProp = "webkitHidden";
        visibilityChange = "webkitvisibilitychange";
    }
    session_1.session.on("start", function () {
        document.addEventListener(visibilityChange, change, false);
    });
    session_1.session.on("close", function () {
        document.removeEventListener(visibilityChange, change, false);
    });
    function change() {
        session_1.session.emit("visibility-change", !!document[hiddenProp]);
    }
    function hidden() {
        return document[hiddenProp];
    }
    exports.visibilityApi = {
        hidden: hidden
    };
});
//return visibilityApi;
//define(["util", "session"], visibilityApiMain);
