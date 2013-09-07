
define(["jquery", "util", "session", "elementFinder"],
function($, util, session, elementFinder){
    var returnMe = util.Module("videos"),
    listeners = {},
    TIME_UPDATE = 'timeupdate',
    MIRRORED_EVENTS = ['play', 'pause'],
    TOO_FAR_APART = 3000;

    session.on("reinitialize", setupListeners);

    session.on("ui-ready", setupListeners);

    function setupListeners () {
        var videos = $('video');
        setupMirroredEvents(videos);
        setupTimeSync(videos);
    };

    function setupMirroredEvents (videos) {
        var currentListener;
        MIRRORED_EVENTS.forEach(function (eventName) {
            currentListener = getEventSender(eventName);
            videos.on(eventName, currentListener);
            listeners[eventName] = currentListener;
        });
    };

    function getEventSender (eventName) {
        return function (event, options) {
            var element = event.target;
            options || (options = {});
            if (!options.silent) {
                session.send({
                    type: ('video-'+eventName),
                    location: elementFinder.elementLocation(element),
                    position: element.currentTime
                });
            }
        }
    };

    function setupTimeSync (videos) {
        listeners[TIME_UPDATE] || (listeners[TIME_UPDATE] = []);
        videos.each(function(i, video) {
            var onTimeUpdate = getTimeUpdater();
            $(video).on(TIME_UPDATE, onTimeUpdate);
            listeners[TIME_UPDATE].push(onTimeUpdate);
        });
    };

    function getTimeUpdater () {
        var last = 0;
        return function (event) {
            var currentTime = event.target.currentTime;
            if(areTooFarApart(currentTime, last)){
                getEventSender(TIME_UPDATE)(event);
            }
            last = currentTime;
        };
    };

    function areTooFarApart (currentTime, lastTime) {
        var secDiff = Math.abs(currentTime - lastTime),
        milliDiff = secDiff * 1000;
        return milliDiff > TOO_FAR_APART;
    }

    session.on("close", unsetListeners);

    function unsetListeners () {
        var videos = $('video');
        Object.keys(listeners).forEach(function (eventName) {
            videos.off(eventName, listeners[eventName])
        });
        listeners = {};
    };


    session.hub.on('video-timeupdate', function (msg) {
        var element = $findElement(msg.location),
        oldTime = element.prop('currentTime'),
        newTime = msg.position;

        //to help throttle uneccesary position changes
        if(areTooFarApart(oldTime, newTime)){
            setTime(element, msg.position);
        };
    })

    MIRRORED_EVENTS.forEach( function (eventName) {
        session.hub.on("video-"+eventName, function (msg) {
            var element = $findElement(msg.location);

            setTime(element, msg.position);

            element.trigger(eventName, {silent: true});
        });
    })

    function $findElement (location) {
        return $(elementFinder.findElement(location));
    }

    function setTime (video, time) {
        video.prop('currentTime', time);
    }

    return returnMe;
});
