/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* One RTCPeerConnection per remote peer.
 *
 * The previous implementation held a single module-level connection and
 * broadcast its offers to the whole room, so a third participant made every
 * client fight over the same connection. This keeps a connection per peer,
 * keyed by clientId, and addresses every signaling message.
 *
 * A full mesh costs O(n^2) uplink, so it is capped (maxRtcPeers, default 6).
 * Past that the honest answer is an SFU, not a slower mesh, so we refuse the
 * connection and say so rather than degrading silently.
 */

import TogetherJS from "../core/togetherjs.js";
import util from "../core/util.js";
import session from "../core/session.js";
import peers from "../core/peers.js";
import media from "./media.js";
import { PeerConnection } from "./connection.js";

var mesh = util.mixinEvents(util.Module("rtcMesh"));
mesh._knownEvents = ["track", "peer-state", "connection-state", "capacity", "error"];

var connections = new Map();
/* connectTo() awaits the ICE configuration, so two callers can race for the
   same peer — an rtc-join and an incoming offer arriving together, say. The
   in-flight promises are shared so a peer only ever gets one connection.
   Each attempt carries an epoch: disconnectFrom() bumps it, so a creation
   that was already in flight when the peer was reset knows to throw its
   connection away instead of overwriting the newer one. */
var connecting = new Map();
var epochs = new Map();
/* Candidates that arrive before the connection object exists.
   Creating a connection is asynchronous (it awaits the ICE configuration),
   and the candidates for an offer follow immediately behind it, so without
   this the first few are silently dropped and the handshake can stall. */
var earlyCandidates = new Map();

function bumpEpoch(peerId) {
  var next = (epochs.get(peerId) || 0) + 1;
  epochs.set(peerId, next);
  return next;
}
/** Live audio/video/muted state reported by each peer, for the UI. */
var peerState = new Map();
var active = false;

var DEFAULT_ICE = [{ urls: "stun:stun.l.google.com:19302" }];

/** Resolve the ICE configuration, giving the host page a chance to mint
    short-lived TURN credentials per connection. */
async function iceConfiguration() {
  var getIceServers = TogetherJS.config.get("getIceServers");
  if (typeof getIceServers === "function") {
    try {
      var servers = await getIceServers();
      if (servers && servers.length) {
        return { iceServers: servers };
      }
    } catch (e) {
      console.warn("TogetherJS RTC: getIceServers failed, falling back to STUN", e);
    }
  }
  var configured = TogetherJS.config.get("iceServers");
  return { iceServers: configured && configured.length ? configured : DEFAULT_ICE };
}

function capacityReached() {
  var max = TogetherJS.config.get("maxRtcPeers") || 6;
  return connections.size >= max;
}

/* Exactly one side of each pair opens the connection.
 *
 * Both sides calling connectTo() means both build an RTCPeerConnection and
 * offer, and the two objects can end up negotiating against each other's
 * discarded counterpart — which shows up as a connection that completes its
 * SDP exchange and then never starts ICE. Perfect negotiation resolves
 * colliding offers on *one* connection; it cannot merge two.
 *
 * So the peer with the lower clientId opens; the other waits and creates its
 * connection when the offer arrives. Perfect negotiation still earns its keep
 * for renegotiation later, when either side may turn a camera on. */
function isInitiatorFor(peerId) {
  return session.clientId < peerId;
}

/** Peers that support RTC, are still live, and are not us. */
function eligiblePeers() {
  return peers.getAllPeers(true).filter(function (peer) {
    return !peer.isSelf && peer.rtcSupported;
  });
}

function connectTo(peerId) {
  if (connections.has(peerId) || peerId === session.clientId) {
    return Promise.resolve(connections.get(peerId) || null);
  }
  var inFlight = connecting.get(peerId);
  if (inFlight) {
    return inFlight;
  }
  if (capacityReached()) {
    mesh.emit("capacity", peerId);
    console.warn(
      "TogetherJS RTC: refusing connection to",
      peerId,
      "— maxRtcPeers reached. A mesh past this size needs an SFU.",
    );
    return Promise.resolve(null);
  }
  var epoch = epochs.get(peerId) || 0;
  var promise = createConnection(peerId, epoch).finally(function () {
    // Only clear our own entry: a reset may already have replaced it.
    if (connecting.get(peerId) === promise) {
      connecting.delete(peerId);
    }
  });
  connecting.set(peerId, promise);
  return promise;
}

