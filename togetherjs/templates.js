/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// FIXME: maybe it would be better to dynamically assemble the first
// argument to define() here to include the localized module:
define(["util", "require"], function (util, require) {
  var assert = util.assert;

  function clean(t) {
    // Removes <% /* ... */ %> comments:
    t = t.replace(/[<][%]\s*\/\*[\S\s\r\n]*\*\/\s*[%][>]/, "");
    t = util.trim(t);
    t = t.replace(/http:\/\/localhost:8080/g, TogetherJS.baseUrl);
    t = t.replace(/TOOL_NAME/g, '<span class="togetherjs-tool-name">TogetherJS</span>');
    return t;
  }

  var lang = TogetherJS.getConfig("lang") || "en-US";
  var moduleName = "templates-" + lang;
  var templatesLang;
  console.warn("loading lang", lang, "template name", moduleName, TogetherJS.getConfig("lang"));
  require([moduleName], function (mod) {
    templatesLang = mod;
  });

  return function (resourceName) {
    // Sometimes require([moduleName]) doesn't return even after the
    // module has been loaded, but this sync version of require() will
    // pick up the module in that case:
    if (! templatesLang) {
      try {
        templatesLang = require(moduleName);
      } catch (e) {
      }
    }
    assert(templatesLang, "Templates not yet loaded");
    return clean(templatesLang[resourceName]);
  };

});
