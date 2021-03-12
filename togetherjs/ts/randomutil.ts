interface RandomStreamModule {
    (seed: unknown): RandomStreamObject;
}

interface RandomStreamObject {
    (): number;
}

define(["util", "whrandom"], function(util: Util, RandomStream: RandomStreamModule) {

    class Randomizer {
        private stream: RandomStreamObject;

        private lower = "abcdefghijklmnopqrstuvwxyz";
        private upper = this.lower.toUpperCase();
        private numberCharacters = "0123456789";
        private whitespace = " \t\n";
        private punctuation = "~`!@#$%^&*()_-+={}[]|\\;:'\"<>,./?";
        private defaultChars = this.lower + this.upper + this.numberCharacters + this.whitespace + this.punctuation;

        constructor(seed: unknown) {
            this.stream = RandomStream(seed);
        }

        number(max: number) {
            return Math.floor(this.stream() * max);
        }

        pick<T>(seq: T[]): T {
            return seq[this.number(seq.length)];
        }

        pickDist(items: number[]) {
            var total = 0;
            for(var a in items) {
                if(!items.hasOwnProperty(a)) {
                    continue;
                }
                if(typeof items[a] != "number") {
                    throw "Bad property: " + a + " not a number";
                }
                total += items[a];
            }
            var num = this.number(total);
            var last;
            for(a in items) {
                if(!items.hasOwnProperty(a)) {
                    continue;
                }
                last = a;
                if(num < items[a]) {
                    return a;
                }
                num -= items[a];
            }
            // FIXME: not sure if this should ever h
            return last;
        }

        string(len: number, chars: string) {
            var s = "";
            for(var i = 0; i < len; i++) {
                s += this.character(chars);
            }
            return s;
        }

        character(chars?: string) {
            chars = chars || this.defaultChars;
            return chars.charAt(this.number(chars.length));
        }
    }

    return Randomizer;
});
