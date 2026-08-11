/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// WebRTC support -- Note that this relies on parts of the interface code that usually goes in ui.js

import $ from "jquery";
import util from "../core/util.js";
import session from "../core/session.js";
import ui from "../ui/ui.js";
import peers from "../core/peers.js";
import storage from "../core/storage.js";
import windowing from "../ui/windowing.js";

var webrtc = util.Module("webrtc");
var assert = util.assert;

session.RTCSupported = !!window.RTCPeerConnection;

// Passed to createOffer(); createAnswer() needs no equivalent since the
// answerer's directions are dictated by the received offer.
var offerOptions = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: false
};

function makePeerConnection() {
  return new RTCPeerConnection({
    iceServers: [{urls: "stun:stun.l.google.com:19302"}]
  });
}

function getUserMedia(options, success, failure) {
  failure = failure || function (error) {
    console.error("Error in getUserMedia:", error);
  };
  navigator.mediaDevices.getUserMedia(options).then(success, failure);
}

/****************************************
 * getUserMedia Avatar support
 */

session.on("ui-ready", function () {
  $("#togetherjs-self-avatar").click(function () {
    var avatar = peers.Self.avatar;
    if (avatar) {
      $preview.attr("src", avatar);
    }
    ui.displayToggle("#togetherjs-avatar-edit");
  });
  if (! session.RTCSupported) {
    $("#togetherjs-avatar-edit-rtc").hide();
  }

  var avatarData = null;
  var $preview = $("#togetherjs-self-avatar-preview");
  var $accept = $("#togetherjs-self-avatar-accept");
  var $cancel = $("#togetherjs-self-avatar-cancel");
  var $takePic = $("#togetherjs-avatar-use-camera");
  var $video = $("#togetherjs-avatar-video");
  var $upload = $("#togetherjs-avatar-upload");

  $takePic.click(function () {
    if (! streaming) {
      startStreaming();
      return;
    }
    takePicture();
  });

  function savePicture(dataUrl) {
    avatarData = dataUrl;
    $preview.attr("src", avatarData);
    $accept.attr("disabled", null);
  }

  $accept.click(function () {
    peers.Self.update({avatar:  avatarData});
    ui.displayToggle("#togetherjs-no-avatar-edit");
    // FIXME: these probably shouldn't be two elements:
    $("#togetherjs-participants-other").show();
    $accept.attr("disabled", "1");
  });

  $cancel.click(function () {
    ui.displayToggle("#togetherjs-no-avatar-edit");
    // FIXME: like above:
    $("#togetherjs-participants-other").show();
  });

  var streaming = false;
  function startStreaming() {
    getUserMedia({
        video: true,
        audio: false
      },
      function(stream) {
        streaming = true;
        $video[0].srcObject = stream;
        $video[0].play();
      },
      function(err) {
        // FIXME: should pop up help or something in the case of a user
        // cancel
        console.error("getUserMedia error:", err);
      }
    );
  }

  function takePicture() {
    assert(streaming);
    var height = $video[0].videoHeight;
    var width = $video[0].videoWidth;
    width = width * (session.AVATAR_SIZE / height);
    height = session.AVATAR_SIZE;
    var $canvas = $("<canvas>");
    $canvas[0].height = session.AVATAR_SIZE;
    $canvas[0].width = session.AVATAR_SIZE;
    var context = $canvas[0].getContext("2d");
    context.arc(session.AVATAR_SIZE/2, session.AVATAR_SIZE/2, session.AVATAR_SIZE/2, 0, Math.PI*2);
    context.closePath();
    context.clip();
    context.drawImage($video[0], (session.AVATAR_SIZE - width) / 2, 0, width, height);
    savePicture($canvas[0].toDataURL("image/png"));
  }

  $upload.on("change", function () {
    var reader = new FileReader();
    reader.onload = function () {
      // FIXME: I don't actually know it's JPEG, but it's probably a
      // good enough guess:
      var url = "data:image/jpeg;base64," + util.blobToBase64(this.result);
      convertImage(url, function (result) {
        savePicture(result);
      });
    };
    reader.onerror = function () {
      console.error("Error reading file:", this.error);
    };
    reader.readAsArrayBuffer(this.files[0]);
  });

  function convertImage(imageUrl, callback) {
    var $canvas = $("<canvas>");
    $canvas[0].height = session.AVATAR_SIZE;
    $canvas[0].width = session.AVATAR_SIZE;
    var context = $canvas[0].getContext("2d");
    var img = new Image();
    img.src = imageUrl;
    // Sometimes the DOM updates immediately to call
    // naturalWidth/etc, and sometimes it doesn't; using setTimeout
    // gives it a chance to catch up
    setTimeout(function () {
      var width = img.naturalWidth || img.width;
      var height = img.naturalHeight || img.height;
      width = width * (session.AVATAR_SIZE / height);
      height = session.AVATAR_SIZE;
      context.drawImage(img, 0, 0, width, height);
      callback($canvas[0].toDataURL("image/png"));
    });
  }

});

