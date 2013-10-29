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
    if (TogetherJS.getConfig("youtube")) {
      prepareYouTube();  
    }
  });

  if (TogetherJS.getConfig("youtube")) {
    prepareYouTube();
  }

  function prepareYouTube() {
    // setup iframes first
    setupYouTubeIframes();

    // load necessary API
    // call onYouTubeIframeAPIReady when the API finishes loading
    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    // this function should be global so it can be called when API is loaded
    // FIXME: handle the case when Iframe API is already loaded
    window.onYouTubeIframeAPIReady = function() {
      // YouTube API is ready
      $(youTubeIframes).each(function (i, iframe) {
        var player = new YT.Player(iframe.id, { // get the reference to the already existing iframe
          events: {
            'onReady': insertPlayer,
            'onStateChange': publishPlayerStateChange
          }
        });
      });
    }

    // give each youtube iframe a unique id and set its enablejsapi param to true
    function setupYouTubeIframes() {
      var iframes = $('iframe');
      iframes.each(function (i, iframe) {
        // look for YouTube Iframes
        // if the iframe's unique id is already set, skip it
        if ($(iframe).attr("src").indexOf("youtube") != -1 && !$(iframe).attr("id")) { 
          $(iframe).attr("id", "youtube-player"+i);
          $(iframe).attr("ensablejsapi", 1);
          youTubeIframes[i] = iframe;
        }
      });
    } // iframes are ready

    function insertPlayer(event) {
      // only when it is READY, attach a player to its iframe
      var currentPlayer = event.target;
      var currentIframe = currentPlayer.a;
      // check if a player is already attached in case of being reinitialized
      if (!$(currentIframe).data("togetherjs-player")) {
        console.log("player is ready: "+currentPlayer);
        $(currentIframe).data("togetherjs-player", currentPlayer);
        // initialize its dontPublish flag as well
        $(currentIframe).data("dontPublish", false);
      }      
    }
  } // end of prepareYouTube
  
  function publishPlayerStateChange(event) {
    var currentPlayer = event.target;
    var currentIframe = currentPlayer.a;
    var currentTime = currentPlayer.getCurrentTime();
    var iframeLocation = elementFinder.elementLocation(currentIframe);
    
    // do not publish if playerState was changed by other users
    if ($(currentIframe).data("dontPublish")) {
      // make it false again so it can start publishing events of its own state changes
      $(currentIframe).data("dontPublish", false);
      return;
    }

    // notify other people that I changed the player state
    if (event.data == YT.PlayerState.PLAYING) {      
      session.send({
        type: "playerStateChange",
        element: iframeLocation,
        playerState: 1,
        playerTime: currentTime
      });
    } else if (event.data == YT.PlayerState.PAUSED) {      
      session.send({
        type: "playerStateChange",
        element: iframeLocation,
        playerState: 2,
        playerTime: currentTime
      });
    } else if (event.data == YT.PlayerState.BUFFERING) {
      // shouldnt do anything when Im buffering
    } else if (event.data == YT.PlayerState.CUED) {
      // TODO: should I syncrhonize newly loaded videos as well?
    } else if (event.data == YT.PlayerState.ENDED) {
      session.send({
        type: "playerStateChange",
        element: iframeLocation,
        playerState: 0
      });
    }
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
      if (areTooFarApart(currentTime, msg.playerTime)) {
        player.seekTo(msg.playerTime);
      }
      player.playVideo();
    } else if (msg.playerState == 2) {
      if (areTooFarApart(currentTime, msg.playerTime)) {
        player.seekTo(msg.playerTime);
      }
      player.pauseVideo();
    }
  });

  // if a late user joins a channel, synchronize his videos
  session.hub.on('hello', function () {
    // wait a couple seconds to make sure the late user has finished loading API
    setTimeout(synchronizeVideosOfLateGuest, API_LOADING_DELAY);
  });

  session.hub.on('synchronizeVideosOfLateGuest', function (msg) {
    var iframe = elementFinder.findElement(msg.element);
    var player = $(iframe).data("togetherjs-player");
    // if the video is only cued, I do not have to do anything to sync
    // FIXME: check if a new video has been loaded
    if (msg.playerState != 5) {
      player.seekTo(msg.playerTime, true);
    }
  });
  
  function synchronizeVideosOfLateGuest() {
    youTubeIframes.forEach(function (iframe) {
      var currentPlayer = $(iframe).data("togetherjs-player");
      var currentVideoUrl = currentPlayer.getVideoUrl();
      var currentState = currentPlayer.getPlayerState();
      var currentTime = currentPlayer.getCurrentTime();
      var iframeLocation = elementFinder.elementLocation(iframe);
      session.send({
        type: "synchronizeVideosOfLateGuest",
        element: iframeLocation,
        videoUrl: currentVideoUrl,
        playerState: currentState, //this might be necessary later
        playerTime: currentTime
      });
    });
  }

  function areTooFarApart(myTime, theirTime) {
    var secDiff = Math.abs(myTime - theirTime);
    var milliDiff = secDiff * 1000;
    return milliDiff > TOO_FAR_APART;
  }
});
