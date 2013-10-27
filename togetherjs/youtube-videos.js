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
  var dontPublish = false;

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
    players.push(event.target);
  }

  
  function publishPlayerStateChange(event) {
    // do not publish if playerState was changed by other users
    if (dontPublish) {
      // make it false again so it can start publishing events of its own state changes
      dontPublish = false;
      return;
    }
    // notify other people that I changed the player state
    if (event.data == YT.PlayerState.PLAYING) {
      var element = event.target.a;
      session.send({
        type: "playerStateChange",
        playerState: 1,
        whichPlayer: elementFinder.elementLocation(element) // id of iframe that changed state
      });
    } else if (event.data == YT.PlayerState.PAUSED) {
      var element = event.target.a;
      session.send({
        type: "playerStateChange",
        playerState: 2,
        whichPlayer: elementFinder.elementLocation(element) 
      });
    } else if (event.data == YT.PlayerState.BUFFERING) {
      var element = event.target.a;
      session.send({
        type: "playerStateChange",
        playerState: 3,
        whichPlayer: elementFinder.elementLocation(element) 
      });
    } else if (event.data == YT.PlayerState.CUED) {
      //videoUrl = player.getVideoUrl();
    } else if (event.data == YT.PlayerState.ENDED) {
      var element = event.target.a;
      session.send({
        type: "playerStateChange",
        playerState: 0,
        whichPlayer: elementFinder.elementLocation(element) 
      });
    }
  }
  
  session.hub.on('playerStateChange', function (msg) {
    // ex)whichPlayer = iframe#youtube-player0
    dontPublish = true;
    var playerIndex = msg.whichPlayer[msg.whichPlayer.length-1];
    var player = players[playerIndex];
    if (msg.playerState == 1) {
      // TODO: get time diff and advance if the diff is too large
      player.playVideo();
    } else if (msg.playerState == 2) {
      // TODO: same as above
      player.pauseVideo();
    }
  });
});
