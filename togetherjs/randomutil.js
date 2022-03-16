define(["require", "exports", "./libs/random"], function (require, exports, random_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.randomutil = exports.Randomizer = void 0;
    //function randomutilMain(_util: TogetherJSNS.Util, RandomStream: RandomStreamModule) {
    class Randomizer {
        constructor(seed) {
            this.lower = "abcdefghijklmnopqrstuvwxyz";
            this.upper = this.lower.toUpperCase();
            this.numberCharacters = "0123456789";
            this.whitespace = " \t\n";
            this.punctuation = "~`!@#$%^&*()_-+={}[]|\\;:'\"<>,./?";
            this.defaultChars = this.lower + this.upper + this.numberCharacters + this.whitespace + this.punctuation;
            this.stream = (0, random_1.RandomStream)(seed);
        }
        number(max) {
            return Math.floor(this.stream() * max);
        }
        pick(seq) {
            return seq[this.number(seq.length)];
        }
        pickDist(items) {
            let total = 0;
            for (const a in items) {
                if (!Object.prototype.hasOwnProperty.call(items, a)) {
                    continue;
                }
                if (typeof items[a] != "number") {
                    throw "Bad property: " + a + " not a number";
                }
                total += items[a];
            }
            let num = this.number(total);
            let last;
            for (const a in items) {
                if (!Object.prototype.hasOwnProperty.call(items, a)) {
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
        }
        string(len, chars) {
            let s = "";
            for (let i = 0; i < len; i++) {
                s += this.character(chars);
            }
            return s;
        }
        character(chars) {
            chars = chars || this.defaultChars;
            return chars.charAt(this.number(chars.length));
        }
    }
    exports.Randomizer = Randomizer;
    const randomutil = (seed) => new Randomizer(seed);
    exports.randomutil = randomutil;
});
//define(["util", "whrandom"], randomutilMain);
