/* WebRTC support
   Note that this relies on parts of the interface code that usually goes in ui.js
   */
define(["require", "jquery", "util", "session", "ui"], function (require, $, util, session, ui) {
  var webrtc = util.Module("webrtc");
  var assert = util.assert;
  var AssertionError = util.AssertionError;

  session.RTCSupported = !!(window.mozRTCPeerConnection ||
                            window.webkitRTCPeerConnection ||
                            window.RTCPeerConnection);

  var URL = window.URL || window.webkitURL;
  var RTCSessionDescription = window.mozRTCSessionDescription || window.RTCSessionDescription;

  function makePeerConnection() {
    // Based roughly off: https://github.com/firebase/gupshup/blob/gh-pages/js/chat.js
    if (window.webkitRTCPeerConnection) {
      return new webkitRTCPeerConnection({
        "iceServers": [{"url": "stun:stun.l.google.com:19302"}]
      }, {
        "optional": [{"DtlsSrtpKeyAgreement": true}]
      });
    }
    if (window.mozRTCPeerConnection) {
      return new mozRTCPeerConnection({
        "iceServers": [{"url": "stun:23.21.150.121"}]
      }, {"optional": []});
    }
    throw AssertionError("Called makePeerConnection() without supported connection");
  }

  // FIXME: maybe shouldn't patch navigator
  navigator.getUserMedia = navigator.getUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.msGetUserMedia;

  /****************************************
   * getUserMedia Avatar support
   */

  var avatarEditState = {};

  session.on("ui-ready", function () {
    $("#towtruck-self-avatar").click(function () {
      var avatar = session.settings.get("avatar");
      if (avatar) {
        $preview.attr("src", avatar);
      }
      ui.displayToggle("#towtruck-avatar-edit");
    });
    if (! session.RTCSupported) {
      $("#towtruck-avatar-edit-rtc").hide();
    }

    var avatarData = null;
    var $preview = $("#towtruck-self-avatar-preview");
    var $accept = $("#towtruck-self-avatar-accept");
    var $cancel = $("#towtruck-self-avatar-cancel");
    var $takePic = $("#towtruck-avatar-use-camera");
    var $video = $("#towtruck-avatar-video");
    var $upload = $("#towtruck-avatar-upload");

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
      session.settings.set("avatar", avatarData);
      ui.displayToggle("#towtruck-no-avatar-edit");
      // FIXME: these probably shouldn't be two elements:
      $("#towtruck-participants-other").show();
      $accept.attr("disabled", "1");
    });

    $cancel.click(function () {
      ui.displayToggle("#towtruck-no-avatar-edit");
      // FIXME: like above:
      $("#towtruck-participants-other").show();
    });

    var streaming = false;
    function startStreaming() {
      navigator.getUserMedia({
          video: true,
          audio: false
        },
        function(stream) {
          streaming = true;
          $video[0].src = URL.createObjectURL(stream);
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

  session.on("ui-ready", function () {
    if (! session.RTCSupported) {
      ui.displayToggle("#towtruck-audio-unavailable");
      return;
    }
    ui.displayToggle("#towtruck-audio-ready");

    var audioStream = null;
    var accepted = false;
    var connected = false;
    var $audio = $("#towtruck-audio-element");
    var offerSent = null;
    var offerReceived = null;
    var offerDescription = false;
    var answerSent = null;
    var answerReceived = null;
    var answerDescription = false;
    var _connection = null;

    $("#towtruck-audio-button").click(function () {
      accepted = true;
      if (! audioStream) {
        startStreaming(connect);
        return;
      }
      if (! connected) {
        connect();
      }
      toggleMute();
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
      ui.displayToggle("#towtruck-audio-error");
      // FIXME: this title doesn't seem to display?
      $("#towtruck-audio-error").attr("title", s);
    }

    function startStreaming(callback) {
      navigator.getUserMedia(
        {
          video: false,
          audio: true
        },
        function (stream) {
          audioStream = stream;
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
      _connection.onaddstream = function (event) {
        for (var i=0; i<_connection.remoteStreams.length; i++) {
          var stream = _connection.remoteStreams[i];
          $audio[0].src = URL.createObjectURL(stream);
          $audio[0].play();
          ui.displayToggle("#towtruck-audio-active");
        }
      };
      _connection.onstatechange = function () {
        // FIXME: this doesn't seem to work:
        console.log("state change", _connection.readyState);
        if (_connection.readyState == "closed") {
          ui.displayToggle("#towtruck-audio-ready");
        }
      };
      _connection.addStream(audioStream);
      return _connection;
    }

    function connect() {
      var connection = getConnection();
      if (offerReceived && (! offerDescription)) {
        connection.setRemoteDescription(
          new RTCSessionDescription({
            type: "offer",
            sdp: offerReceived
          }),
          function () {
            offerDescription = true;
            connect();
          },
          function (err) {
            error("Error doing RTC setRemoteDescription:", err);
          }
        );
        return;
      }
      if (! (offerSent || offerReceived)) {
        connection.createOffer(function (offer) {
          connection.setLocalDescription(
            offer,
            function () {
              session.send({
                type: "rtc-offer",
                offer: offer.sdp
              });
              offerSent = offer;
              ui.displayToggle("#towtruck-audio-outgoing");
            },
            function (err) {
              error("Error doing RTC setLocalDescription:", err);
            }
          );
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
        connection.createAnswer(function (answer) {
          clearTimeout(timeout);
          connection.setLocalDescription(
            answer,
            function () {
              session.send({
                type: "rtc-answer",
                answer: answer.sdp
              });
              answerSent = answer;
            },
            function (err) {
              clearTimeout(timeout);
              error("Error doing RTC setLocalDescription:", err);
            }
          );
        }, function (err) {
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
        ui.displayToggle("#towtruck-audio-incoming");
        return;
      }
      function run() {
        var connection = getConnection();
        connection.setRemoteDescription(
          new RTCSessionDescription({
            type: "offer",
            sdp: offerReceived
          }),
          function () {
            offerDescription = true;
            connect();
          },
          function (err) {
            error("Error doing RTC setRemoteDescription:", err);
          }
        );
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
        }),
        function () {
          answerDescription = true;
          // FIXME: I don't think this connect is ever needed?
          connect();
        },
        function (err) {
          error("Error doing RTC setRemoteDescription:", err);
        }
      );
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
      // FIXME: displayToggle should be set due to
      // _connection.onstatechange, but that's not working, so
      // instead:
      ui.displayToggle("#towtruck-audio-ready");
      if (accepted && (offerSent || answerSent)) {
        abort();
        connect();
      }
    });

    function abort() {
      answerSent = answerReceived = offerSent = offerReceived = null;
      answerDescription = offerDescription = false;
      _connection = null;
      $audio[0].removeAttribute("src");
    }

  });

  return webrtc;

});
