/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
define(["util", "channels", "session", "ui"], function (util, channels, session, ui) {
  var assert = util.assert;
  var who = util.Module("who");
  var MAX_RESPONSE_TIME = 5000;
  var MAX_LATE_RESPONSE = 2000;

  who.getList = function (hubUrl) {
    return util.Deferred(function (def) {
      var expected;
      var channel = channels.WebSocketChannel(hubUrl);
      var users = {};
      var responded = 0;
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
          if (! users[msg.clientId]) {
            users[msg.clientId] = who.ExternalPeer(msg.clientId, msg);
            responded++;
            if (expected && responded >= expected) {
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

  who.invite = function (hubUrl, clientId) {
    return util.Deferred(function (def) {
      var channel = channels.WebSocketChannel(hubUrl);
      var id = util.generateId();
      channel.onmessage = function (msg) {
        if (msg.type == "invite" && msg.inviteId == id) {
          channel.close();
          def.resolve();
        }
      };
      var userInfo = session.makeHelloMessage(false);
      delete userInfo.type;
      userInfo.clientId = session.clientId;
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
  };

  who.ExternalPeer = util.Class({
    isSelf: false,
    isExternal: true,
    constructor: function (id, attrs) {
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
    },

    className: function (prefix) {
      prefix = prefix || "";
      return prefix + util.safeClassName(this.id);
    }

  });

  return who;
});
