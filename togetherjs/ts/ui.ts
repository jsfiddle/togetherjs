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

//function uiMain(require: Require, $: JQueryStatic, util: TogetherJSNS.Util, session: TogetherJSNS.Session, templates: TogetherJSNS.Templates, templating: TogetherJSNS.Templating, linkify: TogetherJSNS.Linkify, peers: TogetherJSNS.Peers, windowing: TogetherJSNS.Windowing, elementFinder: TogetherJSNS.ElementFinder, visibilityApi: TogetherJSNS.VisibilityApi) {
var assert: typeof util.assert = util.assert;
var AssertionError = util.AssertionError;
var chat: TogetherJSNS.Chat;
var $window = $(window);
// This is also in togetherjs.less, as @button-height:
var BUTTON_HEIGHT = 60 + 1; // 60 is button height, 1 is border
// chat TextArea
var TEXTAREA_LINE_HEIGHT = 20; // in pixels
var TEXTAREA_MAX_LINES = 5;
// This is also in togetherjs.less, under .togetherjs-animated
//var ANIMATION_DURATION = 1000; // TODO unused
// Time the new user window sticks around until it fades away:
//var NEW_USER_FADE_TIMEOUT = 5000; // TODO unused
// This is set when an animation will keep the UI from being ready
// (until this time):
var finishedAt: number | null = null;
// Time in milliseconds for the dock to animate out:
var DOCK_ANIMATION_TIME = 300;
// If two chat messages come from the same person in this time
// (milliseconds) then they are collapsed into one message:
var COLLAPSE_MESSAGE_LIMIT = 5000;

var COLORS = [
    "#8A2BE2", "#7FFF00", "#DC143C", "#00FFFF", "#8FBC8F", "#FF8C00", "#FF00FF",
    "#FFD700", "#F08080", "#90EE90", "#FF6347"];

// This would be a circular import, but we just need the chat module sometime
// after everything is loaded, and this is sure to complete by that time:
require(["chat"], function(chatModule: typeof import("chat")) {
    chat = chatModule.chat;
});

class Chat {
    private hideTimeout: number | undefined;

    constructor(private ui: Ui) { }

