/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Peer colours.
 *
 * A peer's colour is their identity in the UI: it rings their avatar, tints
 * their cursor and labels their chat messages. The old palette was eleven
 * hand-picked CSS keyword colours (chartreuse, cyan, gold, lightgreen...)
 * which were wildly uneven in lightness, so some peers got a legible label
 * and others got pale-yellow-on-white. And when a peer did not pick, their
 * colour came from `Math.floor(Math.random() * 0xffffff)`, which could just
 * as easily be near-white as anything else.
 *
 * These are generated from an even OKLCH ramp instead: constant lightness and
 * chroma, hues spread evenly round the wheel. That makes every colour equally
 * distinguishable from the others and equally legible against both themes,
 * which is what a seeded random value cannot promise.
 */

/* Twelve hues, 30 degrees apart, all at OKLCH lightness 0.58 -- light enough
   to carry white text, dark enough to show on a white panel, and identical
   across the set so no peer gets a washed-out identity. Chroma is pushed to
   whatever sRGB allows at each hue (0.10 to 0.16), since a single chroma for
   all twelve would have to drop to the worst hue's limit and mute the lot.

   Written out as sRGB hex rather than oklch() so a value can go straight into
   a canvas fill or an inline style, which oklch() cannot in every engine. */
var PALETTE = [
  "#c24976", // h=0    rose
  "#c74c3d", // h=30   red
  "#b36300", // h=60   orange
  "#967600", // h=90   amber
  "#708500", // h=120  olive
  "#009342", // h=150  green
  "#008e7d", // h=180  teal
  "#008a9b", // h=210  cyan
  "#0083c0", // h=240  blue
  "#5671d8", // h=270  indigo
  "#8a5fc9", // h=300  violet
  "#ad51a7", // h=330  magenta
];

var HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export { PALETTE };

/* True if `color` is something we are willing to paint with.
 *
 * Colours arrive from two places we do not control: a peer over the wire, and
 * the host page's getUserColor() callback. Both used to go straight into a
 * style property — peers.js carried a `FIXME: would be nice to test for
 * color-ness here` on exactly that line. A hex literal is all the client ever
 * sends, so accepting only that keeps anything else out of the DOM. */
export function isValidColor(color) {
  return typeof color == "string" && HEX.test(color.trim());
}

/* Expands #abc to #aabbcc and lowercases, so two spellings of one colour
   compare equal. The swatch highlight never used to appear because the
   palette was uppercase and the generated default was lowercase. */
export function normalizeColor(color) {
  if (!isValidColor(color)) {
    return null;
  }
  var hex = color.trim().toLowerCase();
  if (hex.length == 4) {
    hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  return hex;
}

/* Picks a colour for a peer, preferring one nobody else is using.
 *
 * `taken` is a list of the colours already in play. Identity is the whole
 * point of these colours, so two people in the same session getting the same
 * one is worth avoiding; past twelve peers it wraps, which is well beyond
 * what the mesh carries anyway. */
export function pickColor(taken) {
  var used = {};
  (taken || []).forEach(function (color) {
    var normal = normalizeColor(color);
    if (normal) {
      used[normal] = true;
    }
  });
  var free = PALETTE.filter(function (color) {
    return !used[color];
  });
  var pool = free.length ? free : PALETTE;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* Relative luminance, per WCAG. */
function luminance(hex) {
  var channels = [1, 3, 5].map(function (i) {
    var c = parseInt(hex.substr(i, 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/* Black or white, whichever has the better contrast ratio against
   `background`. The palette above is all one lightness, but the picker also
   offers the platform colour input, so anything can turn up here. */
export function foregroundFor(background) {
  var hex = normalizeColor(background);
  if (!hex) {
    return "#111111";
  }
  var l = luminance(hex);
  // Against white: 1.05 / (l + 0.05). Against black: (l + 0.05) / 0.05.
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? "#ffffff" : "#111111";
}

export default {
  PALETTE: PALETTE,
  isValidColor: isValidColor,
  normalizeColor: normalizeColor,
  pickColor: pickColor,
  foregroundFor: foregroundFor,
};
