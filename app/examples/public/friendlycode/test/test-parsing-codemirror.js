"use strict";

defineTests([
  "jquery",
  "fc/ui/parsing-codemirror"
], function($, ParsingCodeMirror) {
  module("ParsingCodeMirror");
  
  function pcmTest(name, cb) {
    test(name, function() {
      var place = $("<div></div>").appendTo(document.body);
      var events = [];
      var fakeTime = {
        id: 0,
        setTimeout: function(cb, ms) {
          this.cb = cb;
          events.push("time.setTimeout(fn, " + ms + ") -> " + this.id);
          return this.id++;
        },
        clearTimeout: function(id) {
          events.push("time.clearTimeout(" + id + ")");
        }
      };
      var cm = ParsingCodeMirror(place[0], {
        mode: "text/plain",
        parseDelay: 1,
        parse: function(code) {
          return {
            error: "here is an error",
            document: "here is a document"
          };
        },
        time: fakeTime
      });
      cm.on("all", function(eventName, arg) {
        events.push("cm.trigger('" + eventName + "')");
      });
      try {
        cb(cm, events, fakeTime);
      } finally {
        place.remove();
      }
    });
  }
  
  pcmTest("change triggered and timeout set on codeMirror.setValue()",
    function(cm, events, fakeTime) {
      cm.setValue("hello");
      deepEqual(events, [
        "cm.trigger('change')",
        "time.setTimeout(fn, 1) -> 0",
      ]);
    });

  pcmTest("change triggered but no timeout set if reparseEnabled is false",
    function(cm, events, fakeTime) {
      cm.reparseEnabled = false;
      cm.setValue("hello");
      deepEqual(events, [
        "cm.trigger('change')"
      ]);
    });
  
  pcmTest("reparse() triggers events and passes expected arguments",
    function(cm, events, fakeTime) {
      cm.setValue("hello"); events.splice(0);
      cm.on("reparse", function(arg) {
        equal(arg.document, "here is a document", "document passed");
        equal(arg.error, "here is an error", "error passed");
        equal(arg.sourceCode, "hello", "source code passed");
      });
      cm.reparse();
      deepEqual(events, [
        "cm.trigger('reparse')",
        "cm.trigger('cursor-activity')",
       ]);
    });
  
  pcmTest("old timeout cancelled on multiple content changes",
    function(cm, events, fakeTime) {
      cm.setValue("hello"); events.splice(0);
      cm.setValue("hello goober");
      deepEqual(events, [
        "cm.trigger('change')",
        "time.clearTimeout(0)",
        "time.setTimeout(fn, 1) -> 1"
      ]);
    });

  pcmTest("timeout function triggers events w/ expected args",
    function(cm, events, fakeTime) {
      cm.setValue("hello goober"); events.splice(0);
      cm.on("reparse", function(event) {
        equal(event.sourceCode, "hello goober",
              "correct source code is passed on reparse event");
      });
      fakeTime.cb();
      deepEqual(events, [
        "cm.trigger('reparse')",
        "cm.trigger('cursor-activity')"
      ], "events are triggered");
    });

  pcmTest("cursor-activity event is triggered by codeMirror.setCursor()",
    function(cm, events, fakeTime) {
      cm.setValue("hello"); events.splice(0);
      cm.setCursor({line: 0, ch: 2});
      deepEqual(events, ["cm.trigger('cursor-activity')"]);
    });
});
