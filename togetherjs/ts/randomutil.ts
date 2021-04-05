import { RandomStream } from "./libs/random";

//function randomutilMain(_util: TogetherJSNS.Util, RandomStream: RandomStreamModule) {

export class Randomizer {
    private stream;

    private lower = "abcdefghijklmnopqrstuvwxyz";
    private upper = this.lower.toUpperCase();
    private numberCharacters = "0123456789";
    private whitespace = " \t\n";
    private punctuation = "~`!@#$%^&*()_-+={}[]|\\;:'\"<>,./?";
    private defaultChars = this.lower + this.upper + this.numberCharacters + this.whitespace + this.punctuation;

    constructor(seed: number) {
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

    string(len: number, chars?: string) {
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

export const randomutil = (seed: number) => new Randomizer(seed);

//define(["util", "whrandom"], randomutilMain);