    text(attrs: { text: string, peer: TogetherJSNS.PeerClass | TogetherJSNS.PeerSelf, messageId: string, date?: number, notify?: boolean }) {
        assert(typeof attrs.text == "string");
        assert(attrs.peer);
        assert(attrs.messageId);
        var date = attrs.date || Date.now();
        var lastEl = this.ui.container.find("#togetherjs-chat .togetherjs-chat-message");
        if(lastEl.length) {
            lastEl = $(lastEl[lastEl.length - 1]);
        }
        var lastDate = null;
        if(lastEl) {
            lastDate = parseInt(lastEl.attr("data-date"), 10);
        }
        if(lastEl && lastEl.attr("data-person") == attrs.peer.id &&
            lastDate && date < lastDate + COLLAPSE_MESSAGE_LIMIT) {
            lastEl.attr("data-date", date);
            var content = lastEl.find(".togetherjs-chat-content");
            assert(content.length);
            attrs.text = content.text() + "\n" + attrs.text;
            attrs.messageId = lastEl.attr("data-message-id");
            lastEl.remove();
        }
        var el = templating.sub("chat-message", {
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
        var date = attrs.date || Date.now();
        var el = templating.sub("chat-joined", {
            peer: attrs.peer,
            date: date
        });
        // FIXME: should bind the notification to the dock location
        this.add(el, attrs.peer.className("join-message-"), 4000);
    }

    leftSession(attrs: { peer: TogetherJSNS.PeerClass, date?: number, declinedJoin: boolean }) {
        assert(attrs.peer);
        var date = attrs.date || Date.now();
        var el = templating.sub("chat-left", {
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
        var date = attrs.date || Date.now();
        var el = templating.sub("chat-system", {
            content: attrs.text,
            date: date,
        });
        this.add(el, undefined, true);
    }

    clear() {
        deferForContainer(() => {
            var container = this.ui.container.find("#togetherjs-chat-messages");
            container.empty();
        })();
    }

    urlChange(attrs: { peer: TogetherJSNS.PeerClass, url: string, sameUrl: boolean, date?: number, title?: string }) {
        assert(attrs.peer);
        assert(typeof attrs.url == "string");
        assert(typeof attrs.sameUrl == "boolean");
        var messageId = attrs.peer.className("url-change-");
        // FIXME: duplicating functionality in .add():
        var realId = "togetherjs-chat-" + messageId;
        var date = attrs.date || Date.now();
        var title;
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
        var el = templating.sub("url-change", {
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
            var url = attrs.peer.url;
            if(attrs.peer.urlHash) {
                url += attrs.peer.urlHash;
            }
            if(url !== undefined) {
                location.href = url;
            }
        });
        var notify = !attrs.sameUrl;
        if(attrs.sameUrl && $("#" + realId).length === 0) {
            // Don't bother showing a same-url notification, if no previous notification had been shown
            return;
        }
        this.add(el, messageId, notify);
    }

    invite(attrs: { peer: TogetherJSNS.PeerClass | TogetherJSNS.ExternalPeer, url: string, date?: number, forEveryone: boolean }) {
        assert(attrs.peer);
        assert(typeof attrs.url == "string");
        var messageId = attrs.peer.className("invite-");
        var date = attrs.date || Date.now();
        var hrefTitle = attrs.url.replace(/\#?&togetherjs=.*/, "").replace(/^\w+:\/\//, "");
        var el = templating.sub("invite", {
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
            var container = this.ui.container.find("#togetherjs-chat-messages");
            assert(container.length);
            var popup = this.ui.container.find("#togetherjs-chat-notifier");
            container.append(el);
            this.scroll();
            var doNotify = !!notify;
            var section = popup.find("#togetherjs-chat-notifier-message");
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
            var container = this.ui.container.find("#togetherjs-chat-messages")[0];
            container.scrollTop = container.scrollHeight;
        })();
    }
}

/** Like PeerView but for PeerSelf/ExternalPeer objects, also acts as a base for PeerView since PeerView extends PeerSelfView */
class PeerSelfView {
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
        var count = 0;
        var classes = ["togetherjs-person", "togetherjs-person-status",
            "togetherjs-person-name", "togetherjs-person-name-abbrev",
            "togetherjs-person-bgcolor", "togetherjs-person-swatch",
            "togetherjs-person-status", "togetherjs-person-role",
            "togetherjs-person-url", "togetherjs-person-url-title",
            "togetherjs-person-bordercolor"];
        classes.forEach(function(this: PeerView, cls) {
            var els = el.find("." + cls);
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
            var abbrev = this.peer.name;
            if(this.peer.isSelf) {
                abbrev = "me";
            }
            container.find("." + this.peer.className("togetherjs-person-name-")).text(this.peer.name || "");
            container.find("." + this.peer.className("togetherjs-person-name-abbrev-")).text(abbrev!); // TODO !
            var avatarEl = container.find("." + this.peer.className("togetherjs-person-"));
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
                var colors = container.find("." + this.peer.className("togetherjs-person-bgcolor-"));
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
            var url = this.peer.url;
            if("urlHash" in this.peer && this.peer.urlHash) {
                url += this.peer.urlHash;
            }
            container.find("." + this.peer.className("togetherjs-person-url-")).attr("href", url!); // TODO !
            // FIXME: should have richer status:
            container.find("." + this.peer.className("togetherjs-person-status-")).text(this.peer.idle == "active" ? "Active" : "Inactive");
            if(this.peer.isSelf) {
                // FIXME: these could also have consistent/reliable class names:
                var selfName = $(".togetherjs-self-name");
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
        var same = this.detailElement.find(".togetherjs-same-url");
        var different = this.detailElement.find(".togetherjs-different-url");
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
class PeerView extends PeerSelfView {
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

        var url = this.peer.url;
        if(!url || (url == this._lastUpdateUrlDisplay && !force)) {
            return;
        }
        this._lastUpdateUrlDisplay = url;
        var sameUrl = url == session.currentUrl();
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
            var numberOfUsers = peers.getAllPeers().length;

            // collapse the Dock if too many users
            function CollapsedDock() {
                // decrease/reset dock height
                $("#togetherjs-dock").css("height", 260);
                //replace participant button
                $("#togetherjs-dock-participants").replaceWith("<button id='togetherjs-participantlist-button' class='togetherjs-button'><div class='togetherjs-tooltip togetherjs-dock-person-tooltip'><span class='togetherjs-person-name'>Participants</span><span class='togetherjs-person-tooltip-arrow-r'></span></div><div class='togetherjs-person togetherjs-person-status-overlay' title='Participant List' style='background-image: url(" + TogetherJS.baseUrl + "/images/robot-avatar.png); border-color: rgb(255, 0, 0);'></div></button>");
                // new full participant window created on toggle
                $("#togetherjs-participantlist-button").click(function() {
                    windowing.toggle("#togetherjs-participantlist");
                });
            }

            // FIXME: turned off for now
            if(numberOfUsers >= 5 && false) {
                CollapsedDock();
            }
            else {
                // reset

            }

            if(this.dockElement) {
                return;
            }
            this.dockElement = templating.sub("dock-person", {
                peer: this.peer
            });
            this.dockElement.attr("id", this.peer.className("togetherjs-dock-element-"));
            this.ui.container.find("#togetherjs-dock-participants").append(this.dockElement);
            this.dockElement.find(".togetherjs-person").animateDockEntry();
            adjustDockSize(1);
            this.detailElement = templating.sub("participant-window", {
                peer: this.peer
            });
            var followId = this.peer.className("togetherjs-person-status-follow-");
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
            this.ui.container.append(this.detailElement);
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
        this.dockElement.animateDockExit().promise().then(() => {
            this.dockElement!.remove(); // TODO !
            this.dockElement = null;
            this.detailElement!.remove(); // TODO !
            this.detailElement = null;
            adjustDockSize(-1);
        });
    }

    scrollTo() {
        if(this.peer.url != session.currentUrl()) {
            return;
        }
        var pos = this.peer.scrollPosition;
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
        const cursorModule = require("cursor") as typeof import("cursor");
        return cursorModule.cursor.getClient(this.peer.id);
    }

    destroy() {
        // FIXME: should I get rid of the dockElement?
        session.off("hide-window", this.maybeHideDetailWindow);
    }
}

class Ui {
    public container!: JQuery; // TODO !
    public readonly PeerView = (peer: TogetherJSNS.PeerClass) => new PeerView(this, peer);
    public readonly PeerSelfView = (peer: TogetherJSNS.PeerSelf | TogetherJSNS.ExternalPeer) => new PeerSelfView(this, peer);
    public readonly chat = new Chat(this);

    /* Displays some toggleable element; toggleable elements have a
    data-toggles attribute that indicates what other elements should
    be hidden when this element is shown. */
    displayToggle(elem: HTMLElement | string) {
        const el = $(elem);
        assert(el.length, "No element", arguments[0]);
        var other = $(el.attr("data-toggles"));
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
                var d = deferringPrepareUI;
                deferringPrepareUI = null;
                this.prepareUI();
                // This happens when ui.activateUI is called before the document has been
                // loaded:
                if(d == "activate") {
                    this.activateUI();
                }
            });
            return;
        }
        var container = this.container = $(templates("interface"));
        assert(container.length);
        $("body").append(container);
        fixupAvatars(container);
        if(session.firstRun && TogetherJS.startTarget) {
            // Time at which the UI will be fully ready: (We have to do this because the offset won't be quite right until the animation finishes - attempts to calculate the offset without taking into account CSS transforms have so far failed.)
            var timeoutSeconds = DOCK_ANIMATION_TIME / 1000;
            finishedAt = Date.now() + DOCK_ANIMATION_TIME + 50;
            setTimeout(function() {
                finishedAt = Date.now() + DOCK_ANIMATION_TIME + 40;
                var iface = container.find("#togetherjs-dock");
                var start = iface.offset()!; // TODO !
                let pos = $(TogetherJS.startTarget!).offset()!; // TODO !
                pos.top = Math.floor(pos.top - start.top);
                pos.left = Math.floor(pos.left - start.left);
                var translate = "translate(" + pos.left + "px, " + pos.top + "px)";
                iface.css({
                    MozTransform: translate,
                    WebkitTransform: translate,
                    transform: translate,
                    opacity: "0.0"
                });
                setTimeout(function() {
                    // We keep recalculating because the setTimeout times aren't always so accurate:
                    finishedAt = Date.now() + DOCK_ANIMATION_TIME + 20;
                    var transition = "transform " + timeoutSeconds + "s ease-out, ";
                    transition += "opacity " + timeoutSeconds + "s ease-out";
                    iface.css({
                        opacity: "1.0",
                        MozTransition: "-moz-" + transition,
                        MozTransform: "translate(0, 0)",
                        WebkitTransition: "-webkit-" + transition,
                        WebkitTransform: "translate(0, 0)",
                        transition: transition,
                        transform: "translate(0, 0)"
                    });
                    setTimeout(function() {
                        finishedAt = null;
                        iface.attr("style", "");
                    }, 510);
                }, 5);
            }, 5);
        }
        if(TogetherJS.startTarget) {
            var el = $(TogetherJS.startTarget);
            var text = el.text().toLowerCase().replace(/\s+/g, " ");
            text = text.replace(/^\s*/, "").replace(/\s*$/, "");
            if(text == "start togetherjs") {
                el.attr("data-end-togetherjs-html", "End TogetherJS");
            }
            if(el.attr("data-end-togetherjs-html")) {
                el.attr("data-start-togetherjs-html", el.html());
                el.html(el.attr("data-end-togetherjs-html"));
            }
            el.addClass("togetherjs-started");
        }
        this.container.find(".togetherjs-window > header, .togetherjs-modal > header").each(function(this: HTMLElement) {
            $(this).append($('<button class="togetherjs-close"></button>'));
        });

        TogetherJS.config.track("disableWebRTC", (hide, previous) => {
            if(hide && !previous) {
                this.container.find("#togetherjs-audio-button").hide();
                adjustDockSize(-1);
            }
            else if((!hide) && previous) {
                this.container.find("#togetherjs-audio-button").show();
                adjustDockSize(1);
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
        var container = this.container;

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
        var input = container.find("#togetherjs-chat-input");
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
            var val = input.val();
            if($.trim(val)) {
                input.val("");
                // triggering the event manually to avoid the addition of newline character to the textarea:
                input.trigger("input").trigger("propertychange");
                chat.submit(val);
            }
        }
        // auto-resize textarea:
        input.on("input propertychange", function(this: HTMLInputElement) {
            var $this = $(this);
            var actualHeight = $this.height();
            // reset the height of textarea to remove trailing empty space (used for shrinking):
            $this.height(TEXTAREA_LINE_HEIGHT);
            this.scrollTop = 0;
            // scroll to bottom:
            this.scrollTop = 9999;
            var newHeight = this.scrollTop + $this.height();
            var maxHeight = TEXTAREA_MAX_LINES * TEXTAREA_LINE_HEIGHT;
            if(newHeight > maxHeight) {
                newHeight = maxHeight;
                this.style.overflowY = "scroll";
            }
            else {
                this.style.overflowY = "hidden";
            }
            this.style.height = newHeight + "px";
            var diff = newHeight - actualHeight;
            $("#togetherjs-chat-input-box").height($("#togetherjs-chat-input-box").height() + diff);
            $("#togetherjs-chat-messages").height($("#togetherjs-chat-messages").height() - diff);
            return false;
        });

        util.testExpose({ submitChat: submitChat });

        // Moving the window:
        // FIXME: this should probably be stickier, and not just move the window around
        // so abruptly
        var anchor = container.find("#togetherjs-dock-anchor");
        assert(anchor.length);
        // FIXME: This is in place to temporarily disable dock dragging:
        anchor = container.find("#togetherjs-dock-anchor-disabled");
        anchor.mousedown(function(_event) {
            var iface = $("#togetherjs-dock");
            // FIXME: switch to .offset() and pageX/Y
            let startPos: string | null = panelPosition();
            function selectoff() {
                return false;
            }
            function mousemove(event2: JQueryEventObject) {
                var fromRight = $window.width() + window.pageXOffset - event2.pageX;
                var fromLeft = event2.pageX - window.pageXOffset;
                var fromBottom = $window.height() + window.pageYOffset - event2.pageY;
                // FIXME: this is to temporarily disable the bottom view:
                fromBottom = 10000;

                var pos;
                if(fromLeft < fromRight && fromLeft < fromBottom) {
                    pos = "left";
                }
                else if(fromRight < fromLeft && fromRight < fromBottom) {
                    pos = "right";
                }
                else {
                    pos = "bottom";
                }
                iface.removeClass("togetherjs-dock-left");
                iface.removeClass("togetherjs-dock-right");
                iface.removeClass("togetherjs-dock-bottom");
                iface.addClass("togetherjs-dock-" + pos);
                if(startPos && pos != startPos) {
                    windowing.hide();
                    startPos = null;
                }
            }
            $(document).bind("mousemove", mousemove);
            // If you don't turn selection off it will still select text, and show a
            // text selection cursor:
            $(document).bind("selectstart", selectoff);
            // FIXME: it seems like sometimes we lose the mouseup event, and it's as though
            // the mouse is stuck down:
            $(document).one("mouseup", function() {
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
            var src = "/images/togetherjs-logo-close.png";
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
            var src = "/images/togetherjs-logo-open.png";
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
            var src = "/images/togetherjs-logo-close.png";
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
        });

        $("#togetherjs-menu-help, #togetherjs-menu-help-button").click(function() {
            windowing.hide();
            hideMenu();
            require(["walkthrough"], function({ walkthrough }: typeof import("walkthrough")) {
                windowing.hide();
                walkthrough.start(false);
            });
        });

        $("#togetherjs-menu-update-name").click(() => {
            var input = $("#togetherjs-menu .togetherjs-self-name");
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
            var val = $("#togetherjs-menu .togetherjs-self-name").val();
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
            var picker = $("#togetherjs-pick-color");
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
            var swatch = $(event.target);
            var color = swatch.attr("data-color");
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
            var el = templating.sub("swatch", {});
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
                var link = element.find("input.togetherjs-share-link");
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
            var button = $('<button class="togetherjs-minimize"></button>');
            button.click(function(_event) {
                var window = button.closest(".togetherjs-window");
                windowing.hide(window);
            });
            $(item).append(button);
        });

        $("#togetherjs-avatar-done").click(() => {
            this.displayToggle("#togetherjs-no-avatar-edit");
        });

        $("#togetherjs-self-color").css({ backgroundColor: peers.Self.color });

        var avatar = peers.Self.avatar;
        if(avatar) {
            $("#togetherjs-self-avatar").attr("src", avatar);
        }

        var starterButton = $("#togetherjs-starter button");
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
            setTimeout(function() {
                finishedAt = null;
                session.emit("ui-ready", ui);
            }, finishedAt - Date.now());
        }
        else {
            session.emit("ui-ready", ui);
        }

    } // End ui.activateUI()

    activateAvatarEdit(container: JQuery, options: { onSave?: () => void, onPending?: () => void } = {}) {
        var pendingImage: string | null = null;

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
        // TODO qw this do not work, remove?
        container.find("a.togetherjs-share-link").click(function(this: HTMLElement) {
            // FIXME: this is currently opening up Bluetooth, not sharing a link
            if(false && window.MozActivity) {
                //@ts-expect-error unused
                var activity = new MozActivity({
                    name: "share",
                    data: {
                        type: "url",
                        url: $(this).attr("href")
                    }
                });
            }
            // FIXME: should show some help if you actually try to follow the link
            // like this, instead of simply suppressing it
            return false;
        });
        updateShareLink();
    }

    showUrlChangeMessage(peer: TogetherJSNS.PeerClass, _url: string) {
        deferForContainer(() => {
            var window = templating.sub("url-change", { peer: peer });
            this.container.append(window);
            windowing.show(window);
        })();
    }

    updateToolName(container: JQuery) {
        container = container || $(document.body);
        var name = TogetherJS.config.get("toolName");
        if(setToolName && !name) {
            name = "TogetherJS";
        }
        if(name) {
            container.find(".togetherjs-tool-name").text(name);
            setToolName = true;
        }
    }
}

function panelPosition() {
    var iface = $("#togetherjs-dock");
    if(iface.hasClass("togetherjs-dock-right")) {
        return "right";
    }
    else if(iface.hasClass("togetherjs-dock-left")) {
        return "left";
    }
    else if(iface.hasClass("togetherjs-dock-bottom")) {
        return "bottom";
    }
    else {
        throw new AssertionError("#togetherjs-dock doesn't have positioning class");
    }
}

export const ui = new Ui();

// This is used for some signalling when ui.prepareUI and/or
// ui.activateUI is called before the DOM is fully loaded:
let deferringPrepareUI: string | null = null;

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
        let canvas = document.createElement("canvas");
        canvas.height = session.AVATAR_SIZE;
        canvas.width = session.AVATAR_SIZE;
        let context = canvas.getContext("2d")!; // TODO !
        var img = new Image();
        img.src = imageUrl;
        // Sometimes the DOM updates immediately to call
        // naturalWidth/etc, and sometimes it doesn't; using setTimeout
        // gives it a chance to catch up
        setTimeout(function() {
            var width = img.naturalWidth || img.width;
            var height = img.naturalHeight || img.height;
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
        var $this = $(this);
        var inner = $this.find(".togetherjs-person-avatar-swatch");
        if(!inner.length) {
            $this.append('<div class="togetherjs-person-avatar-swatch"></div>');
        }
    });
}

// Menu

function showMenu() {
    var el = $("#togetherjs-menu");
    assert(el.length);
    el.show();
    bindMenu();
    $(document).bind("click", maybeHideMenu);
}

function bindMenu() {
    var el = $("#togetherjs-menu:visible");
    if(el.length) {
        var bound = $("#togetherjs-profile-button");
        var boundOffset = bound.offset()!; // TODO !
        el.css({
            top: boundOffset.top + bound.height() - $window.scrollTop() + "px",
            left: (boundOffset.left + bound.width() - 10 - el.width() - $window.scrollLeft()) + "px"
        });
    }
}

function bindPicker() {
    var picker = $("#togetherjs-pick-color:visible");
    if(picker.length) {
        var menu = $("#togetherjs-menu-update-color");
        var menuOffset = menu.offset()!; // TODO !
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
    var el = $("#togetherjs-menu");
    el.hide();
    $(document).unbind("click", maybeHideMenu);
    ui.displayToggle("#togetherjs-self-name-display");
    $("#togetherjs-pick-color").hide();
}

function maybeHideMenu(event: Event) {
    var t = event.target as Element;
    while(t) {
        if(t.id == "togetherjs-menu") {
            // Click inside the menu, ignore this
            return;
        }
        t = t.parentElement!;
    }
    hideMenu();
}

function adjustDockSize(buttons: number) {
    /* Add or remove spots from the dock; positive number to
        add button(s), negative number to remove button(s)
        */
    assert(typeof buttons == "number");
    assert(buttons && Math.floor(buttons) == buttons);
    var iface = $("#togetherjs-dock");
    var newHeight = iface.height() + (BUTTON_HEIGHT * buttons);
    assert(newHeight >= BUTTON_HEIGHT * 3, "Height went too low (", newHeight,
        "), should never be less than 3 buttons high (", BUTTON_HEIGHT * 3, ")");
    iface.css({
        height: newHeight + "px"
    });
}

// Misc

function updateShareLink() {
    var input = $("input.togetherjs-share-link");
    var link = $("a.togetherjs-share-link");
    var display = $("#togetherjs-session-id");
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
    var starterButton = $("#togetherjs-starter button");
    starterButton.removeClass("togetherjs-running");
    if(starterButton.attr("data-start-text")) {
        starterButton.text(starterButton.attr("data-start-text"));
        starterButton.attr("data-start-text", "");
    }
    if(TogetherJS.startTarget) {
        var el = $(TogetherJS.startTarget);
        if(el.attr("data-start-togetherjs-html")) {
            el.html(el.attr("data-start-togetherjs-html"));
        }
        el.removeClass("togetherjs-started");
    }
});

session.on("display-window", function(id, _win) {
    if(id == "togetherjs-chat") {
        ui.chat.scroll();
        windowing.hide("#togetherjs-chat-notifier");
    }
});

function updateChatParticipantList() {
    var live = peers.getAllPeers(true);
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
    var base = TogetherJS.config.get("inviteFromRoom");
    assert(base);
    return util.makeUrlAbsolute(base, session.hubUrl());
}

var inRefresh = false;

function refreshInvite() {
    if(inRefresh) {
        return;
    }
    inRefresh = true;
    require(["who"], function({ who }: typeof import("who")) {
        var def = who.getList(inviteHubUrl());
        function addUser(user: TogetherJSNS.PeerClass | TogetherJSNS.ExternalPeer, before?: JQuery) {
            var item = templating.sub("invite-user-item", { peer: user });
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
            var sorted: TogetherJSNS.ExternalPeer[] = [];
            for(var id in users) {
                if(users.hasOwnProperty(id)) {
                    sorted.push(users[id]);
                }
            }
            sorted.sort(function(a, b) {
                return (a.name || "") < (b.name || "") ? -1 : 1;
            });
            var pos = 0;
            ui.container.find("#togetherjs-invite-users .togetherjs-menu-item").each(function(this: HTMLElement) {
                var $this = $(this);
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
            for(var i = pos; i < sorted.length; i++) {
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
    require(["who"], function({ who }: typeof import("who")) {
        var peer = who.ExternalPeer(msg.userInfo.clientId, msg.userInfo);
        ui.chat.invite({ peer: peer, url: msg.url, forEveryone: !msg.forClientId });
    });
});

function invite(clientId: string | null) {
    require(["who"], function({ who }: typeof import("who")) {
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

var setToolName = false;

TogetherJS.config.track("toolName", function() {
    ui.updateToolName(ui.container);
});

//return ui;

//define(["require", "jquery", "util", "session", "templates", "templating", "linkify", "peers", "windowing", "elementFinder", "visibilityApi"], uiMain);
