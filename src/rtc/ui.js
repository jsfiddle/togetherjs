/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* The call's user interface: the dock buttons and the video panel.
 *
 * Audio playback is deliberately kept out of the video tiles — one hidden
 * <audio> element per peer — so that closing the video panel does not mute
 * the call.
 */

import TogetherJS from "../core/togetherjs.js";
import $ from "../dom/dom.js";
import util from "../core/util.js";
import session from "../core/session.js";
import peers from "../core/peers.js";
import windowing from "../ui/windowing.js";
import ui from "../ui/ui.js";
import storage from "../core/storage.js";
import media, { mediaSupported, requiresSecureContext } from "./media.js";
import mesh from "./mesh.js";

var rtcUi = util.Module("rtcUi");

/** Audio sinks and video tiles, keyed by peer clientId. */
var audioElements = new Map();
var videoTiles = new Map();

/* The button's states. The old markup split these into "outgoing" and
   "incoming", a distinction that only made sense when there was exactly one
   1:1 offer in flight; with a mesh the button reflects our own state. */
function audioButton(state) {
  var selector = "#togetherjs-audio-" + state;
  if (!$(selector).length) {
    return;
  }
  ui.displayToggle(selector);
  var button = $("#togetherjs-audio-button");
  if (state === "incoming") {
    button.addClass("togetherjs-animated").addClass("togetherjs-color-alert");
  } else {
    button.removeClass("togetherjs-animated").removeClass("togetherjs-color-alert");
  }
}

function videoButtonState(on) {
  $("#togetherjs-video-button").toggleClass("togetherjs-rtc-on", !!on);
}

function refreshButtons() {
  if (!mesh.isActive()) {
    audioButton("ready");
  } else if (media.isMuted()) {
    audioButton("muted");
  } else if (media.hasAudio()) {
    audioButton("active");
  } else {
    audioButton("ready");
  }
  videoButtonState(media.hasVideo());
  updateSelfPreview();
}

/****************************************
 * Media elements
 */

function audioElementFor(peerId) {
  var existing = audioElements.get(peerId);
  if (existing) {
    return existing;
  }
  var el = document.createElement("audio");
  el.autoplay = true;
  el.setAttribute("data-togetherjs-peer", peerId);
  ui.container.append($(el));
  audioElements.set(peerId, el);
  return el;
}

function attach(el, stream) {
  el.srcObject = stream;
  var playing = el.play();
  if (playing && playing.catch) {
    playing.catch(function (err) {
      // Autoplay can be blocked until the user interacts with the page; the
      // call is connected either way, just silent until then.
      console.warn("TogetherJS RTC: could not autoplay media:", err);
    });
  }
}

function tileFor(peerId) {
  var existing = videoTiles.get(peerId);
  if (existing) {
    return existing;
  }
  var peer = peers.getPeer(peerId, null, true);
  var tile = $(
    '<div class="togetherjs-video-tile">' +
      '<video autoplay playsinline></video>' +
      '<div class="togetherjs-video-avatar"></div>' +
      '<div class="togetherjs-video-label"><span class="togetherjs-video-name"></span>' +
      '<span class="togetherjs-video-muted" title="Muted">&#128263;</span></div>' +
      "</div>",
  );
  tile.attr("data-togetherjs-peer", peerId);
  tile.find(".togetherjs-video-name").text(peer ? peer.name || peer.defaultName : "");
  if (peer && peer.avatar) {
    tile.find(".togetherjs-video-avatar").css({ backgroundImage: "url(" + peer.avatar + ")" });
  }
  if (peer && peer.color) {
    tile.css({ borderColor: peer.color });
  }
  $("#togetherjs-video-tiles").append(tile);
  videoTiles.set(peerId, tile);
  return tile;
}

function removePeerMedia(peerId) {
  var audio = audioElements.get(peerId);
  if (audio) {
    audio.srcObject = null;
    $(audio).remove();
    audioElements.delete(peerId);
  }
  var tile = videoTiles.get(peerId);
  if (tile) {
    tile.remove();
    videoTiles.delete(peerId);
  }
  refreshVideoPanel();
}

function removeAllPeerMedia() {
  Array.from(audioElements.keys()).forEach(removePeerMedia);
  Array.from(videoTiles.keys()).forEach(removePeerMedia);
}

/** The self-preview is the first tile, mirrored so it reads like a mirror. */
function updateSelfPreview() {
  var tile = $("#togetherjs-video-self");
  if (!tile.length) {
    return;
  }
  var video = tile.find("video")[0];
  var track = media.get("video");
  if (track) {
    if (!video.srcObject || video.srcObject.getVideoTracks()[0] !== track) {
      attach(video, new MediaStream([track]));
    }
    tile.show();
  } else {
    video.srcObject = null;
    tile.hide();
  }
}

function refreshVideoPanel() {
  var hasTiles = videoTiles.size > 0 || media.hasVideo();
  $("#togetherjs-video-empty").toggleClass("togetherjs-hidden", hasTiles);
}

/****************************************
 * Wiring
 */

