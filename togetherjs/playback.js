"use strict";
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
function playbackMain($, _util, session, storage, require) {
    var ALWAYS_REPLAY = {
        "cursor-update": true,
        "scroll-update": true
    };
    function parseLogs(rawlog) {
        rawlog = rawlog.replace(/\r\n/g, '\n');
        var logs = rawlog.split(/\n/g);
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
            var logItem = JSON.parse(line);
            result.push(logItem);
        }
        return new Logs(result);
    }
    var Logs = /** @class */ (function () {
        function Logs(logs, fromStorage) {
            if (fromStorage === void 0) { fromStorage = false; }
            this.logs = logs;
            this.fromStorage = fromStorage;
            //@ts-expect-error this field is just for debug so its main usage is in the console
            this.start = null;
            this.playTimer = null;
            this.pos = 0;
        }
        Logs.prototype.play = function () {
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
        };
        Logs.prototype.cancel = function () {
            if (this.playTimer) {
                clearTimeout(this.playTimer);
                this.playTimer = null;
            }
            this.start = null;
            this.pos = 0;
            this.unload();
        };
        Logs.prototype.pause = function () {
            if (this.playTimer) {
                clearTimeout(this.playTimer);
                this.playTimer = null;
            }
        };
        Logs.prototype.playOne = function () {
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
        };
        Logs.prototype.playItem = function (item) {
            if (item.type == "hello") {
                // We may need to pause here
                if (item.url != (location.href + "").replace(/\#.*/, "")) {
                    this.pause();
                }
            }
            try {
                session._getChannel().onmessage(item);
            }
            catch (e) {
                console.warn("Could not play back message:", item, "error:", e);
            }
        };
        Logs.prototype.save = function () {
            this.fromStorage = true;
            storage.set("playback.logs", this.logs);
            this.savePos();
        };
        Logs.prototype.savePos = function () {
            storage.set("playback.pos", this.pos);
        };
        Logs.prototype.unload = function () {
            if (this.fromStorage) {
                storage.set("playback.logs", undefined);
                storage.set("playback.pos", undefined);
            }
            // FIXME: should do a bye message here
        };
        return Logs;
    }());
    var Playback = /** @class */ (function () {
        function Playback() {
        }
        Playback.prototype.getLogs = function (url) {
            if (url.search(/^local:/) === 0) {
                return $.Deferred(function (def) {
                    storage.get("recording." + url.substr("local:".length)).then(function (logs) {
                        if (!logs) {
                            def.resolve(null);
                            return;
                        }
                        var logs2 = parseLogs(logs);
                        def.resolve(logs2);
                    }, function (error) {
                        def.reject(error);
                    });
                });
            }
            return $.Deferred(function (def) {
                $.ajax({
                    url: url,
                    dataType: "text"
                }).then(function (logs) {
                    logs = parseLogs(logs);
                    def.resolve(logs);
                }, function (error) {
                    def.reject(error);
                });
            });
        };
        Playback.prototype.getRunningLogs = function () {
            return storage.get("playback.logs").then(function (value) {
                if (!value) {
                    return null;
                }
                var logs = new Logs(value, true);
                return storage.get("playback.pos").then(function (pos) {
                    logs.pos = pos || 0;
                    return logs;
                });
            });
        };
        return Playback;
    }());
    return new Playback();
}
define(["jquery", "util", "session", "storage", "require"], playbackMain);
