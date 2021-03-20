/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

interface Template {
    interface: string;
    walkthrough: string;
    names: string;
}

function templatesMain(util: Util, require: Require) {
    let assert: typeof util.assert = util.assert;

    function clean(t: string) {
        // Removes <% /* ... */ %> comments:
        t = t.replace(/[<][%]\s*\/\*[\S\s\r\n]*\*\/\s*[%][>]/, "");
        t = util.trim(t);
        t = t.replace(/http:\/\/localhost:8080/g, TogetherJS.baseUrl);
        t = t.replace(/TOOL_NAME/g, '<span class="togetherjs-tool-name">TogetherJS</span>');
        t = t.replace(/SITE_NAME/g, '<strong class="togetherjs-site-name">[site name]</strong>');
        t = t.replace(/TOOL_SITE_LINK/g, '<a href="https://togetherjs.com/" target="_blank"><span class="togetherjs-tool-name">TogetherJS</span></a>');
        return t;
    }

    var lang = TogetherJS.getConfig("lang") || "en-US";
    var moduleName = "templates-" + lang;
    var templatesLang: Template;
    require([moduleName], function(mod: Template) {
        templatesLang = mod;
    });

    return function(resourceName: keyof Template) {
        // Sometimes require([moduleName]) doesn't return even after the
        // module has been loaded, but this sync version of require() will
        // pick up the module in that case:
        if(!templatesLang) {
            try {
                templatesLang = require(moduleName);
            } catch(e) {
                console.warn("Error requiring module:", e);
            }
        }
        assert(templatesLang, "Templates not yet loaded");
        return clean(templatesLang[resourceName]);
    };
}

// FIXME: maybe it would be better to dynamically assemble the first
// argument to define() here to include the localized module:
define(["util", "require"], templatesMain);
