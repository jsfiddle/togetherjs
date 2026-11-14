/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* The icon set, as inline SVG.
 *
 * These replace 22 single-colour PNG masks (one file per icon per state,
 * ~378KB in all). Inline SVG is what makes the dock themeable: every path
 * paints with `currentColor`, so an icon follows the colour of whatever it
 * sits in and a host overriding one token recolours the whole UI. The PNGs
 * were white-on-transparent, so the only way to restyle them was to ship
 * different files.
 *
 * Drawn on a 20x20 grid with 1.6px strokes, which keeps them legible at the
 * 16-20px the dock renders at. Geometry is deliberately simple — no gradients,
 * no inner shadows, nothing that needs a second colour.
 */

/* Paths only: the <svg> wrapper is added by icon() below, so every icon gets
   the same sizing and the same accessibility treatment. */
var PATHS = {
  /* A person with a plus: "add a friend". */
  share:
    '<circle cx="8" cy="6.5" r="3.1"/>' +
    '<path d="M2.2 17c0-3.1 2.6-5.1 5.8-5.1 1 0 1.9.2 2.7.5"/>' +
    '<path d="M14.5 11.6v5.2M11.9 14.2h5.2"/>',

  microphone:
    '<path d="M10 3.2a2.3 2.3 0 0 1 2.3 2.3v4.2a2.3 2.3 0 0 1-4.6 0V5.5A2.3 2.3 0 0 1 10 3.2z"/>' +
    '<path d="M5.4 9.3v.6a4.6 4.6 0 0 0 9.2 0v-.6"/>' +
    '<path d="M10 14.5v2.3M7.4 16.8h5.2"/>',

  /* The same microphone with a slash, so muted reads as the same object. */
  "microphone-muted":
    '<path d="M12.3 5.5v2.1M7.7 7v2.7a2.3 2.3 0 0 0 3.9 1.6"/>' +
    '<path d="M12.3 4.4A2.3 2.3 0 0 0 8.2 3.9"/>' +
    '<path d="M5.4 9.3v.6a4.6 4.6 0 0 0 7 3.9M14.6 9.3v.6c0 .5-.1 1-.2 1.5"/>' +
    '<path d="M10 14.5v2.3M7.4 16.8h5.2"/>' +
    '<path d="M3.4 3.4l13.2 13.2"/>',

  /* A camera: the body plus a lens barrel. Nothing in the original PNG set
     drew one, which is why the video button used to borrow the microphone. */
  camera:
    '<path d="M2.6 6.4h8.3a1.4 1.4 0 0 1 1.4 1.4v4.4a1.4 1.4 0 0 1-1.4 1.4H2.6a1.4 1.4 0 0 1-1.4-1.4V7.8a1.4 1.4 0 0 1 1.4-1.4z"/>' +
    '<path d="M12.3 9.4l4.5-2.4a.5.5 0 0 1 .8.4v5.2a.5.5 0 0 1-.8.4l-4.5-2.4z"/>',

  "camera-off":
    '<path d="M7.3 6.4h3.6a1.4 1.4 0 0 1 1.4 1.4v2.3M12.3 12.8a1.4 1.4 0 0 1-1.4 1.4H2.6a1.4 1.4 0 0 1-1.4-1.4V7.8a1.4 1.4 0 0 1 1.4-1.4h1"/>' +
    '<path d="M12.3 9.4l4.5-2.4a.5.5 0 0 1 .8.4v5.2a.5.5 0 0 1-.8.4l-2-1.1"/>' +
    '<path d="M2.4 2.4l15.2 15.2"/>',

  chat:
    '<path d="M17 10.4c0 3.4-3.1 6.2-7 6.2a8 8 0 0 1-2.3-.3L3.4 17.6l1-3a5.8 5.8 0 0 1-1.4-3.8c0-3.4 3.1-6.2 7-6.2s7 2.8 7 6.2z"/>',

  gear:
    '<path d="M18.0 8.3L18.0 11.7L15.8 11.6L15.2 12.9L16.9 14.5L14.5 16.9L12.9 15.2L11.6 15.8L11.7 18.0L8.3 18.0L8.4 15.8L7.1 15.2L5.5 16.9L3.1 14.5L4.8 12.9L4.2 11.6L2.0 11.7L2.0 8.3L4.2 8.4L4.8 7.1L3.1 5.5L5.5 3.1L7.1 4.8L8.4 4.2L8.3 2.0L11.7 2.0L11.6 4.2L12.9 4.8L14.5 3.1L16.9 5.5L15.2 7.1L15.8 8.4Z"/>' +
    '<circle cx="10" cy="10" r="2.6"/>',

  close: '<path d="M5 5l10 10M15 5L5 15"/>',

  /* A short chevron, rotated by CSS to point in any direction. */
  chevron: '<path d="M7.5 4.5l6 5.5-6 5.5"/>',

  /* Two columns of dots: the standard "drag me" affordance. Filled rather
     than stroked, so it stays crisp at small sizes. */
  grip:
    '<g fill="currentColor" stroke="none">' +
    '<circle cx="7.5" cy="5" r="1.3"/><circle cx="12.5" cy="5" r="1.3"/>' +
    '<circle cx="7.5" cy="10" r="1.3"/><circle cx="12.5" cy="10" r="1.3"/>' +
    '<circle cx="7.5" cy="15" r="1.3"/><circle cx="12.5" cy="15" r="1.3"/>' +
    "</g>",

  pencil:
    '<path d="M13.6 2.9l3.5 3.5-9.3 9.3-4.4.9.9-4.4z"/>' +
    '<path d="M11.8 4.7l3.5 3.5"/>',

  /* A power symbol: ends the session. */
  power:
    '<path d="M10 2.4v6.5"/>' +
    '<path d="M14.9 5.4a6.9 6.9 0 1 1-9.8 0"/>',

  /* The little arrow that points from a panel back at its dock button. */
  caret: '<path d="M10 5.5L16 13H4z" fill="currentColor" stroke="none"/>',

  /* Default avatar: replaces default-avatar.png, and takes the peer's colour
     from whatever it is placed in. */
  person:
    '<circle cx="10" cy="7" r="3.4"/>' +
    '<path d="M3.4 17.4c0-3.4 3-5.6 6.6-5.6s6.6 2.2 6.6 5.6"/>',

  check: '<path d="M4 10.6l4 4L16 6"/>',

  plus: '<path d="M10 4.4v11.2M4.4 10h11.2"/>',
};

