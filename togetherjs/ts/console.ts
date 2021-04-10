/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { util } from "./util";

type LogFunction = (...args: any[]) => void;
type LogLevelString = "debug" | "log" | "info" | "notify" | "warn" | "error" | "fatal" | "suppressedWrite";

type LogMessage = [timestamp: number, logLevel: number | "suppress", log: string];

//function consoleMain(util: TogetherJSNS.Util) {

const console = window.console || { log: function() { /* Do nothing */ } };

export class Console {
    public static levels: {[ll in LogLevelString]: number} = {
        debug: 1,
        // FIXME: I'm considering *not* wrapping console.log, and strictly keeping it as a debugging tool; also line numbers would be preserved
        log: 2,
        info: 3,
        notify: 4,
        warn: 5,
        error: 6,
        fatal: 7,
        suppressedWrite: 8,
    };

    private messages: LogMessage[] = [];
    private level = Console.levels.log;
    // Gets set below:
    private maxLevel = 0;
    public levelNames: {[lln: number]: LogLevelString} = {};

    public debug: LogFunction = logFunction("debug", Console.levels["debug"]);
    public log: LogFunction = logFunction("log", Console.levels["log"]);
    public info: LogFunction = logFunction("info", Console.levels["info"]);
    public notify: LogFunction = logFunction("notify", Console.levels["notify"]);
    public warn: LogFunction = logFunction("warn", Console.levels["warn"]);
    public error: LogFunction = logFunction("error", Console.levels["error"]);
    public fatal: LogFunction = logFunction("fatal", Console.levels["fatal"]);

    private consoleLevels: LogFunction[] = [
        [],
        "debug" in console ? console.debug : [],
        "log" in console ? console.log : [],
        "info" in console ? console.info : [],
        "notify" in console ? (console as any).notify : [], // TODO remove
        "warn" in console ? console.warn : [],
        "error" in console ? console.error : [],
        "fatal" in console ? (console as any).fatal : [] // TODO remove
    ];

    constructor() {
        util.forEachAttr(Console.levels, (value) => {
            this.maxLevel = Math.max(this.maxLevel, value);
        });
    
        util.forEachAttr(Console.levels, (value, name) => {
            this.levelNames[value] = name;
        });
    }

    setLevel(l: LogLevelString | LogFunction | number): void {
        let number: number;
        let llNum: number;
        if(typeof l == "string") {
            number = Console.levels[l];
            if(number === undefined) {
                throw new Error("Tried to set Console level to unknown level string: " + l);
            }
            llNum = number;
        }
        else if(typeof l == "function") {
            number = this.consoleLevels.indexOf(l);
            if(number == -1) {
                throw new Error("Tried to set Console level based on unknown console function: " + l);
            }
            llNum = number;
        }
        else { //if(typeof l == "number") {
            if(l < 0) {
                throw new Error("Console level must be 0 or larger: " + l);
            }
            else if(l > this.maxLevel) {
                throw new Error("Console level must be " + this.maxLevel + " or smaller: " + l);
            }
            llNum = l;
        }
        this.level = llNum;
    }

    write(level: "suppress" | number, ...args: unknown[]): void {
        try {
            this.messages.push([
                Date.now(),
                level,
                this._stringify(...args)
            ]);
        }
        catch(e) {
            console.warn("Error stringifying argument:", e);
        }
        if(level != "suppress" && this.level <= level) {
            const l = this.levelNames[level];
            let method: LogFunction;
            if(l in console) {
                method = console[l as keyof typeof console];
            }
            else {
                method = console.log;
            }
            method.apply(console, args);
        }
    }

    suppressedWrite(...args: unknown[]): void {
        const w = this.write;
        const a: Parameters<typeof w> = ["suppress", ...args];
        this.write.apply(this, a);
    }

    trace(level: LogLevelString = "log"): void {
        if("trace" in console) {
            level = "suppressedWrite";
        }

        try {
            throw new Error();
        }
        catch(e) {
            // FIXME: trim this frame
            let stack = e.stack;
            stack = stack.replace(/^[^\n]*\n/, "");
            this[level](stack);
        }

        if("trace" in console) {
            console.trace();
        }
    }