session.on("ui-ready", function () {
  // Feature detection. navigator.mediaDevices is undefined on insecure
  // origins, so an http:// page lands in "requires HTTPS" rather than
  // appearing to work and then failing inside getUserMedia.
  if (!session.RTCSupported) {
    audioButton("unavailable");
    $("#togetherjs-video-button").hide();
    return;
  }
  audioButton("ready");

  TogetherJS.config.track("enableVideo", function (enabled) {
    if (enabled) {
      $("#togetherjs-video-button").show();
    } else {
      $("#togetherjs-video-button").hide();
    }
  });

  $("#togetherjs-audio-button").click(function () {
    if ($("#togetherjs-rtc-info").is(":visible")) {
      windowing.hide();
      return;
    }
    if (!mediaSupported()) {
      windowing.show(
        requiresSecureContext() ? "#togetherjs-rtc-needs-https" : "#togetherjs-rtc-not-supported",
      );
      return;
    }
    if (!mesh.isActive()) {
      joinCall();
      return;
    }
    // Already in the call: the button toggles mute.
    media.toggleMute();
    mesh.broadcastState();
    refreshButtons();
  });

  $("#togetherjs-video-button").click(function () {
    if (!mediaSupported()) {
      windowing.show(
        requiresSecureContext() ? "#togetherjs-rtc-needs-https" : "#togetherjs-rtc-not-supported",
      );
      return;
    }
    if (media.hasVideo()) {
      media.stopVideo();
      refreshButtons();
      return;
    }
    media.startVideo().then(
      function () {
        if (!mesh.isActive()) {
          return joinCall();
        }
        windowing.show("#togetherjs-video");
        refreshButtons();
      },
      function (err) {
        reportMediaError(err);
      },
    );
  });

  $("#togetherjs-rtc-hangup").click(function () {
    mesh.stop();
    removeAllPeerMedia();
    windowing.hide();
    refreshButtons();
  });

  ui.container
    .find("#togetherjs-rtc-info .togetherjs-dont-show-again")
    .change(function () {
      storage.settings.set("dontShowRtcInfo", this.checked);
    });

  populateDevicePickers();
});

function reportMediaError(err) {
  console.warn("TogetherJS RTC: getUserMedia failed:", err);
  if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
    // The user declined, or the browser blocked it. Not an error state worth
    // a red button — just leave the call unjoined.
    audioButton("ready");
    return;
  }
  audioButton("error");
  $("#togetherjs-audio-error").attr("title", (err && err.message) || String(err));
}

async function joinCall() {
  try {
    await media.startAudio();
  } catch (err) {
    reportMediaError(err);
    return;
  }
  var dontShow = await storage.settings.get("dontShowRtcInfo");
  if (!dontShow) {
    windowing.show("#togetherjs-rtc-info");
  }
  await mesh.start();
  refreshButtons();
  populateDevicePickers();
}

/* Device labels are empty until permission has been granted, so the pickers
   are only worth filling in once the user is actually in the call. */
async function populateDevicePickers() {
  if (!mediaSupported()) {
    return;
  }
  var devices = await media.devices();
  [
    { kind: "audio", selector: "#togetherjs-rtc-audio-device" },
    { kind: "video", selector: "#togetherjs-rtc-video-device" },
  ].forEach(function (entry) {
    var select = $(entry.selector);
    if (!select.length) {
      return;
    }
    var list = devices[entry.kind];
    if (!list.length || !list[0].label) {
      select.closest(".togetherjs-rtc-device-row").hide();
      return;
    }
    select.closest(".togetherjs-rtc-device-row").show();
    select.empty();
    list.forEach(function (device) {
      var option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label;
      select[0].appendChild(option);
    });
    select.off("change").on("change", function () {
      media.useDevice(entry.kind, select.val()).then(function () {
        mesh.syncLocalTracks();
      });
    });
  });
}

/****************************************
 * Mesh events
 */

mesh.on("track", function (event) {
  if (event.track.kind === "audio") {
    attach(audioElementFor(event.peerId), event.stream);
  } else {
    var tile = tileFor(event.peerId);
    attach(tile.find("video")[0], event.stream);
    tile.addClass("togetherjs-video-live");
    refreshVideoPanel();
  }
  refreshButtons();
});

mesh.on("peer-state", function (event) {
  if (event.all && event.gone) {
    removeAllPeerMedia();
    return;
  }
  if (event.gone) {
    removePeerMedia(event.peerId);
    return;
  }
  if (event.calling && !mesh.isActive()) {
    // Someone started a call and we have not joined; pulse the button.
    audioButton("incoming");
    return;
  }
  var tile = videoTiles.get(event.peerId);
  if (tile) {
    tile.find(".togetherjs-video-muted").toggleClass("togetherjs-hidden", event.audio !== false);
    tile.toggleClass("togetherjs-video-live", !!event.video);
  }
  if (event.video === false) {
    // Camera off: drop the tile rather than showing a black rectangle.
    var existing = videoTiles.get(event.peerId);
    if (existing) {
      existing.remove();
      videoTiles.delete(event.peerId);
      refreshVideoPanel();
    }
  }
});

mesh.on("capacity", function () {
  windowing.show("#togetherjs-rtc-full");
});

media.on("change", refreshButtons);

export default rtcUi;
