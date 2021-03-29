"use strict";
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
function whoMain(util, channels, session, ui) {
    var assert = util.assert;
    var MAX_RESPONSE_TIME = 5000;
    var MAX_LATE_RESPONSE = 2000;
    var ExternalPeer = /** @class */ (function () {
        function ExternalPeer(id, attrs) {
            this.isSelf = false;
            this.isExternal = true;
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
            this.view = ui.PeerSelfView(this); // TODO seems to be unused
        }
        ExternalPeer.prototype.className = function (prefix) {
            if (prefix === void 0) { prefix = ""; }
            return prefix + util.safeClassName(this.id);
        };
        return ExternalPeer;
    }());
    var Who = /** @class */ (function () {
        function Who() {
            this.ExternalPeer = function (id, attrs) { return new ExternalPeer(id, attrs); };
        }
        Who.prototype.getList = function (hubUrl) {
            return util.Deferred(function (def) {
                var expected;
                var channel = channels.WebSocketChannel(hubUrl);
                var users = {};
                var responded = 0;
                //tslint:disable-next-line unused var
                var firstResponse = 0;
                var lateResponseTimeout;
                channel.onmessage = function (msg) {
                    if (msg.type == "init-connection") {
                        expected = msg.peerCount;
                    }
                    if (msg.type == "who") {
                        // Our message back to ourselves probably
                        firstResponse = setTimeout(function () {
                            close();
                        }, MAX_LATE_RESPONSE);
                    }
                    if (msg.type == "hello-back") {
                        if (!users[msg.clientId]) {
                            users[msg.clientId] = who.ExternalPeer(msg.clientId, msg);
                            responded++;
                            if (expected && responded >= expected) {
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
                var timeout = setTimeout(function () {
                    close();
                }, MAX_RESPONSE_TIME);
                function close() {
                    if (timeout) {
                        clearTimeout(timeout);
                    }
                    if (lateResponseTimeout) {
                        clearTimeout(lateResponseTimeout);
                    }
                    channel.close();
                    def.resolve(users);
                }
            });
        };
        Who.prototype.invite = function (hubUrl, clientId) {
            return util.Deferred(function (def) {
                var channel = channels.WebSocketChannel(hubUrl);
                var id = util.generateId();
                channel.onmessage = function (msg) {
                    if (msg.type == "invite" && msg.inviteId == id) {
                        channel.close();
                        def.resolve();
                    }
                };
                var hello = session.makeHelloMessage(false);
                var userInfo = {
                    name: hello.name,
                    avatar: hello.avatar,
                    color: hello.color,
                    url: hello.url,
                    urlHash: hello.urlHash,
                    title: hello.title,
                    rtcSupported: hello.rtcSupported,
                    isClient: hello.isClient,
                    starting: hello.starting,
                    clientId: session.clientId, // TODO !
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
        };
        return Who;
    }());
    var who = new Who();
    return who;
}
define(["util", "channels", "session", "ui"], whoMain);
