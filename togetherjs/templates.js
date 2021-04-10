/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
define(["require", "exports", "./util"], function (require, exports, util_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.templates = void 0;
    //function templatesMain(util: TogetherJSNS.Util, require: Require) {
    const assert = util_1.util.assert.bind(util_1.util);
    function clean(t) {
        // Removes <% /* ... */ %> comments:
        console.log("TogetherJS.baseUrl", TogetherJS.baseUrl);
        t = t.replace(/[<][%]\s*\/\*[\S\s\r\n]*\*\/\s*[%][>]/, "");
        t = util_1.util.trim(t);
        t = t.replace(/http:\/\/localhost:8080\/togetherjs/g, TogetherJS.baseUrl);
        t = t.replace(/TOOL_NAME/g, '<span class="togetherjs-tool-name">TogetherJS</span>');
        t = t.replace(/SITE_NAME/g, '<strong class="togetherjs-site-name">[site name]</strong>');
        t = t.replace(/TOOL_SITE_LINK/g, '<a href="https://togetherjs.com/" target="_blank"><span class="togetherjs-tool-name">TogetherJS</span></a>');
        return t;
    }
    const lang = TogetherJS.config.get("lang") || "en-US";
    const moduleName = "templates-" + lang;
    let templatesLang;
    require([moduleName], function (mod) {
        templatesLang = mod;
    });
    function templates(resourceName) {
        // Sometimes require([moduleName]) doesn't return even after the module has been loaded, but this sync version of require() will pick up the module in that case:
        if (!templatesLang) {
            try {
                templatesLang = require(moduleName);
            }
            catch (e) {
                console.warn("Error requiring module:", e);
            }
        }
        assert(templatesLang, "Templates not yet loaded");
        return clean(templatesLang[resourceName] || "");
    }
    exports.templates = templates;
});
// FIXME: maybe it would be better to dynamically assemble the first
// argument to define() here to include the localized module:
//define(["util", "require"], templatesMain);
