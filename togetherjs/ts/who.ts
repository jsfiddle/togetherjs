/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { WebSocketChannel } from "./channels";
import { session } from "./session";
import { ui } from "./ui";
import { util } from "./util";

//function whoMain(util: TogetherJSNS.Util, channels: TogetherJSNS.Channels, session: TogetherJSNS.Session, ui: TogetherJSNS.Ui) {
const assert: typeof util.assert = util.assert.bind(util);
const MAX_RESPONSE_TIME = 5000;
const MAX_LATE_RESPONSE = 2000;

export class ExternalPeer {
    isSelf = false;
    isExternal = true;
    id;
    identityId;
    status: TogetherJSNS.PeerStatus;
    idle;
    name;
    avatar;
    color;
    lastMessageDate;
    view;

    // TODO hacks to make ExternalPeer pass as a PeerSelf/PeerClass for PeerSelfView
    isCreator: undefined;
    url: undefined;
    defaultName: undefined;

    constructor(id: string, attrs: TogetherJSNS.ExternalPeerAttributes) {
        attrs = attrs || {};
        assert(id);
        this.id = id;
        this.identityId = attrs.identityId || null;
        this.status = attrs.status || "live";
        this.idle = attrs.status || "active";
        this.name = attrs.name || null;
        this.avatar = attrs.avatar || null;
        this.color = attrs.color || "#00FF00";
        this.lastMessageDate = 0;
        this.view = ui.PeerSelfView(this);
    }

    className(prefix = "") {
        return prefix + util.safeClassName(this.id);
    }
}

export class Who {
    ExternalPeer = (id: string, attrs: TogetherJSNS.ExternalPeerAttributes) => new ExternalPeer(id, attrs);

    getList(hubUrl: string) {
        return util.Deferred<{ [user: string]: ExternalPeer }>(function(def) {
            let expected: number;
            const channel = new WebSocketChannel(hubUrl);
            const users: { [user: string]: ExternalPeer } = {};
            let responded = 0;
            //var firstResponse = 0; // TODO unused
            let lateResponseTimeout: number;
            channel.onmessage = function(msg) {
                if(msg.type == "init-connection") {
                    expected = msg.peerCount;
                }
                if(msg.type == "who") {
                    // Our message back to ourselves probably
                    //firstResponse =  // TODO unused
                    setTimeout(function() {
                        close();
                    }, MAX_LATE_RESPONSE);
                }
                if(msg.type == "hello-back") {
                    if(!users[msg.clientId]) {
                        users[msg.clientId] = who.ExternalPeer(msg.clientId, msg);
                        responded++;
                        if(expected && responded >= expected) {
                            close();
                        }
                        else {
                            def.notify(users);
                        }
                    }
                }
                console.log("users", users);
            };
            channel.send({
                type: "who",
                "server-echo": true,
            });
            const timeout = setTimeout(function() {
                close();
            }, MAX_RESPONSE_TIME);
            function close() {
                if(timeout) {
                    clearTimeout(timeout);
                }
                if(lateResponseTimeout) {
                    clearTimeout(lateResponseTimeout);
                }
                channel.close();
                def.resolve(users);
            }
        });
    }

    invite(hubUrl: string, clientId: string | null) {
        return util.Deferred(function(def) {
            const channel = new WebSocketChannel(hubUrl);
            const id = util.generateId();
            channel.onmessage = function(msg) {
                if(msg.type == "invite" && msg.inviteId == id) {
                    channel.close();
                    def.resolve();
                }
            };
            const hello = session.makeHelloMessage(false);

            const userInfo: TogetherJSNS.ChannelSend.UserInfo = {
                name: hello.name,
                avatar: hello.avatar,
                color: hello.color,
                url: hello.url,
                urlHash: hello.urlHash,
                title: hello.title,
                rtcSupported: hello.rtcSupported,
                isClient: hello.isClient,
                starting: hello.starting,
                clientId: session.clientId!, // TODO !
            };

            channel.send({
                type: "invite",
                inviteId: id,
                url: session.shareUrl(),
                userInfo: userInfo,
                forClientId: clientId,
                "server-echo": true
            });
        });
    }
}

export const who = new Who();

//return who;

//define(["util", "channels", "session", "ui"], whoMain);
