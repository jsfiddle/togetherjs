/* WebRTC support for TowTruck.
   Note that this relies on parts of the interface located in chat.js and intro.js
   */
(function () {
  var TowTruck = window.TowTruck;
  var $ = TowTruck.$;
  var assert = TowTruck.assert;

  var PeerConnection = TowTruck.PeerConnection =
    window.mozRTCPeerConnection ||
    window.webkitRTCPeerConnection ||
    window.RTCPeerConnection;

  navigator.getUserMedia = navigator.getUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.msGetUserMedia;

  TowTruck.RTCSupported = !! PeerConnection;

  TowTruck.on("ui-ready", function () {
    if (! TowTruck.RTCSupported) {
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

  TowTruck.startPicPreview = function () {
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
      TowTruck.settings("avatar", imgData);
      TowTruck.send({type: "nickname-update", avatar: imgData});
      close();
      updatePreview();
    });

    function updatePreview() {
      var avatar = TowTruck.settings("avatar");
      if (avatar) {
        $("#towtruck-avatar-view-container").show();
        $("#towtruck-avatar-view").attr("src", avatar);
      } else {
        $("#towtruck-avatar-view-container").hide();
      }
    }

    updatePreview();

  };

  TowTruck.chatSetup = false;

  TowTruck.peers.on("add update", function (peer) {
    TowTruck.setupChatInterface();
  });

  function addStream(video, stream) {
    video = $(video)[0];
    if (navigator.mozGetUserMedia) {
      video.mozSrcObject = stream;
    } else {
      var vendorURL = window.URL || window.webkitURL;
      video.src = vendorURL.createObjectURL(stream);
    }
  }

  TowTruck.setupChatInterface = function setupChatInterface() {
    if (! TowTruck.chat) {
      return;
    }
    var supported = false;
    TowTruck.peers.forEach(function (p) {
      if (p.rtcSupported) {
        supported = true;
      }
    });
    if (supported) {
      TowTruck.chat.find(".towtruck-start-video").show();
    } else {
      TowTruck.chat.find(".towtruck-start-video").hide();
      $("#towtruck-video").hide();
    }
    if (! setupChatInterface.bound) {
      $(".towtruck-start-video").click(TowTruck.startVideo);
      setupChatInterface.bound = true;
    }
  };

  TowTruck.rtc = {
    connection: null,
    offer: null,
    myOffer: null,
    answer: null,
    myAnswer: null,
    videoWanted: true
  };

  TowTruck.on("ui-showing-towtruck-rtc", function () {
    TowTruck.setupRTC();
  });

  TowTruck.messageHandler.on("rtc-offer", function (msg) {
    TowTruck.rtc.offer = msg.offer;
    TowTruck.setDescription(msg.offer, function () {
      TowTruck.activateTab("towtruck-rtc");
      TowTruck.setupRTC();
    });
  });

  TowTruck.messageHandler.on("rtc-answer", function (msg) {
    TowTruck.rtc.answer = msg.answer;
    TowTruck.setDescription(msg.answer, function () {
      TowTruck.setupRTC();
    });
  });

  TowTruck.startVideo = function startVideo() {
    TowTruck.rtc.videoWanted = true;
    TowTruck.setupRTC();
  };

  TowTruck.makeConnection = function (callback) {
    if (TowTruck.rtc.connection) {
      callback(TowTruck.rtc.connection);
      return;
    }
    // FIXME: Chrome demands a configuration parameter here:
    var conn = new PeerConnection();
    conn.onaddstream = function (event) {
      console.log("onaddstream", event);
      console.log("streams", conn.remoteStreams, conn.remoteStreams.length);
      var video = $("#towtruck-video");
      for (var i=0; i<conn.remoteStreams.length; i++) {
        var s = conn.remoteStreams[i];
        addStream(video, s);
      }
      video[0].play();
    };
    var video = $("#towtruck-video-me");
    assert(video.length);
    // FIXME: temporary hack for demo!
    var useVideo = ! TowTruck.isClient;
    navigator.mozGetUserMedia(
      {audio: true, video: useVideo},
      function (stream) {
        addStream(video, stream);
        video[0].play();
        TowTruck.rtc.localStream = stream;
        TowTruck.rtc.connection = conn;
        conn.addStream(stream);
        callback(conn);
      },
      function (error) {
        console.warn("Error in RTC getUserMedia:", error);
      }
    );
  };

  TowTruck.createAnswer = function (callback) {
    var conn = TowTruck.rtc.connection;
    assert(conn);
    assert(TowTruck.rtc.offer);
    conn.createAnswer(
      //TowTruck.rtc.offer,
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
  };

  TowTruck.createOffer = function (callback) {
    var conn = TowTruck.rtc.connection;
    assert(conn);
    conn.createOffer(
      function (offer) {
        TowTruck.rtc.myOffer = offer;
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
  };

  TowTruck.setDescription = function (desc, callback) {
    TowTruck.makeConnection(function (conn) {
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
  };

  TowTruck.setupRTC = function () {
    var rtc = TowTruck.rtc;
    if (! rtc.videoWanted) {
      if (rtc.offer) {
        TowTruck.addChat("Do you want to talk?  Press (v) to start video", "system");
      }
      return;
    }
    if (rtc.videoWanted && ! rtc.offer) {
      TowTruck.makeConnection(function () {
        TowTruck.createOffer(function (offer) {
          TowTruck.send({
            type: "rtc-offer",
            offer: offer
          });
        });
      });
      return;
    }
    if (rtc.videoWanted && rtc.offer && ! rtc.myAnswer) {
    console.log("sending answer");
      TowTruck.makeConnection(function () {
      console.log("connection created");
        TowTruck.createAnswer(function (answer) {
        console.log("answer created");
          TowTruck.send({
            type: "rtc-answer",
            answer: answer
          });
        });
      });
    }
  };

})();
