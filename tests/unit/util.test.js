/* Covers util's promise helpers and URL utilities. Merges the old
   test_resolves.js and test_misc.js doctests. */

import { describe, it, expect } from "vitest";
import util from "../../src/core/util.js";

describe("util.resolver", () => {
  it("resolves a deferred with the function's return value", async () => {
    const def = util.Deferred();
    setTimeout(util.resolver(def, () => "ok"));
    expect(await def).toBe("ok");
  });

  it("adopts a returned promise", async () => {
    const def = util.Deferred();
    const chained = util.Deferred();
    setTimeout(util.resolver(def, () => chained));
    setTimeout(() => chained.resolve("second"));
    expect(await def).toBe("second");
  });
});

describe("util.resolveMany", () => {
  it("collects the results in order", async () => {
    const defs = [util.Deferred(), util.Deferred(), util.Deferred()];
    const result = util.resolveMany(defs);
    setTimeout(() => {
      defs[0].resolve("first");
      defs[1].resolve("second");
      defs[2].resolve("last");
    });
    expect(await result).toEqual(["first", "second", "last"]);
  });
});

describe("util.makeUrlAbsolute", () => {
  const base = "http://example.com/foo/bar?query#hash";

  it("resolves a root-relative url", () => {
    expect(util.makeUrlAbsolute("/baz", base)).toBe("http://example.com/baz");
  });

  it("resolves a path-relative url", () => {
    expect(util.makeUrlAbsolute("baz", base)).toBe("http://example.com/foo/baz");
  });

  it("leaves an absolute url alone", () => {
    expect(util.makeUrlAbsolute("http://other.com/x", base)).toBe("http://other.com/x");
  });

  it("resolves a protocol-relative url", () => {
    expect(util.makeUrlAbsolute("//other.com/x", base)).toBe("http://other.com/x");
  });
});

describe("util.truncateCommonDomain", () => {
  it("strips the domain when it matches", () => {
    expect(util.truncateCommonDomain("http://example.com/foo", "http://example.com/bar")).toBe(
      "/foo",
    );
  });

  it("keeps the full url when the domains differ", () => {
    expect(util.truncateCommonDomain("http://other.com/foo", "http://example.com/bar")).toBe(
      "http://other.com/foo",
    );
  });
});

describe("util.assertValidUrl", () => {
  it("accepts http, https and data urls", () => {
    expect(() => util.assertValidUrl("http://example.com/x")).not.toThrow();
    expect(() => util.assertValidUrl("https://example.com/x")).not.toThrow();
    expect(() => util.assertValidUrl("data:image/png;base64,AAAA")).not.toThrow();
  });

  it("rejects a javascript: url", () => {
    expect(() => util.assertValidUrl("javascript:alert(1)")).toThrow();
  });
});

describe("util.safeClassName", () => {
  it("replaces characters that are not class-safe", () => {
    expect(util.safeClassName("a b/c")).toBe("a_b_c");
  });

  it("substitutes rather than drops, so a name of separators stays non-empty", () => {
    expect(util.safeClassName("///")).toBe("___");
  });

  it("falls back to a placeholder for an empty name", () => {
    expect(util.safeClassName("")).toBe("class");
  });
});