    _browserInfo(): string[] {
        // FIXME: add TogetherJS version and
        return [
            "TogetherJS base URL: " + TogetherJS.baseUrl,
            "User Agent: " + navigator.userAgent,
            "Page loaded: " + this._formatDate(TogetherJS.pageLoaded),
            "Age: " + this._formatMinutes(Date.now() - TogetherJS.pageLoaded) + " minutes",
            // FIXME: make this right:
            //"Window: height: " + window.screen.height + " width: " + window.screen.width
            "URL: " + location.href,
            "------+------+----------------------------------------------"
        ];
    }

    _stringify(...args: any[]): string {
        let s = "";
        for(let i = 0; i < args.length; i++) {
            if(s) {
                s += " ";
            }
            s += this._stringifyItem(args[i]);
        }
        return s;
    }

    _stringifyItem(item: string | TogetherJSNS.PeerClass): string {
        if(typeof item == "string") {
            if(item === "") {
                return '""';
            }
            return item;
        }
        if(typeof item == "object" && "repr" in item) {
            try {
                return item.repr();
            }
            catch(e) {
                console.warn("Error getting object repr:", item, e);
            }
        }
        if(item !== null && typeof item == "object") {
            // FIXME: this can drop lots of kinds of values, like a function or undefined
            item = JSON.stringify(item);
        }
        return item.toString();
    }

    _formatDate(timestamp: number): string {
        return (new Date(timestamp)).toISOString();
    }

    _formatTime(timestamp: number): string {
        return ((timestamp - TogetherJS.pageLoaded) / 1000).toFixed(2);
    }

    _formatMinutes(milliseconds: number): string {
        const m: number = Math.floor(milliseconds / 1000 / 60);
        let formatted = "" + m;
        const remaining = milliseconds - (m * 1000 * 60);
        if(m > 10) {
            // Over 10 minutes, just ignore the seconds
            return formatted;
        }
        let seconds = Math.floor(remaining / 1000) + "";
        formatted += ":";
        seconds = lpad(seconds, 2, "0");
        formatted += seconds;
        if(formatted == "0:00") {
            formatted += ((remaining / 1000).toFixed(3) + "").substr(1);
        }
        return formatted;
    }

    _formatLevel(l: number | "suppress"): LogLevelString | "" {
        if(l === "suppress") {
            return "";
        }
        return this.levelNames[l];
    }

    toString(): string {
        try {
            const lines = this._browserInfo();
            this.messages.forEach(function(this: Console, m) {
                lines.push(lpad(this._formatTime(m[0]), 6) + " " + rpad(this._formatLevel(m[1]), 6) + " " + lpadLines(m[2], 14));
            }, this);
            return lines.join("\n");
        }
        catch(e) {
            // toString errors can otherwise be swallowed:
            console.warn("Error running console.toString():", e);
            throw e;
        }
    }
}

function rpad(s: string, len: number, pad = " ") {
    s = s + "";
    while(s.length < len) {
        s += pad;
    }
    return s;
}

function lpad(s: string, len: number, pad = " ") {
    s = s + "";
    while(s.length < len) {
        s = pad + s;
    }
    return s;
}

function lpadLines(s: string, len: number, pad = " ") {
    let i;
    s = s + "";
    if(s.indexOf("\n") == -1) {
        return s;
    }
    let fullPad = "";
    for(i = 0; i < len; i++) {
        fullPad += pad;
    }
    const lines = s.split(/\n/g);
    for(i = 1; i < s.length; i++) {
        lines[i] = fullPad + s[i];
    }
    return lines.join("\n");
}

// This is a factory that creates `Console.prototype.debug`, `.error` etc:
function logFunction(_name: LogLevelString, level: number) {
    return function(this: Console, ...args: string[]) {
        const a: Parameters<typeof this.write> = [level as number | "suppress", ...args];
        this.write.apply(this, a);
    };
}

export const appConsole = new Console();

//return appConsole;

//define(["util"], consoleMain);
