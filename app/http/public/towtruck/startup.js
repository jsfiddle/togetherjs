/* This module handles all the different UI that happens (sometimes in order) when
   TowTruck is started:

   - Introduce the session when you've been invited
   - Show any browser compatibility indicators
   - Show the walkthrough the first time
   - Show the share link window

   When everything is done it fires session.emit("startup-ready")

*/
define(["util", "require", "jquery", "modal"], function (util, require, $, modal) {
  var assert = util.assert;
  var startup = util.Module("startup");
  // Avoid circular import:
  var session = null;

  var STEPS = [
    "browserBroken",
    "browserUnsupported",
    "sessionIntro",
    "walkthrough",
    // FIXME: see about() later if you add anything after here:
    "about"
    ];

  var currentStep = null;

  startup.start = function () {
    if (! session) {
      require(["session"], function (sessionModule) {
        session = sessionModule;
        startup.start();
      });
      return;
    }
    var index = -1;
    if (currentStep) {
      index = STEPS.indexOf(currentStep);
    }
    index++;
    if (index >= STEPS.length) {
      session.emit("startup-ready");
      return;
    }
    currentStep = STEPS[index];
    handlers[currentStep](startup.start);
  };

  var handlers = {

    browserBroken: function (next) {
      if (window.WebSocket) {
        next();
        return;
      }
      modal.showModal("#towtruck-browser-broken", function () {
        session.close();
      });
    },

    browserUnsupported: function (next) {
      if (! $.browser.msie) {
        next();
        return;
      }
      modal.showModal("#towtruck-browser-unsupported", function () {
        next();
      });
    },

    sessionIntro: function (next) {
      if ((! session.isClient) || ! session.firstRun) {
        next();
        return;
      }
      var cancelled = false;
      modal.showModal("#towtruck-intro", function () {
        if (! cancelled) {
          next();
        }
      });
      $("#towtruck-intro .towtruck-modal-dont-join").click(function () {
        cancelled = true;
        modal.stopModal();
        session.close();
      });
    },

    walkthrough: function (next) {
      if (session.settings.get("seenIntroDialog")) {
        next();
        return;
      }
      require(["walkthrough"], function (walkthrough) {
        walkthrough.start(function () {
          session.settings.set("seenIntroDialog", true);
          next();
        });
      });
    },

    about: function (next) {
      if (session.isClient || ! session.firstRun) {
        next();
        return;
      }
      require(["ui"], function (ui) {
        ui.displayWindow("#towtruck-about");
        // FIXME: no way to detect when the window is closed
      });
    }

  };

  return startup;
});
