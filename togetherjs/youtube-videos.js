/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http:// mozilla.org/MPL/2.0/. */

define(["jquery", "util", "session", "elementFinder"],
function ($, util, session, elementFinder) {

  var tag = document.createElement('script');

  tag.src = "https://www.youtube.com/iframe_api";
  var firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  var TOO_FAR_APART = 3000;

  //  an array of all embedded YouTube players 
  var players = [];
  var iframes = $('iframe#youtube-player');

  // boolean to indicate when to not publish
  var dontPublish = [];

  // TODO: enablejsapi should be set as well
  // the only thing the user has to do should be setting iframe id to "youtube-player"
  $(function giveUniqueIdsToIframes() {
    iframes.each(function (i, iframe) {
      iframe.id = iframe.id+i;
    });
    console.log("Iframes are set");
  });

  // this function should be global so it can be called when API is loaded
  window.onYouTubeIframeAPIReady = function() {
    console.log("Iframe API is ready");
    iframes.each(function (i, iframe) {
      var player = new YT.Player(iframe.id, { // get the reference to the already existing iframe
        events: {
          'onReady': insertPlayer,
          'onStateChange': publishPlayerStateChange
        }
      });
    });
  }

  function insertPlayer(event) {
    // only when it is READY, insert each player into the list
    var currentPlayer = event.target;
    // get playerIndex and insert it into that specific location
    var playerIndex = getPlayerIndex(currentPlayer);
    players[playerIndex] = currentPlayer;
    dontPublish[playerIndex] = false;
  }

  function getPlayerIndex(currentPlayer) {
    // ex)element = <iframe id="youtube-player0" ...>
    var element = currentPlayer.a;
    // ex)whichPlayer = iframe#youtube-player0
    var whichPlayer = elementFinder.elementLocation(element);
    // ex)playerIndex = 0
    var playerIndex = whichPlayer[whichPlayer.length-1];
    return playerIndex;
  }
  
  function publishPlayerStateChange(event) {
    var currentPlayer = event.target;
    var currentTime = currentPlayer.getCurrentTime();
    var playerIndex = getPlayerIndex(currentPlayer);

    // do not publish if playerState was changed by other users
    if (dontPublish[playerIndex]) {
      // make it false again so it can start publishing events of its own state changes
      dontPublish[playerIndex] = false;
      return;
    }

    // notify other people that I changed the player state
    if (event.data == YT.PlayerState.PLAYING) {      
      session.send({
        type: "playerStateChange",
        playerIndex: playerIndex, // id of iframe that changed state
        playerState: 1,
        playerTime: currentTime

      });
    } else if (event.data == YT.PlayerState.PAUSED) {      
      session.send({
        type: "playerStateChange",
        playerIndex: playerIndex,
        playerState: 2,
        playerTime: currentTime,

      });
    } else if (event.data == YT.PlayerState.BUFFERING) {
      console.log("Im just buffering. Do nothing");
    } else if (event.data == YT.PlayerState.CUED) {
      // TODO: should I syncrhonize newly loaded videos as well?
      //videoUrl = player.getVideoUrl();
    } else if (event.data == YT.PlayerState.ENDED) {
      session.send({
        type: "playerStateChange",
        playerIndex: playerIndex,
        playerState: 0
      });
    }
  }
  
  session.hub.on('playerStateChange', function (msg) {
    var player = players[msg.playerIndex];
    var currentTime = player.getCurrentTime();
    var currentState = player.getPlayerState();

    if (currentState != msg.playerState) {
      dontPublish[msg.playerIndex] = true;
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

  function areTooFarApart(myTime, theirTime) {
    var secDiff = Math.abs(myTime - theirTime);
    var milliDiff = secDiff * 1000;
    return milliDiff > TOO_FAR_APART;
  }
});
