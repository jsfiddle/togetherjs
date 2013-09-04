"use strict";

// This class is responsible for communicating with a publishing server
// to save and load published code.
define(["jquery"], function($) {
  var myOrigin = window.location.protocol + "//" + window.location.host;
  
  function Publisher(baseURL) {
    // We want to support CORS for development but in production it doesn't
    // matter because all requests will be same-origin. However, browsers
    // that don't support CORS will barf if they're given absolute URLs to
    // the same domain, so we want to return relative URLs in such cases.
    function makeURL(path) {
      if (baseURL == myOrigin)
        return path;
      path = baseURL + path;
      if (!$.support.cors && window.console)
        window.console.warn("No CORS detected for request to " + path);
      return path;
    }

    return {
      baseURL: baseURL,
      loadCode: function(path, cb) {
        $.ajax({
          type: 'GET',
          url: makeURL(path),
          dataType: 'text',
          error: function(data) {
            cb(data);
          },
          success: function(data) {
            cb(null, fixDoctypeHeadBodyMunging(data), baseURL + path);
          }
        });
      },
      saveCode: function(data, originalURL, cb) {
        $.ajax({
          type: 'POST',
          url: makeURL('/api/page'),
          data: {
            'html': data,
            'original-url': originalURL || ''
          },
          dataType: 'text',
          error: function(data) {
            cb(data);
          },
          success: function(data) {
            cb(null, {path: data, url: baseURL + data});
          }
        });
      }
    };
  }
  
  // This is a fix for https://github.com/mozilla/webpagemaker/issues/20.
  function fixDoctypeHeadBodyMunging(html) {
    var lines = html.split('\n');
    if (lines.length > 2 &&
        lines[0] == '<!DOCTYPE html><html><head>' &&
        lines[lines.length-1] == '</body></html>') {
      return '<!DOCTYPE html>\n<html>\n  <head>\n' +
             lines.slice(1, -1).join('\n') + '</body>\n</html>';
    }
    return html;
  }
  
  // Exposing this for unit testing purposes only.
  Publisher._fixDoctypeHeadBodyMunging = fixDoctypeHeadBodyMunging;
  
  return Publisher;
});
