/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
/*jshint evil:true */
define(["require", "exports", "./peers", "./playback", "./session", "./storage", "./templates", "./togetherjs", "./ui", "./util", "./windowing"], function (require, exports, peers_1, playback_1, session_1, storage_1, templates_1, togetherjs_1, ui_1, util_1, windowing_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.chat = void 0;
    //function chatMain(require: Require, $: JQueryStatic, util: TogetherJSNS.Util, session: TogetherJSNS.Session, ui: TogetherJSNS.Ui, templates: TogetherJSNS.Templates, playback: TogetherJSNS.Playback, storage: TogetherJSNS.Storage, peers: TogetherJSNS.Peers, windowing: TogetherJSNS.Windowing) {
    var assert = util_1.util.assert;
    var Walkabout;
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
    var Chat = /** @class */ (function () {
        function Chat() {
        }
        Chat.prototype.submit = function (message) {
            var parts = message.split(/ /);
            if (parts[0].charAt(0) == "/") {
                var name = parts[0].substr(1).toLowerCase();
                var method = commands["command_" + name];
                if (method) {
                    method.apply(commands, parts.slice(1)); // TODO any way to remove this "as any" cast?
                    return;
                }
            }
            var messageId = session_1.session.clientId + "-" + Date.now();
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
        };
        return Chat;
    }());
    exports.chat = new Chat();
    var Commands = /** @class */ (function () {
        function Commands() {
            this._testCancel = null;
            this._testShow = [];
            this.playing = null;
        }
        Commands.prototype.command_help = function () {
            var msg = util_1.util.trim(templates_1.templates("help"));
            ui_1.ui.chat.system({
                text: msg
            });
        };
        Commands.prototype.command_test = function (argString) {
            var _this = this;
            if (!Walkabout) {
                require(["walkabout"], function (WalkaboutModule) {
                    Walkabout = WalkaboutModule;
                    _this.command_test(argString);
                });
                return;
            }
            var args = util_1.util.trim(argString || "").split(/\s+/g);
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
                var times = parseInt(args[1], 10);
                if (isNaN(times) || !times) {
                    times = 100;
                }
                ui_1.ui.chat.system({
                    text: "Testing with walkabout.js"
                });
                var tmpl = $(templates_1.templates("walkabout"));
                var container = ui_1.ui.container.find(".togetherjs-test-container");
                container.empty();
                container.append(tmpl);
                container.show();
                var statusContainer = container.find(".togetherjs-status");
                statusContainer.text("starting...");
                var self_1 = this;
                this._testCancel = Walkabout.runManyActions({
                    ondone: function () {
                        statusContainer.text("done");
                        statusContainer.one("click", function () {
                            container.hide();
                        });
                        self_1._testCancel = null;
                    },
                    onstatus: function (status) {
                        var note = "actions: " + status.actions.length + " running: " +
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
                    var actions = Walkabout.findActions();
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
        };
        Commands.prototype.command_clear = function () {
            ui_1.ui.chat.clear();
        };
        Commands.prototype.command_exec = function () {
            var expr = Array.prototype.slice.call(arguments).join(" ");
            var result;
            // We use this to force global eval (not in this scope):
            var e = eval;
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
        };
        Commands.prototype.command_record = function () {
            ui_1.ui.chat.system({
                text: "When you see the robot appear, the recording will have started"
            });
            window.open(session_1.session.recordUrl(), "_blank", "left,width=" + ($(window).width() / 2));
        };
        Commands.prototype.command_playback = function (url) {
            var _this = this;
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
            var logLoader = playback_1.playback.getLogs(url);
            logLoader.then(function (logs) {
                if (!logs) {
                    ui_1.ui.chat.system({
                        text: "No logs found."
                    });
                    return;
                }
                logs.save();
                _this.playing = logs;
                logs.play();
            }, function (error) {
                ui_1.ui.chat.system({
                    text: "Error fetching " + url + ":\n" + JSON.stringify(error, null, "  ")
                });
            });
            windowing_1.windowing.hide("#togetherjs-chat");
        };
        Commands.prototype.command_savelogs = function (name) {
            if (name === void 0) { name = "default"; }
            document.createElement("a");
            session_1.session.send({
                type: "get-logs",
                forClient: session_1.session.clientId,
                saveAs: name
            });
            function save(msg) {
                if (msg.request.forClient == session_1.session.clientId && msg.request.saveAs == name) {
                    storage_1.storage.set("recording." + name, msg.logs).then(function () {
                        session_1.session.hub.off("logs", save);
                        ui_1.ui.chat.system({
                            text: "Saved as local:" + name
                        });
                    });
                }
            }
            session_1.session.hub.on("logs", save);
        };
        Commands.prototype.command_baseurl = function (url) {
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
        };
        Commands.prototype.command_config = function (variable, value) {
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
            if (!togetherjs_1.TogetherJS._defaultConfiguration.hasOwnProperty(variable)) {
                ui_1.ui.chat.system({
                    text: "Warning: variable " + variable + " is unknown"
                });
            }
            // TODO find better types
            storage_1.storage.get("configOverride").then(function (c) {
                var expire = Date.now() + (1000 * 60 * 60 * 24);
                c = c || { expiresAt: expire };
                c[variable] = value;
                c.expiresAt = Date.now() + (1000 * 60 * 60 * 24);
                storage_1.storage.set("configOverride", c).then(function () {
                    ui_1.ui.chat.system({
                        text: "Variable " + variable + " = " + JSON.stringify(value) + "\nValue will be set for one day."
                    });
                });
            });
        };
        return Commands;
    }());
    var commands = new Commands();
    // this section deal with saving/restoring chat history as long as session is alive
    var chatStorageKey = "chatlog";
    var maxLogMessages = 100;
    function saveChatMessage(obj) {
        assert(obj.peerId);
        assert(obj.messageId);
        assert(obj.date);
        assert(typeof obj.text == "string");
        loadChatLog().then(function (logs) {
            if (logs) {
                for (var i = logs.length - 1; i >= 0; i--) {
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
            for (var i = 0; i < log.length; i++) {
                // peers should already be loaded from sessionStorage by the peers module
                var currentPeer = peers_1.peers.getPeer(log[i].peerId, undefined, true);
                if (!currentPeer) {
                    // sometimes peers go away
                    continue;
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
