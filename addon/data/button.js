/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

self.port.on("TogetherJSOn", function () {
  document.getElementById("togetherjs-button").innerHTML = "truckin'";
});

self.port.on("TogetherJSOff", function () {
  document.getElementById("togetherjs-button").innerHTML = "togetherjs";
});
