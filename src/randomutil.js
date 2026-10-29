/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Seeded random value generation, used by the OT tests to replay a fixed
   sequence of edits. */

import RandomStream from "./vendor/whrandom/random.js";

var LOWER = "abcdefghijklmnopqrstuvwxyz";
var UPPER = LOWER.toUpperCase();
var NUMBERS = "0123456789";
var WHITESPACE = " \t\n";
var PUNCTUATION = "~`!@#$%^&*()_-+={}[]|\;:'\"<>,./?";

class Randomizer {
  constructor(seed) {
    this.stream = RandomStream(seed);
  }

  number(max) {
    return Math.floor(this.stream() * max);
  }

  pick(seq) {
    return seq[this.number(seq.length)];
  }

  pickDist(items) {
    var total = 0;
    for (var a in items) {
      if (!Object.prototype.hasOwnProperty.call(items, a)) {
        continue;
      }
      if (typeof items[a] != "number") {
        throw new Error("Bad property: " + a + " not a number");
      }
      total += items[a];
    }
    var num = this.number(total);
    var last;
    for (a in items) {
      if (!Object.prototype.hasOwnProperty.call(items, a)) {
        continue;
      }
      last = a;
      if (num < items[a]) {
        return a;
      }
      num -= items[a];
    }
    return last;
  }

  string(len, chars) {
    var s = "";
    for (var i = 0; i < len; i++) {
      s += this.character(chars);
    }
    return s;
  }

  character(chars) {
    chars = chars || this.defaultChars;
    return chars.charAt(this.number(chars.length));
  }
}

/* These stay on the prototype rather than becoming class fields: callers
   override one on an instance (the OT tests narrow defaultChars) and read the
   rest back off the class, which per-instance fields would not allow. */
Randomizer.prototype.lower = LOWER;
Randomizer.prototype.upper = UPPER;
Randomizer.prototype.numberCharacters = NUMBERS;
Randomizer.prototype.whitespace = WHITESPACE;
Randomizer.prototype.punctuation = PUNCTUATION;
Randomizer.prototype.defaultChars = LOWER + UPPER + NUMBERS + WHITESPACE + PUNCTUATION;

export default Randomizer;
