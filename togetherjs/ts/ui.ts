/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { elementFinder } from "./elementFinder";
import { linkify } from "./linkify";
import { peers } from "./peers";
import { session } from "./session";
import { templates } from "./templates";
import { templating } from "./templating";
import { util } from "./util";
import { visibilityApi } from "./visibilityApi";
import { windowing } from "./windowing";
import { storage } from "./storage";
import $ from "jquery";

//function uiMain(require: Require, $: JQueryStatic, util: TogetherJSNS.Util, session: TogetherJSNS.Session, templates: TogetherJSNS.Templates, templating: TogetherJSNS.Templating, linkify: TogetherJSNS.Linkify, peers: TogetherJSNS.Peers, windowing: TogetherJSNS.Windowing, elementFinder: TogetherJSNS.ElementFinder, visibilityApi: TogetherJSNS.VisibilityApi) {
const assert: typeof util.assert = util.assert.bind(util);
const AssertionError = util.AssertionError;
let chat: TogetherJSNS.Chat;
const $window = $(window);
// This is also in togetherjs.less, as @button-height:
const BUTTON_HEIGHT = 60 + 1; // 60 is button height, 1 is border
// chat TextArea
const TEXTAREA_LINE_HEIGHT = 20; // in pixels
const TEXTAREA_MAX_LINES = 5;
// This is set when an animation will keep the UI from being ready (until this time):
let finishedAt: number | null = null;
// If two chat messages come from the same person in this time (milliseconds) then they are collapsed into one message:
const COLLAPSE_MESSAGE_LIMIT = 5000;
const COLORS = ["#8A2BE2", "#7FFF00", "#DC143C", "#00FFFF", "#8FBC8F", "#FF8C00", "#FF00FF", "#FFD700", "#F08080", "#90EE90", "#FF6347"];
// This is used for some signalling when ui.prepareUI and/or ui.activateUI is called before the DOM is fully loaded:
let deferringPrepareUI: string | null = null;
let setToolName = false;

// This would be a circular import, but we just need the chat module sometime after everything is loaded, and this is sure to complete by that time:
require(["chat"], function(chatModule) {
    chat = chatModule.chat;
});

class Chat {
    private hideTimeout: number | undefined;

    constructor(private ui: Ui) { }

    text(attrs: { text: string, peer: TogetherJSNS.PeerClass | TogetherJSNS.PeerSelf, messageId: string, date?: number, notify?: boolean }) {
        assert(typeof attrs.text == "string");
        assert(attrs.peer);
        assert(attrs.messageId);
        const date = attrs.date || Date.now();
        let lastEl = this.ui.container.find("#togetherjs-chat .togetherjs-chat-message");
        if(lastEl.length) {
            lastEl = $(lastEl[lastEl.length - 1]);
        }
        let lastDate = null;
        if(lastEl) {
            lastDate = parseInt(lastEl.attr("data-date"), 10);
        }
        if(lastEl && lastEl.attr("data-person") == attrs.peer.id &&
            lastDate && date < lastDate + COLLAPSE_MESSAGE_LIMIT) {
            lastEl.attr("data-date", date);
            const content = lastEl.find(".togetherjs-chat-content");
            assert(content.length);
            attrs.text = content.text() + "\n" + attrs.text;
            attrs.messageId = lastEl.attr("data-message-id");
            lastEl.remove();
        }
        const el = templating.sub("chat-message", {
            peer: attrs.peer,
            content: attrs.text,
            date: date,
        });
        linkify(el.find(".togetherjs-chat-content"));
        el.attr("data-person", attrs.peer.id)
            .attr("data-date", date)
            .attr("data-message-id", attrs.messageId);
        this.add(el, attrs.messageId, attrs.notify);
    }

    joinedSession(attrs: { peer: TogetherJSNS.PeerClass, date?: number }) {
        assert(attrs.peer);
        const date = attrs.date || Date.now();
        const el = templating.sub("chat-joined", {
            peer: attrs.peer,
            date: date
        });
        // FIXME: should bind the notification to the dock location
        this.add(el, attrs.peer.className("join-message-"), 4000);
    }

    leftSession(attrs: { peer: TogetherJSNS.PeerClass, date?: number, declinedJoin: boolean }) {
        assert(attrs.peer);
        const date = attrs.date || Date.now();
        const el = templating.sub("chat-left", {
            peer: attrs.peer,
            date: date,
            declinedJoin: attrs.declinedJoin
        });
        // FIXME: should bind the notification to the dock location
        this.add(el, attrs.peer.className("join-message-"), 4000);
    }

    system(attrs: { text: string, date?: number }) {
        assert(!("peer" in attrs)); // TODO why does it asserts that we DON'T have a peer field?
        assert(typeof attrs.text == "string");
        const date = attrs.date || Date.now();
        const el = templating.sub("chat-system", {
            content: attrs.text,
            date: date,
        });
        this.add(el, undefined, true);
    }

    clear() {
        deferForContainer(() => {
            const container = this.ui.container.find("#togetherjs-chat-messages");
            container.empty();
        })();
    }

    urlChange(attrs: { peer: TogetherJSNS.PeerClass, url: string, sameUrl: boolean, date?: number, title?: string }) {
        assert(attrs.peer);
        assert(typeof attrs.url == "string");
        assert(typeof attrs.sameUrl == "boolean");
        const messageId = attrs.peer.className("url-change-");
        // FIXME: duplicating functionality in .add():
        const realId = "togetherjs-chat-" + messageId;
        const date = attrs.date || Date.now();
        let title;
        // FIXME: strip off common domain from msg.url?  E.g., if I'm on
        // http://example.com/foobar, and someone goes to http://example.com/baz then
        // show only /baz
        // FIXME: truncate long titles
        if(attrs.title) {
            title = attrs.title + " (" + attrs.url + ")";
        }
        else {
            title = attrs.url;
        }
        const el = templating.sub("url-change", {
            peer: attrs.peer,
            date: date,
            href: attrs.url,
            title: title,
            sameUrl: attrs.sameUrl
        });
        el.find(".togetherjs-nudge").click(function() {
            attrs.peer.nudge();
            return false;
        });
        el.find(".togetherjs-follow").click(function() {
            let url = attrs.peer.url;
            if(attrs.peer.urlHash) {
                url += attrs.peer.urlHash;
            }
            if(url !== undefined) {
                location.href = url;
            }
        });
        const notify = !attrs.sameUrl;
        if(attrs.sameUrl && $("#" + realId).length === 0) {
            // Don't bother showing a same-url notification, if no previous notification had been shown
            return;
        }
        this.add(el, messageId, notify);
    }

