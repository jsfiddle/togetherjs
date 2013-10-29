/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http:// mozilla.org/MPL/2.0/. */

define(["jquery", "util", "session", "elementFinder"],
function ($, util, session, elementFinder) {

  // constant var to indicate whether two players are too far apart in sync
  var TOO_FAR_APART = 3000;
  // embedded youtube iframes
  var youTubeIframes = [];

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
        $(currentIframe).data("togetherjs-player", currentPlayer);
        // initialize its dontPublish flag as well
        $(currentIframe).data("dontPublish", false);
      }      
    }
  } // end of prepareYouTube

  /*
  function getPlayerIndex(currentPlayer) {
    // ex)element = <iframe id="youtube-player0" ...>
    var element = currentPlayer.a;
    // ex)whichPlayer = iframe#youtube-player0
    var whichPlayer = elementFinder.elementLocation(element);
    // ex)playerIndex = 0
    var playerIndex = whichPlayer[whichPlayer.length-1];
    return playerIndex;
  } // I probably dont need this function anymore
  */
  
  function publishPlayerStateChange(event, frame) {
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

  // if a new user joins a channel, synchronize his videos
  /*
  session.hub.on('hello', function () {
    youTubeIframes.forEach(function (frame) {
      publishPlayerStateChange({target: frame});
    });
  });
  */

  function areTooFarApart(myTime, theirTime) {
    var secDiff = Math.abs(myTime - theirTime);
    var milliDiff = secDiff * 1000;
    return milliDiff > TOO_FAR_APART;
  }
});
