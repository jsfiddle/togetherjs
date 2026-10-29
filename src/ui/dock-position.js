/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Where the dock currently sits.
 *
 * ui.js owns the dragging and windowing.js has to lay panels out on the
 * correct side of it. ui.js already imports windowing.js, so this tiny module
 * carries the one value between them instead of closing that loop. (The 2013
 * code worked around the same problem by hardcoding `var ifacePos = "right"`
 * with the real lookup commented out next to it, which is why a dock on the
 * left grew its panels off the edge of the screen.)
 */

var EDGES = ["right", "left", "top", "bottom"];

var current = "right";
var listeners = [];

export function dockPosition() {
  return current;
}

export function setDockPosition(edge) {
  if (EDGES.indexOf(edge) == -1) {
    console.warn("Unknown dock position:", edge);
    return;
  }
  if (edge === current) {
    return;
  }
  current = edge;
  listeners.forEach(function (listener) {
    listener(edge);
  });
}

export function onDockPositionChange(listener) {
  listeners.push(listener);
}

export { EDGES };
