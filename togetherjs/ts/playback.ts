/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

interface LogItem {
    type: "cursor-update" | "scroll-update" | "hello" | "hello-back",
    date: number,
    url: string,
}

function playbackMain($: JQueryStatic, _util: Util, session: TogetherJSNS.Session, storage: TogetherJSNS.Storage, require: Require) {

    var ALWAYS_REPLAY = {
        "cursor-update": true,
        "scroll-update": true
    };

    function parseLogs(rawlog: string) {
        rawlog = rawlog.replace(/\r\n/g, '\n');
        let logs = rawlog.split(/\n/g);
        var result = [];
        for(var i = 0; i < logs.length; i++) {
            var line = logs[i];
            line = line.replace(/^\s+/, "").replace(/\s+$/, "");
            if(line.search(/\/\*/) === 0) {
                var last = line.search(/\*\//);
                if(last == -1) {
                    console.warn("bad line:", line);
                    continue;
                }
                line = line.substr(last + 2);
            }
            line = line.replace(/^\s+/, "");
            if(!line) {
                continue;
            }
            const logItem = JSON.parse(line) as LogItem;
            result.push(logItem);
        }
        return new Logs(result);
    }

    class Logs {
        public pos: number;
        //@ts-expect-error this field is just for debug so its main usage is in the console
        private start: number | null = null;
        private playTimer: number | null = null;

        constructor(private logs: LogItem[], private fromStorage: boolean = false) {
            this.pos = 0;
        }

        play() {
            this.start = Date.now();
            if(this.pos >= this.logs.length) {
                this.unload();
                return;
            }
            if(this.pos !== 0) {
                // First we need to play the hello
                var toReplay = [];
                var foundHello = false;
                for(var i = this.pos - 1; i >= 0; i--) {
                    var item = this.logs[i];
                    if(item.type in ALWAYS_REPLAY) {
                        toReplay.push(item);
                    }
                    if(item.type == "hello" || item.type == "hello-back") {
                        this.playItem(item);
                        foundHello = true;
                        break;
                    }
                }
                if(!foundHello) {
                    console.warn("No hello message found before position", this.pos);
                }
                toReplay.reverse();
                for(i = 0; i < toReplay.length; i++) {
                    this.playItem(toReplay[i]);
                }
            }
            this.playOne();
        }

        cancel() {
            if(this.playTimer) {
                clearTimeout(this.playTimer);
                this.playTimer = null;
            }
            this.start = null;
            this.pos = 0;
            this.unload();
        }

        pause() {
            if(this.playTimer) {
                clearTimeout(this.playTimer);
                this.playTimer = null;
            }
        }

        playOne() {
            this.playTimer = null;
            if(this.pos >= this.logs.length) {
                this.unload();
                return;
            }
            var item = this.logs[this.pos];
            this.playItem(item);
            this.pos++;
            if(this.pos >= this.logs.length) {
                this.unload();
                return;
            }
            var next = this.logs[this.pos];
            var pause = next.date - item.date;
            this.playTimer = setTimeout(this.playOne.bind(this), pause);
            if(this.fromStorage) {
                this.savePos();
            }
        }

        playItem(item: LogItem) {
            if(item.type == "hello") {
                // We may need to pause here
                if(item.url != (location.href + "").replace(/\#.*/, "")) {
                    this.pause();
                }
            }
            try {
                session._getChannel().onmessage(item);
            }
            catch(e) {
                console.warn("Could not play back message:", item, "error:", e);
            }
        }

        save() {
            this.fromStorage = true;
            storage.set("playback.logs", this.logs);
            this.savePos();
        }

        savePos() {
            storage.set("playback.pos", this.pos);
        }

        unload() {
            if(this.fromStorage) {
                storage.set("playback.logs", undefined);
                storage.set("playback.pos", undefined);
            }
            // FIXME: should do a bye message here
        }
    }

    class Playback {
        LogsExport!: Logs; // TODO ugly export;
        getLogs(url: string) {
            if(url.search(/^local:/) === 0) {
                return $.Deferred<Logs>(function(def) {
                    const name = url.substr("local:".length);
                    storage.get(`recording.${name}` as const).then(function(logs) {
                        if(!logs) {
                            def.resolve(null);
                            return;
                        }
                        const logs2 = parseLogs(logs);
                        def.resolve(logs2);
                    }, function(error) {
                        def.reject(error);
                    });
                });
            }
            return $.Deferred<Logs>(function(def) {
                $.ajax({
                    url: url,
                    dataType: "text"
                }).then(
                    function(logs) {
                        logs = parseLogs(logs);
                        def.resolve(logs);
                    },
                    function(error) {
                        def.reject(error);
                    });
            });
        }

        getRunningLogs() {
            return storage.get("playback.logs").then(function(value) {
                if(!value) {
                    return null;
                }
                var logs = new Logs(value, true);
                return storage.get("playback.pos").then(function(pos) {
                    logs.pos = pos || 0;
                    return logs;
                });
            });
        }
    }

    return new Playback();
}

define(["jquery", "util", "session", "storage", "require"], playbackMain);
