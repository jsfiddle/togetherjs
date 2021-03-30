/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
/*jshint evil:true */

function chatMain(require: Require, $: JQueryStatic, util: Util, session: TogetherJSNS.Session, ui: TogetherJSNS.Ui, templates: TogetherJSNS.Templates, playback: TogetherJSNS.Playback, storage: TogetherJSNS.Storage, peers: TogetherJSNS.Peers, windowing: TogetherJSNS.Windowing) {
    var assert: typeof util.assert = util.assert;
    var Walkabout: TogetherJSNS.Walkabout;

    session.hub.on("chat", function(msg) {
        ui.chat.text({
            text: msg.text,
            peer: msg.peer,
            // FIXME: a little unsure of trusting this (maybe I should prefix it?)
            messageId: msg.messageId,
            notify: true
        });
        saveChatMessage({
            text: msg.text,
            date: Date.now(),
            peerId: msg.peer.id,
            messageId: msg.messageId
        });
    });

    // FIXME: this doesn't really belong in this module:
    session.hub.on("bye", function(msg) {
        ui.chat.leftSession({
            peer: msg.peer,
            declinedJoin: msg.reason == "declined-join"
        });
    });

    type CommandStrings = "test" | "clear" | "help" | "test" | "clear" | "exec" | "record" | "playback" | "savelogs" | "baseurl" | "config";

    class Chat {
        submit(message: string) {
            var parts = message.split(/ /);
            if(parts[0].charAt(0) == "/") {
                var name = parts[0].substr(1).toLowerCase() as CommandStrings;
                var method = commands[`command_${name}` as const];
                if(method) {
                    method.apply(commands, parts.slice(1) as any); // TODO any way to remove this "as any" cast?
                    return;
                }
            }
            var messageId = session.clientId + "-" + Date.now();
            session.send({
                type: "chat",
                text: message,
                messageId: messageId
            });
            ui.chat.text({
                text: message,
                peer: peers.Self,
                messageId: messageId,
                notify: false
            });
            saveChatMessage({
                text: message,
                date: Date.now(),
                peerId: peers.Self.id,
                messageId: messageId
            });
        }
    }

    const chat = new Chat();

    class Commands {
        _testCancel: (() => void) | null = null;
        _testShow: WalkaboutNS.Action[] = [];
        playing: TogetherJSNS.Logs | null = null;

        command_help() {
            var msg = util.trim(templates("help"));
            ui.chat.system({
                text: msg
            });
        }

        command_test(argString?: string) {
            if(!Walkabout) {
                require(["walkabout"], (WalkaboutModule: TogetherJSNS.Walkabout) => {
                    Walkabout = WalkaboutModule;
                    this.command_test(argString);
                });
                return;
            }
            let args = util.trim(argString || "").split(/\s+/g);
            if(args[0] === "" || !args.length) {
                if(this._testCancel) {
                    args = ["cancel"];
                }
                else {
                    args = ["start"];
                }
            }
            if(args[0] == "cancel") {
                util.assert(this._testCancel !== null);
                ui.chat.system({
                    text: "Aborting test"
                });
                this._testCancel();
                this._testCancel = null;
                return;
            }
            if(args[0] == "start") {
                var times = parseInt(args[1], 10);
                if(isNaN(times) || !times) {
                    times = 100;
                }
                ui.chat.system({
                    text: "Testing with walkabout.js"
                });
                var tmpl = $(templates("walkabout"));
                var container = ui.container.find(".togetherjs-test-container");
                container.empty();
                container.append(tmpl);
                container.show();
                var statusContainer = container.find(".togetherjs-status");
                statusContainer.text("starting...");
                const self = this;
                this._testCancel = Walkabout.runManyActions({
                    ondone: function() {
                        statusContainer.text("done");
                        statusContainer.one("click", function() {
                            container.hide();
                        });
                        self._testCancel = null;
                    },
                    onstatus: function(status) {
                        var note = "actions: " + status.actions.length + " running: " +
                            (status.times - status.remaining) + " / " + status.times;
                        statusContainer.text(note);
                    }
                });
                return;
            }
            if(args[0] == "show") {
                if(this._testShow.length) {
                    this._testShow.forEach(function(item) {
                        if(item) {
                            item.remove();
                        }
                    }, this);
                    this._testShow = [];
                }
                else {
                    var actions = Walkabout.findActions();
                    actions.forEach(function(this: Commands, action) {
                        this._testShow.push(action.show());
                    }, this);
                }
                return;
            }
            if(args[0] == "describe") {
                Walkabout.findActions().forEach(function(action) {
                    ui.chat.system({
                        text: action.description()
                    });
                }, this);
                return;
            }
            ui.chat.system({
                text: "Did not understand: " + args.join(" ")
            });
        }

        command_clear() {
            ui.chat.clear();
        }

        command_exec() {
            var expr = Array.prototype.slice.call(arguments).join(" ");
            var result;
            // We use this to force global eval (not in this scope):
            var e = eval;
            try {
                result = e(expr);
            }
            catch(error) {
                ui.chat.system({
                    text: "Error: " + error
                });
            }
            if(result !== undefined) {
                ui.chat.system({
                    text: "" + result
                });
            }
        }

        command_record() {
            ui.chat.system({
                text: "When you see the robot appear, the recording will have started"
            });
            window.open(
                session.recordUrl(), "_blank",
                "left,width=" + ($(window).width() / 2));
        }

        command_playback(url?: string) {
            if(this.playing) {
                this.playing.cancel();
                this.playing.unload();
                this.playing = null;
                ui.chat.system({
                    text: "playback cancelled"
                });
                return;
            }
            if(!url) {
                ui.chat.system({
                    text: "Nothing is playing"
                });
                return;
            }
            var logLoader = playback.getLogs(url);
            logLoader.then(
                (logs) => {
                    if(!logs) {
                        ui.chat.system({
                            text: "No logs found."
                        });
                        return;
                    }
                    logs.save();
                    this.playing = logs;
                    logs.play();
                },
                function(error) {
                    ui.chat.system({
                        text: "Error fetching " + url + ":\n" + JSON.stringify(error, null, "  ")
                    });
                });
            windowing.hide("#togetherjs-chat");
        }

        command_savelogs(name: string = "default") {
            document.createElement("a");
            session.send({
                type: "get-logs",
                forClient: session.clientId,
                saveAs: name
            });
            function save(msg: { request: { forClient: string | undefined, saveAs: string }, logs: string }) {
                if(msg.request.forClient == session.clientId && msg.request.saveAs == name) {
                    storage.set(`recording.${name}` as const, msg.logs).then(function() {
                        session.hub.off("logs", save);
                        ui.chat.system({
                            text: "Saved as local:" + name
                        });
                    });
                }
            }
            session.hub.on("logs", save);
        }

        command_baseurl(url?: string) {
            if(!url) {
                storage.get("baseUrlOverride").then(function(b) {
                    if(b) {
                        ui.chat.system({
                            text: "Set to: " + b.baseUrl
                        });
                    }
                    else {
                        ui.chat.system({
                            text: "No baseUrl override set"
                        });
                    }
                });
                return;
            }
            url = url.replace(/\/*$/, "");
            ui.chat.system({
                text: "If this goes wrong, do this in the console to reset:\n  localStorage.setItem('togetherjs.baseUrlOverride', null)"
            });
            storage.set("baseUrlOverride", {
                baseUrl: url,
                expiresAt: Date.now() + (1000 * 60 * 60 * 24)
            }).then(function() {
                ui.chat.system({
                    text: "baseUrl overridden (to " + url + "), will last for one day."
                });
            });
        }

        command_config(variable?: string, value?: string) {
            if(!(variable || value)) {
                storage.get("configOverride").then(function(c) {
                    if(c) {
                        util.forEachAttr(c, function(value, attr) {
                            if(attr == "expiresAt") {
                                return;
                            }
                            ui.chat.system({
                                text: "  " + attr + " = " + JSON.stringify(value)
                            });
                        });
                        ui.chat.system({
                            text: "Config expires at " + (new Date(c.expiresAt))
                        });
                    }
                    else {
                        ui.chat.system({
                            text: "No config override"
                        });
                    }
                });
                return;
            }
            if(variable == "clear") {
                storage.set("configOverride", undefined);
                ui.chat.system({
                    text: "Clearing all overridden configuration"
                });
                return;
            }
            console.log("config", [variable, value]);
            if(!(variable && value)) {
                ui.chat.system({
                    text: "Error: must provide /config VAR VALUE"
                });
                return;
            }
            try {
                value = JSON.parse(value);
            }
            catch(e) {
                ui.chat.system({
                    text: "Error: value (" + value + ") could not be parsed: " + e
                });
                return;
            }
            if(!TogetherJS._defaultConfiguration.hasOwnProperty(variable)) {
                ui.chat.system({
                    text: "Warning: variable " + variable + " is unknown"
                });
            }
            // TODO find better types
            storage.get("configOverride").then(function(c) {
                const expire = Date.now() + (1000 * 60 * 60 * 24);
                c = c || {expiresAt: expire};
                c[variable] = value;
                c.expiresAt = Date.now() + (1000 * 60 * 60 * 24);
                storage.set("configOverride", c).then(function() {
                    ui.chat.system({
                        text: "Variable " + variable + " = " + JSON.stringify(value) + "\nValue will be set for one day."
                    });
                });
            });
        }
    }

    const commands = new Commands();

    // this section deal with saving/restoring chat history as long as session is alive
    const chatStorageKey = "chatlog";
    var maxLogMessages = 100;

    function saveChatMessage(obj: {text: string, peerId: string, messageId: string, date: number}) {
        assert(obj.peerId);
        assert(obj.messageId);
        assert(obj.date);
        assert(typeof obj.text == "string");

        loadChatLog().then(function(logs) {
            if(logs) {
                for(var i = logs.length - 1; i >= 0; i--) {
                    if(logs[i].messageId === obj.messageId) {
                        return;
                    }
                }
                logs.push(obj);
                if(logs.length > maxLogMessages) {
                    logs.splice(0, logs.length - maxLogMessages);
                }
                storage.tab.set(chatStorageKey, logs);
            }
        });
    }

    function loadChatLog() {
        return storage.tab.get(chatStorageKey, []);
    }

    session.once("ui-ready", function() {
        loadChatLog().then(function(log) {
            if(!log) {
                return;
            }
            for(var i = 0; i < log.length; i++) {
                // peers should already be loaded from sessionStorage by the peers module
                var currentPeer = peers.getPeer(log[i].peerId, undefined, true);
                if(!currentPeer) {
                    // sometimes peers go away
                    continue;
                }
                ui.chat.text({
                    text: log[i].text,
                    date: log[i].date,
                    peer: currentPeer,
                    messageId: log[i].messageId
                });
            }
        });
    });
    //delete chat log
    session.on("close", function() {
        storage.tab.set(chatStorageKey, undefined);
    });

    return chat;
}

define(["require", "jquery", "util", "session", "ui", "templates", "playback", "storage", "peers", "windowing"], chatMain);
