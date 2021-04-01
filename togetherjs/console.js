/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
import { TogetherJS } from "./togetherjs";
import { util } from "./util";
//function consoleMain(util: TogetherJSNS.Util) {
var console = window.console || { log: function () { } };
var Console = /** @class */ (function () {
    function Console() {
        var _this = this;
        this.messages = [];
        this.level = Console.levels.log;
        // Gets set below:
        this.maxLevel = 0;
        this.levelNames = {};
        this.debug = logFunction("debug", Console.levels["debug"]);
        this.log = logFunction("log", Console.levels["log"]);
        this.info = logFunction("info", Console.levels["info"]);
        this.notify = logFunction("notify", Console.levels["notify"]);
        this.warn = logFunction("warn", Console.levels["warn"]);
        this.error = logFunction("error", Console.levels["error"]);
        this.fatal = logFunction("fatal", Console.levels["fatal"]);
        this.consoleLevels = [
            [],
            "debug" in console ? console.debug : [],
            "log" in console ? console.log : [],
            "info" in console ? console.info : [],
            "notify" in console ? console.notify : [],
            "warn" in console ? console.warn : [],
            "error" in console ? console.error : [],
            "fatal" in console ? console.fatal : []
        ];
        util.forEachAttr(Console.levels, function (value, _name) {
            _this.maxLevel = Math.max(_this.maxLevel, value);
        });
        util.forEachAttr(Console.levels, function (value, name) {
            _this.levelNames[value] = name;
        });
    }
    Console.prototype.setLevel = function (l) {
        var number;
        var llNum;
        if (typeof l == "string") {
            number = Console.levels[l];
            if (number === undefined) {
                throw new Error("Tried to set Console level to unknown level string: " + l);
            }
            llNum = number;
        }
        else if (typeof l == "function") {
            number = this.consoleLevels.indexOf(l);
            if (number == -1) {
                throw new Error("Tried to set Console level based on unknown console function: " + l);
            }
            llNum = number;
        }
        else { //if(typeof l == "number") {
            if (l < 0) {
                throw new Error("Console level must be 0 or larger: " + l);
            }
            else if (l > this.maxLevel) {
                throw new Error("Console level must be " + this.maxLevel + " or smaller: " + l);
            }
            llNum = l;
        }
        this.level = llNum;
    };
    Console.prototype.write = function (level) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        try {
            this.messages.push([
                Date.now(),
                level,
                this._stringify.apply(this, args)
            ]);
        }
        catch (e) {
            console.warn("Error stringifying argument:", e);
        }
        if (level != "suppress" && this.level <= level) {
            var l = this.levelNames[level];
            var method = void 0;
            if (l in console) {
                method = console[l];
            }
            else {
                method = console.log;
            }
            method.apply(console, args);
        }
    };
    Console.prototype.suppressedWrite = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var w = this.write;
        var a = __spreadArray(["suppress"], args);
        this.write.apply(this, a);
    };
    Console.prototype.trace = function (level) {
        if (level === void 0) { level = "log"; }
        if ("trace" in console) {
            level = "suppressedWrite";
        }
        try {
            throw new Error();
        }
        catch (e) {
            // FIXME: trim this frame
            var stack = e.stack;
            stack = stack.replace(/^[^\n]*\n/, "");
            this[level](stack);
        }
        if ("trace" in console) {
            console.trace();
        }
    };
    Console.prototype._browserInfo = function () {
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
    };
    Console.prototype._stringify = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var s = "";
        for (var i = 0; i < args.length; i++) {
            if (s) {
                s += " ";
            }
            s += this._stringifyItem(args[i]);
        }
        return s;
    };
    Console.prototype._stringifyItem = function (item) {
        if (typeof item == "string") {
            if (item === "") {
                return '""';
            }
            return item;
        }
        if (typeof item == "object" && "repr" in item) {
            try {
                return item.repr();
            }
            catch (e) {
                console.warn("Error getting object repr:", item, e);
            }
        }
        if (item !== null && typeof item == "object") {
            // FIXME: this can drop lots of kinds of values, like a function or undefined
            item = JSON.stringify(item);
        }
        return item.toString();
    };
    Console.prototype._formatDate = function (timestamp) {
        return (new Date(timestamp)).toISOString();
    };
    Console.prototype._formatTime = function (timestamp) {
        return ((timestamp - TogetherJS.pageLoaded) / 1000).toFixed(2);
    };
    Console.prototype._formatMinutes = function (milliseconds) {
        var m = Math.floor(milliseconds / 1000 / 60);
        var formatted = "" + m;
        var remaining = milliseconds - (m * 1000 * 60);
        if (m > 10) {
            // Over 10 minutes, just ignore the seconds
            return formatted;
        }
        var seconds = Math.floor(remaining / 1000) + "";
        formatted += ":";
        seconds = lpad(seconds, 2, "0");
        formatted += seconds;
        if (formatted == "0:00") {
            formatted += ((remaining / 1000).toFixed(3) + "").substr(1);
        }
        return formatted;
    };
    Console.prototype._formatLevel = function (l) {
        if (l === "suppress") {
            return "";
        }
        return this.levelNames[l];
    };
    Console.prototype.toString = function () {
        try {
            var lines = this._browserInfo();
            this.messages.forEach(function (m) {
                lines.push(lpad(this._formatTime(m[0]), 6) + " " + rpad(this._formatLevel(m[1]), 6) + " " + lpadLines(m[2], 14));
            }, this);
            return lines.join("\n");
        }
        catch (e) {
            // toString errors can otherwise be swallowed:
            console.warn("Error running console.toString():", e);
            throw e;
        }
    };
    // TODO qw unused and don't work
    Console.prototype.submit = function (options) {
        if (options === void 0) { options = {}; }
        // FIXME: friendpaste is broken for this (and other pastebin sites aren't really Browser-accessible)
        return util.Deferred(function () {
            var site = options.site || TogetherJS.config.get("pasteSite") || "https://www.friendpaste.com/";
            var req = new XMLHttpRequest();
            req.open("POST", site);
            req.setRequestHeader("Content-Type", "application/json");
            req.send(JSON.stringify({
                "title": options.title || "TogetherJS log file",
                "snippet": this.toString(),
                "language": "text"
            }));
            req.onreadystatechange = function () {
                if (req.readyState === 4) {
                    JSON.parse(req.responseText);
                    // TODO what is this function supposed to do?
                }
            };
        });
    };
    Console.levels = {
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
    return Console;
}());
;
function rpad(s, len, pad) {
    if (pad === void 0) { pad = " "; }
    s = s + "";
    while (s.length < len) {
        s += pad;
    }
    return s;
}
function lpad(s, len, pad) {
    if (pad === void 0) { pad = " "; }
    s = s + "";
    while (s.length < len) {
        s = pad + s;
    }
    return s;
}
function lpadLines(s, len, pad) {
    if (pad === void 0) { pad = " "; }
    var i;
    s = s + "";
    if (s.indexOf("\n") == -1) {
        return s;
    }
    var fullPad = "";
    for (i = 0; i < len; i++) {
        fullPad += pad;
    }
    var lines = s.split(/\n/g);
    for (i = 1; i < s.length; i++) {
        lines[i] = fullPad + s[i];
    }
    return lines.join("\n");
}
// This is a factory that creates `Console.prototype.debug`, `.error` etc:
function logFunction(_name, level) {
    return function () {
        var args = Array.prototype.slice.call(arguments);
        var a = __spreadArray([level], args);
        this.write.apply(this, a);
    };
}
export var appConsole = new Console();
//return appConsole;
//define(["util"], consoleMain);
