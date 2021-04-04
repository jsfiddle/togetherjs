/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "./channels", "./util", "jquery"], function (require, exports, channels_1, util_1, jquery_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.recorder = void 0;
    jquery_1 = __importDefault(jquery_1);
    //function recorderMain($: JQueryStatic, util: TogetherJSNS.Util, channels: TogetherJSNS.Channels) {
    const assert = util_1.util.assert.bind(util_1.util);
    let channel; // TODO potentially not initialized, why does TSC doesn't catch that?
    let clientId = "recorder";
    function display(elOrSelector) {
        let el = jquery_1.default(elOrSelector);
        var toggles = el.attr("data-toggles");
        if (toggles) {
            jquery_1.default(toggles).hide();
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
            logs: jquery_1.default("#record").val(),
            request: req
        });
    }
    class Recorder {
        start(options) {
            jquery_1.default(() => {
                jquery_1.default("#record").css({ height: jquery_1.default(window).height() - 50 });
                jquery_1.default("#restart").click(function () {
                    location.reload();
                });
                jquery_1.default("#select").click(function () {
                    jquery_1.default("#record").select();
                });
                this.activate(options);
            });
        }
        activate(options) {
            var _a;
            var match;
            this.shareId = (_a = TogetherJS.startup._joinShareId) !== null && _a !== void 0 ? _a : undefined;
            if (!this.shareId) {
                match = /\&togetherjs=([^&]+)/.exec(location.hash);
                if (!match) {
                    display("#no-session-id");
                    return;
                }
                this.shareId = match[1];
            }
            assert(options.defaultHubBase != undefined); // TODO add assert for easier typechecking
            var hubBase = options.defaultHubBase;
            match = /\&hubBase=([^&]+)/.exec(location.hash);
            if (match) {
                hubBase = match[1];
            }
            hubBase = hubBase.replace(/\/*$/, "");
            var url = hubBase + "/hub/" + this.shareId;
            channel = channels_1.channels.WebSocketChannel(url);
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
            var $record = jquery_1.default("#record");
            $record.val($record.val() + JSON.stringify(msg) + "\n\n");
        }
    }
    jquery_1.default(window).unload(function () {
        channel.send({
            type: "bye",
            clientId: clientId
        });
    });
    exports.recorder = new Recorder();
});
//define(["jquery", "util", "channels"], recorderMain);
