/* Ported from togetherjs/tests/test_linkify.js */

import { describe, it, expect } from "vitest";
import $ from "../../src/dom/dom.js";
import linkify from "../../src/dom/linkify.js";

// linkify() takes a jQuery object or an element and returns the raw element.
function linkified(markup) {
  return linkify($(markup));
}

/** The anchors linkify produced, as [href, text] pairs. */
function anchors(el) {
  return Array.from(el.querySelectorAll("a")).map((a) => [
    a.getAttribute("href"),
    a.textContent,
    a.getAttribute("target"),
  ]);
}

describe("linkify", () => {
  it("leaves text without URLs alone", () => {
    const el = linkified("<span>this is a test</span>");
    expect(el.textContent).toBe("this is a test");
    expect(anchors(el)).toEqual([]);
  });

  it("turns a bare URL into an anchor", () => {
    const el = linkified("<span>http://foo.com test</span>");
    expect(anchors(el)).toEqual([["http://foo.com", "http://foo.com", "_blank"]]);
    expect(el.textContent).toBe("http://foo.com test");
  });

  it("does not swallow a trailing close paren", () => {
    const el = linkified("<span>yahoo (http://yahoo.com)</span>");
    expect(anchors(el)).toEqual([["http://yahoo.com", "http://yahoo.com", "_blank"]]);
    expect(el.textContent).toBe("yahoo (http://yahoo.com)");
  });

  it("returns the underlying element it was given", () => {
    const el = $("<span>plain</span>");
    expect(linkify(el)).toBe(el[0]);
  });
});
