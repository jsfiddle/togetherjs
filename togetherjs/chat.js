/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
/*jshint evil:true */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "./peers", "./playback", "./session", "./storage", "./templates", "./ui", "./util", "./windowing", "jquery"], function (require, exports, peers_1, playback_1, session_1, storage_1, templates_1, ui_1, util_1, windowing_1, jquery_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.chat = exports.Chat = void 0;
    jquery_1 = __importDefault(jquery_1);
    //function chatMain(require: Require, $: JQueryStatic, util: TogetherJSNS.Util, session: TogetherJSNS.Session, ui: TogetherJSNS.Ui, templates: TogetherJSNS.Templates, playback: TogetherJSNS.Playback, storage: TogetherJSNS.Storage, peers: TogetherJSNS.Peers, windowing: TogetherJSNS.Windowing) {
    const assert = util_1.util.assert.bind(util_1.util);
    let Walkabout;
    session_1.session.hub.on("chat", function (msg) {
        ui_1.ui.chat.text({
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
    session_1.session.hub.on("bye", function (msg) {
        ui_1.ui.chat.leftSession({
            peer: msg.peer,
            declinedJoin: msg.reason == "declined-join"
        });
    });
    class Commands {
        constructor() {
            this._testCancel = null;
            this._testShow = [];
            this.playing = null;
        }
        command_help() {
            const msg = util_1.util.trim(templates_1.templates("help"));
            ui_1.ui.chat.system({
                text: msg
            });
        }
        command_test(argString) {
            if (!Walkabout) {
                require(["walkabout"], (WalkaboutModule) => {
                    Walkabout = WalkaboutModule.walkabout;
                    this.command_test(argString);
                });
                return;
            }
            let args = util_1.util.trim(argString || "").split(/\s+/g);
            if (args[0] === "" || !args.length) {
                if (this._testCancel) {
                    args = ["cancel"];
                }
                else {
                    args = ["start"];
                }
            }
            if (args[0] == "cancel") {
                assert(this._testCancel !== null);
                ui_1.ui.chat.system({
                    text: "Aborting test"
                });
                this._testCancel();
                this._testCancel = null;
                return;
            }
            if (args[0] == "start") {
                let times = parseInt(args[1], 10);
                if (isNaN(times) || !times) {
                    times = 100;
                }
                ui_1.ui.chat.system({
                    text: "Testing with walkabout.js"
                });
                const tmpl = jquery_1.default(templates_1.templates("walkabout"));
                const container = ui_1.ui.container.find(".togetherjs-test-container");
                container.empty();
                container.append(tmpl);
                container.show();
                const statusContainer = container.find(".togetherjs-status");
                statusContainer.text("starting...");
                const self = this;
                this._testCancel = Walkabout.runManyActions({
                    ondone: function () {
                        statusContainer.text("done");
                        statusContainer.one("click", function () {
                            container.hide();
                        });
                        self._testCancel = null;
                    },
                    onstatus: function (status) {
                        const note = "actions: " + status.actions.length + " running: " +
                            (status.times - status.remaining) + " / " + status.times;
                        statusContainer.text(note);
                    }
                });
                return;
            }
            if (args[0] == "show") {
                if (this._testShow.length) {
                    this._testShow.forEach(function (item) {
                        if (item) {
                            item.remove();
                        }
                    }, this);
                    this._testShow = [];
                }
                else {
                    const actions = Walkabout.findActions();
                    actions.forEach(function (action) {
                        this._testShow.push(action.show());
                    }, this);
                }
                return;
            }
            if (args[0] == "describe") {
                Walkabout.findActions().forEach(function (action) {
                    ui_1.ui.chat.system({
                        text: action.description()
                    });
                }, this);
                return;
            }
            ui_1.ui.chat.system({
                text: "Did not understand: " + args.join(" ")
            });
        }
        command_clear() {
            ui_1.ui.chat.clear();
        }
        command_exec(...args) {
            const expr = Array.prototype.slice.call(args).join(" ");
            let result;
            // We use this to force global eval (not in this scope):
            const e = eval;
            try {
                result = e(expr);
            }
            catch (error) {
                ui_1.ui.chat.system({
                    text: "Error: " + error
                });
            }
            if (result !== undefined) {
                ui_1.ui.chat.system({
                    text: "" + result
                });
            }
        }
        command_record() {
            ui_1.ui.chat.system({
                text: "When you see the robot appear, the recording will have started"
            });
            window.open(session_1.session.recordUrl(), "_blank", "left,width=" + (jquery_1.default(window).width() / 2));
        }
        command_playback(url) {
            if (this.playing) {
                this.playing.cancel();
                this.playing.unload();
                this.playing = null;
                ui_1.ui.chat.system({
                    text: "playback cancelled"
                });
                return;
            }
            if (!url) {
                ui_1.ui.chat.system({
                    text: "Nothing is playing"
                });
                return;
            }
            const logLoader = playback_1.playback.getLogs(url);
            logLoader.then((logs) => {
                if (!logs) {
                    ui_1.ui.chat.system({
                        text: "No logs found."
                    });
                    return;
                }
                logs.save();
                this.playing = logs;
                logs.play();
            }, function (error) {
                ui_1.ui.chat.system({
                    text: "Error fetching " + url + ":\n" + JSON.stringify(error, null, "  ")
                });
            });
            windowing_1.windowing.hide("#togetherjs-chat");
        }
        command_savelogs(name = "default") {
            document.createElement("a");
            session_1.session.send({
                type: "get-logs",
                forClient: session_1.session.clientId,
                saveAs: name
            });
            function save(msg) {
                if (msg.request.forClient == session_1.session.clientId && msg.request.saveAs == name) {
                    storage_1.storage.set(`recording.${name}`, msg.logs).then(function () {
                        session_1.session.hub.off("logs", save);
                        ui_1.ui.chat.system({
                            text: "Saved as local:" + name
                        });
                    });
                }
            }
            session_1.session.hub.on("logs", save);
        }
        command_baseurl(url) {
            if (!url) {
                storage_1.storage.get("baseUrlOverride").then(function (b) {
                    if (b) {
                        ui_1.ui.chat.system({
                            text: "Set to: " + b.baseUrl
                        });
                    }
                    else {
                        ui_1.ui.chat.system({
                            text: "No baseUrl override set"
                        });
                    }
                });
                return;
            }
            url = url.replace(/\/*$/, "");
            ui_1.ui.chat.system({
                text: "If this goes wrong, do this in the console to reset:\n  localStorage.setItem('togetherjs.baseUrlOverride', null)"
            });
            storage_1.storage.set("baseUrlOverride", {
                baseUrl: url,
                expiresAt: Date.now() + (1000 * 60 * 60 * 24)
            }).then(function () {
                ui_1.ui.chat.system({
                    text: "baseUrl overridden (to " + url + "), will last for one day."
                });
            });
        }
        command_config(variable, value) {
            if (!(variable || value)) {
                storage_1.storage.get("configOverride").then(function (c) {
                    if (c) {
                        util_1.util.forEachAttr(c, function (value, attr) {
                            if (attr == "expiresAt") {
                                return;
                            }
                            ui_1.ui.chat.system({
                                text: "  " + attr + " = " + JSON.stringify(value)
                            });
                        });
                        ui_1.ui.chat.system({
                            text: "Config expires at " + (new Date(c.expiresAt))
                        });
                    }
                    else {
                        ui_1.ui.chat.system({
                            text: "No config override"
                        });
                    }
                });
                return;
            }
            if (variable == "clear") {
                storage_1.storage.set("configOverride", undefined);
                ui_1.ui.chat.system({
                    text: "Clearing all overridden configuration"
                });
                return;
            }
            console.log("config", [variable, value]);
            if (!(variable && value)) {
                ui_1.ui.chat.system({
                    text: "Error: must provide /config VAR VALUE"
                });
                return;
            }
            try {
                value = JSON.parse(value);
            }
            catch (e) {
                ui_1.ui.chat.system({
                    text: "Error: value (" + value + ") could not be parsed: " + e
                });
                return;
            }
            if (!Object.prototype.hasOwnProperty.call(TogetherJS.configuration, variable)) {
                ui_1.ui.chat.system({
                    text: "Warning: variable " + variable + " is unknown"
                });
            }
            // TODO find better types
            storage_1.storage.get("configOverride").then(function (c) {
                const expire = Date.now() + (1000 * 60 * 60 * 24);
                c = c || { expiresAt: expire };
                c[variable] = value;
                c.expiresAt = Date.now() + (1000 * 60 * 60 * 24);
                storage_1.storage.set("configOverride", c).then(function () {
                    ui_1.ui.chat.system({
                        text: "Variable " + variable + " = " + JSON.stringify(value) + "\nValue will be set for one day."
                    });
                });
            });
        }
    }
    const commands = new Commands();
    class Chat {
        submit(message) {
            const parts = message.split(/ /);
            if (parts[0].charAt(0) == "/") {
                const name = parts[0].substr(1).toLowerCase();
                const method = commands[`command_${name}`];
                if (method) {
                    method.apply(commands, parts.slice(1)); // TODO any way to remove this "as any" cast?
                    return;
                }
            }
            const messageId = session_1.session.clientId + "-" + Date.now();
            session_1.session.send({
                type: "chat",
                text: message,
                messageId: messageId
            });
            ui_1.ui.chat.text({
                text: message,
                peer: peers_1.peers.Self,
                messageId: messageId,
                notify: false
            });
            saveChatMessage({
                text: message,
                date: Date.now(),
                peerId: peers_1.peers.Self.id,
                messageId: messageId
            });
        }
    }
    exports.Chat = Chat;
    exports.chat = new Chat();
    // this section deal with saving/restoring chat history as long as session is alive
    const chatStorageKey = "chatlog";
    const maxLogMessages = 100;
    function saveChatMessage(obj) {
        assert(obj.peerId);
        assert(obj.messageId);
        assert(obj.date);
        assert(typeof obj.text == "string");
        loadChatLog().then(function (logs) {
            if (logs) {
                for (let i = logs.length - 1; i >= 0; i--) {
                    if (logs[i].messageId === obj.messageId) {
                        return;
                    }
                }
                logs.push(obj);
                if (logs.length > maxLogMessages) {
                    logs.splice(0, logs.length - maxLogMessages);
                }
                storage_1.storage.tab.set(chatStorageKey, logs);
            }
        });
    }
    function loadChatLog() {
        return storage_1.storage.tab.get(chatStorageKey, []);
    }
    session_1.session.once("ui-ready", function () {
        loadChatLog().then(function (log) {
            if (!log) {
                return;
            }
            for (let i = 0; i < log.length; i++) {
                // peers should already be loaded from sessionStorage by the peers module
                const currentPeer = peers_1.peers.getPeer(log[i].peerId, undefined);
                if (!currentPeer) {
                    continue; // sometimes peers go away
                }
                ui_1.ui.chat.text({
                    text: log[i].text,
                    date: log[i].date,
                    peer: currentPeer,
                    messageId: log[i].messageId
                });
            }
        });
    });
    //delete chat log
    session_1.session.on("close", function () {
        storage_1.storage.tab.set(chatStorageKey, undefined);
    });
});
//return chat;
//define(["require", "jquery", "util", "session", "ui", "templates", "playback", "storage", "peers", "windowing"], chatMain);