    invite(attrs: { peer: TogetherJSNS.PeerClass | TogetherJSNS.ExternalPeer, url: string, date?: number, forEveryone: boolean }) {
        assert(attrs.peer);
        assert(typeof attrs.url == "string");
        const messageId = attrs.peer.className("invite-");
        const date = attrs.date || Date.now();
        const hrefTitle = attrs.url.replace(/#?&togetherjs=.*/, "").replace(/^\w+:\/\//, "");
        const el = templating.sub("invite", {
            peer: attrs.peer,
            date: date,
            href: attrs.url,
            hrefTitle: hrefTitle,
            forEveryone: attrs.forEveryone
        });
        if(attrs.forEveryone) {
            el.find("a").click(function() {
                // FIXME: hacky way to do this:
                chat.submit("Followed link to " + attrs.url);
            });
        }
        this.add(el, messageId, true);
    }

    add(el: JQuery, id?: string, notify: boolean | number = false) {
        deferForContainer(() => {
            if(id) {
                el.attr("id", "togetherjs-chat-" + util.safeClassName(id));
            }
            const container = this.ui.container.find("#togetherjs-chat-messages");
            assert(container.length);
            const popup = this.ui.container.find("#togetherjs-chat-notifier");
            container.append(el);
            this.scroll();
            let doNotify = !!notify;
            const section = popup.find("#togetherjs-chat-notifier-message");
            if(notify && visibilityApi.hidden()) {
                const mediaElement = this.ui.container.find("#togetherjs-notification")[0] as HTMLMediaElement;
                mediaElement.play();
            }
            if(id && section.data("message-id") == id) {
                doNotify = true;
            }
            if(container.is(":visible")) {
                doNotify = false;
            }
            if(doNotify) {
                section.empty();
                section.append(el.clone(true, true));
                if(section.data("message-id") != id) {
                    section.data("message-id", id || "");
                    windowing.show(popup);
                }
                else if(!popup.is(":visible")) {
                    windowing.show(popup);
                }
                if(typeof notify == "number") {
                    // This is the amount of time we're supposed to notify
                    if(this.hideTimeout) {
                        clearTimeout(this.hideTimeout);
                        this.hideTimeout = undefined;
                    }
                    this.hideTimeout = setTimeout(() => {
                        windowing.hide(popup);
                        this.hideTimeout = undefined;
                    }, notify);
                }
            }
        })();
    }

    scroll() {
        deferForContainer(() => {
            const container = this.ui.container.find("#togetherjs-chat-messages")[0];
            container.scrollTop = container.scrollHeight;
        })();
    }
}

/** Like PeerView but for PeerSelf/ExternalPeer objects, also acts as a base for PeerView since PeerView extends PeerSelfView */
export class PeerSelfView {
    protected followCheckbox?: JQuery;
    protected _lastUpdateUrlDisplay?: string;
    protected dockElement: JQuery | null = null;
    protected detailElement: JQuery | null = null;

    constructor(
        protected ui: Ui,
        protected peer: TogetherJSNS.PeerSelf | TogetherJSNS.PeerClass | TogetherJSNS.ExternalPeer
    ) { }

    /** Takes an element and sets any person-related attributes on the element. Different from updates, which use the class names we set here: */
    setElement(el: JQuery) {
        let count = 0;
        const classes = ["togetherjs-person", "togetherjs-person-status",
            "togetherjs-person-name", "togetherjs-person-name-abbrev",
            "togetherjs-person-bgcolor", "togetherjs-person-swatch",
            "togetherjs-person-status", "togetherjs-person-role",
            "togetherjs-person-url", "togetherjs-person-url-title",
            "togetherjs-person-bordercolor"];
        classes.forEach(function(this: PeerView, cls) {
            const els = el.find("." + cls);
            els.addClass(this.peer.className(cls + "-"));
            count += els.length;
        }, this);
        if(!count) {
            console.warn("setElement(", el, ") doesn't contain any person items");
        }
        this.updateDisplay(el);
    }

    update() {
        this.updateDisplay();
    }

    updateDisplay(container?: JQuery) {
        deferForContainer(() => {
            container = container || this.ui.container;
            let abbrev = this.peer.name;
            if(this.peer.isSelf) {
                abbrev = "me";
            }
            container.find("." + this.peer.className("togetherjs-person-name-")).text(this.peer.name || "");
            container.find("." + this.peer.className("togetherjs-person-name-abbrev-")).text(abbrev!); // TODO !
            const avatarEl = container.find("." + this.peer.className("togetherjs-person-"));
            if(this.peer.avatar) {
                util.assertValidUrl(this.peer.avatar);
                avatarEl.css({
                    backgroundImage: "url(" + this.peer.avatar + ")"
                });
            }
            if(this.peer.idle == "inactive") {
                avatarEl.addClass("togetherjs-person-inactive");
            }
            else {
                avatarEl.removeClass("togetherjs-person-inactive");
            }
            avatarEl.attr("title", this.peer.name);
            if(this.peer.color) {
                avatarEl.css({
                    borderColor: this.peer.color
                });
                avatarEl.find(".togetherjs-person-avatar-swatch").css({
                    borderTopColor: this.peer.color,
                    borderRightColor: this.peer.color
                });
            }
            if(this.peer.color) {
                let colors = container.find("." + this.peer.className("togetherjs-person-bgcolor-"));
                colors.css({
                    backgroundColor: this.peer.color
                });
                colors = container.find("." + this.peer.className("togetherjs-person-bordercolor-"));
                colors.css({
                    borderColor: this.peer.color
                });
            }
            container.find("." + this.peer.className("togetherjs-person-role-")).text(this.peer.isCreator ? "Creator" : "Participant");
            let urlName: string;
            const domain = util.truncateCommonDomain(this.peer.url!, location.href); // TODO !
            // TODO code change
            if("title" in this.peer && this.peer.title) {
                urlName = this.peer.title + " (" + domain + ")";
            }
            else {
                urlName = domain;
            }
            container.find("." + this.peer.className("togetherjs-person-url-title-")).text(urlName);
            let url = this.peer.url;
            if("urlHash" in this.peer && this.peer.urlHash) {
                url += this.peer.urlHash;
            }
            container.find("." + this.peer.className("togetherjs-person-url-")).attr("href", url!); // TODO !
            // FIXME: should have richer status:
            container.find("." + this.peer.className("togetherjs-person-status-")).text(this.peer.idle == "active" ? "Active" : "Inactive");
            if(this.peer.isSelf) {
                // FIXME: these could also have consistent/reliable class names:
                const selfName = $(".togetherjs-self-name");
                selfName.each((function(this: PeerSelfView, _index: number, elem: Element) {
                    const el = $(elem);
                    if(el.val() != this.peer.name) {
                        el.val(this.peer.name!); // TODO !
                    }
                }).bind(this));
                $("#togetherjs-menu-avatar").attr("src", this.peer.avatar);
                if(!this.peer.name && this.peer.defaultName) {
                    $("#togetherjs-menu .togetherjs-person-name-self").text(this.peer.defaultName);
                }
            }
            if(this.peer.url != session.currentUrl()) {
                container.find("." + this.peer.className("togetherjs-person-")).addClass("togetherjs-person-other-url");
            }
            else {
                container.find("." + this.peer.className("togetherjs-person-")).removeClass("togetherjs-person-other-url");
            }
            if("following" in this.peer && this.peer.following) {
                if(this.followCheckbox) {
                    this.followCheckbox.prop("checked", true);
                }
            }
            else {
                if(this.followCheckbox) {
                    this.followCheckbox.prop("checked", false);
                }
            }
            // FIXME: add some style based on following?
            updateChatParticipantList();
            this.updateFollow();
        })();
    }