/* Icons whose shape only reads correctly when filled. */
var FILLED = { caret: true, grip: true };

/* Returns the SVG markup for one icon.
 *
 * Always aria-hidden: an icon never carries the accessible name. The control
 * around it does, through its own text, aria-label or a visually hidden
 * label — so a screen reader hears "Turn on microphone", not "image".
 */
export function icon(name, options) {
  var path = PATHS[name];
  if (!path) {
    console.warn("No such icon:", name);
    return "";
  }
  options = options || {};
  var attrs = [
    'xmlns="http://www.w3.org/2000/svg"',
    'viewBox="0 0 20 20"',
    'aria-hidden="true"',
    'focusable="false"',
    'class="togetherjs-icon' + (options.className ? " " + options.className : "") + '"',
  ];
  if (FILLED[name]) {
    attrs.push('fill="currentColor"', 'stroke="none"');
  } else {
    attrs.push(
      'fill="none"',
      'stroke="currentColor"',
      'stroke-width="1.6"',
      'stroke-linecap="round"',
      'stroke-linejoin="round"'
    );
  }
  return "<svg " + attrs.join(" ") + ">" + path + "</svg>";
}

export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(PATHS, name);
}

/* Replaces every <span data-togetherjs-icon="name"> in a tree with that icon.
   The templates mark up where an icon belongs and this fills them in, so the
   markup stays free of inline SVG. */
export function expandIcons(root) {
  if (!root) {
    return;
  }
  var holders = root.querySelectorAll("[data-togetherjs-icon]");
  for (var i = 0; i < holders.length; i++) {
    var el = holders[i];
    var name = el.getAttribute("data-togetherjs-icon");
    el.innerHTML = icon(name);
    el.removeAttribute("data-togetherjs-icon");
  }
}

export default { icon: icon, hasIcon: hasIcon, expandIcons: expandIcons };
