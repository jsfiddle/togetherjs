
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

    function setupTimeSync (videos) {
        var onTimeUpdate = getTimeUpdater();
        videos.on(TIME_UPDATE, onTimeUpdate);
        listeners[TIME_UPDATE] = onTimeUpdate;
    };

    function getTimeUpdater () {
        var last = 0;
        return function (){
            var currentTime = event.target.currentTime;
            if(areTooFarApart(currentTime, last)){
                getEventSender(TIME_UPDATE)(event);
            }
            last = currentTime;
        };
    };

    function getEventSender (eventName) {
        return function (event) {
            var element = event.target;
            session.send({
                type: ('video-'+eventName),
                //'this' should refer to the video element grabbed by
                //jquery, but watch out for this
                location: elementFinder.elementLocation(element),
                position: element.currentTime
            });
        }
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
        var element = elementFinder.findElement(msg.position),
        onTimeUpdate = listeners[TIME_UPDATE],
        oldTime = element.prop('currentTime'),
        newTime = msg.position;

        //to help throttle uneccesary position changes
        if(areTooFarApart(oldTime, newTime)){
            setTime(element, msg.position);
        };
    })

    MIRRORED_EVENTS.forEach( function (eventName) {
        session.hub.on("video-"+eventName, function (msg) {
            var element = elementFinder.findElement(msg.location),
            state = lookupState(msg);
            setTime(element, msg.position);
            //UI tested in chromium:
            //this won't trigger an infinite event loop
            element.trigger(eventName);
        });
    })

    function setTime (video, time) {
        video.prop('currentTime', time);
    }

    return returnMe;
});