    updateFollow() {
        if(!("url" in this.peer) || !this.peer.url) {
            return;
        }
        if(!this.detailElement) {
            return;
        }
        const same = this.detailElement.find(".togetherjs-same-url");
        const different = this.detailElement.find(".togetherjs-different-url");
        if(this.peer.url == session.currentUrl()) {
            same.show();
            different.hide();
        }
        else {
            same.hide();
            different.show();
        }
    }
}

/* This class is bound to peers.Peer instances as peer.view. The .update() method is regularly called by peer objects when info changes. */
export class PeerView extends PeerSelfView {
    constructor(
        ui: Ui,
        protected peer: TogetherJSNS.PeerClass
    ) {
        super(ui, peer);
        assert(peer.isSelf !== undefined, "PeerView instantiated with non-Peer object");
    }

    update() {
        // Called d0 from PeerSelf & PeerClass
        // Only function directly called from PeerSelf
        if(!this.peer.isSelf) {
            if(this.peer.status == "live") {
                this.dock();
            }
            else {
                this.undock();
            }
        }

        super.update();
        this.updateUrlDisplay();
    }

    updateUrlDisplay(force = false) {
        // TODO check that all of that is ok. This function is sometimes called with a this.peer of type PeerSelf which is a problem because:
        /*
        1. PeerSelf has no title (but it's okay if it's undefined because chat.urlChange() will replace it with this.peer.url in this case so it's only weird for TS and not JS)
        2. in chat.urlChange() HTMLElement are created and click callbacks are established on them that access to peer.nudge() and peer.urlHash which don't exist on PeerSelf so that's a problem ...
        
        BUT the if at the end of chat.urlChange() can return BEFORE adding the element to the dom, the if is like this:
            if(attrs.sameUrl && $("#" + realId).length === 0) { return; }
            this.add(el, messageId, notify); // adds the element to the dom
        So the element is NOT added to the dom if:
        1. attrs.sameUrl is true, which I guess it always is if this.peer is a PeerSelf because you're always on the same page as yourself
        2. AND $("#" + realId).length === 0 is true, meaning that an element with this id can't be found the element WILL NOT be added. messageId and realId are set like this:
            var messageId = attrs.peer.className("url-change-"); // appends a safe version (without special char) of peer.id to "url-change-"
            var realId = "togetherjs-chat-" + messageId;
        which means that we are looking for an element with the id togetherjs-chat-url-change-[peer.id]
        
        So if there is never a togetherjs-chat-url-change-[own-id] for your own id in the page then chat.urlChange does nothing. I think. And you will never find a #togetherjs-chat-url-change-[own-id] because that would mean that togetherJS showed you a notification telling you that YOURSELF changed page which wouldn't make any sense.

        document.querySelectorAll("[id^='togetherjs-chat-url-change-']") gives us a few results either in the chat (maybe hiddent by default I'm not sure) or as some kind of popup but non without our id (something like YK5yyks2.wFOBGqpa)

        That is the reason for this code change: we return at the beginning of updateUrlDisplay() if peer.isSelf is true.
        */
        if(this.peer.isSelf) {
            return; // TODO see long explantion above and check that it's ok
        }

        const url = this.peer.url;
        if(!url || (url == this._lastUpdateUrlDisplay && !force)) {
            return;
        }
        this._lastUpdateUrlDisplay = url;
        const sameUrl = url == session.currentUrl();
        this.ui.chat.urlChange({
            peer: this.peer,
            url: this.peer.url!, // TODO !
            title: this.peer.title!, // TODO !
            sameUrl: sameUrl
        });
    }

    urlNudge() {
        // FIXME: do something more distinct here
        this.updateUrlDisplay(true);
    }

    notifyJoined() {
        this.ui.chat.joinedSession({ peer: this.peer });
    }

    // when there are too many participants in the dock, consolidate the participants to one avatar, and on mouseOver, the dock expands down to reveal the rest of the participants
    // if there are X users in the session
    // then hide the users in the dock
    // and shrink the size of the dock
    // and if you rollover the dock, it expands and reveals the rest of the participants in the dock
    // if users hit X then show the participant button with the consol
    dock() {
        deferForContainer(() => {
            if(this.dockElement) {
                return;
            }
            this.dockElement = templating.sub("dock-person", {
                peer: this.peer
            });
            this.dockElement.attr("id", this.peer.className("togetherjs-dock-element-"));
            this.ui.container.find("#togetherjs-dock-participants").append(this.dockElement);
            this.dockElement.find(".togetherjs-person").animateDockEntry();
            const numberOfUsers = peers.getAllPeers(true).length;
            if (numberOfUsers > 4) {
                $("#togetherjs-dock-participants .togetherjs-dock-person:not(:first-of-type").each(function () {
                    this.style.setProperty("--offset", (((numberOfUsers - 4) * -BUTTON_HEIGHT) / (numberOfUsers - 1)) + "px")
                })
                const persons = $("#togetherjs-dock-participants")
                if (!persons[0].hasListener) {
                    persons.mouseenter(adjustDockPos)
                    persons.mouseleave(adjustDockPos)
                    persons[0].hasListener = true
                }
            }
            adjustDockPos();
            this.detailElement = templating.sub("participant-window", {
                peer: this.peer
            });
            const followId = this.peer.className("togetherjs-person-status-follow-");
            this.detailElement.find('[for="togetherjs-person-status-follow"]').attr("for", followId);
            this.detailElement.find('#togetherjs-person-status-follow').attr("id", followId);
            this.detailElement.find(".togetherjs-follow").click(function(this: JQuery) {
                location.href = $(this).attr("href");
            });
            this.detailElement.find(".togetherjs-nudge").click(() => {
                this.peer.nudge();
            });
            this.followCheckbox = this.detailElement.find("#" + followId);
            const self = this;
            this.followCheckbox.change(function(this: HTMLInputElement) {
                if(!this.checked) {
                    self.peer.unfollow();
                }
                // Following doesn't happen until the window is closed
                // FIXME: should we tell the user this?
            });
            this.maybeHideDetailWindow = this.maybeHideDetailWindow.bind(this);
            session.on("hide-window", this.maybeHideDetailWindow);
            $("#togetherjs-feedback-form").after(this.detailElement);
            this.dockElement.click(() => {
                if(this.detailElement!.is(":visible")) { // TODO ! detailElement is probably set when we click on the dock, we should find a way to signify that more clearly
                    windowing.hide(this.detailElement!); // TODO !
                }
                else {
                    windowing.show(this.detailElement!, { bind: this.dockElement ?? undefined }); // TODO !
                    this.scrollTo();
                    this.cursor().element.animate({
                        opacity: 0.3
                    }).animate({
                        opacity: 1
                    }).animate({
                        opacity: 0.3
                    }).animate({
                        opacity: 1
                    });
                }
            });
            this.updateFollow();
        })();
    }

