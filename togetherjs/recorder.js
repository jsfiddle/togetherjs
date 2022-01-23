/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "jquery", "./channels", "./util"], function (require, exports, jquery_1, channels_1, util_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.recorder = void 0;
    jquery_1 = __importDefault(jquery_1);
    //function recorderMain($: JQueryStatic, util: TogetherJSNS.Util, channels: TogetherJSNS.Channels) {
    const assert = util_1.util.assert.bind(util_1.util);
    let channel; // TODO potentially not initialized, why does TSC doesn't catch that?
    const clientId = "recorder";
    function display(elOrSelector) {
        const el = (0, jquery_1.default)(elOrSelector);
        const toggles = el.attr("data-toggles");
        if (toggles) {
            (0, jquery_1.default)(toggles).hide();
        }
        el.show();
    }
    function sendHello(helloBack) {
        if (helloBack) {
            channel.send({
                type: "hello-back",
                name: "Recorder 'bot",
                // FIXME: replace with robot:
                avatar: TogetherJS.baseUrl + "/images/robot-avatar.png",
                color: "#888888",
                rtcSupported: false,
                clientId: clientId,
                url: "about:blank",
                identityId: "_robot",
                status: "live" // TODO added this field, check that it's ok
            });
        }
        else {
            channel.send({
                type: "hello",
                name: "Recorder 'bot",
                // FIXME: replace with robot:
                avatar: TogetherJS.baseUrl + "/images/robot-avatar.png",
                color: "#888888",
                rtcSupported: false,
                clientId: clientId,
                url: "about:blank"
            });
        }
    }
    function sendLogs(req) {
        channel.send({
            type: "logs",
            clientId: clientId,
            logs: (0, jquery_1.default)("#record").val(),
            request: req
        });
    }
    class Recorder {
        start(options) {
            (0, jquery_1.default)(() => {
                (0, jquery_1.default)("#record").css({ height: (0, jquery_1.default)(window).height() - 50 });
                (0, jquery_1.default)("#restart").click(function () {
                    location.reload();
                });
                (0, jquery_1.default)("#select").click(function () {
                    (0, jquery_1.default)("#record").select();
                });
                this.activate(options);
            });
        }
        activate(options) {
            var _a;
            let match;
            this.shareId = (_a = TogetherJS.startup._joinShareId) !== null && _a !== void 0 ? _a : undefined;
            if (!this.shareId) {
                match = /&togetherjs=([^&]+)/.exec(location.hash);
                if (!match) {
                    display("#no-session-id");
                    return;
                }
                this.shareId = match[1];
            }
            assert(options.defaultHubBase != undefined); // TODO add assert for easier typechecking
            let hubBase = options.defaultHubBase;
            match = /&hubBase=([^&]+)/.exec(location.hash);
            if (match) {
                hubBase = match[1];
            }
            hubBase = hubBase.replace(/\/*$/, "");
            const url = hubBase + "/hub/" + this.shareId;
            channel = new channels_1.WebSocketChannel(url);
            channel.onmessage = msg => {
                if (msg.type == "hello-back") {
                    display("#connected");
                }
                if (msg.type == "hello") {
                    sendHello(true);
                }
                if (msg.type == "get-logs") {
                    sendLogs(msg);
                    return;
                }
                this.logMessage(msg);
            };
            sendHello(false);
        }
        logMessage(msg) {
            msg.date = Date.now(); // TODO abusive cast
            const $record = (0, jquery_1.default)("#record");
            $record.val($record.val() + JSON.stringify(msg) + "\n\n");
        }
    }
    (0, jquery_1.default)(window).unload(function () {
        channel.send({
            type: "bye",
            clientId: clientId
        });
    });
    exports.recorder = new Recorder();
});
//define(["jquery", "util", "channels"], recorderMain);
