/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "./session", "./storage", "jquery"], function (require, exports, session_1, storage_1, jquery_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.playback = void 0;
    jquery_1 = __importDefault(jquery_1);
    //function playbackMain($: JQueryStatic, _util: TogetherJSNS.Util, session: TogetherJSNS.Session, storage: TogetherJSNS.Storage, _require: Require) {
    var ALWAYS_REPLAY = {
        "cursor-update": true,
        "scroll-update": true
    };
    function parseLogs(rawlog) {
        rawlog = rawlog.replace(/\r\n/g, '\n');
        let logs = rawlog.split(/\n/g);
        var result = [];
        for (var i = 0; i < logs.length; i++) {
            var line = logs[i];
            line = line.replace(/^\s+/, "").replace(/\s+$/, "");
            if (line.search(/\/\*/) === 0) {
                var last = line.search(/\*\//);
                if (last == -1) {
                    console.warn("bad line:", line);
                    continue;
                }
                line = line.substr(last + 2);
            }
            line = line.replace(/^\s+/, "");
            if (!line) {
                continue;
            }
            const logItem = JSON.parse(line);
            result.push(logItem);
        }
        return new Logs(result);
    }
    class Logs {
        constructor(logs, fromStorage = false) {
            this.logs = logs;
            this.fromStorage = fromStorage;
            //@ts-expect-error this field is just for debug so its main usage is in the console
            this.start = null;
            this.playTimer = null;
            this.pos = 0;
        }
        play() {
            this.start = Date.now();
            if (this.pos >= this.logs.length) {
                this.unload();
                return;
            }
            if (this.pos !== 0) {
                // First we need to play the hello
                var toReplay = [];
                var foundHello = false;
                for (var i = this.pos - 1; i >= 0; i--) {
                    var item = this.logs[i];
                    if (item.type in ALWAYS_REPLAY) {
                        toReplay.push(item);
                    }
                    if (item.type == "hello" || item.type == "hello-back") {
                        this.playItem(item);
                        foundHello = true;
                        break;
                    }
                }
                if (!foundHello) {
                    console.warn("No hello message found before position", this.pos);
                }
                toReplay.reverse();
                for (i = 0; i < toReplay.length; i++) {
                    this.playItem(toReplay[i]);
                }
            }
            this.playOne();
        }
        cancel() {
            if (this.playTimer) {
                clearTimeout(this.playTimer);
                this.playTimer = null;
            }
            this.start = null;
            this.pos = 0;
            this.unload();
        }
        pause() {
            if (this.playTimer) {
                clearTimeout(this.playTimer);
                this.playTimer = null;
            }
        }
        playOne() {
            this.playTimer = null;
            if (this.pos >= this.logs.length) {
                this.unload();
                return;
            }
            var item = this.logs[this.pos];
            this.playItem(item);
            this.pos++;
            if (this.pos >= this.logs.length) {
                this.unload();
                return;
            }
            var next = this.logs[this.pos];
            var pause = next.date - item.date;
            this.playTimer = setTimeout(this.playOne.bind(this), pause);
            if (this.fromStorage) {
                this.savePos();
            }
        }
        playItem(item) {
            if (item.type == "hello") {
                // We may need to pause here
                if (item.url != (location.href + "").replace(/\#.*/, "")) {
                    this.pause();
                }
            }
            try {
                session_1.session._getChannel().onmessage(item);
            }
            catch (e) {
                console.warn("Could not play back message:", item, "error:", e);
            }
        }
        save() {
            this.fromStorage = true;
            storage_1.storage.set("playback.logs", this.logs);
            this.savePos();
        }
        savePos() {
            storage_1.storage.set("playback.pos", this.pos);
        }
        unload() {
            if (this.fromStorage) {
                storage_1.storage.set("playback.logs", undefined);
                storage_1.storage.set("playback.pos", undefined);
            }
            // FIXME: should do a bye message here
        }
    }
    class Playback {
        getLogs(url) {
            if (url.search(/^local:/) === 0) {
                return jquery_1.default.Deferred(function (def) {
                    const name = url.substr("local:".length);
                    storage_1.storage.get(`recording.${name}`).then(function (logs) {
                        if (!logs) {
                            def.resolve(undefined);
                            return;
                        }
                        const logs2 = parseLogs(logs);
                        def.resolve(logs2);
                    }, function (error) {
                        def.reject(error);
                    });
                });
            }
            return jquery_1.default.Deferred(function (def) {
                jquery_1.default.ajax({
                    url: url,
                    dataType: "text"
                }).then(function (logs) {
                    logs = parseLogs(logs);
                    def.resolve(logs);
                }, function (error) {
                    def.reject(error);
                });
            });
        }
        getRunningLogs() {
            return storage_1.storage.get("playback.logs").then(function (value) {
                if (!value) {
                    return null;
                }
                var logs = new Logs(value, true);
                return storage_1.storage.get("playback.pos").then(function (pos) {
                    logs.pos = pos || 0;
                    return logs;
                });
            });
        }
    }
    exports.playback = new Playback();
});
//define(["jquery", "util", "session", "storage", "require"], playbackMain);
