"use strict";

defineTests(["jquery", "slowparse-errors"], function($) {
  module("slowparse-errors");

  test("base errors are available", function() {
    equal($.errorTemplates.filter(".CLOSE_TAG_FOR_VOID_ELEMENT").length, 1);
  });
  
  test("forbidjs errors are available", function() {
    equal($.errorTemplates.filter(".SCRIPT_ELEMENT_NOT_ALLOWED").length, 1);
  });
});
