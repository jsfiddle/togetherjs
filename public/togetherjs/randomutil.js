define(["util", "whrandom"], function (util, RandomStream) {

  var Randomizer = util.Class({
    constructor: function (seed) {
      this.stream = RandomStream(seed);
    },
    number: function (max) {
      return Math.floor(this.stream() * max);
    },
    pick: function (seq) {
      return seq[this.number(seq.length)];
    },
    pickDist: function (items) {
      var total = 0;
      for (var a in items) {
        if (! items.hasOwnProperty(a)) {
          continue;
        }
        if (typeof items[a] != "number") {
          throw "Bad property: " + a + " not a number";
        }
        total += items[a];
      }
      var num = this.number(total);
      var last;
      for (a in items) {
        if (! items.hasOwnProperty(a)) {
          continue;
        }
        last = a;
        if (num < items[a]) {
          return a;
        }
        num -= items[a];
      }
      // FIXME: not sure if this should ever h
      return last;
    },
    string: function (len, chars) {
      var s = "";
      for (var i=0; i<len; i++) {
        s += this.character(chars);
      }
      return s;
    },
    character: function (chars) {
      chars = chars || this.defaultChars;
      return chars.charAt(this.number(chars.length));
    }
  });

  Randomizer.prototype.lower = "abcdefghijklmnopqrstuvwxyz";
  Randomizer.prototype.upper = Randomizer.prototype.lower.toUpperCase();
  Randomizer.prototype.numberCharacters = "0123456789";
  Randomizer.prototype.whitespace = " \t\n";
  Randomizer.prototype.punctuation = "~`!@#$%^&*()_-+={}[]|\\;:'\"<>,./?";
  Randomizer.prototype.defaultChars =
      Randomizer.prototype.lower + Randomizer.prototype.upper +
      Randomizer.prototype.numberCharacters + Randomizer.prototype.whitespace +
      Randomizer.prototype.punctuation;

  return Randomizer;
});