async function createConnection(peerId, epoch) {
  var configuration = await iceConfiguration();
  if ((epochs.get(peerId) || 0) !== epoch) {
    // The peer was reset while we awaited the config; a newer attempt owns
    // this slot now.
    return connections.get(peerId) || null;
  }

  var connection = PeerConnection({
    peerId: peerId,
    selfId: session.clientId,
    initiator: isInitiatorFor(peerId),
    configuration: configuration,
    send: function (msg) {
      session.send(msg);
    },
    onTrack: function (track, stream, fromId) {
      mesh.emit("track", { track: track, stream: stream, peerId: fromId });
    },
    onStateChange: function (state, fromId) {
      mesh.emit("connection-state", { peerId: fromId, state: state });
      if (state === "failed" || state === "closed") {
        // Leave "disconnected" alone: connection.js gives ICE a chance to
        // recover before anything is torn down.
        mesh.disconnectFrom(fromId);
      }
    },
  });
  if ((epochs.get(peerId) || 0) !== epoch) {
    connection.close();
    return connections.get(peerId) || null;
  }
  connections.set(peerId, connection);

  var queued = earlyCandidates.get(peerId);
  if (queued) {
    earlyCandidates.delete(peerId);
    queued.forEach(function (candidate) {
      connection.handleCandidate(candidate);
    });
  }

  // Attach whatever we are already sending. Adding the tracks fires
  // onnegotiationneeded, which starts the handshake.
  await applyLocalTracks(connection);
  return connection;
}

async function applyLocalTracks(connection) {
  if (connection.closed) {
    return;
  }
  await connection.setAudioTrack(media.get("audio"));
  await connection.setVideoTrack(media.get("video"));
}

/** Push the current local tracks onto every open connection. */
mesh.syncLocalTracks = async function () {
  var updates = [];
  connections.forEach(function (connection) {
    updates.push(applyLocalTracks(connection));
  });
  await Promise.all(updates);
  mesh.broadcastState();
};

/** Tell peers what we are sending, so they can show mute/camera badges. An
    audio track that is merely disabled still sends silence, so this is the
    only way for them to know. */
mesh.broadcastState = function () {
  if (!active) {
    return;
  }
  var state = media.state();
  session.send({ type: "rtc-state", audio: state.audio, video: state.video });
};

/** Open connections to every eligible peer.
 *
 * Announcing the join first matters. Perfect negotiation only converges if no
 * signaling is dropped, but a peer that has not joined the call cannot answer
 * an offer — so a caller who offered too early would sit in have-local-offer
 * forever. The rtc-join broadcast tells peers already in the call to discard
 * any half-open connection to us and start again from a clean state. */
mesh.start = async function () {
  active = true;
  // Announce first: peers already in the call use this both to know we can
  // answer now, and to start the connection when they are the initiator.
  session.send({ type: "rtc-join" });
  var targets = eligiblePeers();
  for (var i = 0; i < targets.length; i++) {
    var peerId = targets[i].id;
    resetIfUnanswered(peerId);
    if (isInitiatorFor(peerId)) {
      await connectTo(peerId);
    }
    // Otherwise they will offer us, prompted by the rtc-join above.
  }
  mesh.broadcastState();
};

/* Drop a connection only if its offer was never answered.
 *
 * There is exactly one situation this exists for: we offered while the peer
 * had not joined the call yet, so they dropped the offer and we are parked in
 * have-local-offer with no remote description, forever. That connection has
 * to be rebuilt.
 *
 * Anything else must be left alone. Resetting on "not yet connected" also
 * kills connections that are merely still gathering candidates, and with
 * three peers each announcing a join, connections get torn down mid-handshake
 * over and over and never settle. */
function resetIfUnanswered(peerId) {
  var connection = connections.get(peerId);
  if (connection && connection.isUnanswered()) {
    mesh.disconnectFrom(peerId);
  }
}

