/* Ported from togetherjs/tests/test_elementFinder.js.

   The property that matters: a location string produced for an element must
   resolve back to that same element. Peers exchange these strings to point at
   each other's DOM, so a round-trip failure means cursors and focus rings land
   on the wrong node. */

import { describe, it, expect, beforeEach } from "vitest";
import $ from "../../src/dom/dom.js";
import elementFinder from "../../src/dom/elementFinder.js";

const FIXTURE = `
  <div id="outer">
    <p class="one">first</p>
    <p class="two">second <span>nested</span></p>
    <ul>
      <li>a</li>
      <li>b</li>
      <li>c</li>
    </ul>
    <table><tbody><tr><td>cell</td></tr></tbody></table>
  </div>
`;

describe("elementFinder", () => {
  beforeEach(() => {
    document.body.innerHTML = FIXTURE;
  });

  it("round-trips every element in the document", () => {
    const failures = [];
    $(document.body)
      .find("*")
      .each((_i, el) => {
        let location;
        try {
          location = elementFinder.elementLocation($(el));
        } catch (e) {
          failures.push(`${el.tagName}: could not locate (${e})`);
          return;
        }
        const resolved = elementFinder.findElement(location);
        if (resolved !== el) {
          failures.push(`${el.tagName} @ ${location} resolved to ${resolved && resolved.tagName}`);
        }
      });
    expect(failures).toEqual([]);
  });

  it("uses the id when an element has one", () => {
    expect(elementFinder.elementLocation($("#outer"))).toBe("#outer");
  });

  it("throws a CannotFind for a location that matches nothing", () => {
    expect(() => elementFinder.findElement("#does-not-exist")).toThrow();
  });

  it("ignores TogetherJS's own UI, which is marked by the togetherjs class", () => {
    document.body.innerHTML +=
      '<div id="togetherjs-container" class="togetherjs"><span id="inside"></span></div>';
    expect(elementFinder.ignoreElement($("#togetherjs-container")[0])).toBe(true);
    // Descendants are ignored too, which is what keeps the client's own DOM
    // out of the element locations peers exchange.
    expect(elementFinder.ignoreElement($("#inside")[0])).toBe(true);
    expect(elementFinder.ignoreElement($("#outer")[0])).toBe(false);
  });
});
