/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http:// mozilla.org/MPL/2.0/. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "./elementFinder", "./session", "jquery"], function (require, exports, elementFinder_1, session_1, jquery_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    jquery_1 = __importDefault(jquery_1);
    //function youtubeVideosMain($: JQueryStatic, _util: TogetherJSNS.Util, session: TogetherJSNS.Session, elementFinder: TogetherJSNS.ElementFinder) {
    // constant var to indicate whether two players are too far apart in sync
    const TOO_FAR_APART = 3000;
    // embedded youtube iframes
    let youTubeIframes = [];
    // youtube API load delay
    const API_LOADING_DELAY = 2000;
    session_1.session.on("reinitialize", function () {
        if (TogetherJS.config.get("youtube")) {
            prepareYouTube();
        }
    });
    session_1.session.on("close", function () {
        jquery_1.default(youTubeIframes).each(function (_i, iframe) {
            // detach players from iframes
            jquery_1.default(iframe).removeData("togetherjs-player");
            jquery_1.default(iframe).removeData("dontPublish");
            jquery_1.default(iframe).removeData("currentVideoId");
            // disable iframeAPI
            jquery_1.default(iframe).removeAttr("enablejsapi");
            // remove unique youtube iframe indicators
            const id = jquery_1.default(iframe).attr("id") || "";
            if (id.indexOf("youtube-player") === 0) {
                // An id we added
                jquery_1.default(iframe).removeAttr("id");
            }
            youTubeIframes = [];
        });
    });
    jquery_1.default(function () {
        TogetherJS.config.track("youtube", function (track, previous) {
            if (track && !previous) {
                prepareYouTube();
            }
        });
    });
    let youtubeHooked = false;
    function prepareYouTube() {
        // setup iframes first
        setupYouTubeIframes();
        // this function should be global so it can be called when API is loaded
        if (!youtubeHooked) {
            youtubeHooked = true;
            window.onYouTubeIframeAPIReady = function (oldf) {
                return function () {
                    // YouTube API is ready
                    jquery_1.default(youTubeIframes).each(function (_i, iframe) {
                        new YT.Player(iframe.id, {
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
            };
            window.onYouTubeIframeAPIReady(window.onYouTubeIframeAPIReady);
        }
        if (window.YT === undefined) {
            // load necessary API
            // it calls onYouTubeIframeAPIReady automatically when the API finishes loading
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0]; // TODO !
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag); // TODO !
        }
        else {
            // manually invoke APIReady function when the API was already loaded by user
            onYouTubeIframeAPIReady(); // TODO !
        }
        // give each youtube iframe a unique id and set its enablejsapi param to true
        function setupYouTubeIframes() {
            const iframes = jquery_1.default('iframe');
            iframes.each(function (i, f) {
                const iframe = f;
                // if the iframe's unique id is already set, skip it
                // FIXME: what if the user manually sets an iframe's id (i.e. "#my-youtube")?
                // maybe we should set iframes everytime togetherjs is reinitialized?
                const osrc = jquery_1.default(iframe).attr("src");
                let src = osrc;
                if ((src || "").indexOf("youtube") != -1 && !jquery_1.default(iframe).attr("id")) {
                    jquery_1.default(iframe).attr("id", "youtube-player" + i);
                    jquery_1.default(iframe).attr("enablejsapi", 1);
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
                        jquery_1.default(iframe).attr("src", src);
                    }
                    youTubeIframes[i] = iframe;
                }
            });
        } // iframes are ready
        function insertPlayer(event) {
            // only when it is READY, attach a player to its iframe
            const currentPlayer = event.target;
            const currentIframe = currentPlayer.getIframe();
            // check if a player is already attached in case of being reinitialized
            if (!jquery_1.default(currentIframe).data("togetherjs-player")) {
                jquery_1.default(currentIframe).data("togetherjs-player", currentPlayer);
                // initialize its dontPublish flag as well
                jquery_1.default(currentIframe).data("dontPublish", false);
                // store its current video's id
                const currentVideoId = getVideoIdFromUrl(currentPlayer.getVideoUrl());
                jquery_1.default(currentIframe).data("currentVideoId", currentVideoId);
            }
        }
    } // end of prepareYouTube
    function publishPlayerStateChange(event) {
        const target = event.target;
        const currentIframe = target.getIframe();
        //var currentPlayer = $(currentIframe).data("togetherjs-player");
        const currentPlayer = target;
        const currentTime = currentPlayer.getCurrentTime();
        //var currentTime = target.k.currentTime;
        const iframeLocation = elementFinder_1.elementFinder.elementLocation(currentIframe);
        if (jquery_1.default(currentPlayer).data("seek")) {
            jquery_1.default(currentPlayer).removeData("seek");
            return;
        }
        // do not publish if playerState was changed by other users
        if (jquery_1.default(currentIframe).data("dontPublish")) {
            // make it false again so it can start publishing events of its own state changes
            jquery_1.default(currentIframe).data("dontPublish", false);
            return;
        }
        // notify other people that I changed the player state
        if (event.data == YT.PlayerState.PLAYING) {
            const currentVideoId = isDifferentVideoLoaded(currentIframe);
            if (currentVideoId) {
                // notify that I just loaded another video
                publishDifferentVideoLoaded(iframeLocation, currentVideoId);
                // update current video id
                jquery_1.default(currentIframe).data("currentVideoId", currentVideoId);
            }
            else {
                session_1.session.send({
                    type: "playerStateChange",
                    element: iframeLocation,
                    playerState: 1,
                    playerTime: currentTime
                });
            }
        }
        else if (event.data == YT.PlayerState.PAUSED) {
            session_1.session.send({
                type: "playerStateChange",
                element: iframeLocation,
                playerState: 2,
                playerTime: currentTime
            });
        }
        else {
            // do nothing when the state is buffering, cued, or ended
            return;
        }
    }
    function publishDifferentVideoLoaded(iframeLocation, videoId) {
        session_1.session.send({
            type: "differentVideoLoaded",
            videoId: videoId,
            element: iframeLocation
        });
    }
    session_1.session.hub.on('playerStateChange', function (msg) {
        const iframe = elementFinder_1.elementFinder.findElement(msg.element);
        const player = jquery_1.default(iframe).data("togetherjs-player");
        const currentTime = player.getCurrentTime();
        const currentState = player.getPlayerState();
        if (currentState != msg.playerState) {
            jquery_1.default(iframe).data("dontPublish", true);
        }
        if (msg.playerState == 1) {
            player.playVideo();
            // seekTo() updates the video's time and plays it if it was already playing
            // and pauses it if it was already paused
            if (areTooFarApart(currentTime, msg.playerTime)) {
                player.seekTo(msg.playerTime, true);
            }
        }
        else if (msg.playerState == 2) {
            // When YouTube videos are advanced while playing,
            // Chrome: pause -> pause -> play (onStateChange is called even when it is from pause to pause)
            // FireFox: buffering -> play -> buffering -> play
            // We must prevent advanced videos from going out of sync
            player.pauseVideo();
            if (areTooFarApart(currentTime, msg.playerTime)) {
                // "seek" flag will help supress publishing unwanted state changes
                jquery_1.default(player).data("seek", true);
                player.seekTo(msg.playerTime, true);
            }
        }
    });
    // if a late user joins a channel, synchronize his videos
    session_1.session.hub.on('hello', function () {
        // wait a couple seconds to make sure the late user has finished loading API
        setTimeout(synchronizeVideosOfLateGuest, API_LOADING_DELAY);
    });
    session_1.session.hub.on('synchronizeVideosOfLateGuest', function (msg) {
        // XXX can this message arrive before we're initialized?
        const iframe = elementFinder_1.elementFinder.findElement(msg.element);
        const player = jquery_1.default(iframe).data("togetherjs-player");
        // check if another video had been loaded to an existing iframe before I joined
        const currentVideoId = getVideoIdFromUrl(player.getVideoUrl());
        if (msg.videoId != currentVideoId) {
            jquery_1.default(iframe).data("currentVideoId", msg.videoId);
            player.loadVideoById(msg.videoId, msg.playerTime, 'default');
        }
        else {
            // if the video is only cued, I do not have to do anything to sync
            if (msg.playerState != 5) {
                player.seekTo(msg.playerTime, true).playVideo();
            }
        }
    });
    session_1.session.hub.on('differentVideoLoaded', function (msg) {
        // load a new video if the host has loaded one
        const iframe = elementFinder_1.elementFinder.findElement(msg.element);
        const player = jquery_1.default(iframe).data("togetherjs-player");
        player.loadVideoById(msg.videoId, 0, 'default');
        jquery_1.default(iframe).data("currentVideoId", msg.videoId);
    });
    function synchronizeVideosOfLateGuest() {
        youTubeIframes.forEach(function (iframe) {
            const currentPlayer = jquery_1.default(iframe).data("togetherjs-player");
            const currentVideoId = getVideoIdFromUrl(currentPlayer.getVideoUrl());
            const currentState = currentPlayer.getPlayerState();
            const currentTime = currentPlayer.getCurrentTime();
            const iframeLocation = elementFinder_1.elementFinder.elementLocation(iframe);
            session_1.session.send({
                type: "synchronizeVideosOfLateGuest",
                element: iframeLocation,
                videoId: currentVideoId,
                playerState: currentState,
                playerTime: currentTime
            });
        });
    }
    function isDifferentVideoLoaded(iframe) {
        const lastVideoId = jquery_1.default(iframe).data("currentVideoId");
        const currentPlayer = jquery_1.default(iframe).data("togetherjs-player");
        const currentVideoId = getVideoIdFromUrl(currentPlayer.getVideoUrl());
        // since url forms of iframe src and player's video url are different,
        // I have to compare the video ids
        if (currentVideoId != lastVideoId) {
            return currentVideoId;
        }
        else {
            return false;
        }
    }
    // parses videoId from the url returned by getVideoUrl function
    function getVideoIdFromUrl(videoUrl) {
        let videoId = videoUrl.split('v=')[1];
        //Chrome and Firefox have different positions for parameters
        const ampersandIndex = videoId.indexOf('&');
        if (ampersandIndex != -1) {
            videoId = videoId.substring(0, ampersandIndex);
        }
        return videoId;
    }
    function areTooFarApart(myTime, theirTime) {
        const secDiff = Math.abs(myTime - theirTime);
        const milliDiff = secDiff * 1000;
        return milliDiff > TOO_FAR_APART;
    }
});
//define(["jquery", "util", "session", "elementFinder"], youtubeVideosMain);
