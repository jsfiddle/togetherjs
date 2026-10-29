/* Ported from togetherjs/tests/test_storage.js */

import { describe, it, expect, beforeEach } from "vitest";
import storage from "../../src/core/storage.js";

describe("storage", () => {
  beforeEach(async () => {
    await storage.clear();
    await storage.tab.clear();
  });

  it("describes itself", () => {
    expect(String(storage)).toBe("[storage for localStorage]");
    expect(String(storage.tab)).toBe("[storage for sessionStorage]");
  });

  it("starts empty after a clear", async () => {
    expect(await storage.keys()).toEqual([]);
    expect(await storage.tab.keys()).toEqual([]);
  });

  it("round-trips a value", async () => {
    await storage.tab.set("foo", "bar");
    expect(await storage.tab.keys()).toEqual(["foo"]);
    expect(await storage.tab.get("foo")).toBe("bar");
  });

  it("returns the default for a missing key", async () => {
    expect(await storage.get("nope", "fallback")).toBe("fallback");
  });

  it("removes a key when set to undefined", async () => {
    await storage.set("gone", "here");
    expect(await storage.get("gone")).toBe("here");
    await storage.set("gone", undefined);
    expect(await storage.keys()).toEqual([]);
  });

  it("keeps localStorage and sessionStorage separate", async () => {
    await storage.set("only-local", 1);
    expect(await storage.tab.keys()).toEqual([]);
    expect(await storage.keys()).toEqual(["only-local"]);
  });

  it("applies the configured storagePrefix to the underlying keys", async () => {
    await storage.set("prefixed", true);
    // The default prefix is "togetherjs"; the Storage instance appends ".".
    expect(Object.keys(localStorage)).toContain("togetherjs.prefixed");
  });

  describe("settings", () => {
    it("rejects unknown setting names", () => {
      expect(() => storage.settings.get("not-a-setting")).toThrow();
    });

    it("round-trips a known setting", async () => {
      await storage.settings.set("name", "Ada");
      expect(await storage.settings.get("name")).toBe("Ada");
    });
  });
});
