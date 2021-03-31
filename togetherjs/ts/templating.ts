/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { session } from "./session";
import { TogetherJSNS } from "./types/togetherjs";
import { util } from "./util";

//function templatingMain($: JQueryStatic, util: TogetherJSNS.Util, _peers: TogetherJSNS.Peers, _windowing: TogetherJSNS.Windowing, session: TogetherJSNS.Session) {
var assert: typeof util.assert = util.assert;

class Templating {
    clone(templateId: string) { // TODO may be changed to a union type with all possibilities?
        let templateId2 = "#togetherjs-template-" + templateId;
        var template = $(templateId2);
        assert(template.length, "No template found with id:", templateId2);
        template = template.clone();
        template.attr("id", null);
        // FIXME: if called directly, doesn't emit new-element event:
        return template;
    }

    // TODO find if there is another way to do that. Using a restrictive prototype and a less restrictibe implementation because "in" check in if only works with union types which TogetherJSNS.TemplatingSub.Any is but TogetherJSNS.TemplatingSub.Map[K] is not
    //sub<K extends keyof TogetherJSNS.TemplatingSub.Map>(templateId: K, variables: TogetherJSNS.TemplatingSub.Map[K]): JQuery {
    //sub(templateId: keyof TogetherJSNS.TemplatingSub.Map, variables: TogetherJSNS.TemplatingSub.All): JQuery {
    sub(templateId: keyof TogetherJSNS.TemplatingSub.Map, variables: TogetherJSNS.TemplatingSub.Any): JQuery {
        let template = this.clone(templateId);
        util.forEachAttr(variables, function(value, attr) { // TODO value has type never
            // FIXME: do the substitution... somehow?
            var subs = template.find(".togetherjs-sub-" + attr).removeClass("togetherjs-sub-" + attr);
            if(subs.length) {
                if(typeof value == "string") {
                    subs.text(value);
                }
                else if((value as object) instanceof $) { // TODO check cast, because TogetherJSNS.TemplatingSub.Any is reduced to never (or is it for another reason?), value is of type never which is not ok with in checks
                    subs.append(value as JQuery); // TODO instanceof check does not constrains value as JQuery so we need this cast, can we remove it?
                }
                else {
                    // TODO should probably replace with console.error
                    assert(false, "Unknown variable value type:", attr, "=", value);
                }
            }
            let ifs = template.find(".togetherjs-if-" + attr).removeClass("togetherjs-sub-" + attr);
            if(!value) {
                ifs.hide();
            }
            ifs = template.find(".togetherjs-ifnot-" + attr).removeClass("togetherjs-ifnot-" + attr);
            if(value) {
                ifs.hide();
            }
            let attrName = "data-togetherjs-subattr-" + attr;
            let attrs = template.find("[" + attrName + "]");
            attrs.each(function(_index, element) {
                assert(typeof value == "string");
                const $element = $(element);
                let subAttribute = $element.attr(attrName);
                $element.attr(attrName, null);
                $element.attr(subAttribute, value);
            });
        });
        if("peer" in variables && variables.peer) {
            variables.peer.view.setElement(template);
        }
        if("date" in variables && variables.date) {
            let date: Date | number = variables.date;
            if(typeof date == "number") {
                date = new Date(date);
            }
            var ampm = "AM";
            var hour = date.getHours();
            if(hour > 12) {
                hour -= 12;
                ampm = "PM";
            }
            var minute = date.getMinutes();
            var t = hour + ":";
            if(minute < 10) {
                t += "0";
            }
            t += minute;
            template.find(".togetherjs-time").text(t);
            template.find(".togetherjs-ampm").text(ampm);
        }

        // FIXME: silly this is on session:
        session.emit("new-element", template);
        return template;
    }
}

export const templating = new Templating();

//define(["jquery", "util", "peers", "windowing", "session"], templatingMain);
