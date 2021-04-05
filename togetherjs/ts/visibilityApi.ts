/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { session } from "./session";

// Loading this module will cause, when TogetherJS is active, the session object to emit visibility-change with a `hidden` argument whenever the visibility changes, on browsers where we can detect it.

//function visibilityApiMain(_util: TogetherJSNS.Util, session: TogetherJSNS.On) {
let hiddenProp: "hidden" | "mozHidden" | "msHidden" | "webkitHidden";
let visibilityChange: "visibilitychange" | "mozvisibilitychange" | "msvisibilitychange" | "webkitvisibilitychange";

if(document.hidden !== undefined) { // Opera 12.10 and Firefox 18 and later support
    hiddenProp = "hidden";
    visibilityChange = "visibilitychange";
}
else if(document.mozHidden !== undefined) {
    hiddenProp = "mozHidden";
    visibilityChange = "mozvisibilitychange";
}
else if(document.msHidden !== undefined) {
    hiddenProp = "msHidden";
    visibilityChange = "msvisibilitychange";
}
else if(document.webkitHidden !== undefined) {
    hiddenProp = "webkitHidden";
    visibilityChange = "webkitvisibilitychange";
}

session.on("start", function() {
    document.addEventListener(visibilityChange, change, false);
});

session.on("close", function() {
    document.removeEventListener(visibilityChange, change, false);
});

function change() {
    session.emit("visibility-change", !!document[hiddenProp]);
}

function hidden() {
    return document[hiddenProp];
}

export const visibilityApi = {
    hidden: hidden
}

//return visibilityApi;

//define(["util", "session"], visibilityApiMain);
