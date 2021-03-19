"use strict";
define(["util", "whrandom"], function (_util, RandomStream) {
    var Randomizer = /** @class */ (function () {
        function Randomizer(seed) {
            this.lower = "abcdefghijklmnopqrstuvwxyz";
            this.upper = this.lower.toUpperCase();
            this.numberCharacters = "0123456789";
            this.whitespace = " \t\n";
            this.punctuation = "~`!@#$%^&*()_-+={}[]|\\;:'\"<>,./?";
            this.defaultChars = this.lower + this.upper + this.numberCharacters + this.whitespace + this.punctuation;
            this.stream = RandomStream(seed);
        }
        Randomizer.prototype.number = function (max) {
            return Math.floor(this.stream() * max);
        };
        Randomizer.prototype.pick = function (seq) {
            return seq[this.number(seq.length)];
        };
        Randomizer.prototype.pickDist = function (items) {
            var total = 0;
            for (var a in items) {
                if (!items.hasOwnProperty(a)) {
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
                if (!items.hasOwnProperty(a)) {
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
        };
        Randomizer.prototype.string = function (len, chars) {
            var s = "";
            for (var i = 0; i < len; i++) {
                s += this.character(chars);
            }
            return s;
        };
        Randomizer.prototype.character = function (chars) {
            chars = chars || this.defaultChars;
            return chars.charAt(this.number(chars.length));
        };
        return Randomizer;
    }());
    return function (seed) { return new Randomizer(seed); };
});
