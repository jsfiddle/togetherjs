/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "./peers", "./session", "./templates", "./templating", "./ui", "./util", "./windowing", "jquery"], function (require, exports, peers_1, session_1, templates_1, templating_1, ui_1, util_1, windowing_1, jquery_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.walkthrough = exports.Walkthrough = void 0;
    jquery_1 = __importDefault(jquery_1);
    //function walkthroughMain(util: TogetherJSNS.Util, ui: TogetherJSNS.Ui, $: JQueryStatic, windowing: TogetherJSNS.Windowing, templates: TogetherJSNS.Templates, templating: TogetherJSNS.Templating, session: TogetherJSNS.Session, peers: TogetherJSNS.Peers) {
    let assert = util_1.util.assert.bind(util_1.util);
    let onHideAll = null;
    let container; // TODO init
    let slides; // TODO init
    function show(index) {
        slides.hide();
        jquery_1.default(slides[index]).show();
        var bullets = container.find("#togetherjs-walkthrough-progress .togetherjs-walkthrough-slide-progress");
        bullets.removeClass("togetherjs-active");
        jquery_1.default(bullets[index]).addClass("togetherjs-active");
        var $next = jquery_1.default("#togetherjs-walkthrough-next").removeClass("togetherjs-disabled");
        var $previous = jquery_1.default("#togetherjs-walkthrough-previous").removeClass("togetherjs-disabled");
        if (index == slides.length - 1) {
            $next.addClass("togetherjs-disabled");
        }
        else if (index === 0) {
            $previous.addClass("togetherjs-disabled");
        }
    }
    function previous() {
        var index = getIndex();
        index--;
        if (index < 0) {
            index = 0;
        }
        show(index);
    }
    function next() {
        var index = getIndex();
        index++;
        if (index >= slides.length) {
            index = slides.length - 1;
        }
        show(index);
    }
    function getIndex() {
        var active = slides.filter(":visible");
        if (!active.length) {
            return 0;
        }
        for (var i = 0; i < slides.length; i++) {
            if (slides[i] == active[0]) {
                return i;
            }
        }
        return 0;
    }
    class Walkthrough {
        start(firstTime, doneCallback = null) {
            if (!container) {
                container = jquery_1.default(templates_1.templates("walkthrough"));
                container.hide();
                ui_1.ui.container.append(container);
                slides = container.find(".togetherjs-walkthrough-slide");
                slides.hide();
                var progress = jquery_1.default("#togetherjs-walkthrough-progress");
                slides.each(function (index) {
                    var bullet = templating_1.templating.sub("walkthrough-slide-progress", {});
                    progress.append(bullet);
                    bullet.click(function () {
                        show(index);
                    });
                });
                container.find("#togetherjs-walkthrough-previous").click(previous);
                container.find("#togetherjs-walkthrough-next").click(next);
                ui_1.ui.prepareShareLink(container);
                container.find(".togetherjs-self-name").bind("keyup", function (event) {
                    var val = jquery_1.default(event.target).val();
                    peers_1.peers.Self.update({ name: val });
                });
                container.find(".togetherjs-swatch").click(function () {
                    var picker = jquery_1.default("#togetherjs-pick-color");
                    if (picker.is(":visible")) {
                        picker.hide();
                        return;
                    }
                    picker.show();
                    picker.find(".togetherjs-swatch-active").removeClass("togetherjs-swatch-active");
                    picker.find(".togetherjs-swatch[data-color=\"" + peers_1.peers.Self.color + "\"]").addClass("togetherjs-swatch-active");
                    var location = container.find(".togetherjs-swatch").offset(); // TODO !
                    picker.css({
                        top: location.top,
                        // The -7 comes out of thin air, but puts it in the right place:
                        left: location.left - 7
                    });
                });
                if (session_1.session.isClient) {
                    container.find(".togetherjs-if-creator").remove();
                    container.find(".togetherjs-ifnot-creator").show();
                }
                else {
                    container.find(".togetherjs-if-creator").show();
                    container.find(".togetherjs-ifnot-creator").remove();
                }
                TogetherJS.config.track("siteName", function (value) {
                    value = value || document.title;
                    container.find(".togetherjs-site-name").text(value);
                });
                ui_1.ui.activateAvatarEdit(container, {
                    onSave: function () {
                        container.find("#togetherjs-avatar-when-saved").show();
                        container.find("#togetherjs-avatar-when-unsaved").hide();
                    },
                    onPending: function () {
                        container.find("#togetherjs-avatar-when-saved").hide();
                        container.find("#togetherjs-avatar-when-unsaved").show();
                    }
                });
                // This triggers substititions in the walkthrough:
                peers_1.peers.Self.update({});
                session_1.session.emit("new-element", container);
            }
            assert(typeof firstTime == "boolean", "You must provide a firstTime boolean parameter");
            if (firstTime) {
                container.find(".togetherjs-walkthrough-firsttime").show();
                container.find(".togetherjs-walkthrough-not-firsttime").hide();
            }
            else {
                container.find(".togetherjs-walkthrough-firsttime").hide();
                container.find(".togetherjs-walkthrough-not-firsttime").show();
            }
            onHideAll = doneCallback;
            show(0);
            windowing_1.windowing.show(container);
        }
        stop() {
            windowing_1.windowing.hide(container);
            if (onHideAll) {
                onHideAll();
                onHideAll = null;
            }
        }
    }
    exports.Walkthrough = Walkthrough;
    exports.walkthrough = new Walkthrough();
    session_1.session.on("hide-window", function () {
        if (onHideAll) {
            onHideAll();
            onHideAll = null;
        }
    });
});
//return walkthrough;
//define(["util", "ui", "jquery", "windowing", "templates", "templating", "session", "peers"], walkthroughMain);