    undock() {
        if(!this.dockElement) {
            return;
        }
        if (peers.getAllPeers(true).length <= 4) {
            $("#togetherjs-dock-participants .togetherjs-dock-person:not(:first-of-type").each(function () {
                this.style.removeProperty("--offset")
            })
            const persons = $("#togetherjs-dock-participants")
            if (persons[0].hasListener) {
                persons.off("mouseenter")
                persons.off("mouseleave")
                delete persons[0].hasListener
            }
        }
        this.dockElement.find(".togetherjs-person").animateDockExit().promise().then(() => {
            this.dockElement!.remove(); // TODO !
            this.dockElement = null;
            this.detailElement!.remove(); // TODO !
            this.detailElement = null;
            adjustDockPos();
        });
    }

    scrollTo() {
        if(this.peer.url != session.currentUrl()) {
            return;
        }
        const pos = this.peer.scrollPosition;
        if(!pos) {
            console.warn("Peer has no scroll position:", this.peer);
            return;
        }
        $("html, body").easeTo(elementFinder.pixelForPosition(pos));
    }

    maybeHideDetailWindow(windows: JQuery[]) {
        if(this.detailElement && windows[0] && windows[0][0] === this.detailElement[0]) {
            if(this.followCheckbox && (this.followCheckbox[0] as HTMLInputElement).checked) {
                this.peer.follow();
            }
            else {
                this.peer.unfollow();
            }
        }
    }

    dockClick() {
        // FIXME: scroll to person
    }

    cursor() {
        const cursorModule = require("cursor");
        return cursorModule.getClient(this.peer.id);
    }

    destroy() {
        // FIXME: should I get rid of the dockElement?
        session.off("hide-window", this.maybeHideDetailWindow);
    }
}

export class Ui {
    public container!: JQuery; // TODO !!
    public readonly PeerView = (peer: TogetherJSNS.PeerClass) => new PeerView(this, peer);
    public readonly PeerSelfView = (peer: TogetherJSNS.PeerSelf | TogetherJSNS.ExternalPeer) => new PeerSelfView(this, peer);
    public readonly chat = new Chat(this);

    /* Displays some toggleable element; toggleable elements have a
    data-toggles attribute that indicates what other elements should
    be hidden when this element is shown. */
    displayToggle(elem: HTMLElement | string) {
        const el = $(elem);
        const other = $(el.attr("data-toggles"));
        assert(other.length, "Cannot toggle", el[0], "selector", other.selector);
        other.hide();
        el.show();
    }

    // This is called before activateUI; it doesn't bind anything, but does display the dock
    // FIXME: because this module has lots of requirements we can't do this before those requirements are loaded.  Maybe worth splitting this out?  OTOH, in production we should have all the files combined so there's not much problem loading those modules.
    prepareUI() {
        if(!(document.readyState == "complete" || document.readyState == "interactive")) {
            // Too soon!  Wait a sec...
            deferringPrepareUI = "deferring";
            document.addEventListener("DOMContentLoaded", () => {
                const d = deferringPrepareUI;
                deferringPrepareUI = null;
                this.prepareUI();
                // This happens when ui.activateUI is called before the document has been loaded:
                if(d == "activate") {
                    this.activateUI();
                }
            });
            return;
        }
        const container = this.container = $(templates("interface"));
        assert(container.length);
        $("body").append(container);
        const iface = container.find("#togetherjs-dock")
        iface.css("visibility", "hidden")
        storage.settings.get("dockConfig").then(s => {
          if (s) {
            s.pos.visibility = ""
            iface.addClass(s["class"])
            iface.css(s.pos)
          } else {
            iface.addClass("togetherjs-dock-right")
            iface.css({right: "5px", top: "5px", visibility: ""})
          }
        })
        $("#togetherjs-buttons").addClass("on")
        fixupAvatars(container);
        this.container.find(".togetherjs-window > header, .togetherjs-modal > header").each(function(this: HTMLElement) {
            $(this).append($('<button class="togetherjs-close"></button>'));
        });

        TogetherJS.config.track("disableWebRTC", (hide, previous) => {
            if(hide && !previous) {
                this.container.find("#togetherjs-audio-button").hide();
                adjustDockPos();
            }
            else if((!hide) && previous) {
                this.container.find("#togetherjs-audio-button").show();
                adjustDockPos();
            }
        });

    }

