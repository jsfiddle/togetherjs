/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
define(["require", "jquery", "util"], function (require, $, util) {
  var translator = util.Module("translator");
  var assert = util.assert;

  //FIXME: Read API key from config env
  //Simon's severely limited API key
  translator.apiKey = "AIzaSyDoLqBvTaoeCytNtJC2gJUGoWhPi6kMLLg";

  translator.translate = function(text, source, target, callback){
    var apiurl = "https://www.googleapis.com/language/translate/v2?key=" + translator.apiKey +
      "&source=" + source +
      "&target=" + target +
      "&q=";

    $.ajax({
      url: apiurl + encodeURIComponent(text),
      dataType: 'jsonp',
      success: function(data) {
        if (typeof callback === 'function'){
          // TODO: Emit array of translations
          callback(data.data.translations[0].translatedText);
        }
      }
    });
  }

  translator.detect = function(text){
  }

  return translator;
});

