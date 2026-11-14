/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Who is talking.
 *
 * Measures the loudness of each peer's incoming audio and says when someone
 * starts and stops speaking, so the UI can mark them. This is worked out
 * locally from the streams we already receive — nothing extra goes over the
 * hub, which matters because speech starts and stops several times a second
 * and broadcasting that would be a lot of traffic for a decoration.
 *
 * The consequence is that we only know about peers whose audio we actually
 * receive: if you are not in the call, nobody shows as speaking.
 */

import util from "../core/util.js";
import { mixinEvents } from "../core/events.js";

var speaking = mixinEvents(util.Module("rtcSpeaking"));
speaking._knownEvents = ["change"];

/* RMS amplitude, 0..1. Two thresholds rather than one: a single threshold
   makes the indicator strobe through the quiet parts of ordinary speech. */
var START_LEVEL = 0.05;
var STOP_LEVEL = 0.025;
/* How long it has to stay quiet before we call it stopped. Long enough to
   ride out the gaps between words, short enough to feel responsive. */
var STOP_DELAY = 700;
var POLL_INTERVAL = 100;

var context = null;
var watchers = new Map();
var timer = null;

function audioContext() {
  if (!context) {
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) {
      return null;
    }
    context = new Ctor();
  }
  // A context created before a user gesture starts suspended.
  if (context.state === "suspended" && context.resume) {
    context.resume().catch(function () {});
  }
  return context;
}

function level(watcher) {
  watcher.analyser.getByteTimeDomainData(watcher.data);
  var sum = 0;
  for (var i = 0; i < watcher.data.length; i++) {
    // Samples are centred on 128; the deviation from that is the signal.
    var sample = (watcher.data[i] - 128) / 128;
    sum += sample * sample;
  }
  return Math.sqrt(sum / watcher.data.length);
}

function set(peerId, watcher, isSpeaking) {
  if (watcher.speaking === isSpeaking) {
    return;
  }
  watcher.speaking = isSpeaking;
  speaking.emit("change", { peerId: peerId, speaking: isSpeaking });
}

function poll() {
  var now = Date.now();
  watchers.forEach(function (watcher, peerId) {
    var rms = level(watcher);
    if (rms > START_LEVEL) {
      watcher.quietSince = 0;
      set(peerId, watcher, true);
    } else if (rms < STOP_LEVEL) {
      if (!watcher.quietSince) {
        watcher.quietSince = now;
      } else if (now - watcher.quietSince > STOP_DELAY) {
        set(peerId, watcher, false);
      }
    } else {
      // Between the two thresholds: hold whatever state we are in.
      watcher.quietSince = 0;
    }
  });
}

function startPolling() {
  if (!timer) {
    timer = setInterval(poll, POLL_INTERVAL);
  }
}

function stopPolling() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/* Starts reporting on a peer. The stream is the one the mesh handed us for
   that peer; calling this again for the same peer replaces the old watch. */
speaking.watch = function (peerId, stream) {
  if (!stream || !stream.getAudioTracks().length) {
    return;
  }
  var ctx = audioContext();
  if (!ctx) {
    return;
  }
  speaking.unwatch(peerId);
  var analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.4;
  var source = ctx.createMediaStreamSource(stream);
  /* Connected to the analyser only, never to the destination: the audio is
     already being played by the peer's <audio> element and routing it here
     as well would double it. */
  source.connect(analyser);
  watchers.set(peerId, {
    source: source,
    analyser: analyser,
    data: new Uint8Array(analyser.fftSize),
    speaking: false,
    quietSince: 0,
  });
  startPolling();
};

speaking.unwatch = function (peerId) {
  var watcher = watchers.get(peerId);
  if (!watcher) {
    return;
  }
  try {
    watcher.source.disconnect();
  } catch {
    // Already disconnected, or the context went away underneath us.
  }
  watchers.delete(peerId);
  // Whoever was listening still thinks this peer is talking.
  set(peerId, watcher, false);
  if (!watchers.size) {
    stopPolling();
  }
};

speaking.stopAll = function () {
  Array.from(watchers.keys()).forEach(speaking.unwatch);
  stopPolling();
};

speaking.isSpeaking = function (peerId) {
  var watcher = watchers.get(peerId);
  return !!(watcher && watcher.speaking);
};

export default speaking;
