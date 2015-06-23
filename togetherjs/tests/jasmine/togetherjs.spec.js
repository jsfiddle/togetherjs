define(['togetherjs'], function(togetherJS) {
  'use strict';
  ddescribe('TogetherJS', function() {
    it('should exist', function() {
      expect(typeof togetherJS === 'function').toEqual(true);
    });

    // Properties
    describe('pageLoaded', function() {
      it('should be no later than now', function() {
        expect(togetherJS.pageLoaded <= Date.now()).toEqual(true);
      });
    });

    describe('running', function() {
      it('should be false on load', function() {
        expect(togetherJS.running).toEqual(false);
      });

      // TJS isn't booting for some reason. Hard to test properly without a
      // way to grab the ready event. Spy perhaps?
      xit('should be true when togetherJS has booted', function() {
        togetherJS.on(
          'ready',
          function() {
            expect(togetherJS.running).toEqual(false);
          }
        );

        togetherJS();
      });
    });

    describe('version', function() {
      it('should return the version of the library', function() {
        expect(togetherJS.version).toEqual('unknown');
      });
    });

    describe('baseUrl', function() {
      it('should contain the current host by default', function() {
        var host = window.location.host;

        expect(togetherJS.baseUrl.indexOf(host)).not.toEqual(-1);
      });

      // Probably needs to be running/set by global before we can do this.
      xit('should match the provided config', function() {
        var testBaseUrl = 'testBaseUrl';

        togetherJS.config('baseUrl', testBaseUrl);

        expect(togetherJS.baseUrl.indexOf(testBaseUrl)).not.toEqual(-1);
      });
    });

    // Functions
    describe('startup', function() {});

    describe('Event handling', function() {
      var callbackContainer;
      var eventName;

      beforeEach(function() {
        callbackContainer = {};
        callbackContainer.callback = function (){};
        spyOn(callbackContainer, 'callback');
        eventName = 'testEvent';
      });

      describe('on', function() {
        it('should trigger a callback for an event', function() {
          togetherJS.on(eventName, callbackContainer.callback);
          togetherJS.emit(eventName);

          expect(callbackContainer.callback).toHaveBeenCalled();
        });

        it('should trigger a callback repeatedly', function() {
          togetherJS.on(eventName, callbackContainer.callback);
          togetherJS.emit(eventName);
          togetherJS.emit(eventName);

          expect(callbackContainer.callback.calls.count()).toEqual(2);
        });

        it("should Throw if the callback isn't a function", function() {
          var fakeCallback = 'string';
          expect(function(){togetherJS.on(eventName, fakeCallback)}).toThrow();
        });

        it('should be able to take multiple events', function() {
          var eventName2 = 'secondTestEvent';

          togetherJS.on(
            eventName + ' ' + eventName2,
            callbackContainer.callback
          );

          togetherJS.emit(eventName);
          togetherJS.emit(eventName2);

          expect(callbackContainer.callback.calls.count()).toEqual(2);
        });
      });

      describe('once', function() {
        it('should trigger a callback for an event', function() {
          togetherJS.once(eventName, callbackContainer.callback);
          togetherJS.emit(eventName);

          expect(callbackContainer.callback).toHaveBeenCalled();
        });

        it('should only trigger a callback once', function() {
          togetherJS.once(eventName, callbackContainer.callback);
          togetherJS.emit(eventName);
          togetherJS.emit(eventName);

          expect(callbackContainer.callback).toHaveBeenCalled();
          expect(callbackContainer.callback.calls.count()).toEqual(1);
        });
      });

      describe('off', function() {
        it('should remove a callback for an event', function() {
          togetherJS.on(eventName, callbackContainer.callback);
          togetherJS.emit(eventName);

          expect(callbackContainer.callback).toHaveBeenCalled();

          togetherJS.off(eventName, callbackContainer.callback);
          togetherJS.emit(eventName);

          expect(callbackContainer.callback.calls.count()).toEqual(1);
        });

        it('should be able to remove a callback for multiple events', function() {
          var eventName2 = 'secondTestEvent';

          togetherJS.on(
            eventName + ' ' + eventName2,
            callbackContainer.callback
          );

          togetherJS.emit(eventName);
          togetherJS.emit(eventName2);

          expect(callbackContainer.callback.calls.count()).toEqual(2);

          togetherJS.off(
            eventName + ' ' + eventName2,
            callbackContainer.callback
          );
          togetherJS.emit(eventName);
          togetherJS.emit(eventName2);

          expect(callbackContainer.callback.calls.count()).toEqual(2);
        });

        it(
          'should be able to remove a callback for an event, when multiple have been added',
          function() {
            var eventName2 = 'secondTestEvent';

            togetherJS.on(
              eventName + ' ' + eventName2,
              callbackContainer.callback
            );

            togetherJS.emit(eventName);
            togetherJS.emit(eventName2);

            expect(callbackContainer.callback.calls.count()).toEqual(2);

            togetherJS.off(eventName, callbackContainer.callback);
            togetherJS.emit(eventName);
            togetherJS.emit(eventName2);

            expect(callbackContainer.callback.calls.count()).toEqual(3);
          }
        );
      });
    });

    describe('toString', function() {
      it('should return the name of the library', function() {
        expect(togetherJS.toString()).toEqual('TogetherJS');
      });
    });

    describe('Configuration', function() {
      describe('getConfig', function() {
        it('should get the value for a given config key', function() {
        });
      });

      describe('config', function() {
        var configName;
        var configValue;

        beforeEach(function() {
          configName = 'testConfig';
          configValue = 'testValue';
        });

        it('should set a config value', function() {
          togetherJS.config(configName, configValue);

          expect(togetherJS.config.get(configName)).toEqual(configValue);
        });

        it('should set config from an object', function() {
          var configObj = {};

          configObj[configName] = configValue;
          togetherJS.config(configObj);

          expect(togetherJS.config.get(configName)).toEqual(configValue);
        });

        it('should throw if the only argument is not an object', function() {
          expect(function(){togetherJS.config(configName)}).toThrow();
        });

        // Needs ignored value tests here.
      });

      describe('track', function(){
        var callbackContainer;
        var paramName;

        beforeEach(function() {
          callbackContainer = {};
          callbackContainer.callback = function (){};
          spyOn(callbackContainer, 'callback');
          paramName = 'dontShowClicks';
        });

        it('should add a callback to a parameter', function() {
          togetherJS.config.track(paramName, callbackContainer.callback);
          expect(callbackContainer.callback).toHaveBeenCalled();
        });

        it('should call a callback when the value changes', function() {
          togetherJS.config.track(paramName, callbackContainer.callback);
          expect(callbackContainer.callback.calls.count()).toEqual(1);
          togetherJS.config(paramName, true);
          expect(callbackContainer.callback.calls.count()).toEqual(2);
        });

        it('should return the callback', function() {
          var returnValue = togetherJS.config.track(paramName, callbackContainer.callback);

          expect(returnValue).toBe(callbackContainer.callback);
        });

        it('should throw if the parameter is not in the default config', function() {
          expect(function(){togetherJS.config.track('fakeParam', callbackContainer.callback);}).toThrow();
        });
      });

      describe('close', function(){
        var callbackContainer;
        var paramName;

        beforeEach(function() {
          callbackContainer = {};
          callbackContainer.callback = function (){};
          spyOn(callbackContainer, 'callback');
          paramName = 'dontShowClicks';
        });

        it('should prevent a value being changed if TogetherJS is running', function() {
          // This is not the best way of doing this, because it requires knowledge of the internals.
          // Ideally it would be a function call that has this side effect, but I want a controlled system
          togetherJS.running = true;

          expect(function(){togetherJS.config(paramName, true)}).not.toThrow();

          togetherJS.config.close(paramName);

          expect(function(){togetherJS.config(paramName, true)}).toThrow();
        });

        it('should throw if the parameter is not in the default config', function() {
          expect(function(){togetherJS.config.close('fakeParam')}).toThrow();
        });
      });
    });

    describe('reinitialize', function() {});
    describe('refreshUserData', function() {});
    describe('hub', function() {});
    describe('send', function() {});
    describe('shareUrl', function() {});
    describe('listenForShortcut', function() {});
    describe('removeShortcut', function() {});
    describe('checkForUsersOnChannel', function() {});
  });
});
