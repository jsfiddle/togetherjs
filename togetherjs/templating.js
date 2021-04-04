/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "./session", "./util", "jquery"], function (require, exports, session_1, util_1, jquery_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.templating = void 0;
    jquery_1 = __importDefault(jquery_1);
    //function templatingMain($: JQueryStatic, util: TogetherJSNS.Util, _peers: TogetherJSNS.Peers, _windowing: TogetherJSNS.Windowing, session: TogetherJSNS.Session) {
    var assert = util_1.util.assert.bind(util_1.util);
    class Templating {
        clone(templateId) {
            let templateId2 = "#togetherjs-template-" + templateId;
            var template = jquery_1.default(templateId2);
            assert(template.length, "No template found with id:", templateId2);
            template = template.clone();
            template.attr("id", null);
            // FIXME: if called directly, doesn't emit new-element event:
            return template;
        }
        // TODO find if there is another way to do that. Using a restrictive prototype and a less restrictibe implementation because "in" check in if only works with union types which TogetherJSNS.TemplatingSub.Any is but TogetherJSNS.TemplatingSub.Map[K] is not
        //sub<K extends keyof TogetherJSNS.TemplatingSub.Map>(templateId: K, variables: TogetherJSNS.TemplatingSub.Map[K]): JQuery {
        //sub(templateId: keyof TogetherJSNS.TemplatingSub.Map, variables: TogetherJSNS.TemplatingSub.All): JQuery {
        sub(templateId, variables) {
            let template = this.clone(templateId);
            util_1.util.forEachAttr(variables, function (value, attr) {
                // FIXME: do the substitution... somehow?
                var subs = template.find(".togetherjs-sub-" + attr).removeClass("togetherjs-sub-" + attr);
                if (subs.length) {
                    if (typeof value == "string") {
                        subs.text(value);
                    }
                    else if (value instanceof jquery_1.default) { // TODO check cast, because TogetherJSNS.TemplatingSub.Any is reduced to never (or is it for another reason?), value is of type never which is not ok with in checks
                        subs.append(value); // TODO instanceof check does not constrains value as JQuery so we need this cast, can we remove it?
                    }
                    else {
                        // TODO should probably replace with console.error
                        assert(false, "Unknown variable value type:", attr, "=", value);
                    }
                }
                let ifs = template.find(".togetherjs-if-" + attr).removeClass("togetherjs-sub-" + attr);
                if (!value) {
                    ifs.hide();
                }
                ifs = template.find(".togetherjs-ifnot-" + attr).removeClass("togetherjs-ifnot-" + attr);
                if (value) {
                    ifs.hide();
                }
                let attrName = "data-togetherjs-subattr-" + attr;
                let attrs = template.find("[" + attrName + "]");
                attrs.each(function (_index, element) {
                    assert(typeof value == "string");
                    const $element = jquery_1.default(element);
                    let subAttribute = $element.attr(attrName);
                    $element.attr(attrName, null);
                    $element.attr(subAttribute, value);
                });
            });
            if ("peer" in variables && variables.peer) {
                variables.peer.view.setElement(template);
            }
            if ("date" in variables && variables.date) {
                let date = variables.date;
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
            session_1.session.emit("new-element", template);
            return template;
        }
    }
    exports.templating = new Templating();
});
//define(["jquery", "util", "peers", "windowing", "session"], templatingMain);