/****************************************
 * RTC support
 */

function audioButton(selector) {
  ui.displayToggle(selector);
  if (selector == "#togetherjs-audio-incoming") {
    $("#togetherjs-audio-button").addClass("togetherjs-animated").addClass("togetherjs-color-alert");
  } else {
    $("#togetherjs-audio-button").removeClass("togetherjs-animated").removeClass("togetherjs-color-alert");
  }
}

session.on("ui-ready", function () {
  $("#togetherjs-audio-button").click(function () {
    if ($("#togetherjs-rtc-info").is(":visible")) {
      windowing.hide();
      return;
    }
    if (session.RTCSupported) {
      enableAudio();
    } else {
      windowing.show("#togetherjs-rtc-not-supported");
    }
  });

  if (! session.RTCSupported) {
    audioButton("#togetherjs-audio-unavailable");
    return;
  }
  audioButton("#togetherjs-audio-ready");

  var audioStream = null;
  var accepted = false;
  var connected = false;
  var $audio = $("#togetherjs-audio-element");
  var offerSent = null;
  var offerReceived = null;
  var offerDescription = false;
  var answerSent = null;
  var answerReceived = null;
  var answerDescription = false;
  var _connection = null;
  var iceCandidate = null;

  function enableAudio() {
    accepted = true;
    storage.settings.get("dontShowRtcInfo").then(function (dontShow) {
      if (! dontShow) {
        windowing.show("#togetherjs-rtc-info");
      }
    });
    if (! audioStream) {
      startStreaming(connect);
      return;
    }
    if (! connected) {
      connect();
    }
    toggleMute();
  }

  ui.container.find("#togetherjs-rtc-info .togetherjs-dont-show-again").change(function () {
    storage.settings.set("dontShowRtcInfo", this.checked);
  });

  function error() {
    console.warn.apply(console, arguments);
    var s = "";
    for (var i=0; i<arguments.length; i++) {
      if (s) {
        s += " ";
      }
      var a = arguments[i];
      if (typeof a == "string") {
        s += a;
      } else {
        var repl;
        try {
          repl = JSON.stringify(a);
        } catch (e) {
        }
        if (! repl) {
          repl = "" + a;
        }
        s += repl;
      }
    }
    audioButton("#togetherjs-audio-error");
    // FIXME: this title doesn't seem to display?
    $("#togetherjs-audio-error").attr("title", s);
  }

  function startStreaming(callback) {
    getUserMedia(
      {
        video: false,
        audio: true
      },
      function (stream) {
        audioStream = stream;
        attachMedia("#togetherjs-local-audio", stream);
        if (callback) {
          callback();
        }
      },
      function (err) {
        // FIXME: handle cancel case
        if (err && err.code == 1) {
          // User cancel
          return;
        }
        error("getUserMedia error:", err);
      }
    );
  }

  function attachMedia(element, media) {
    element = $(element)[0];
    element.autoplay = true;
    element.srcObject = media;
    var playing = element.play();
    if (playing && playing.catch) {
      playing.catch(function (err) {
        // Autoplay can be blocked until the user interacts with the page;
        // the call is still connected, just silent until then.
        console.warn("Could not autoplay media:", err);
      });
    }
  }

  function getConnection() {
    assert(audioStream);
    if (_connection) {
      return _connection;
    }
    try {
      _connection = makePeerConnection();
    } catch (e) {
      error("Error creating PeerConnection:", e);
      throw e;
    }
    _connection.ontrack = function (event) {
      attachMedia($audio, event.streams[0]);
      audioButton("#togetherjs-audio-active");
    };
    _connection.onconnectionstatechange = function () {
      var state = _connection.connectionState;
      if (state == "closed" || state == "failed" || state == "disconnected") {
        audioButton("#togetherjs-audio-ready");
      }
    };
    _connection.onicecandidate = function (event) {
      if (event.candidate) {
        session.send({
          type: "rtc-ice-candidate",
          candidate: {
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
            candidate: event.candidate.candidate
          }
        });
      }
    };
    audioStream.getTracks().forEach(function (track) {
      _connection.addTrack(track, audioStream);
    });
    return _connection;
  }

  function addIceCandidate() {
    if (iceCandidate) {
      console.log("adding ice", iceCandidate);
      _connection.addIceCandidate(new RTCIceCandidate(iceCandidate));
    }
  }

  function connect() {
    var connection = getConnection();
    if (offerReceived && (! offerDescription)) {
      connection.setRemoteDescription(
        new RTCSessionDescription({
          type: "offer",
          sdp: offerReceived
        })
      ).then(function () {
        offerDescription = true;
        addIceCandidate();
        connect();
      }, function (err) {
        error("Error doing RTC setRemoteDescription:", err);
      });
      return;
    }
    if (! (offerSent || offerReceived)) {
      connection.createOffer(offerOptions).then(function (offer) {
        return connection.setLocalDescription(offer).then(function () {
          session.send({
            type: "rtc-offer",
            offer: offer.sdp
          });
          offerSent = offer;
          audioButton("#togetherjs-audio-outgoing");
        }, function (err) {
          error("Error doing RTC setLocalDescription:", err);
        });
      }, function (err) {
        error("Error doing RTC createOffer:", err);
      });
    } else if (! (answerSent || answerReceived)) {
      // FIXME: I might have only needed this due to my own bugs, this might
      // not actually time out
      var timeout = setTimeout(function () {
        if (! answerSent) {
          error("createAnswer Timed out; reload or restart browser");
        }
      }, 2000);
      connection.createAnswer().then(function (answer) {
        clearTimeout(timeout);
        return connection.setLocalDescription(answer).then(function () {
          session.send({
            type: "rtc-answer",
            answer: answer.sdp
          });
          answerSent = answer;
        }, function (err) {
          error("Error doing RTC setLocalDescription:", err);
        });
      }, function (err) {
        clearTimeout(timeout);
        error("Error doing RTC createAnswer:", err);
      });
    }
  }

  function toggleMute() {
    // FIXME: implement.  Actually, wait for this to be implementable - currently
    // muting of localStreams isn't possible
    // FIXME: replace with hang-up?
  }

  session.hub.on("rtc-offer", function (msg) {
    if (offerReceived || answerSent || answerReceived || offerSent) {
      abort();
    }
    offerReceived = msg.offer;
    if (! accepted) {
      audioButton("#togetherjs-audio-incoming");
      return;
    }
    function run() {
      var connection = getConnection();
      connection.setRemoteDescription(
        new RTCSessionDescription({
          type: "offer",
          sdp: offerReceived
        })
      ).then(function () {
        offerDescription = true;
        addIceCandidate();
        connect();
      }, function (err) {
        error("Error doing RTC setRemoteDescription:", err);
      });
    }
    if (! audioStream) {
      startStreaming(run);
    } else {
      run();
    }
  });

  session.hub.on("rtc-answer", function (msg) {
    if (answerSent || answerReceived || offerReceived || (! offerSent)) {
      abort();
      // Basically we have to abort and try again.  We'll expect the other
      // client to restart when appropriate
      session.send({type: "rtc-abort"});
      return;
    }
    answerReceived = msg.answer;
    assert(offerSent);
    assert(audioStream);
    var connection = getConnection();
    connection.setRemoteDescription(
      new RTCSessionDescription({
        type: "answer",
        sdp: answerReceived
      })
    ).then(function () {
      answerDescription = true;
      // FIXME: I don't think this connect is ever needed?
      connect();
    }, function (err) {
      error("Error doing RTC setRemoteDescription:", err);
    });
  });

  session.hub.on("rtc-ice-candidate", function (msg) {
    iceCandidate = msg.candidate;
    if (offerDescription || answerDescription) {
      addIceCandidate();
    }
  });

  session.hub.on("rtc-abort", function (msg) {
    abort();
    if (! accepted) {
      return;
    }
    if (! audioStream) {
      startStreaming(function () {
        connect();
      });
    } else {
      connect();
    }
  });

  session.hub.on("hello", function (msg) {
    // A peer reloading/navigating away tears down their end without us
    // getting an onconnectionstatechange for it, so reset here too:
    audioButton("#togetherjs-audio-ready");
    if (accepted && (offerSent || answerSent)) {
      abort();
      connect();
    }
  });

  function abort() {
    answerSent = answerReceived = offerSent = offerReceived = null;
    answerDescription = offerDescription = false;
    _connection = null;
    $audio[0].srcObject = null;
  }

});

export default webrtc;
