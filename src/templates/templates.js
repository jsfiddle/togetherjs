/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Access to the localized HTML/text templates.
 *
 * Every locale is compiled into ./generated.js at build time (see
 * build/templates.mjs), so unlike the RequireJS version there is no
 * `templates-<lang>` module to fetch and no load-order race to work around.
 */

import TogetherJS from "../core/togetherjs.js";
import util from "../core/util.js";
import { locales, availableLocales } from "./generated.js";

var assert = util.assert;

/* Resolve the configured language against what was actually built.
   Falls back from a full tag to its base ("de-CH" -> "de" -> "de-DE"). */
function resolveLang() {
  var lang = TogetherJS.config.get("lang");
  if (lang === undefined) {
    // BCP 47 mandates hyphens, not underscores, to separate lang parts
    lang = (navigator.language || "").replace(/_/g, "-");
  }
  if (locales[lang]) {
    return lang;
  }
  // "de-CH" is not built, but "de-DE" may be: match on the base subtag.
  var base = lang.replace(/-.*$/, "").toLowerCase();
  var match = availableLocales.filter(function (candidate) {
    return candidate.toLowerCase() === base || candidate.toLowerCase().indexOf(base + "-") === 0;
  })[0];
  if (match) {
    return match;
  }
  var fallback = TogetherJS.config.get("fallbackLang");
  return locales[fallback] ? fallback : "en-US";
}

var resolved = null;

/* Substitutions that cannot be baked in at build time: they depend on where
   the script was served from and on per-site configuration. */
function clean(t) {
  // Removes <% /* ... */ %> comments:
  t = t.replace(/[<][%]\s*\/\*[\S\s\r\n]*\*\/\s*[%][>]/, "");
  t = util.trim(t);
  t = t.replace(/\{\{baseUrl\}\}/g, TogetherJS.baseUrl);
  t = t.replace(/TOOL_NAME/g, '<span class="togetherjs-tool-name">TogetherJS</span>');
  t = t.replace(/SITE_NAME/g, '<strong class="togetherjs-site-name">[site name]</strong>');
  t = t.replace(
    /TOOL_SITE_LINK/g,
    '<a href="https://togetherjs.com/" target="_blank"><span class="togetherjs-tool-name">TogetherJS</span></a>',
  );
  return t;
}

export default function templates(resourceName) {
  if (resolved === null) {
    resolved = resolveLang();
    // Publish the resolved value so the rest of the client and the host page
    // can see which locale actually won.
    TogetherJS.config("lang", resolved);
  }
  var bundle = locales[resolved];
  assert(bundle, "No templates for language", resolved);
  var template = bundle[resourceName];
  assert(template !== undefined, "No template named", resourceName);
  return clean(template);
}

export { availableLocales };
