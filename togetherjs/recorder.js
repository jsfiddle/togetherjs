/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["jquery", "util", "channels"], function ($, util, channels) {
  var recorder = util.Module("recorder");
  var assert = util.assert;
  var channel = null;
  var baseUrl = null;
  var clientId = "recorder";

  function display(el) {
    el = $(el);
    var toggles = el.attr("data-toggles");
    if (toggles) {
      $(toggles).hide();
    }
    el.show();
  }

  recorder.start = function (options) {
    $(function () {
      $("#record").css({height: $(window).height() - 50});
      $("#restart").click(function () {
        location.reload();
      });
      $("#select").click(function () {
        $("#record").select();
      });
      recorder.activate(options);
    });
  };

  recorder.activate = function (options) {
    var match;
    baseUrl = options.baseUrl;
    recorder.shareId = TogetherJS.startup._joinShareId;
    if (! recorder.shareId) {
      match = /\&togetherjs=([^&]+)/.exec(location.hash);
      if (! match) {
        display("#no-session-id");
        return;
      }
      recorder.shareId = match[1];
    }
    var hubBase = options.defaultHubBase;
    match = /\&hubBase=([^&]+)/.exec(location.hash);
    if (match) {
      hubBase = match[1];
    }
    hubBase = hubBase.replace(/\/*$/, "");
    var url = hubBase + "/hub/" + recorder.shareId;
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
      recorder.logMessage(msg);
    };
    sendHello(false);
  };

  function sendHello(helloBack) {
    var msg = {
      type: helloBack ? "hello-back" : "hello",
      name: "Recorder 'bot",
      // FIXME: replace with robot:
      avatar: TogetherJS.baseUrl + "/togetherjs/images/robot-avatar.png",
      color: "#888888",
      rtcSupported: false,
      clientId: clientId,
      url: "about:blank"
    };
    channel.send(msg);
  }

  function sendLogs(req) {
    var msg = {
      type: "logs",
      clientId: clientId,
      logs: $("#record").val(),
      request: req
    };
    channel.send(msg);
  }

  recorder.logMessage = function (msg) {
    msg.date = Date.now();
    msg = JSON.stringify(msg);
    var $record = $("#record");
    $record.val($record.val() + msg + "\n\n");
  };

  $(window).unload(function () {
    channel.send({
      type: "bye",
      clientId: clientId
    });
  });

  return recorder;

});
