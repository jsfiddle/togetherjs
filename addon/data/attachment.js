/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

self.port.on("Config", function (config) {
  var doc = unsafeWindow.document;
  unsafeWindow._TowTruckBookmarklet = true;
  unsafeWindow.TowTruck = {hubBase: config.hubBase || null};
  if (config.shareId) {
    unsafeWindow._TowTruckShareId = config.shareId;
  }
  var script = doc.createElement("script");
  script.src = config.url;
  console.log("Attaching:", script.outerHTML, "to:", window.location.href);
  doc.head.appendChild(script);
});

// FIXME: need to bind to session.on("close") and emit this:
// self.port.emit("Close");
