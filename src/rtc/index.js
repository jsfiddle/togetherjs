/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Audio and video calling.
 *
 * This replaces the old webrtc.js, which held a single RTCPeerConnection for
 * the whole room and broadcast its offers to everyone, so any third
 * participant broke the call. See ./mesh.js for the per-peer connections and
 * ./connection.js for the negotiation.
 *
 * The module is split as:
 *   media.js       the local microphone and camera
 *   connection.js  one peer connection, with perfect negotiation
 *   mesh.js        the set of connections, and the signaling
 *   ui.js          the dock buttons and video tiles
 */

import util from "../core/util.js";
import session from "../core/session.js";
import { provide } from "../core/registry.js";
import media, { mediaSupported } from "./media.js";
import mesh from "./mesh.js";
import "./ui.js";

var webrtc = util.Module("webrtc");

/* Announced to peers in the hello message and stored on each Peer, so we never
   offer to a client that cannot answer. Requires both the API and a secure
   context: navigator.mediaDevices is undefined on http:// pages, where the old
   check (`!!window.RTCPeerConnection`) passed and then failed inside
   getUserMedia. */
session.RTCSupported = !!window.RTCPeerConnection && mediaSupported();

session.on("prepare-hello", function (msg) {
  msg.rtcSupported = session.RTCSupported;
});

webrtc.media = media;
webrtc.mesh = mesh;

/** Join the call with audio. Exposed for the host page and for tests. */
webrtc.startAudio = async function () {
  await media.startAudio();
  await mesh.start();
};

/** Turn the camera on, joining the call if not already in it. */
webrtc.startVideo = async function () {
  await media.startVideo();
  if (!mesh.isActive()) {
    await media.startAudio().catch(function () {
      // Video without audio is fine; the mesh still needs starting.
    });
    await mesh.start();
  } else {
    await mesh.syncLocalTracks();
  }
};

webrtc.stopVideo = function () {
  media.stopVideo();
};

webrtc.toggleMute = function () {
  var muted = media.toggleMute();
  mesh.broadcastState();
  return muted;
};

webrtc.hangup = function () {
  mesh.stop();
};

/* Exposed for the end-to-end tests, which drive the mesh directly and assert
   on connection state and RTP statistics. */
util.testExpose({ rtc: webrtc });

provide("webrtc", webrtc);

export default webrtc;
