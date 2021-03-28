"use strict";
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
define(["jquery", "util", "channels"], function ($, _util, channels) {
    var channel = null;
    var baseUrl = null;
    var clientId = "recorder";
    function display(elOrSelector) {
        var el = $(elOrSelector);
        var toggles = el.attr("data-toggles");
        if (toggles) {
            $(toggles).hide();
        }
        el.show();
    }
    function sendHello(helloBack) {
        if (helloBack) {
            channel.send({
                type: "hello-back",
                name: "Recorder 'bot",
                // FIXME: replace with robot:
                avatar: TogetherJS.baseUrl + "/togetherjs/images/robot-avatar.png",
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
                avatar: TogetherJS.baseUrl + "/togetherjs/images/robot-avatar.png",
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
            logs: $("#record").val(),
            request: req
        });
    }
    var Recorder = /** @class */ (function () {
        function Recorder() {
        }
        Recorder.prototype.start = function (options) {
            var _this = this;
            $(function () {
                $("#record").css({ height: $(window).height() - 50 });
                $("#restart").click(function () {
                    location.reload();
                });
                $("#select").click(function () {
                    $("#record").select();
                });
                _this.activate(options);
            });
        };
        Recorder.prototype.activate = function (options) {
            var _this = this;
            var match;
            baseUrl = options.baseUrl;
            this.shareId = TogetherJS.startup._joinShareId;
            if (!this.shareId) {
                match = /\&togetherjs=([^&]+)/.exec(location.hash);
                if (!match) {
                    display("#no-session-id");
                    return;
                }
                this.shareId = match[1];
            }
            var hubBase = options.defaultHubBase;
            match = /\&hubBase=([^&]+)/.exec(location.hash);
            if (match) {
                hubBase = match[1];
            }
            hubBase = hubBase.replace(/\/*$/, "");
            var url = hubBase + "/hub/" + this.shareId;
            channel = channels.WebSocketChannel(url);
            channel.onmessage = function (msg) {
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
                _this.logMessage(msg);
            };
            sendHello(false);
        };
        Recorder.prototype.logMessage = function (msg) {
            msg.date = Date.now(); // TODO as any
            var $record = $("#record");
            $record.val($record.val() + JSON.stringify(msg) + "\n\n");
        };
        return Recorder;
    }());
    $(window).unload(function () {
        channel.send({
            type: "bye",
            clientId: clientId
        });
    });
    return new Recorder();
});
