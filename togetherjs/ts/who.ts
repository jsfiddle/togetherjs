/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

interface ExternalPeerAttributes {
    identityId;
    status;
    name;
    avatar;
    color;
}

function whoMain(util: Util, channels: TogetherJSNS.Channels, session: TogetherJSNS.Session, ui: TogetherJSNS.Ui) {
    const assert: typeof util.assert = util.assert;
    var MAX_RESPONSE_TIME = 5000;
    var MAX_LATE_RESPONSE = 2000;

    class ExternalPeer {
        isSelf = false;
        isExternal = true;
        id;
        identityId;
        status;
        idle;
        name;
        avatar;
        color;
        lastMessageDate;
        view;

        constructor(id: string, attrs: ExternalPeerAttributes) {
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
            this.view = ui.PeerView(this);
        }

        className(prefix) {
            prefix = prefix || "";
            return prefix + util.safeClassName(this.id);
        }
    }

    class Who {
        ExternalPeerExport = ExternalPeer; // TODO ugly export
        ExternalPeer = (id: string, attrs: ExternalPeerAttributes) => new ExternalPeer(id, attrs);

        getList(hubUrl: string) {
            return util.Deferred(function(def) {
                var expected;
                var channel = channels.WebSocketChannel(hubUrl);
                var users = {};
                var responded = 0;
                var firstResponse = 0;
                var lateResponseTimeout;
                channel.onmessage = function(msg) {
                    if(msg.type == "init-connection") {
                        expected = msg.peerCount;
                    }
                    if(msg.type == "who") {
                        // Our message back to ourselves probably
                        firstResponse = setTimeout(function() {
                            close();
                        }, MAX_LATE_RESPONSE);
                    }
                    if(msg.type == "hello-back") {
                        if(!users[msg.clientId]) {
                            users[msg.clientId] = who.ExternalPeer(msg.clientId, msg);
                            responded++;
                            if(expected && responded >= expected) {
                                close();
                            } else {
                                def.notify(users);
                            }
                        }
                    }
                    console.log("users", users);
                };
                channel.send({
                    type: "who",
                    "server-echo": true,
                    clientId: null
                });
                var timeout = setTimeout(function() {
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
    
        invite(hubUrl: string, clientId: string) {
            return util.Deferred(function(def) {
                var channel = channels.WebSocketChannel(hubUrl);
                var id = util.generateId();
                channel.onmessage = function(msg) {
                    if(msg.type == "invite" && msg.inviteId == id) {
                        channel.close();
                        def.resolve();
                    }
                };
                var hello = session.makeHelloMessage(false);

                const userInfo = {
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
                    clientId: null,
                    "server-echo": true
                });
            });
        }
    }

    const who = new Who();

    return who;
}

define(["util", "channels", "session", "ui"], whoMain);
