"use strict";

define([
  'jquery-slowparse',
  'text!slowparse/spec/errors.base.html',
  'text!slowparse/spec/errors.forbidjs.html'
], function($, base, forbidjs) {
  [base, forbidjs].forEach(function(html) {
    var div = $('<div></div>').html(html);
    $.errorTemplates = $.errorTemplates.add($(".error-msg", div));
  });
});
