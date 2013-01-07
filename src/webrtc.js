/* WebRTC support for TowTruck.
   Note that this relies on parts of the interface located in chat.js and intro.js
   */
(function () {
  var TowTruck = window.TowTruck;
  var $ = TowTruck.$;
  var assert = TowTruck.assert;

  var PeerConnection = window.RTCPeerConnection ||
    window.mozRTCPeerConnection ||
    window.webkitRTCPeerConnection;

  navigator.getUserMedia = navigator.getUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.msGetUserMedia;

  TowTruck.RTCSupported = !! PeerConnection;

  if (! PeerConnection) {
    // WebRTC not supported
    // FIXME: could getUserMedia sometimes be availble when RTC is not?
    return;
  }

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

})();