mesh.disconnectFrom = function (peerId) {
  bumpEpoch(peerId);
  connecting.delete(peerId);
  earlyCandidates.delete(peerId);
  var connection = connections.get(peerId);
  if (!connection) {
    return;
  }
  connection.close();
  connections.delete(peerId);
  peerState.delete(peerId);
  mesh.emit("peer-state", { peerId: peerId, gone: true });
};

/** Tear the whole mesh down and stop the local devices. */
mesh.stop = function () {
  active = false;
  connections.forEach(function (connection) {
    connection.close();
  });
  connections.forEach(function (connection, peerId) {
    bumpEpoch(peerId);
  });
  connections.clear();
  connecting.clear();
  earlyCandidates.clear();
  peerState.clear();
  media.stopAll();
  mesh.emit("peer-state", { all: true, gone: true });
};

mesh.isActive = function () {
  return active;
};

mesh.peerIds = function () {
  return Array.from(connections.keys());
};

mesh.stateFor = function (peerId) {
  return peerState.get(peerId) || null;
};

mesh.size = function () {
  return connections.size;
};

/* For the end-to-end tests, which assert on connectionState and getStats().
   Not part of the supported API. */
mesh._connectionFor = function (peerId) {
  return connections.get(peerId) || null;
};

/****************************************
 * Signaling
 */

/* Someone joined the call. If we are in it too, reset our connection to them
   and negotiate afresh; both sides may now offer at once, which is exactly the
   collision perfect negotiation exists to resolve. */
session.hub.on("rtc-join", function (msg) {
  if (msg.clientId === session.clientId) {
    return;
  }
  if (!active) {
    // The UI pulses the button to show an incoming call; answering runs start().
    mesh.emit("peer-state", { peerId: msg.clientId, calling: true });
    return;
  }
  resetIfUnanswered(msg.clientId);
  if (isInitiatorFor(msg.clientId)) {
    connectTo(msg.clientId).then(function () {
      mesh.broadcastState();
    });
  } else {
    mesh.broadcastState();
  }
});

session.hub.on("rtc-description", function (msg) {
  if (msg.clientId === session.clientId) {
    return;
  }
  var connection = connections.get(msg.clientId);
  if (!connection) {
    if (!active) {
      // We have not joined, so we cannot answer. The peer will re-offer when
      // we send our own rtc-join.
      mesh.emit("peer-state", { peerId: msg.clientId, calling: true });
      return;
    }
    connectTo(msg.clientId).then(function (created) {
      if (created) {
        created.handleDescription(msg.description);
      }
    });
    return;
  }
  connection.handleDescription(msg.description);
});

session.hub.on("rtc-ice", function (msg) {
  if (msg.clientId === session.clientId) {
    return;
  }
  var connection = connections.get(msg.clientId);
  if (connection) {
    connection.handleCandidate(msg.candidate);
    return;
  }
  if (!active) {
    return;
  }
  // The connection is probably still being built; hold on to this.
  if (!earlyCandidates.has(msg.clientId)) {
    earlyCandidates.set(msg.clientId, []);
  }
  earlyCandidates.get(msg.clientId).push(msg.candidate);
});

session.hub.on("rtc-state", function (msg) {
  if (msg.clientId === session.clientId) {
    return;
  }
  peerState.set(msg.clientId, { audio: !!msg.audio, video: !!msg.video });
  mesh.emit("peer-state", { peerId: msg.clientId, audio: !!msg.audio, video: !!msg.video });
});

/* A peer that reloads or navigates away tears down its side without us seeing
   a state change, so treat a fresh hello as a reset for that peer. */
/* A peer that reloads or navigates away tears down its side without us seeing
   a state change, so a fresh hello resets that peer. They will send their own
   rtc-join if they rejoin the call. */
session.hub.on("hello", function (msg) {
  if (msg.clientId === session.clientId) {
    return;
  }
  mesh.disconnectFrom(msg.clientId);
});

/* peers.js has no dedicated "bye" event; leaving is a status change. */
peers.on("status-updated", function (peer) {
  if (peer.status !== "live" && !peer.isSelf) {
    mesh.disconnectFrom(peer.id);
  }
});

session.on("close", function () {
  mesh.stop();
});

media.on("change", function () {
  if (active) {
    mesh.syncLocalTracks();
  }
});

export default mesh;