    // After prepareUI, this actually makes the interface live.  We have to do this later because we call prepareUI when many components aren't initialized, so we don't even want the user to be able to interact with the interface.  But activateUI is called once everything is loaded and ready for interaction.
    activateUI() {
        if(deferringPrepareUI) {
            console.warn("ui.activateUI called before document is ready; waiting...");
            deferringPrepareUI = "activate";
            return;
        }
        if(!this.container) {
            this.prepareUI();
        }
        const container = this.container;

        //create the overlay
        if($.browser.mobile) {
            // $("body").append( "\x3cdiv class='overlay' style='position: absolute; top: 0; left: 0; background-color: rgba(0,0,0,0); width: 120%; height: 100%; z-index: 1000; margin: -10px'>\x3c/div>" );
        }

        // The share link:
        this.prepareShareLink(container);
        container.find("input.togetherjs-share-link").on("keydown", function(event: JQueryEventObject) {
            if(event.which == 27) {
                windowing.hide("#togetherjs-share");
                return false;
            }
            return undefined;
        });
        session.on("shareId", updateShareLink);

        // The chat input element:
        const input = container.find("#togetherjs-chat-input");
        //@
        input.bind("keydown", function(event) {
            if(event.which == 13 && !event.shiftKey) { // Enter without Shift pressed
                submitChat();
                return false;
            }
            if(event.which == 27) { // Escape
                windowing.hide("#togetherjs-chat");
                return false;
            }
            return; // just for the lint rule saying "not all path return a value"
        });

        function submitChat() {
            const val = input.val();
            if($.trim(val)) {
                input.val("");
                // triggering the event manually to avoid the addition of newline character to the textarea:
                input.trigger("input").trigger("propertychange");
                chat.submit(val);
            }
        }
        // auto-resize textarea:
        input.on("input propertychange", function(this: HTMLInputElement) {
            const $this = $(this);
            const actualHeight = $this.height();
            // reset the height of textarea to remove trailing empty space (used for shrinking):
            $this.height(TEXTAREA_LINE_HEIGHT);
            this.scrollTop = 0;
            // scroll to bottom:
            this.scrollTop = 9999;
            let newHeight = this.scrollTop + $this.height();
            const maxHeight = TEXTAREA_MAX_LINES * TEXTAREA_LINE_HEIGHT;
            if(newHeight > maxHeight) {
                newHeight = maxHeight;
                this.style.overflowY = "scroll";
            }
            else {
                this.style.overflowY = "hidden";
            }
            this.style.height = newHeight + "px";
            const diff = newHeight - actualHeight;
            $("#togetherjs-chat-input-box").height($("#togetherjs-chat-input-box").height() + diff);
            $("#togetherjs-chat-messages").height($("#togetherjs-chat-messages").height() - diff);
            return false;
        });

        util.testExpose({ submitChat: submitChat });

        // Moving the window:
        // FIXME: this should probably be stickier, and not just move the window around
        // so abruptly
        const anchor = container.find("#togetherjs-dock-anchor");
        assert(anchor.length);
        anchor.mousedown(function(event: MouseEvent) {
            const iface = $("#togetherjs-dock");
            const startLeft= parseInt(iface.css("left"))
            const startTop = parseInt(iface.css("top"))
      
            $("#togetherjs-menu").hide()
            windowing.hide();
            
            function selectoff() {
                return false;
            }

            function mousemove(event2: JQueryEventObject) {
                let left: any = startLeft + event2.screenX - event.screenX
                let right
                let top: any = startTop + event2.screenY - event.screenY
                let bottom
                iface.css({ right: "", bottom: "" })
                if (iface.lockedHor) {
                    if (left < 5) {
                        left = "5px"
                        right = ""
                    } else {
                        iface.css("left", left + "px")
                        if (parseInt(iface.css("right")) < 5) {
                            left = ""
                            right = "5px"
                        }
                    }
                } else {
                    if (left < 50) {
                        iface.lockedVert = true
                        left = "5px"
                        right = ""
                    } else {
                        iface.css("left", left + "px")
                        if (parseInt(iface.css("right")) < 50) {
                            iface.lockedVert = true
                            left = ""
                            right = "5px"
                        } else
                            iface.lockedVert = false
                        }
                }
                if (iface.lockedVert) {
                    if (top < 5) {
                        top = "5px"
                        bottom = ""
                    } else {
                        iface.css("top", top + "px")
                        if (parseInt(iface.css("bottom")) < 5) {
                            top = ""
                            bottom = "5px"
                        }
                    }
                } else {
                    if (top < 50) {
                        iface.lockedHor = true
                        top = "5px"
                        bottom = ""
                    } else {
                        iface.css("top", top + "px")
                        if ((iface.threshold && (top > iface.threshold)) || (!iface.threshold && (parseInt(iface.css("bottom")) < 50))) {
                            iface.lockedHor = true
                            top = ""
                            bottom = "5px"
                        } else {
                            iface.lockedHor = false
                            delete iface.threshold
                        }
                    }
                }
                iface.css({ left: left, right: right, top: top, bottom: bottom })
                if (iface.lockedHor) {
                    if (iface.css("bottom") == "5px") {
                        if (!iface.threshold)
                            iface.threshold = parseInt(iface.css("top")) - 50
                        iface.removeClass("togetherjs-dock-left togetherjs-dock-right togetherjs-dock-top")
                        iface.addClass("togetherjs-dock-bottom")
                    } else {
                        iface.removeClass("togetherjs-dock-left togetherjs-dock-right togetherjs-dock-bottom")
                        iface.addClass("togetherjs-dock-top")
                    }
                } else if (parseInt(iface.css("right")) < 330) {
                    iface.removeClass("togetherjs-dock-left togetherjs-dock-top togetherjs-dock-bottom")
                    iface.addClass("togetherjs-dock-right")
                } else {
                    iface.removeClass("togetherjs-dock-right togetherjs-dock-top togetherjs-dock-bottom")
                    iface.addClass("togetherjs-dock-left")
                }
            }

            $(document).bind("mousemove", mousemove);
            // If you don't turn selection off it will still select text, and show a
            // text selection cursor:
            $(document).bind("selectstart", selectoff);
            // FIXME: it seems like sometimes we lose the mouseup event, and it's as though
            // the mouse is stuck down:
            $(document).one("mouseup", function() {
                const style = iface[0].style
                const pos: any = {}
                if (style.left)
                    pos.left = style.left
                else
                    pos.right = style.right
                if (style.top)
                    pos.top = style.top
                else
                    pos.bottom = style.bottom
                storage.settings.set("dockConfig", {pos: pos,
                                                    "class": iface.hasClass("togetherjs-dock-right") ? "togetherjs-dock-right"
                                                           : iface.hasClass("togetherjs-dock-top") ? "togetherjs-dock-top"
                                                           : iface.hasClass("togetherjs-dock-bottom") ? "togetherjs-dock-bottom"
                                                           : "togetherjs-dock-left"})
                $(document).unbind("mousemove", mousemove);
                $(document).unbind("selectstart", selectoff);
            });
            return false;
        });

        function openDock() {
            $('.togetherjs-window').animate({
                opacity: 1
            });
            $('#togetherjs-dock-participants').animate({
                opacity: 1
            });
            $('#togetherjs-dock #togetherjs-buttons').animate({
                opacity: 1
            });

            //for iphone
            if($(window).width() < 480) {
                $('.togetherjs-dock-right').animate(
                    { width: "204px" },
                    { duration: 60, easing: "linear" },
                    "linear" // TODO adding that seems to match the prototy more closly, check that it's ok, anyway we want to remove JQuery and at worst this parameter will be ignored
                );
            }

            //for ipad
            else {
                $('.togetherjs-dock-right').animate(
                    { width: "27%" },
                    { duration: 60, easing: "linear" },
                    "linear" // TODO see above
                );
            }


            // add bg overlay
            // $("body").append( "\x3cdiv class='overlay' style='position: absolute; top: 0; left: -2px; background-color: rgba(0,0,0,0.5); width: 200%; height: 400%; z-index: 1000; margin: 0px;'>\x3c/div>" );

            //disable vertical scrolling
            // $("body").css({
            //   "position": "fixed",
            //   top: 0,
            //   left: 0
            // });

            //replace the anchor icon
            const src = "/images/togetherjs-logo-close.png";
            $("#togetherjs-dock-anchor #togetherjs-dock-anchor-horizontal img").attr("src", src);
        }

        function closeDock() {
            //enable vertical scrolling
            $("body").css({
                "position": "",
                top: "",
                left: ""
            });

            //replace the anchor icon
            const src = "/images/togetherjs-logo-open.png";
            $("#togetherjs-dock-anchor #togetherjs-dock-anchor-horizontal img").attr("src", src);

            $('.togetherjs-window').animate({ opacity: 0 });
            $('#togetherjs-dock-participants').animate({ opacity: 0 });
            $('#togetherjs-dock #togetherjs-buttons').animate({ opacity: 0 });
            $('.togetherjs-dock-right').animate(
                { width: "40px" },
                { duration: 60, easing: "linear" },
                "linear" // TODO see above
            );

            // remove bg overlay
            //$(".overlay").remove();
        }

        // Setting the anchor button + dock mobile actions
        if($.browser.mobile) {

            // toggle the audio button
            $("#togetherjs-audio-button").click(function() {
                windowing.toggle("#togetherjs-rtc-not-supported");
            });

            // toggle the profile button
            $("#togetherjs-profile-button").click(function() {
                windowing.toggle("#togetherjs-menu-window");
            });

            // $("body").append( "\x3cdiv class='overlay' style='position: absolute; top: 0; left: -2px; background-color: rgba(0,0,0,0.5); width: 200%; height: 400%; z-index: 1000; margin: 0px'>\x3c/div>" );

            //disable vertical scrolling
            // $("body").css({
            //   "position": "fixed",
            //   top: 0,
            //   left: 0
            // });

            //replace the anchor icon
            const src = "/images/togetherjs-logo-close.png";
            $("#togetherjs-dock-anchor #togetherjs-dock-anchor-horizontal img").attr("src", src);

            // TODO this is a very old use of the toggle function that would do cb1 on odd click and cb2 on even click
            //$("#togetherjs-dock-anchor").toggle(() => closeDock(), () => openDock());
            $("#togetherjs-dock-anchor").click(() => {
                closeDock();
                setTimeout(openDock, 1000); // TODO change: this is obviously not what should happen, it should close the dock on the 2n+1 click and open it again on the 2n click but since openDock and closeDock don't work yet I can't test it.
            });
        }

        $("#togetherjs-share-button").click(function() {
            windowing.toggle("#togetherjs-share");
        });

        $("#togetherjs-profile-button").click(function(event) {
            if($.browser.mobile) {
                windowing.show("#togetherjs-menu-window");
                return false;
            }
            toggleMenu();
            event.stopPropagation();
            return false;
        });

        $("#togetherjs-menu-feedback, #togetherjs-menu-feedback-button").click(function() {
            windowing.hide();
            hideMenu();
            windowing.show("#togetherjs-feedback-form");
            // Lazy loading of content
            const feedbackForm = document.getElementById("togetherjs-feedback-form");
            const iframe = feedbackForm?.querySelector("iframe");
            if(iframe && iframe.dataset.src) { 
                iframe.src = iframe?.dataset.src;
            }
        });

        $("#togetherjs-menu-help, #togetherjs-menu-help-button").click(function() {
            windowing.hide();
            hideMenu();
            require(["walkthrough"], function({ walkthrough }) {
                windowing.hide();
                walkthrough.start(false);
            });
        });

        $("#togetherjs-menu-update-name").click(() => {
            const input = $("#togetherjs-menu .togetherjs-self-name");
            input.css({
                width: $("#togetherjs-menu").width() - 32 + "px"
            });
            this.displayToggle("#togetherjs-menu .togetherjs-self-name");
            $("#togetherjs-menu .togetherjs-self-name").focus();
        });

        $("#togetherjs-menu-update-name-button").click(function() {
            windowing.show("#togetherjs-edit-name-window");
            $("#togetherjs-edit-name-window input").focus();
        });

        $("#togetherjs-menu .togetherjs-self-name").bind("keyup change", (event) => {
            console.log("alrighty", event);
            if(event.which == 13) {
                this.displayToggle("#togetherjs-self-name-display");
                return;
            }
            const val = $("#togetherjs-menu .togetherjs-self-name").val();
            console.log("values!!", val);
            if(val) {
                peers.Self.update({ name: val });
            }
        });

        $("#togetherjs-menu-update-avatar, #togetherjs-menu-update-avatar-button").click(function() {
            hideMenu();
            windowing.show("#togetherjs-avatar-edit");
        });

        $("#togetherjs-menu-end, #togetherjs-menu-end-button").click(function() {
            hideMenu();
            windowing.show("#togetherjs-confirm-end");
        });

        $("#togetherjs-end-session").click(function() {
            session.close();
            //$(".overlay").remove();

        });

        $("#togetherjs-menu-update-color").click(function() {
            const picker = $("#togetherjs-pick-color");
            if(picker.is(":visible")) {
                picker.hide();
                return;
            }
            picker.show();
            bindPicker();
            picker.find(".togetherjs-swatch-active").removeClass("togetherjs-swatch-active");
            picker.find(".togetherjs-swatch[data-color=\"" + peers.Self.color + "\"]").addClass("togetherjs-swatch-active");
        });

        $("#togetherjs-pick-color").click(".togetherjs-swatch", function(event) {
            const swatch = $(event.target);
            const color = swatch.attr("data-color");
            peers.Self.update({
                color: color
            });
            event.stopPropagation();
            return false;
        });

        $("#togetherjs-pick-color").click(function(event) {
            $("#togetherjs-pick-color").hide();
            event.stopPropagation();
            return false;
        });

        COLORS.forEach(function(color) {
            const el = templating.sub("swatch", {});
            el.attr("data-color", color);
            el.css({
                backgroundColor: color,
                borderColor: "#333333" // TODO was tinycolor.darken(color).toHex()
            });
            $("#togetherjs-pick-color").append(el);
        });

        $("#togetherjs-chat-button").click(function() {
            windowing.toggle("#togetherjs-chat");
        });

        session.on("display-window", function(id: string, element: JQuery) {
            if(id == "togetherjs-chat") {
                if(!$.browser.mobile) {
                    $("#togetherjs-chat-input").focus();
                }
            }
            else if(id == "togetherjs-share") {
                const link = element.find("input.togetherjs-share-link");
                if(link.is(":visible")) {
                    link.focus().select();
                }
            }
        });

        container.find("#togetherjs-chat-notifier").click(function(event: MouseEvent) {
            if($(event.target as HTMLElement).is("a") || container.is(".togetherjs-close")) {
                return;
            }
            windowing.show("#togetherjs-chat");
        });

        // FIXME: Don't think this makes sense
        $(".togetherjs header.togetherjs-title").each(function(_index, item) {
            const button = $('<button class="togetherjs-minimize"></button>');
            button.click(function() {
                const window = button.closest(".togetherjs-window");
                windowing.hide(window);
            });
            $(item).append(button);
        });

        $("#togetherjs-avatar-done").click(() => {
            this.displayToggle("#togetherjs-no-avatar-edit");
        });

        $("#togetherjs-self-color").css({ backgroundColor: peers.Self.color });

        const avatar = peers.Self.avatar;
        if(avatar) {
            $("#togetherjs-self-avatar").attr("src", avatar);
        }

        const starterButton = $("#togetherjs-starter button");
        starterButton.click(function() {
            windowing.show("#togetherjs-about");
        }).addClass("togetherjs-running");
        if(starterButton.text() == "Start TogetherJS") {
            starterButton.attr("data-start-text", starterButton.text());
            starterButton.text("End TogetherJS Session");
        }

        this.activateAvatarEdit(container, {
            onSave: function() {
                windowing.hide("#togetherjs-avatar-edit");
            }
        });

        // TODO some feature seem to be hidden in the HTML like #togetherjs-invite in interface.html
        // TODO also inviter is always null apparently???
        TogetherJS.config.track("inviteFromRoom", function(inviter) {
            if(inviter) {
                container.find("#togetherjs-invite").show();
            }
            else {
                container.find("#togetherjs-invite").hide();
            }
        });

        container.find("#togetherjs-menu-refresh-invite").click(refreshInvite);
        container.find("#togetherjs-menu-invite-anyone").click(function() {
            invite(null);
        });

        // The following lines should be at the end of this function (new code goes above)
        session.emit("new-element", this.container!); // TODO !

        if(finishedAt && finishedAt > Date.now()) {
            setTimeout(() => {
                finishedAt = null;
                session.emit("ui-ready", this);
            }, finishedAt - Date.now());
        }
        else {
            session.emit("ui-ready", this);
        }

    } // End ui.activateUI()

