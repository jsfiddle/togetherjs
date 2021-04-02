/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { channels } from "./channels";
import { util } from "./util";

//function recorderMain($: JQueryStatic, util: TogetherJSNS.Util, channels: TogetherJSNS.Channels) {
const assert: typeof util.assert = util.assert;
let channel: TogetherJSNS.WebSocketChannel; // TODO potentially not initialized, why does TSC doesn't catch that?
let clientId = "recorder";

function display(elOrSelector: HTMLElement | JQuery | string) {
    let el = $(elOrSelector);
    var toggles = el.attr("data-toggles");
    if(toggles) {
        $(toggles).hide();
    }
    el.show();
}

function sendHello(helloBack: boolean) {
    if(helloBack) {
        channel.send({
            type: "hello-back",
            name: "Recorder 'bot",
            // FIXME: replace with robot:
            avatar: TogetherJS.baseUrl + "/images/robot-avatar.png",
            color: "#888888",
            rtcSupported: false,
            clientId: clientId,
            url: "about:blank",
            identityId: "_robot", // TODO added this field, check that it's ok
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

function sendLogs(req: TogetherJSNS.SessionSend.GetLogs) {
    channel.send({
        type: "logs",
        clientId: clientId,
        logs: $("#record").val(),
        request: req
    });
}

class Recorder {
    private shareId?: string;
    start(options: Partial<TogetherJSNS.Config & { defaultHubBase: string }>) {
        $(() => {
            $("#record").css({ height: $(window).height() - 50 });
            $("#restart").click(function() {
                location.reload();
            });
            $("#select").click(function() {
                $("#record").select();
            });
            this.activate(options);
        });
    }

    activate(options: Partial<TogetherJSNS.Config & { defaultHubBase: string }>) {
        var match;
        this.shareId = TogetherJS.startup._joinShareId ?? undefined;
        if(!this.shareId) {
            match = /\&togetherjs=([^&]+)/.exec(location.hash);
            if(!match) {
                display("#no-session-id");
                return;
            }
            this.shareId = match[1];
        }
        assert(options.defaultHubBase != undefined); // TODO add assert for easier typechecking
        var hubBase = options.defaultHubBase;
        match = /\&hubBase=([^&]+)/.exec(location.hash);
        if(match) {
            hubBase = match[1];
        }
        hubBase = hubBase.replace(/\/*$/, "");
        var url = hubBase + "/hub/" + this.shareId;
        channel = channels.WebSocketChannel(url);
        channel.onmessage = msg => {
            if(msg.type == "hello-back") {
                display("#connected");
            }
            if(msg.type == "hello") {
                sendHello(true);
            }
            if(msg.type == "get-logs") {
                sendLogs(msg);
                return;
            }
            this.logMessage(msg);
        };
        sendHello(false);
    }

    logMessage(msg: TogetherJSNS.ValueOf<TogetherJSNS.AnyMessage.MapForReceiving>) {
        (msg as typeof msg & TogetherJSNS.WithDate).date = Date.now(); // TODO abusive cast
        var $record = $("#record");
        $record.val($record.val() + JSON.stringify(msg) + "\n\n");
    }
}

$(window).unload(function() {
    channel.send({
        type: "bye",
        clientId: clientId
    });
});

export const recorder = new Recorder();


//define(["jquery", "util", "channels"], recorderMain);
