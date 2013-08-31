
define(["jquery", "util", "session", "elementFinder"],
    function($, util, session, elementFinder){
    var video = util.Module("videos"),
    listeners = {},
    MIRRORED_EVENTS = ['play', 'pause'];


    function getEventSender (event) {
        return function () {
            session.send({
                type: ('video-'+event),
                //'this' should refer to the video element grabbed by
                //jquery, but watch out for this
                location: elementFinder.elementLocation(this),
                position: this.currentTime
            });
        }
    }

    function setupMirroredEvents (videos) {
        var currentListener;
        MIRRORED_EVENTS.forEach(function (event) {
            currentListener = getEventSender(event);
            videos.on(event, currentListener);
            listeners[event] = currentListener;
        });
    }
    function setInit ( ) {
        var videos = $('video');
        setupMirroredEvents(videos);
    }

    function destroyTrackers () {
        var videos = $('video');
        MIRRORED_EVENTS.forEach(function (event) {
            videos.off(event, listeners[event])
        });
        listeners = [];
    }

    session.on("reinitialize", setInit);

    session.on("ui-ready", setInit);

    session.on("close", destroyTrackers);

    MIRRORED_EVENTS.forEach( function (event) {
        session.hub.on("video-"+event, function (msg) {
            var element = elementFinder.findElement(msg.location);
            element.prop('currentTime', msg.position);
            element.trigger(event);
        });
    })


    return video;

})