    activateAvatarEdit(container: JQuery, options: { onSave?: () => void, onPending?: () => void } = {}) {
        let pendingImage: string | null = null;

        container.find(".togetherjs-avatar-save").prop("disabled", true);

        container.find(".togetherjs-avatar-save").click(function() {
            if(pendingImage) {
                peers.Self.update({ avatar: pendingImage });
                container.find(".togetherjs-avatar-save").prop("disabled", true);
                if(options.onSave) {
                    options.onSave();
                }
            }
        });

        container.find(".togetherjs-upload-avatar").on("change", function(this: File) {
            util.readFileImage(this).then(function(url) {
                if(!url) { return }
                sizeDownImage(url).then(function(smallUrl) {
                    pendingImage = smallUrl ?? null;
                    container.find(".togetherjs-avatar-preview").css({
                        backgroundImage: 'url(' + pendingImage + ')'
                    });
                    container.find(".togetherjs-avatar-save").prop("disabled", false);
                    if(options.onPending) {
                        options.onPending();
                    }
                });
            });
        });

    }

    prepareShareLink(container: JQuery) {
        container.find("input.togetherjs-share-link").click(function(this: HTMLElement) {
            $(this).select();
        }).change(function() {
            updateShareLink();
        });
        updateShareLink();
    }

