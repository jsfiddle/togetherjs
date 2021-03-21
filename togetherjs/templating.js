"use strict";
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
;
function templatingMain($, util, peers, windowing, session) {
    var assert = util.assert;
    var Templating = /** @class */ (function () {
        function Templating() {
        }
        Templating.prototype.clone = function (templateId) {
            var templateId2 = "#togetherjs-template-" + templateId;
            var template = $(templateId2);
            assert(template.length, "No template found with id:", templateId2);
            template = template.clone();
            template.attr("id", null);
            // FIXME: if called directly, doesn't emit new-element event:
            return template;
        };
        Templating.prototype.sub = function (templateId, variables) {
            var template = this.clone(templateId);
            util.forEachAttr(variables, function (value, attr) {
                // FIXME: do the substitution... somehow?
                var subs = template.find(".togetherjs-sub-" + attr).removeClass("togetherjs-sub-" + attr);
                if (subs.length) {
                    if (typeof value == "string") {
                        subs.text(value);
                    }
                    else if (value instanceof $) {
                        subs.append(value); // TODO instanceof check does not constrains value as JQuery so we need this cast, can we remove it?
                    }
                    else {
                        // TODO should probably replace with console.error
                        assert(false, "Unknown variable value type:", attr, "=", value);
                    }
                }
                var ifs = template.find(".togetherjs-if-" + attr).removeClass("togetherjs-sub-" + attr);
                if (!value) {
                    ifs.hide();
                }
                ifs = template.find(".togetherjs-ifnot-" + attr).removeClass("togetherjs-ifnot-" + attr);
                if (value) {
                    ifs.hide();
                }
                var attrName = "data-togetherjs-subattr-" + attr;
                var attrs = template.find("[" + attrName + "]");
                attrs.each(function (index, element) {
                    assert(typeof value == "string");
                    var $element = $(element);
                    var subAttribute = $element.attr(attrName);
                    $element.attr(attrName, null);
                    $element.attr(subAttribute, value);
                });
            });
            if (variables.peer) {
                variables.peer.view.setElement(template);
            }
            if (variables.date) {
                var date = variables.date;
                if (typeof date == "number") {
                    date = new Date(date);
                }
                var ampm = "AM";
                var hour = date.getHours();
                if (hour > 12) {
                    hour -= 12;
                    ampm = "PM";
                }
                var minute = date.getMinutes();
                var t = hour + ":";
                if (minute < 10) {
                    t += "0";
                }
                t += minute;
                template.find(".togetherjs-time").text(t);
                template.find(".togetherjs-ampm").text(ampm);
            }
            // FIXME: silly this is on session:
            session.emit("new-element", template);
            return template;
        };
        return Templating;
    }());
    return new Templating();
}
define(["jquery", "util", "peers", "windowing", "session"], templatingMain);
