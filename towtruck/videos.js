
define(["jquery", "util", "session", "elementFinder"],
    function($, util, session, elementFinder){

    var returnMe = util.Module("videos"),
    listeners = {},
    TIME_UPDATE = 'timeupdate',
    MIRRORED_EVENTS = ['play', 'pause'],
    SYNC_CHECK = 4000,
    TOO_FAR_APART = 3000;


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

    function setupMirroredEvents (videos) {
        var currentListener;
        MIRRORED_EVENTS.forEach(function (eventName) {
            currentListener = getEventSender(eventName);
            videos.on(eventName, currentListener);
            listeners[eventName] = currentListener;
        });
    };

    //all clo
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

    function setupTimeSync (videos) {
        var onTimeUpdate = getTimeUpdater();
        videos.on(TIME_UPDATE, onTimeUpdate);
        listeners[TIME_UPDATE] = onTimeUpdate;
    };

    function setInit () {
        var videos = $('video');
        setupMirroredEvents(videos);
        setupTimeSync(videos);
    };

    function destroyTrackers () {
        var videos = $('video');
        Object.keys(listeners).forEach(function (eventName) {
            videos.off(eventName, listeners[eventName])
        });
        listeners = {};
    };


    function setTime (video, time) {
        video.prop('currentTime', time);
    }

    function areTooFarApart (currentTime, lastTime) {
        var secDiff = Math.abs(currentTime - lastTime),
        milliDiff = secDiff * 1000;
        return milliDiff > TOO_FAR_APART;
    }

    session.on("reinitialize", setInit);

    session.on("ui-ready", setInit);

    session.on("close", destroyTrackers);


    session.hub.on('video-timeupdate', function (msg) {
        var element = elementFinder.findElement(msg.position);
        element.prop.currentTime = msg.position;
    })

    MIRRORED_EVENTS.forEach( function (eventName) {
        session.hub.on("video-"+event, function (msg) {
            var element = elementFinder.findElement(msg.location);
            setTime(element, msg.position);
            element.trigger(eventName);
        });
    })


    return returnMe;

})
