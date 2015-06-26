define(['togetherjs/eventTracking'], function(eventTracking) {
  'use strict';

  describe('Event tracking', function() {
    var callbackContainer;
    var eventName;

    beforeEach(function() {
      callbackContainer = {};
      callbackContainer.callback = function (){};
      spyOn(callbackContainer, 'callback');
      eventName = 'testEvent';
    });

    describe('.on', function() {
      it('should trigger a callback for an event', function() {
        eventTracking.on(eventName, callbackContainer.callback);
        eventTracking.emit(eventName);

        expect(callbackContainer.callback).toHaveBeenCalled();
      });

      it('should trigger a callback repeatedly', function() {
        eventTracking.on(eventName, callbackContainer.callback);
        eventTracking.emit(eventName);
        eventTracking.emit(eventName);

        expect(callbackContainer.callback.calls.count()).toEqual(2);
      });

      it("should Throw if the callback isn't a function", function() {
        var fakeCallback = 'string';
        expect(function(){eventTracking.on(eventName, fakeCallback)}).toThrow();
      });

      it('should be able to take multiple events', function() {
        var eventName2 = 'secondTestEvent';

        eventTracking.on(
          eventName + ' ' + eventName2,
          callbackContainer.callback
        );

        eventTracking.emit(eventName);
        eventTracking.emit(eventName2);

        expect(callbackContainer.callback.calls.count()).toEqual(2);
      });
    });

    describe('.once', function() {
      it('should trigger a callback for an event', function() {
        eventTracking.once(eventName, callbackContainer.callback);
        eventTracking.emit(eventName);

        expect(callbackContainer.callback).toHaveBeenCalled();
      });

      it('should only trigger a callback once', function() {
        eventTracking.once(eventName, callbackContainer.callback);
        eventTracking.emit(eventName);
        eventTracking.emit(eventName);

        expect(callbackContainer.callback).toHaveBeenCalled();
        expect(callbackContainer.callback.calls.count()).toEqual(1);
      });
    });

    describe('.off', function() {
      it('should remove a callback for an event', function() {
        eventTracking.on(eventName, callbackContainer.callback);
        eventTracking.emit(eventName);

        expect(callbackContainer.callback).toHaveBeenCalled();

        eventTracking.off(eventName, callbackContainer.callback);
        eventTracking.emit(eventName);

        expect(callbackContainer.callback.calls.count()).toEqual(1);
      });

      it('should be able to remove a callback for multiple events', function() {
        var eventName2 = 'secondTestEvent';

        eventTracking.on(
          eventName + ' ' + eventName2,
          callbackContainer.callback
        );

        eventTracking.emit(eventName);
        eventTracking.emit(eventName2);

        expect(callbackContainer.callback.calls.count()).toEqual(2);

        eventTracking.off(
          eventName + ' ' + eventName2,
          callbackContainer.callback
        );
        eventTracking.emit(eventName);
        eventTracking.emit(eventName2);

        expect(callbackContainer.callback.calls.count()).toEqual(2);
      });

      it(
        'should be able to remove a callback for an event, when multiple have been added',
        function() {
          var eventName2 = 'secondTestEvent';

          eventTracking.on(
            eventName + ' ' + eventName2,
            callbackContainer.callback
          );

          eventTracking.emit(eventName);
          eventTracking.emit(eventName2);

          expect(callbackContainer.callback.calls.count()).toEqual(2);

          eventTracking.off(eventName, callbackContainer.callback);
          eventTracking.emit(eventName);
          eventTracking.emit(eventName2);

          expect(callbackContainer.callback.calls.count()).toEqual(3);
        }
      );
    });
  });
});
