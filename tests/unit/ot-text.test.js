/* Operational-transform invariants, ported from the doctest.js suite
   (togetherjs/tests/test_ot_text.js). The randomized case is the important
   one: it is what actually catches transpose bugs. */

import { describe, it, expect } from "vitest";
import ot from "../../src/sync/ot.js";
import Randomizer from "../../src/randomutil.js";

function r(start, length, text) {
  return ot.TextReplace(start, length, text);
}

describe("TextReplace.apply", () => {
  it("inserts text at an offset", () => {
    expect(r(0, 0, "abc").apply("def")).toBe("abcdef");
    expect(r(3, 0, "abc").apply("def")).toBe("defabc");
  });

  it("deletes a range", () => {
    expect(r(1, 2, "").apply("abcdef")).toBe("adef");
  });

  it("replaces a range", () => {
    expect(r(1, 2, "XY").apply("abcdef")).toBe("aXYdef");
  });
});

describe("TextReplace.transpose", () => {
  /* The defining property: given two concurrent edits to the same base text,
     applying each side's transposed counterpart must converge. */
  function converges(base, d1, d2) {
    const sub = d1.transpose(d2);
    const a = sub[0].apply(d2.apply(base));
    const b = sub[1].apply(d1.apply(base));
    return { a, b };
  }

  it("converges for two inserts at the same point", () => {
    const { a, b } = converges("abcdefg", r(1, 0, "XX"), r(1, 0, "YY"));
    expect(a).toBe(b);
  });

  it("converges for an insert against a delete", () => {
    const { a, b } = converges("abcdefg", r(1, 0, "XX"), r(2, 3, ""));
    expect(a).toBe(b);
  });

  it("converges for two overlapping deletes", () => {
    const { a, b } = converges("abcdefg", r(1, 3, ""), r(2, 3, ""));
    expect(a).toBe(b);
  });

  /* The original doctest drove this with a seeded generator so failures could
     be reproduced; keep that, and check both transpose directions. */
  it("converges for randomized edit pairs (seeded)", () => {
    const generator = new Randomizer(1);
    generator.defaultChars = "XYZ/_ ";
    const base = "abcdefg";

    for (let i = 0; i < 200; i++) {
      const d1 = ot.TextReplace.random(base, generator);
      const d2 = ot.TextReplace.random(base, generator);

      const first = converges(base, d1, d2);
      expect(first.a, `d1=${d1} d2=${d2}`).toBe(first.b);

      const second = converges(base, d2, d1);
      expect(second.a, `d2=${d2} d1=${d1}`).toBe(second.b);
    }
  });
});
