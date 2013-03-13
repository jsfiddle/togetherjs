/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["jquery", "util", "session"], function ($, util, session) {
  var playback = util.Module("playback");
  var assert = util.assert;

  var ALWAYS_REPLAY = {
    "cursor-update": true,
    "scroll-update": true
  };

  playback.getLogs = function (url) {
    var result = $.Deferred();
    $.ajax({
      url: url,
      dataType: "text"
    }).then(
      function (logs) {
        logs = parseLogs(logs);
        result.resolve(logs);
      },
      function (error) {
        result.reject(error);
      });
    return result;
  };

  function parseLogs(logs) {
    logs = logs.replace(/\r\n/g, '\n');
    logs = logs.split(/\n/g);
    var result = [];
    for (var i=0; i<logs.length; i++) {
      var line = logs[i];
      line = line.replace(/^\s+/, "").replace(/\s+$/, "");
      if (line.search(/\/\*/) === 0) {
        var last = line.search(/\*\//);
        if (last == -1) {
          console.warn("bad line:", line);
          continue;
        }
        line = line.substr(last+2);
      }
      line = line.replace(/^\s+/, "");
      if (! line) {
        continue;
      }
      line = JSON.parse(line);
      result.push(line);
    }
    return Logs(result);
  }

  var Logs = util.Class({
    constructor: function (logs, fromStorage) {
      this.logs = logs;
      this.fromStorage = fromStorage;
      this.pos = 0;
    },

    play: function () {
      this.start = Date.now();
      if (this.pos >= this.logs.length) {
        this.unload();
        return;
      }
      if (this.pos !== 0) {
        // First we need to play the hello
        var toReplay = [];
        var foundHello = false;
        for (var i=this.pos-1; i>=0; i--) {
          var item = this.logs[i];
          if (ALWAYS_REPLAY[item.type]) {
            toReplay.push(item);
          }
          if (item.type == "hello" || item.type == "hello-back") {
            this.playItem(item);
            foundHello = true;
            break;
          }
        }
        if (! foundHello) {
          console.warn("No hello message found before position", this.pos);
        }
        toReplay.reverse();
        for (i=0; i<toReplay.length; i++) {
          this.playItem(toReplay[i]);
        }
      }
      this.playOne();
    },

    cancel: function () {
      if (this.playTimer) {
        clearTimeout(this.playTimer);
        this.playTimer = null;
      }
      this.start = null;
      this.pos = 0;
      this.unload();
    },

    pause: function () {
      if (this.playTimer) {
        clearTimeout(this.playTimer);
        this.playTimer = null;
      }
    },

    playOne: function () {
      this.playTimer = null;
      if (this.pos >= this.logs.length) {
        this.unload();
        return;
      }
      var item = this.logs[this.pos];
      this.playItem(item);
      this.pos++;
      if (this.pos >= this.logs.length) {
        this.unload();
        return;
      }
      var next = this.logs[this.pos];
      var pause = next.date - item.date;
      this.playTimer = setTimeout(this.playOne.bind(this), pause);
      if (this.fromStorage) {
        this.savePos();
      }
    },

    playItem: function (item) {
      if (item.type == "hello") {
        // We may need to pause here
        if (item.url != (location.href+"").replace(/\#.*/, "")) {
          this.pause();
        }
      }
      try {
        session._getChannel().onmessage(item);
      } catch (e) {
        console.warn("Could not play back message:", item, "error:", e);
      }
    },

    save: function () {
      this.fromStorage = true;
      session.setStorage("playback.logs", this.logs);
      this.savePos();
    },

    savePos: function () {
      session.setStorage("playback.pos", this.pos);
    },

    unload: function () {
      if (this.fromStorage) {
        session.setStorage("playback.logs");
        session.setStorage("playback.pos");
      }
      // FIXME: should do a bye message here
    }

  });

  playback.getRunningLogs = function () {
    var value = session.getStorage("playback.logs");
    if (! value) {
      return null;
    }
    var logs = Logs(value, true);
    var pos = session.getStorage("playback.pos") || 0;
    logs.pos = pos;
    return logs;
  };

  return playback;
});
