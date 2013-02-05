/* WebRTC support
   Note that this relies on parts of the interface code that usually goes in ui.js
   */
define(["require", "jquery", "util", "session", "ui"], function (require, $, util, session, ui) {
  var webrtc = util.Module("webrtc");
  var assert = util.assert;

  var PeerConnection =
    window.mozRTCPeerConnection ||
    window.webkitRTCPeerConnection ||
    window.RTCPeerConnection;

  navigator.getUserMedia = navigator.getUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.msGetUserMedia;

  session.RTCSupported = !! PeerConnection;

  session.on("ui-ready", function () {
    if (! session.RTCSupported) {
      $(".towtruck-rtc, [data-activate='towtruck-rtc']").hide();
      return;
    }
    $("#towtruck-mute").click(function () {
      var video = $("#towtruck-video")[0];
      video.muted = ! video.muted;
      if (video.muted) {
        $("#towtruck-mute").text("Unmute");
      } else {
        $("#towtruck-mute").text("Mute");
      }
    });
  });

  function startPicPreview() {
    $("#towtruck-open-pic").show();
    $("#towtruck-open-pic").click(function () {
      $("#towtruck-open-pic").hide();
      $("#towtruck-pic-viewer").hide();
      $("#towtruck-accept-pic").hide();
      $("#towtruck-pic-container").show();
      if (! streaming) {
        startStreaming();
      }
    });

    function close() {
      $("#towtruck-open-pic").show();
      $("#towtruck-pic-container").hide();
    }
    $("#towtruck-pic-cancel").click(close);

    var video = $("#towtruck-pic-preview");
    var pic = $("#towtruck-pic-viewer");
    var streaming = false;
    assert(video.length);

    function startStreaming() {
      console.log("calling getUserMedia");
      navigator.getUserMedia({
          video: true,
          audio: false
        },
        function(stream) {
          if (navigator.mozGetUserMedia) {
            video[0].mozSrcObject = stream;
          } else {
            var vendorURL = window.URL || window.webkitURL;
            video[0].src = vendorURL.createObjectURL(stream);
          }
          video[0].play();
        },
        function(err) {
          // FIXME: should pop up help or something in the case of a user
          // cancel
          console.error("getUserMedia error:", err);
        }
      );
      console.log("done getUserMedia");
    }

    video.on("canplay", function () {
      // This keeps us from asking for getUserMedia more than once:
      streaming = true;
    });

    $("#towtruck-take-pic").click(function () {
      var height = video[0].clientHeight;
      var width = video[0].clientWidth;
      var canvas = $("<canvas>");
      canvas.css({height: height + "px", width: width + "px"});
      var context = canvas[0].getContext("2d");
      context.drawImage(video[0], 0, 0, width, height);
      var data = canvas[0].toDataURL("image/png");
      // FIXME: for some reason this image is truncated on the bottom,
      // but I don't know why
      pic.attr("src", data).show();
      $("#towtruck-accept-pic").show();
    });

    $("#towtruck-accept-pic").click(function () {
      var imgData = pic.attr("src");
      session.settings.set("avatar", imgData);
      session.send({type: "nickname-update", avatar: imgData});
      close();
      updatePreview();
    });

    function updatePreview() {
      var avatar = session.settings.get("avatar");
      if (avatar) {
        $("#towtruck-avatar-view-container").show();
        $("#towtruck-avatar-view").attr("src", avatar);
      } else {
        $("#towtruck-avatar-view-container").hide();
      }
    }

    updatePreview();

  }

  session.peers.on("add update", function (peer) {
    setupChatInterface();
  });

  function addStream(video, stream) {
    video = $(video)[0];
    if (navigator.mozGetUserMedia) {
      video.mozSrcObject = stream;
      console.log("Added stream", stream, "to", video, video.id);
    } //else {
      var vendorURL = window.URL || window.webkitURL;
      video.src = vendorURL.createObjectURL(stream);
    //}
  }

  function setupChatInterface() {
    if (! ui.container) {
      return;
    }
    var supported = false;
    session.peers.forEach(function (p) {
      if (p.rtcSupported) {
        supported = true;
      }
    });
    if (supported) {
      ui.container.find(".towtruck-start-video").show();
    } else {
      ui.container.find(".towtruck-start-video").hide();
      $("#towtruck-video").hide();
    }
    if (! setupChatInterface.bound) {
      $(".towtruck-start-video").click(startVideo);
      setupChatInterface.bound = true;
    }
  }

  var rtc = webrtc.rtc = {
    connection: null,
    offer: null,
    myOffer: null,
    answer: null,
    myAnswer: null,
    videoWanted: true
  };

  session.on("ui-showing-towtruck-rtc", function () {
    setupRTC();
  });

  session.hub.on("rtc-offer", function (msg) {
    rtc.offer = msg.offer;
    setDescription(msg.offer, function () {
      ui.activateTab("towtruck-rtc");
      setupRTC();
    });
  });

  session.hub.on("rtc-answer", function (msg) {
    rtc.answer = msg.answer;
    setDescription(msg.answer, function () {
      setupRTC();
    });
  });

  function startVideo() {
    rtc.videoWanted = true;
    setupRTC();
  }

  function makeConnection(callback) {
    if (rtc.connection) {
      callback(rtc.connection);
      return;
    }
    // FIXME: Chrome demands a configuration parameter here:
    console.log("creating PeerConnection", PeerConnection);
    var conn;
    try {
      conn = new PeerConnection();
    } catch (e) {
      // FIXME: should warn about Firefox and the about:config
      // media.peerconnection.enabled pref
      console.error("Error creating PeerConnection:", e);
      throw e;
    }
    console.log("PeerConnection created");
    conn.onaddstream = function (event) {
      console.log("onaddstream", event);
      console.log("streams", conn.remoteStreams, conn.remoteStreams.length);
      var video = $("#towtruck-video");
      for (var i=0; i<conn.remoteStreams.length; i++) {
        var s = conn.remoteStreams[i];
        addStream(video, s);
      }
      addStream(video, event.stream);
      video[0].play();
    };
    var video = $("#towtruck-video-me");
    assert(video.length);
    navigator.mozGetUserMedia(
      {audio: true, video: true},
      function (stream) {
        addStream(video, stream);
        video[0].play();
        rtc.localStream = stream;
        rtc.connection = conn;
        conn.addStream(stream);
        callback(conn);
      },
      function (error) {
        console.warn("Error in RTC getUserMedia:", error);
      }
    );
  }

  function createAnswer(callback) {
    var conn = rtc.connection;
    assert(conn);
    assert(rtc.offer);
    conn.createAnswer(
      //rtc.offer,
      function (answer) {
        conn.setLocalDescription(
          answer,
          function () {
            callback(answer);
          },
          function (error) {
            console.warn("Error doing RTC setLocalDescription:", error);
          }
        );
      },
      function (error) {
        console.warn("Error doing RTC createAnswer:", error);
      }
    );
  }

  function createOffer(callback) {
    var conn = rtc.connection;
    assert(conn);
    conn.createOffer(
      function (offer) {
        rtc.myOffer = offer;
        conn.setLocalDescription(
          offer,
          function () {
            callback(offer);
          },
          function (error) {
            console.warn("Error doing RTC setLocalDescription:", error);
          }
        );
      },
      function (error) {
        console.warn("Error doing RTC createOffer:", error);
      }
    );
  }

  function setDescription(desc, callback) {
    makeConnection(function (conn) {
      conn.setRemoteDescription(
        desc,
        function () {
          if (callback) {
            callback();
          }
        },
        function (error) {
          console.warn("Error doing RTC setRemoteDescription:", error);
        }
      );
    });
  }

  function setupRTC() {
    var chat = require("chat");
    console.log("setupRTC started");
    if (! rtc.videoWanted) {
      if (rtc.offer) {
        chat.addChat("Do you want to talk?  Press (v) to start video", "system");
      }
      return;
    }
    if (rtc.videoWanted && ! rtc.offer) {
      console.log("making connection & offer");
      makeConnection(function () {
        console.log("created connection");
        createOffer(function (offer) {
          console.log("created offer");
          session.send({
            type: "rtc-offer",
            offer: offer
          });
        });
      });
      return;
    }
    if (rtc.videoWanted && rtc.offer && ! rtc.myAnswer) {
      console.log("sending answer");
      makeConnection(function () {
        console.log("connection created");
        createAnswer(function (answer) {
          console.log("answer created");
          session.send({
            type: "rtc-answer",
            answer: answer
          });
        });
      });
    }
  }

  return webrtc;

});
