/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Loading this module will cause, when TogetherJS is active, the
   session object to emit visibility-change with a `hidden` argument
   whenever the visibility changes, on browsers where we can detect
   it.
   */

define(["util", "session"], function (util, session) {
  var visibilityApi = util.Module("visibilityApi");
  var hidden;
  var visibilityChange;
  if (document.hidden !== undefined) { // Opera 12.10 and Firefox 18 and later support
    hidden = "hidden";
    visibilityChange = "visibilitychange";
  } else if (document.mozHidden !== undefined) {
    hidden = "mozHidden";
    visibilityChange = "mozvisibilitychange";
  } else if (document.msHidden !== undefined) {
    hidden = "msHidden";
    visibilityChange = "msvisibilitychange";
  } else if (document.webkitHidden !== undefined) {
    hidden = "webkitHidden";
    visibilityChange = "webkitvisibilitychange";
  }

  session.on("start", function () {
    document.addEventListener(visibilityChange, change, false);
  });

  session.on("close", function () {
    document.removeEventListener(visibilityChange, change, false);
  });

  function change() {
    session.emit("visibility-change", document[hidden]);
  }

  visibilityApi.hidden = function () {
    return document[hidden];
  };

  return visibilityApi;
});
