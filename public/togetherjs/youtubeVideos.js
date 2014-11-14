/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http:// mozilla.org/MPL/2.0/. */

define(["jquery", "util", "session", "elementFinder"],
function ($, util, session, elementFinder) {

  // constant var to indicate whether two players are too far apart in sync
  var TOO_FAR_APART = 3000;
  // embedded youtube iframes
  var youTubeIframes = [];
  // youtube API load delay
  var API_LOADING_DELAY = 2000;

  session.on("reinitialize", function () {
    if (TogetherJS.config.get("youtube")) {
      prepareYouTube();
    }
  });

  session.on("close", function () {
    $(youTubeIframes).each(function (i, iframe) {
      // detach players from iframes
      $(iframe).removeData("togetherjs-player");
      $(iframe).removeData("dontPublish");
      $(iframe).removeData("currentVideoId");
      // disable iframeAPI
      $(iframe).removeAttr("enablejsapi");
      // remove unique youtube iframe indicators
      var id = $(iframe).attr("id") || "";
      if (id.indexOf("youtube-player") === 0) {
        // An id we added
        $(iframe).removeAttr("id");
      }
      youTubeIframes = [];
    });
  });

  $(function() {
    TogetherJS.config.track("youtube", function (track, previous) {
      if (track && ! previous) {
        prepareYouTube();
        // You can enable youtube dynamically, but can't turn it off:
        TogetherJS.config.close("youtube");
      }
    });
  });

  var youtubeHooked = false;

  function prepareYouTube() {
    // setup iframes first
    setupYouTubeIframes();

    // this function should be global so it can be called when API is loaded
    if (!youtubeHooked) {
      youtubeHooked = true;
      window.onYouTubeIframeAPIReady = (function(oldf) {
        return function() {
          // YouTube API is ready
          $(youTubeIframes).each(function (i, iframe) {
            var player = new YT.Player(iframe.id, { // get the reference to the already existing iframe
              events: {
                'onReady': insertPlayer,
                'onStateChange': publishPlayerStateChange
              }
            });
          });
          if (oldf) {
            return oldf();
          }
        };
      })(window.onYouTubeIframeAPIReady);
    }

    if (window.YT === undefined) {
      // load necessary API
      // it calls onYouTubeIframeAPIReady automatically when the API finishes loading
      var tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      var firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      // manually invoke APIReady function when the API was already loaded by user
      onYouTubeIframeAPIReady();
    }

    // give each youtube iframe a unique id and set its enablejsapi param to true
    function setupYouTubeIframes() {
      var iframes = $('iframe');
      iframes.each(function (i, iframe) {
        // if the iframe's unique id is already set, skip it
        // FIXME: what if the user manually sets an iframe's id (i.e. "#my-youtube")?
        // maybe we should set iframes everytime togetherjs is reinitialized?
        var osrc = $(iframe).attr("src"), src = osrc;
        if ((src || "").indexOf("youtube") != -1 && !$(iframe).attr("id")) {
          $(iframe).attr("id", "youtube-player"+i);
          $(iframe).attr("enablejsapi", 1);
          // we also need to add ?enablejsapi to the iframe src.
          if (!/[?&]enablejsapi=1(&|$)/.test(src)) {
            src += (/[?]/.test(src)) ? '&' : '?';
            src += 'enablejsapi=1';
          }
          // the youtube API seems to be unhappy unless the URL starts
          // with https
          if (!/^https[:]\/\//.test(src)) {
            src = 'https://' + src.replace(/^(\w+[:])?\/\//, '');
          }
          if (src !== osrc) {
            $(iframe).attr("src", src);
          }
          youTubeIframes[i] = iframe;
        }
      });
    } // iframes are ready

    function insertPlayer(event) {
      // only when it is READY, attach a player to its iframe
      var currentPlayer = event.target;
      var currentIframe = currentPlayer.getIframe();
      // check if a player is already attached in case of being reinitialized
      if (!$(currentIframe).data("togetherjs-player")) {
        $(currentIframe).data("togetherjs-player", currentPlayer);
        // initialize its dontPublish flag as well
        $(currentIframe).data("dontPublish", false);
        // store its current video's id
        var currentVideoId = getVideoIdFromUrl(currentPlayer.getVideoUrl());
        $(currentIframe).data("currentVideoId", currentVideoId);
      }
    }
  } // end of prepareYouTube

  function publishPlayerStateChange(event) {
    var target = event.target;
    var currentIframe = target.getIframe();
    //var currentPlayer = $(currentIframe).data("togetherjs-player");
    var currentPlayer = target;
    var currentTime = currentPlayer.getCurrentTime();
    //var currentTime = target.k.currentTime;
    var iframeLocation = elementFinder.elementLocation(currentIframe);

    if ($(currentPlayer).data("seek")) {
      $(currentPlayer).removeData("seek");
      return;
    }

    // do not publish if playerState was changed by other users
    if ($(currentIframe).data("dontPublish")) {
      // make it false again so it can start publishing events of its own state changes
      $(currentIframe).data("dontPublish", false);
      return;
    }

    // notify other people that I changed the player state
    if (event.data == YT.PlayerState.PLAYING) {

      var currentVideoId = isDifferentVideoLoaded(currentIframe);
      if (currentVideoId) {
        // notify that I just loaded another video
        publishDifferentVideoLoaded(iframeLocation, currentVideoId);
        // update current video id
        $(currentIframe).data("currentVideoId", currentVideoId);
      } else {
        session.send({
          type: "playerStateChange",
          element: iframeLocation,
          playerState: 1,
          playerTime: currentTime
        });
      }
    } else if (event.data == YT.PlayerState.PAUSED) {
      session.send({
        type: "playerStateChange",
        element: iframeLocation,
        playerState: 2,
        playerTime: currentTime
      });
    } else {
      // do nothing when the state is buffering, cued, or ended
      return;
    }
  }

  function publishDifferentVideoLoaded(iframeLocation, videoId) {
    session.send({
      type: "differentVideoLoaded",
      videoId: videoId,
      element: iframeLocation
    });
  }

  session.hub.on('playerStateChange', function (msg) {
    var iframe = elementFinder.findElement(msg.element);
    var player = $(iframe).data("togetherjs-player");
    var currentTime = player.getCurrentTime();
    var currentState = player.getPlayerState();

    if (currentState != msg.playerState) {
      $(iframe).data("dontPublish", true);
    }

    if (msg.playerState == 1) {
      player.playVideo();
      // seekTo() updates the video's time and plays it if it was already playing
      // and pauses it if it was already paused
      if (areTooFarApart(currentTime, msg.playerTime)) {
        player.seekTo(msg.playerTime, true);
      }
    } else if (msg.playerState == 2) {
      // When YouTube videos are advanced while playing,
      // Chrome: pause -> pause -> play (onStateChange is called even when it is from pause to pause)
      // FireFox: buffering -> play -> buffering -> play
      // We must prevent advanced videos from going out of sync
      player.pauseVideo();
      if (areTooFarApart(currentTime, msg.playerTime)) {
        // "seek" flag will help supress publishing unwanted state changes
        $(player).data("seek", true);
        player.seekTo(msg.playerTime, true);
      }
    }
  });

  // if a late user joins a channel, synchronize his videos
  session.hub.on('hello', function () {
    // wait a couple seconds to make sure the late user has finished loading API
    setTimeout(synchronizeVideosOfLateGuest, API_LOADING_DELAY);
  });

  session.hub.on('synchronizeVideosOfLateGuest', function (msg) {
    // XXX can this message arrive before we're initialized?
    var iframe = elementFinder.findElement(msg.element);
    var player = $(iframe).data("togetherjs-player");
    // check if another video had been loaded to an existing iframe before I joined
    var currentVideoId = getVideoIdFromUrl(player.getVideoUrl());
    if (msg.videoId != currentVideoId) {
      $(iframe).data("currentVideoId", msg.videoId);
      player.loadVideoById(msg.videoId, msg.playerTime, 'default');
    } else {
      // if the video is only cued, I do not have to do anything to sync
      if (msg.playerState != 5) {
        player.seekTo(msg.playerTime, true).playVideo();
      }
    }
  });

  session.hub.on('differentVideoLoaded', function (msg) {
    // load a new video if the host has loaded one
    var iframe = elementFinder.findElement(msg.element);
    var player = $(iframe).data("togetherjs-player");
    player.loadVideoById(msg.videoId, 0, 'default');
    $(iframe).data("currentVideoId", msg.videoId);

  });

  function synchronizeVideosOfLateGuest() {
    youTubeIframes.forEach(function (iframe) {
      var currentPlayer = $(iframe).data("togetherjs-player");
      var currentVideoId = getVideoIdFromUrl(currentPlayer.getVideoUrl());
      var currentState = currentPlayer.getPlayerState();
      var currentTime = currentPlayer.getCurrentTime();
      var iframeLocation = elementFinder.elementLocation(iframe);
      session.send({
        type: "synchronizeVideosOfLateGuest",
        element: iframeLocation,
        videoId: currentVideoId,
        playerState: currentState, //this might be necessary later
        playerTime: currentTime
      });
    });
  }

  function isDifferentVideoLoaded(iframe) {
    var lastVideoId = $(iframe).data("currentVideoId");
    var currentPlayer = $(iframe).data("togetherjs-player");
    var currentVideoId = getVideoIdFromUrl(currentPlayer.getVideoUrl());

    // since url forms of iframe src and player's video url are different,
    // I have to compare the video ids
    if (currentVideoId != lastVideoId) {
      return currentVideoId;
    } else {
      return false;
    }
  }

  // parses videoId from the url returned by getVideoUrl function
  function getVideoIdFromUrl(videoUrl) {
    var videoId = videoUrl.split('v=')[1];
    //Chrome and Firefox have different positions for parameters
    var ampersandIndex = videoId.indexOf('&');
    if (ampersandIndex != -1) {
      videoId = videoId.substring(0, ampersandIndex);
    }
    return videoId;
  }

  function areTooFarApart(myTime, theirTime) {
    var secDiff = Math.abs(myTime - theirTime);
    var milliDiff = secDiff * 1000;
    return milliDiff > TOO_FAR_APART;
  }
});
