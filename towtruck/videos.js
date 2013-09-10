
define(["jquery", "util", "session", "elementFinder"],
function($, util, session, elementFinder){

  var listeners = {};

  var TIME_UPDATE = 'timeupdate';
  var MIRRORED_EVENTS = ['play', 'pause'];

  var TOO_FAR_APART = 3000;

  session.on("reinitialize", function () {
    unsetListeners();
    setupListeners();
  });

  session.on("ui-ready", setupListeners);

  function setupListeners() {
    var videos = $('video');
    setupMirroredEvents(videos);
    setupTimeSync(videos);
  };

  function setupMirroredEvents(videos) {
    var currentListener;
    MIRRORED_EVENTS.forEach(function (eventName) {
      currentListener = makeEventSender(eventName);
      videos.on(eventName, currentListener);
      listeners[eventName] = currentListener;
    });
  };

  function makeEventSender(eventName) {
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

  function setupTimeSync(videos) {
    listeners[TIME_UPDATE] || (listeners[TIME_UPDATE] = []);
    videos.each(function(i, video) {
      var onTimeUpdate = makeTimeUpdater();
      $(video).on(TIME_UPDATE, onTimeUpdate);
      listeners[TIME_UPDATE].push(onTimeUpdate);
    });
  };

  function makeTimeUpdater() {
    var last = 0;
    return function (event) {
      var currentTime = event.target.currentTime;
      if(areTooFarApart(currentTime, last)){
        makeEventSender(TIME_UPDATE)(event);
      }
      last = currentTime;
    };
  };

  function areTooFarApart(currentTime, lastTime) {
    var secDiff = Math.abs(currentTime - lastTime);
    var milliDiff = secDiff * 1000;
    return milliDiff > TOO_FAR_APART;
  }

  session.on("close", unsetListeners);

  function unsetListeners() {
    var videos = $('video');
    Object.keys(listeners).forEach(function (eventName) {
      var listener = listeners[eventName];
      if (listener instanceof Array) {
        listener.forEach(function (fn) {
          videos.off(eventName, fn);
        });
      } else {
        videos.off(eventName, listener);
      }
    });
    listeners = {};
  };


  session.hub.on('video-timeupdate', function (msg) {
    var element = $findElement(msg.location);
    var oldTime = element.prop('currentTime');
    var newTime = msg.position;

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

  //Currently does not discriminate between visible and invisible videos
  function $findElement(location) {
    return $(elementFinder.findElement(location));
  }

  function setTime(video, time) {
    video.prop('currentTime', time);
  }

});