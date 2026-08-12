/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* The UI's animations.
 *
 * These replace jqueryPlugins.js, which drove every animation through jQuery
 * `step:` callbacks tweening a fake `borderSpacing` property and writing
 * -webkit-/-moz-/-ms-/-o-transform by hand on each frame — a technique that
 * predates CSS transitions.
 *
 * They are plain functions taking a DomList rather than $.fn plugins: the
 * client has only a handful of call sites, and extending the DOM helper's
 * prototype from another module is the jQuery-plugin pattern this rewrite is
 * getting away from.
 */

import $ from "./dom.js";

/** Wait for an element's animations to settle. */
function finished(el) {
  const node = el[0];
  if (!node || !node.getAnimations) return Promise.resolve();
  return Promise.all(node.getAnimations().map((a) => a.finished.catch(() => {})));
}

/* Slide a notification window in from the right. */
export function slideIn(el) {
  el.css({ opacity: 0, zIndex: 8888 });
  const node = el[0];
  if (!node) return Promise.resolve();
  const animation = node.animate(
    [
      { transform: "translateX(74px)", opacity: 0 },
      { transform: "translateX(0)", opacity: 1 },
    ],
    { duration: 200, easing: "ease-out", fill: "forwards" },
  );
  return animation.finished.then(() => {
    el.css({ opacity: 1, zIndex: 9999 });
    animation.cancel();
  });
}

/* Pop a window out of its dock button, with a small overshoot. */
export function popinWindow(el) {
  el.css({ opacity: 1, zIndex: 8888 });
  const pointer = $("#togetherjs-window-pointer-right");

  // The original skipped the bounce on mobile; a coarse pointer usually means
  // a slower device, so keep that.
  const frames = $.isMobile()
    ? [{ transform: "translateX(74px)" }, { transform: "translateX(0)" }]
    : [
        { transform: "translateX(74px)" },
        { transform: "translateX(-4px)", offset: 0.8 },
        { transform: "translateX(0)" },
      ];
  const options = { duration: 120, easing: "ease-out", fill: "forwards" };

  const animations = [];
  if (el[0]) animations.push(el[0].animate(frames, options));
  if (pointer[0]) {
    pointer.css({ opacity: 1, zIndex: 8888 });
    animations.push(pointer[0].animate(frames, options));
  }
  return Promise.all(animations.map((a) => a.finished.catch(() => {}))).then(() => {
    for (const a of animations) {
      // Leave the element at its natural position rather than holding the
      // animation's forwards fill, which would win over later style changes.
      try {
        a.commitStyles();
      } catch {
        /* not composited */
      }
      a.cancel();
    }
    el.css({ transform: "" });
    pointer.css({ transform: "" });
  });
}

/* Fade a notification away, flipping its bottom edge out. */
export function fadeOutWindow(el) {
  const node = el[0];
  if (!node) return Promise.resolve();
  const animation = node.animate(
    [
      { transform: "perspective(600px) rotateX(0deg)", opacity: 1 },
      { transform: "perspective(600px) rotateX(-90deg)", opacity: 0.5 },
    ],
    { duration: 500, easing: "linear", fill: "forwards" },
  );
  return animation.finished.then(() => {
    animation.cancel();
    el.css({ transform: "", opacity: "" });
  });
}

/* Grow an avatar into the dock. */
export function animateDockEntry(el) {
  const node = el[0];
  if (!node) return Promise.resolve();
  const height = el.height();
  const width = el.width();
  const margin = parseInt(el.css("marginLeft"), 10) || 0;

  const animation = node.animate(
    [
      {
        marginLeft: margin + width / 2 + "px",
        height: "0px",
        width: "0px",
        backgroundSize: "0 0",
      },
      {
        marginLeft: margin + "px",
        height: height + "px",
        width: width + "px",
        backgroundSize: height + 4 + "px",
      },
    ],
    { duration: 600, easing: "ease-out" },
  );
  // No fill: the element should land back on its stylesheet values.
  return animation.finished.catch(() => {});
}

/* Shrink an avatar out of the dock; the reverse of the above. */
export function animateDockExit(el) {
  const node = el[0];
  if (!node) return Promise.resolve();
  const height = el.height();
  const width = el.width();
  const margin = parseInt(el.css("marginLeft"), 10) || 0;

  const animation = node.animate(
    [
      {
        marginLeft: margin + "px",
        height: height + "px",
        width: width + "px",
        backgroundSize: height + 4 + "px",
        opacity: 1,
      },
      {
        marginLeft: margin + width / 2 + "px",
        height: "0px",
        width: "0px",
        backgroundSize: "0 0",
        opacity: 0,
      },
    ],
    { duration: 600, easing: "ease-in", fill: "forwards" },
  );
  return animation.finished.catch(() => {});
}

/* Smoothly scroll the page to a vertical position. */
export function easeTo(y) {
  window.scrollTo({ top: y, behavior: "smooth" });
  return Promise.resolve();
}

/* The three-dot "typing" indicator.
   The original drove this from a setInterval writing opacity on each dot; it
   is a CSS animation now, so it costs nothing while it runs. */
export function animateKeyboard(el) {
  el.addClass("togetherjs-typing-animating");
}

export function stopKeyboardAnimation(el) {
  el.removeClass("togetherjs-typing-animating");
}

export { finished };
