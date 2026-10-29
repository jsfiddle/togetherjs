/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* One RTCPeerConnection to one remote peer.
 *
 * This implements the WebRTC spec's "perfect negotiation" pattern, which the
 * old single-connection code approximated with an ad-hoc `rtc-abort` message
 * and a 2-second watchdog. The pattern's whole point is that both sides can
 * start negotiating at the same moment and still converge, without either
 * having to be designated the caller up front.
 *
 * The three rules:
 *   1. Politeness is decided deterministically and the two sides always
 *      disagree about who is polite.
 *   2. onnegotiationneeded does setLocalDescription() with no arguments and
 *      lets the browser decide whether that is an offer or an answer. This is
 *      what makes turning the camera on mid-call Just Work.
 *   3. On an offer collision, the impolite side ignores the incoming offer and
 *      the polite side rolls back to accept it.
 */

import util from "../core/util.js";

var assert = util.assert;

/* Reasons a connection reports itself as gone, so the mesh can decide whether
   to retry or drop it. */
export var FAILED = "failed";
export var CLOSED = "closed";

export function PeerConnection(options) {
  var peerId = options.peerId;
  var selfId = options.selfId;
  var send = options.send;
  var onTrack = options.onTrack;
  var onStateChange = options.onStateChange;

  assert(peerId && selfId, "PeerConnection needs both peer and self ids");

  /* Both ends compute this independently and always disagree, which is what
     breaks the tie when offers cross. Comparing the client ids is arbitrary
     but stable, and every client already knows both of them. */
  var polite = selfId < peerId;

  /* Only one side opens the connection (see mesh.js). The answering side must
     not create its own transceivers: doing so fires negotiationneeded and it
     offers back at the very moment it is about to answer, turning every
     single connection setup into a glare. It picks up the transceivers the
     offer creates instead. */
  var initiator = !!options.initiator;

  var pc = new RTCPeerConnection(options.configuration);
  var makingOffer = false;
  var ignoreOffer = false;
  /* Candidates that arrive before the remote description is set cannot be
     added yet. The old code kept a single candidate in a scalar and let each
     new one overwrite the last, which lost all but one and dropped any that
     arrived early. */
  var pendingCandidates = [];
  var closed = false;
  var disconnectTimer = null;

  /* Both sides create the transceivers, so the m-line layout is symmetric and
     fixed for the connection's lifetime: turning a camera on later then only
     needs replaceTrack() and never reshapes the SDP.
     Adding them fires negotiationneeded on both sides, though, and the
     answering side must not act on that — offering back at the moment it is
     about to answer turns every connection setup into an offer collision.
     So it stays quiet until it has applied the first remote description. */
  var audioTransceiver = pc.addTransceiver("audio", { direction: "sendrecv" });
  var videoTransceiver = pc.addTransceiver("video", { direction: "sendrecv" });
  var mayNegotiate = initiator;

  pc.onnegotiationneeded = async function () {
    if (!mayNegotiate) {
      // Answering side, before the first offer arrives. Renegotiation after
      // that point (a camera turning on, say) is allowed from either side.
      return;
    }
    try {
      makingOffer = true;
      await pc.setLocalDescription();
      send({ type: "rtc-description", to: peerId, description: pc.localDescription.toJSON() });
    } catch (e) {
      console.warn("TogetherJS RTC: negotiation failed for", peerId, e);
    } finally {
      makingOffer = false;
    }
  };

  pc.onicecandidate = function (event) {
    // A null candidate signals end-of-candidates; forward it as-is.
    send({
      type: "rtc-ice",
      to: peerId,
      candidate: event.candidate ? event.candidate.toJSON() : null,
    });
  };

  pc.ontrack = function (event) {
    if (onTrack) {
      onTrack(event.track, event.streams[0], peerId);
    }
  };

  pc.onconnectionstatechange = function () {
    if (onStateChange) {
      onStateChange(pc.connectionState, peerId);
    }
  };

  pc.oniceconnectionstatechange = function () {
    var state = pc.iceConnectionState;
    if (state === "failed") {
      // Only one side should restart, or the two restarts race each other.
      if (!polite) {
        pc.restartIce();
      }
      return;
    }
    if (state === "disconnected") {
      // "disconnected" often recovers by itself, so give it a moment before
      // forcing an ICE restart.
      clearTimeout(disconnectTimer);
      disconnectTimer = setTimeout(function () {
        if (pc.iceConnectionState === "disconnected" && !polite) {
          pc.restartIce();
        }
      }, 5000);
      return;
    }
    clearTimeout(disconnectTimer);
  };

  async function drainCandidates() {
    var queued = pendingCandidates;
    pendingCandidates = [];
    for (var i = 0; i < queued.length; i++) {
      try {
        await pc.addIceCandidate(queued[i]);
      } catch (e) {
        if (!ignoreOffer) {
          console.warn("TogetherJS RTC: could not add queued candidate", e);
        }
      }
    }
  }

  var connection = {
    peerId: peerId,
    polite: polite,
    pc: pc,

    /** Handle an incoming description (offer or answer) from this peer. */
    handleDescription: async function (description) {
      if (closed) {
        return;
      }
      // An offer arriving while we are mid-offer, or while the signaling state
      // is anything but stable, is a collision.
      var collision =
        description.type === "offer" && (makingOffer || pc.signalingState !== "stable");
      ignoreOffer = !polite && collision;
      if (ignoreOffer) {
        // The polite peer will roll back and accept ours instead.
        return;
      }
      try {
        // setRemoteDescription performs the implicit rollback when we are the
        // polite peer in a collision.
        await pc.setRemoteDescription(description);
        mayNegotiate = true;
        await drainCandidates();
        if (description.type === "offer") {
          await pc.setLocalDescription();
          send({ type: "rtc-description", to: peerId, description: pc.localDescription.toJSON() });
        }
        ignoreOffer = false;
      } catch (e) {
        console.warn("TogetherJS RTC: could not apply description from", peerId, e);
      }
    },

    /** Handle an incoming ICE candidate from this peer. */
    handleCandidate: async function (candidate) {
      if (closed) {
        return;
      }
      if (!pc.remoteDescription) {
        pendingCandidates.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(candidate);
      } catch (e) {
        // Expected when we deliberately ignored an offer; otherwise worth
        // knowing about.
        if (!ignoreOffer) {
          console.warn("TogetherJS RTC: could not add candidate from", peerId, e);
        }
      }
    },

    /* The track setters can race a close(): the mesh resets a connection while
       its tracks are still being attached. replaceTrack() throws on a closed
       connection, so short-circuit rather than letting that surface. */

    /** Send (or stop sending) a local audio track. */
    setAudioTrack: function (track) {
      if (closed) {
        return Promise.resolve();
      }
      return audioTransceiver.sender.replaceTrack(track || null);
    },

    /** Send (or stop sending) a local video track. */
    setVideoTrack: function (track) {
      if (closed) {
        return Promise.resolve();
      }
      return videoTransceiver.sender.replaceTrack(track || null);
    },

    get closed() {
      return closed;
    },

    /** True when we offered and nothing ever came back — which happens when
        the peer was not in the call yet and dropped our offer. */
    isUnanswered: function () {
      return pc.signalingState === "have-local-offer" && !pc.remoteDescription;
    },

    get connectionState() {
      return pc.connectionState;
    },

    close: function () {
      if (closed) {
        return;
      }
      closed = true;
      clearTimeout(disconnectTimer);
      pc.onnegotiationneeded = null;
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      // The old abort() dropped the connection object without ever calling
      // close(), leaking the underlying transport.
      pc.close();
    },
  };

  return connection;
}
