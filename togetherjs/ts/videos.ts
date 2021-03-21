/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

interface Listener {
    name: string,
    listener: (eventObject: JQueryEventObject, ...args: any[]) => any,
}

interface Options {
    silent?: boolean;
}

interface VideoTimeupdateMessage {
    location: string,
    position: number,
}

define(["jquery", "util", "session", "elementFinder"], function($: JQueryStatic, _util: Util, session: TogetherJSNS.Session, elementFinder: ElementFinder) {

    var listeners: Listener[] = [];

    var TIME_UPDATE = 'timeupdate';
    var MIRRORED_EVENTS = ['play', 'pause'];

    var TOO_FAR_APART = 3000;

    session.on("reinitialize", function() {
        unsetListeners();
        setupListeners();
    });

    session.on("ui-ready", setupListeners);

    function setupListeners() {
        var videos = $('video');
        setupMirroredEvents(videos);
        setupTimeSync(videos);
    }

    function setupMirroredEvents(videos: JQuery) {
        var currentListener;
        MIRRORED_EVENTS.forEach(function(eventName) {
            currentListener = makeEventSender(eventName);
            videos.on(eventName, currentListener);
            listeners.push({
                name: eventName,
                listener: currentListener
            });
        });
    }

    function makeEventSender(eventName: string) { // TODO replace with union type
        return function(event: Event, options: Options = {}) {
            var element = event.target as HTMLMediaElement;
            if(!options.silent && element) {
                session.send({
                    type: ('video-' + eventName) as TogetherJSNS.Messages,
                    location: elementFinder.elementLocation(element),
                    position: element.currentTime
                });
            }
        };
    }

    function setupTimeSync(videos: JQuery) {
        videos.each(function(_i, video) {
            var onTimeUpdate = makeTimeUpdater();
            $(video).on(TIME_UPDATE, onTimeUpdate);
            listeners.push({
                name: TIME_UPDATE,
                listener: onTimeUpdate
            });
        });
    }

    function makeTimeUpdater() {
        var last = 0;
        return function(event: Event) {
            var currentTime = (event.target as HTMLMediaElement).currentTime;
            if(areTooFarApart(currentTime, last)) {
                makeEventSender(TIME_UPDATE)(event);
            }
            last = currentTime;
        };
    }

    function areTooFarApart(currentTime: number, lastTime: number) {
        var secDiff = Math.abs(currentTime - lastTime);
        var milliDiff = secDiff * 1000;
        return milliDiff > TOO_FAR_APART;
    }

    session.on("close", unsetListeners);

    function unsetListeners() {
        var videos = $('video');
        listeners.forEach(function(event) {
            videos.off(event.name, event.listener);
        });
        listeners = [];
    }


    session.hub.on('video-timeupdate', function(msg: VideoTimeupdateMessage) {
        var element = $findElement(msg.location);
        var oldTime = element.prop('currentTime');
        var newTime = msg.position;

        //to help throttle uneccesary position changes
        if(areTooFarApart(oldTime, newTime)) {
            setTime(element, msg.position);
        }
    });

    MIRRORED_EVENTS.forEach(function(eventName) {
        // TODO fix this call to .on
        session.hub.on("video-" + eventName, function(msg: VideoTimeupdateMessage) {
            var element = $findElement(msg.location);

            setTime(element, msg.position);

            element.trigger(eventName, { silent: true });
        });
    });

    //Currently does not discriminate between visible and invisible videos
    function $findElement(location: string) {
        return $(elementFinder.findElement(location));
    }

    function setTime(video: JQuery, time: number) {
        video.prop('currentTime', time);
    }

});
