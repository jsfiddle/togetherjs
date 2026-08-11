/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Local microphone and camera.
 *
 * Audio and video are acquired independently so that turning the camera on
 * mid-call does not re-prompt for the microphone, and so a user can grant one
 * without the other.
 */

import util from "../core/util.js";

var media = util.mixinEvents(util.Module("rtcMedia"));
media._knownEvents = ["change", "error"];

var audioTrack = null;
var videoTrack = null;
var audioMuted = false;
var preferredAudioDevice = null;
var preferredVideoDevice = null;

/** True when the page can use getUserMedia at all. */
export function mediaSupported() {
  // navigator.mediaDevices is undefined on insecure origins, so a plain http://
  // page fails here rather than throwing later inside getUserMedia.
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/** True when the failure is "this page isn't secure", which is worth its own
    message: nothing the user does in the permission prompt will fix it. */
export function requiresSecureContext() {
  return !window.isSecureContext;
}

media.get = function (kind) {
  return kind === "audio" ? audioTrack : videoTrack;
};

media.hasAudio = function () {
  return !!audioTrack;
};

media.hasVideo = function () {
  return !!videoTrack;
};

media.isMuted = function () {
  return audioMuted;
};

/** The state peers need to render badges, broadcast on every change. */
media.state = function () {
  return {
    audio: !!audioTrack && !audioMuted,
    video: !!videoTrack,
  };
};

media.startAudio = async function () {
  if (audioTrack) {
    return audioTrack;
  }
  var constraints = {
    audio: preferredAudioDevice ? { deviceId: { exact: preferredAudioDevice } } : true,
  };
  var stream = await navigator.mediaDevices.getUserMedia(constraints);
  audioTrack = stream.getAudioTracks()[0];
  audioTrack.enabled = !audioMuted;
  // The browser can stop a track on its own (device unplugged, permission
  // revoked); reflect that rather than showing a live mic that isn't.
  audioTrack.addEventListener("ended", function () {
    audioTrack = null;
    media.emit("change");
  });
  media.emit("change");
  return audioTrack;
};

media.startVideo = async function () {
  if (videoTrack) {
    return videoTrack;
  }
  var constraints = {
    video: preferredVideoDevice
      ? { deviceId: { exact: preferredVideoDevice } }
      : { width: { ideal: 320 }, height: { ideal: 240 } },
  };
  var stream = await navigator.mediaDevices.getUserMedia(constraints);
  videoTrack = stream.getVideoTracks()[0];
  videoTrack.addEventListener("ended", function () {
    videoTrack = null;
    media.emit("change");
  });
  media.emit("change");
  return videoTrack;
};

/* Muting flips the track's enabled flag rather than removing it: instant, no
   renegotiation, and the connection stays warm. A disabled audio track still
   sends silence, so peers cannot tell without being told — hence the rtc-state
   broadcast that accompanies this. */
media.setMuted = function (muted) {
  audioMuted = !!muted;
  if (audioTrack) {
    audioTrack.enabled = !audioMuted;
  }
  media.emit("change");
  return audioMuted;
};

media.toggleMute = function () {
  return media.setMuted(!audioMuted);
};

/* Stopping the camera track rather than merely disabling it is deliberate:
   `enabled = false` leaves the hardware capture light on, which users
   reasonably read as still being watched. */
media.stopVideo = function () {
  if (videoTrack) {
    videoTrack.stop();
    videoTrack = null;
    media.emit("change");
  }
};

media.stopAudio = function () {
  if (audioTrack) {
    audioTrack.stop();
    audioTrack = null;
    media.emit("change");
  }
};

media.stopAll = function () {
  media.stopAudio();
  media.stopVideo();
  audioMuted = false;
};

/** Available microphones and cameras, once permission has been granted.
    Labels are empty until then, which is why the picker only appears after
    the user has joined the call. */
media.devices = async function () {
  if (!mediaSupported()) {
    return { audio: [], video: [] };
  }
  var all = await navigator.mediaDevices.enumerateDevices();
  return {
    audio: all.filter(function (d) {
      return d.kind === "audioinput";
    }),
    video: all.filter(function (d) {
      return d.kind === "videoinput";
    }),
  };
};

/** Switch input device. Returns the new track so callers can replaceTrack it
    onto every peer connection. */
media.useDevice = async function (kind, deviceId) {
  if (kind === "audio") {
    preferredAudioDevice = deviceId;
    if (audioTrack) {
      audioTrack.stop();
      audioTrack = null;
      return media.startAudio();
    }
    return null;
  }
  preferredVideoDevice = deviceId;
  if (videoTrack) {
    videoTrack.stop();
    videoTrack = null;
    return media.startVideo();
  }
  return null;
};

export default media;
