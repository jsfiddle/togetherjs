/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
define(["require", "exports", "./channels", "./session", "./ui", "./util"], function (require, exports, channels_1, session_1, ui_1, util_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.who = void 0;
    //function whoMain(util: TogetherJSNS.Util, channels: TogetherJSNS.Channels, session: TogetherJSNS.Session, ui: TogetherJSNS.Ui) {
    var assert = util_1.util.assert.bind(util_1.util);
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
            this.view = ui_1.ui.PeerSelfView(this);
        }
        ExternalPeer.prototype.className = function (prefix) {
            if (prefix === void 0) { prefix = ""; }
            return prefix + util_1.util.safeClassName(this.id);
        };
        return ExternalPeer;
    }());
    var Who = /** @class */ (function () {
        function Who() {
            this.ExternalPeer = function (id, attrs) { return new ExternalPeer(id, attrs); };
        }
        Who.prototype.getList = function (hubUrl) {
            return util_1.util.Deferred(function (def) {
                var expected;
                var channel = channels_1.channels.WebSocketChannel(hubUrl);
                var users = {};
                var responded = 0;
                //var firstResponse = 0; // TODO unused
                var lateResponseTimeout;
                channel.onmessage = function (msg) {
                    if (msg.type == "init-connection") {
                        expected = msg.peerCount;
                    }
                    if (msg.type == "who") {
                        // Our message back to ourselves probably
                        //firstResponse =  // TODO unused
                        setTimeout(function () {
                            close();
                        }, MAX_LATE_RESPONSE);
                    }
                    if (msg.type == "hello-back") {
                        if (!users[msg.clientId]) {
                            users[msg.clientId] = exports.who.ExternalPeer(msg.clientId, msg);
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
            return util_1.util.Deferred(function (def) {
                var channel = channels_1.channels.WebSocketChannel(hubUrl);
                var id = util_1.util.generateId();
                channel.onmessage = function (msg) {
                    if (msg.type == "invite" && msg.inviteId == id) {
                        channel.close();
                        def.resolve();
                    }
                };
                var hello = session_1.session.makeHelloMessage(false);
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
                    clientId: session_1.session.clientId, // TODO !
                };
                channel.send({
                    type: "invite",
                    inviteId: id,
                    url: session_1.session.shareUrl(),
                    userInfo: userInfo,
                    forClientId: clientId,
                    "server-echo": true
                });
            });
        };
        return Who;
    }());
    exports.who = new Who();
});
//return who;
//define(["util", "channels", "session", "ui"], whoMain);