    showUrlChangeMessage(peer: TogetherJSNS.PeerClass, _url: string) {
        deferForContainer(() => {
            const window = templating.sub("url-change", { peer: peer });
            this.container.append(window);
            windowing.show(window);
        })();
    }

    updateToolName(container: JQuery) {
        container = container || $(document.body);
        let name = TogetherJS.config.get("toolName");
        if(setToolName && !name) {
            name = "TogetherJS";
        }
        if(name) {
            container.find(".togetherjs-tool-name").text(name);
            setToolName = true;
        }
    }
}

export const ui: any = new Ui();
ui.panelPosition = function () {
    const iface = $("#togetherjs-dock");
    if (iface.hasClass("togetherjs-dock-right")) {
        return "right";
    } else if (iface.hasClass("togetherjs-dock-left")) {
        return "left";
    } else if (iface.hasClass("togetherjs-dock-top")) {
        return "top";
    } else if (iface.hasClass("togetherjs-dock-bottom")) {
        return "bottom";
    } else {
        throw new AssertionError("#togetherjs-dock doesn't have positioning class");
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deferForContainer<A extends any[]>(func: (...args: A) => void) {
    /* Defers any calls to func() until after ui.container is set
        Function cannot have a return value (as sometimes the call will
        become async).  Use like:

        method: deferForContainer(function (args) {...})
        */
    return function(...args: A) {
        // TODO I made some tests and this is always undefined apparently so no need to pretend it's usable. all "null" here were "this".
        if(ui.container) {
            func.apply(null, args);
        }
        //var args = Array.prototype.slice.call(arguments) as A; // TODO use args
        session.once("ui-ready", function() {
            func.apply(null, args);
        });
    };
}

function sizeDownImage(imageUrl: string) {
    return util.Deferred<string>(function(def) {
        const canvas = document.createElement("canvas");
        canvas.height = session.AVATAR_SIZE;
        canvas.width = session.AVATAR_SIZE;
        const context = canvas.getContext("2d")!; // ! is ok because the first call to getContext can't fail if it's "2d"
        const img = new Image();
        img.src = imageUrl;
        // Sometimes the DOM updates immediately to call
        // naturalWidth/etc, and sometimes it doesn't; using setTimeout
        // gives it a chance to catch up
        setTimeout(function() {
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;
            width = width * (session.AVATAR_SIZE / height);
            height = session.AVATAR_SIZE;
            context.drawImage(img, 0, 0, width, height);
            def.resolve(canvas.toDataURL("image/png"));
        });
    });
}

function fixupAvatars(container: JQuery) {
    /* All <div class="togetherjs-person" /> elements need an element inside,
        so we add that element here */
    container.find(".togetherjs-person").each(function(this: HTMLElement) {
        const $this = $(this);
        const inner = $this.find(".togetherjs-person-avatar-swatch");
        if(!inner.length) {
            $this.append('<div class="togetherjs-person-avatar-swatch"></div>');
        }
    });
}

// Menu

function showMenu() {
    const el = $("#togetherjs-menu");
    assert(el.length);
    el.show();
    bindMenu();
    $(document).bind("click", maybeHideMenu);
}

function bindMenu() {
    const el = $("#togetherjs-menu:visible");
    if(el.length) {
        const ifacePos = ui.panelPosition()
        const bound = $("#togetherjs-profile-button");
        const boundOffset = bound.offset()!; // TODO !
        el.css((ifacePos == "bottom") ? {
            left: (boundOffset.left + 10 - $window.scrollLeft()) + "px",
            top: "",
            bottom: (bound.height() + 5) + "px"
        } : {
            left: (ifacePos == "right") ? (boundOffset.left + bound.width() - 10 - el.width() - $window.scrollLeft()) + "px"
                                        : (boundOffset.left + 10 - $window.scrollLeft()) + "px",
            top: (boundOffset.top + bound.height() - $window.scrollTop()) + "px",
            bottom: ""
        });
        if (parseInt(el.css("bottom")) < 5)
            el.css({
            left: (ifacePos == "right") ? (boundOffset.left - el.width() - $window.scrollLeft()) + "px"
                                        : (boundOffset.left + bound.width() - $window.scrollLeft()) + "px",
            top: "",
            bottom: "5px"
        })
    }
}

function bindPicker() {
    const picker = $("#togetherjs-pick-color:visible");
    if(picker.length) {
        const menu = $("#togetherjs-menu-update-color");
        const menuOffset = menu.offset()!; // TODO !
        picker.css({
            top: menuOffset.top + menu.height(),
            left: menuOffset.left
        });
    }
}

session.on("resize", function() {
    bindMenu();
    bindPicker();
});

function toggleMenu() {
    if($("#togetherjs-menu").is(":visible")) {
        hideMenu();
    }
    else {
        showMenu();
    }
}

function hideMenu() {
    const el = $("#togetherjs-menu");
    el.hide();
    $(document).unbind("click", maybeHideMenu);
    ui.displayToggle("#togetherjs-self-name-display");
    $("#togetherjs-pick-color").hide();
}

function maybeHideMenu(event: Event) {
    let t = event.target as Element;
    while(t) {
        if(t.id == "togetherjs-menu") {
            // Click inside the menu, ignore this
            return;
        }
        t = t.parentElement!;
    }
    hideMenu();
}

function adjustDockPos() {
    const iface = $("#togetherjs-dock")
    const right = parseInt(iface.css("right"))
    const bottom = parseInt(iface.css("bottom"))
    if (right < 5)
        iface.css("left", (parseInt(iface.css("left")) - 5 + right) + "px")
    else if (bottom < 5)
        iface.css("top", (parseInt(iface.css("top")) - 5 + bottom) + "px")
    else
        storage.settings.get("dockConfig").then(s => iface.css(s ? s.pos : {right: "5px", top: "5px"}))
    const buttonContainer = $("#togetherjs-buttons")
    if ($("#togetherjs-dock-participants").children().length)
        buttonContainer.removeClass("on")
    else
        buttonContainer.addClass("on")
}

// Misc

function updateShareLink() {
    const input = $("input.togetherjs-share-link");
    const link = $("a.togetherjs-share-link");
    const display = $("#togetherjs-session-id");
    if(!session.shareId) {
        input.val("");
        link.attr("href", "#");
        display.text("(none)");
    }
    else {
        input.val(session.shareUrl());
        link.attr("href", session.shareUrl());
        display.text(session.shareId);
    }
}

session.on("close", function() {

    if($.browser.mobile) {
        // remove bg overlay
        //$(".overlay").remove();

        //after hitting End, reset window draggin
        $("body").css({
            "position": "",
            top: "",
            left: ""
        });
    }

    if(ui.container) {
        ui.container.remove();
        // TODO remove this @ts-expect-error
        //@ts-expect-error easier typechecking
        ui.container = null;
    }
    // Clear out any other spurious elements:
    $(".togetherjs").remove();
    const starterButton = $("#togetherjs-starter button");
    starterButton.removeClass("togetherjs-running");
    if(starterButton.attr("data-start-text")) {
        starterButton.text(starterButton.attr("data-start-text"));
        starterButton.attr("data-start-text", "");
    }
});

session.on("display-window", function(id) {
    if (id == "togetherjs-chat") {
        ui.chat.scroll();
        windowing.hide("#togetherjs-chat-notifier");
        $("#togetherjs-window-pointer").show();
    }
});

function updateChatParticipantList() {
    const live = peers.getAllPeers(true);
    if(live.length) {
        ui.displayToggle("#togetherjs-chat-participants");
        $("#togetherjs-chat-participant-list").text(
            live.map(function(p) { return p.name; }).join(", "));
    }
    else {
        ui.displayToggle("#togetherjs-chat-no-participants");
    }
}

function inviteHubUrl() {
    const base = TogetherJS.config.get("inviteFromRoom");
    assert(base);
    return util.makeUrlAbsolute(base, session.hubUrl());
}

let inRefresh = false;

function refreshInvite() {
    if(inRefresh) {
        return;
    }
    inRefresh = true;
    require(["who"], function({ who }) {
        const def = who.getList(inviteHubUrl());
        function addUser(user: TogetherJSNS.PeerClass | TogetherJSNS.ExternalPeer, before?: JQuery) {
            const item = templating.sub("invite-user-item", { peer: user });
            item.attr("data-clientid", user.id);
            if(before) {
                item.insertBefore(before);
            }
            else {
                $("#togetherjs-invite-users").append(item);
            }
            item.click(function() {
                invite(user.id); // TODO was user.clientId but it does not exist on any peer-like class so it was changed to id
            });
        }
        function refresh(users: { [user: string]: TogetherJSNS.ExternalPeer }, finished: boolean) {
            const sorted: TogetherJSNS.ExternalPeer[] = [];
            for(const id in users) {
                if(Object.prototype.hasOwnProperty.call(users, id)) {
                    sorted.push(users[id]);
                }
            }
            sorted.sort(function(a, b) {
                return (a.name || "") < (b.name || "") ? -1 : 1;
            });
            let pos = 0;
            ui.container.find("#togetherjs-invite-users .togetherjs-menu-item").each(function(this: HTMLElement) {
                const $this = $(this);
                if(finished && !users[$this.attr("data-clientid")]) {
                    $this.remove();
                    return;
                }
                if(pos >= sorted.length) {
                    return;
                }
                while(pos < sorted.length && $this.attr("data-clientid") !== sorted[pos].id) {
                    addUser(sorted[pos], $this);
                    pos++;
                }
                while(pos < sorted.length && $this.attr("data-clientid") == sorted[pos].id) {
                    pos++;
                }
            });
            for(let i = pos; i < sorted.length; i++) {
                addUser(sorted[pos]);
            }
        }
        def.then(function(users) {
            if(users === undefined) {
                console.error("users was", users);
                return;
            }
            refresh(users, true);
            inRefresh = false;
        });
        def.progress(refresh);
    });
}

session.hub.on("invite", function(msg) {
    if(msg.forClientId && msg.clientId != peers.Self.id) {
        return;
    }
    require(["who"], function(whoModule) {
        const peer = new whoModule.ExternalPeer(msg.userInfo.clientId, msg.userInfo);
        ui.chat.invite({ peer: peer, url: msg.url, forEveryone: !msg.forClientId });
    });
});

function invite(clientId: string | null) {
    require(["who"], function({ who }) {
        // FIXME: use the return value of this to give a signal that
        // the invite has been successfully sent:
        who.invite(inviteHubUrl(), clientId).then(function() {
            hideMenu();
        });
    });
}

session.hub.on("url-change-nudge", function(msg) {
    if(msg.to && msg.to != session.clientId) {
        // Not directed to us
        return;
    }
    msg.peer.urlNudge();
});

session.on("new-element", function(el) {
    if(TogetherJS.config.get("toolName")) {
        ui.updateToolName(el);
    }
});

TogetherJS.config.track("toolName", function() {
    ui.updateToolName(ui.container);
});

//return ui;

//define(["require", "jquery", "util", "session", "templates", "templating", "linkify", "peers", "windowing", "elementFinder", "visibilityApi"], uiMain);
