/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import util from "./core/util.js";
import session from "./core/session.js";
import storage from "./core/storage.js";

var playback = util.Module("playback");

var ALWAYS_REPLAY = {
  "cursor-update": true,
  "scroll-update": true
};

playback.getLogs = function (url) {
  if (url.search(/^local:/) === 0) {
    return util.Deferred(function (def) {
      storage.get("recording." + url.substr("local:".length)).then(function (logs) {
        if (! logs) {
          def.resolve(null);
          return;
        }
        logs = parseLogs(logs);
        def.resolve(logs);
      }, function (error) {
        def.reject(error);
      });
    });
  }
  return util.Deferred(function (def) {
    fetch(url).then(function (resp) {
      if (! resp.ok) {
        throw new Error("Could not fetch logs: " + resp.status + " " + resp.statusText);
      }
      return resp.text();
    }).then(function (logs) {
      def.resolve(parseLogs(logs));
    }, function (error) {
      def.reject(error);
    });
  });
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
  return new Logs(result);
}

class Logs {
  constructor(logs, fromStorage) {
    this.logs = logs;
    this.fromStorage = fromStorage;
    this.pos = 0;
  }

  play() {
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
  }

  cancel() {
    if (this.playTimer) {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }
    this.start = null;
    this.pos = 0;
    this.unload();
  }

  pause() {
    if (this.playTimer) {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }
  }

  playOne() {
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
  }

  playItem(item) {
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
  }

  save() {
    this.fromStorage = true;
    storage.set("playback.logs", this.logs);
    this.savePos();
  }

  savePos() {
    storage.set("playback.pos", this.pos);
  }

  unload() {
    if (this.fromStorage) {
      storage.set("playback.logs", undefined);
      storage.set("playback.pos", undefined);
    }
    // FIXME: should do a bye message here
  }
};


playback.getRunningLogs = function () {
  return storage.get("playback.logs").then(function (value) {
    if (! value) {
      return null;
    }
    var logs = new Logs(value, true);
    return storage.get("playback.pos").then(function (pos) {
      pos = pos || 0;
      logs.pos = pos;
      return logs;
    });
  });
};

export default playback;
