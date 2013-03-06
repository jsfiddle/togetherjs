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
