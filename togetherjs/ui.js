/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "./elementFinder", "./linkify", "./peers", "./session", "./templates", "./templating", "./util", "./visibilityApi", "./windowing", "jquery"], function (require, exports, elementFinder_1, linkify_1, peers_1, session_1, templates_1, templating_1, util_1, visibilityApi_1, windowing_1, jquery_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ui = exports.Ui = exports.PeerView = exports.PeerSelfView = void 0;
    jquery_1 = __importDefault(jquery_1);
    //function uiMain(require: Require, $: JQueryStatic, util: TogetherJSNS.Util, session: TogetherJSNS.Session, templates: TogetherJSNS.Templates, templating: TogetherJSNS.Templating, linkify: TogetherJSNS.Linkify, peers: TogetherJSNS.Peers, windowing: TogetherJSNS.Windowing, elementFinder: TogetherJSNS.ElementFinder, visibilityApi: TogetherJSNS.VisibilityApi) {
    const assert = util_1.util.assert.bind(util_1.util);
    const AssertionError = util_1.util.AssertionError;
    let chat;
    const $window = jquery_1.default(window);
    // This is also in togetherjs.less, as @button-height:
    const BUTTON_HEIGHT = 60 + 1; // 60 is button height, 1 is border
    // chat TextArea
    const TEXTAREA_LINE_HEIGHT = 20; // in pixels
    const TEXTAREA_MAX_LINES = 5;
    // This is set when an animation will keep the UI from being ready (until this time):
    let finishedAt = null;
    // If two chat messages come from the same person in this time (milliseconds) then they are collapsed into one message:
    const COLLAPSE_MESSAGE_LIMIT = 5000;
    const COLORS = ["#8A2BE2", "#7FFF00", "#DC143C", "#00FFFF", "#8FBC8F", "#FF8C00", "#FF00FF", "#FFD700", "#F08080", "#90EE90", "#FF6347"];
    // This is used for some signalling when ui.prepareUI and/or ui.activateUI is called before the DOM is fully loaded:
    let deferringPrepareUI = null;
    let setToolName = false;
    // This would be a circular import, but we just need the chat module sometime after everything is loaded, and this is sure to complete by that time:
    require(["chat"], function (chatModule) {
        chat = chatModule.chat;
    });
    class Chat {
        constructor(ui) {
            this.ui = ui;
        }
        text(attrs) {
            assert(typeof attrs.text == "string");
            assert(attrs.peer);
            assert(attrs.messageId);
            const date = attrs.date || Date.now();
            let lastEl = this.ui.container.find("#togetherjs-chat .togetherjs-chat-message");
            if (lastEl.length) {
                lastEl = jquery_1.default(lastEl[lastEl.length - 1]);
            }
            let lastDate = null;
            if (lastEl) {
                lastDate = parseInt(lastEl.attr("data-date"), 10);
            }
            if (lastEl && lastEl.attr("data-person") == attrs.peer.id &&
                lastDate && date < lastDate + COLLAPSE_MESSAGE_LIMIT) {
                lastEl.attr("data-date", date);
                const content = lastEl.find(".togetherjs-chat-content");
                assert(content.length);
                attrs.text = content.text() + "\n" + attrs.text;
                attrs.messageId = lastEl.attr("data-message-id");
                lastEl.remove();
            }
            const el = templating_1.templating.sub("chat-message", {
                peer: attrs.peer,
                content: attrs.text,
                date: date,
            });
            linkify_1.linkify(el.find(".togetherjs-chat-content"));
            el.attr("data-person", attrs.peer.id)
                .attr("data-date", date)
                .attr("data-message-id", attrs.messageId);
            this.add(el, attrs.messageId, attrs.notify);
        }
        joinedSession(attrs) {
            assert(attrs.peer);
            const date = attrs.date || Date.now();
            const el = templating_1.templating.sub("chat-joined", {
                peer: attrs.peer,
                date: date
            });
            // FIXME: should bind the notification to the dock location
            this.add(el, attrs.peer.className("join-message-"), 4000);
        }
        leftSession(attrs) {
            assert(attrs.peer);
            const date = attrs.date || Date.now();
            const el = templating_1.templating.sub("chat-left", {
                peer: attrs.peer,
                date: date,
                declinedJoin: attrs.declinedJoin
            });
            // FIXME: should bind the notification to the dock location
            this.add(el, attrs.peer.className("join-message-"), 4000);
        }
        system(attrs) {
            assert(!("peer" in attrs)); // TODO why does it asserts that we DON'T have a peer field?
            assert(typeof attrs.text == "string");
            const date = attrs.date || Date.now();
            const el = templating_1.templating.sub("chat-system", {
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
        urlChange(attrs) {
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
            if (attrs.title) {
                title = attrs.title + " (" + attrs.url + ")";
            }
            else {
                title = attrs.url;
            }
            const el = templating_1.templating.sub("url-change", {
                peer: attrs.peer,
                date: date,
                href: attrs.url,
                title: title,
                sameUrl: attrs.sameUrl
            });
            el.find(".togetherjs-nudge").click(function () {
                attrs.peer.nudge();
                return false;
            });
            el.find(".togetherjs-follow").click(function () {
                let url = attrs.peer.url;
                if (attrs.peer.urlHash) {
                    url += attrs.peer.urlHash;
                }
                if (url !== undefined) {
                    location.href = url;
                }
            });
            const notify = !attrs.sameUrl;
            if (attrs.sameUrl && jquery_1.default("#" + realId).length === 0) {
                // Don't bother showing a same-url notification, if no previous notification had been shown
                return;
            }
            this.add(el, messageId, notify);
        }
        invite(attrs) {
            assert(attrs.peer);
            assert(typeof attrs.url == "string");
            const messageId = attrs.peer.className("invite-");
            const date = attrs.date || Date.now();
            const hrefTitle = attrs.url.replace(/#?&togetherjs=.*/, "").replace(/^\w+:\/\//, "");
            const el = templating_1.templating.sub("invite", {
                peer: attrs.peer,
                date: date,
                href: attrs.url,
                hrefTitle: hrefTitle,
                forEveryone: attrs.forEveryone
            });
            if (attrs.forEveryone) {
                el.find("a").click(function () {
                    // FIXME: hacky way to do this:
                    chat.submit("Followed link to " + attrs.url);
                });
            }
            this.add(el, messageId, true);
        }
        add(el, id, notify = false) {
            deferForContainer(() => {
                if (id) {
                    el.attr("id", "togetherjs-chat-" + util_1.util.safeClassName(id));
                }
                const container = this.ui.container.find("#togetherjs-chat-messages");
                assert(container.length);
                const popup = this.ui.container.find("#togetherjs-chat-notifier");
                container.append(el);
                this.scroll();
                let doNotify = !!notify;
                const section = popup.find("#togetherjs-chat-notifier-message");
                if (notify && visibilityApi_1.visibilityApi.hidden()) {
                    const mediaElement = this.ui.container.find("#togetherjs-notification")[0];
                    mediaElement.play();
                }
                if (id && section.data("message-id") == id) {
                    doNotify = true;
                }
                if (container.is(":visible")) {
                    doNotify = false;
                }
                if (doNotify) {
                    section.empty();
                    section.append(el.clone(true, true));
                    if (section.data("message-id") != id) {
                        section.data("message-id", id || "");
                        windowing_1.windowing.show(popup);
                    }
                    else if (!popup.is(":visible")) {
                        windowing_1.windowing.show(popup);
                    }
                    if (typeof notify == "number") {
                        // This is the amount of time we're supposed to notify
                        if (this.hideTimeout) {
                            clearTimeout(this.hideTimeout);
                            this.hideTimeout = undefined;
                        }
                        this.hideTimeout = setTimeout(() => {
                            windowing_1.windowing.hide(popup);
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
    class PeerSelfView {
        constructor(ui, peer) {
            this.ui = ui;
            this.peer = peer;
            this.dockElement = null;
            this.detailElement = null;
        }
        /** Takes an element and sets any person-related attributes on the element. Different from updates, which use the class names we set here: */
        setElement(el) {
            let count = 0;
            const classes = ["togetherjs-person", "togetherjs-person-status",
                "togetherjs-person-name", "togetherjs-person-name-abbrev",
                "togetherjs-person-bgcolor", "togetherjs-person-swatch",
                "togetherjs-person-status", "togetherjs-person-role",
                "togetherjs-person-url", "togetherjs-person-url-title",
                "togetherjs-person-bordercolor"];
            classes.forEach(function (cls) {
                const els = el.find("." + cls);
                els.addClass(this.peer.className(cls + "-"));
                count += els.length;
            }, this);
            if (!count) {
                console.warn("setElement(", el, ") doesn't contain any person items");
            }
            this.updateDisplay(el);
        }
        update() {
            this.updateDisplay();
        }
        updateDisplay(container) {
            deferForContainer(() => {
                container = container || this.ui.container;
                let abbrev = this.peer.name;
                if (this.peer.isSelf) {
                    abbrev = "me";
                }
                container.find("." + this.peer.className("togetherjs-person-name-")).text(this.peer.name || "");
                container.find("." + this.peer.className("togetherjs-person-name-abbrev-")).text(abbrev); // TODO !
                const avatarEl = container.find("." + this.peer.className("togetherjs-person-"));
                if (this.peer.avatar) {
                    util_1.util.assertValidUrl(this.peer.avatar);
                    avatarEl.css({
                        backgroundImage: "url(" + this.peer.avatar + ")"
                    });
                }
                if (this.peer.idle == "inactive") {
                    avatarEl.addClass("togetherjs-person-inactive");
                }
                else {
                    avatarEl.removeClass("togetherjs-person-inactive");
                }
                avatarEl.attr("title", this.peer.name);
                if (this.peer.color) {
                    avatarEl.css({
                        borderColor: this.peer.color
                    });
                    avatarEl.find(".togetherjs-person-avatar-swatch").css({
                        borderTopColor: this.peer.color,
                        borderRightColor: this.peer.color
                    });
                }
                if (this.peer.color) {
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
                let urlName;
                const domain = util_1.util.truncateCommonDomain(this.peer.url, location.href); // TODO !
                // TODO code change
                if ("title" in this.peer && this.peer.title) {
                    urlName = this.peer.title + " (" + domain + ")";
                }
                else {
                    urlName = domain;
                }
                container.find("." + this.peer.className("togetherjs-person-url-title-")).text(urlName);
                let url = this.peer.url;
                if ("urlHash" in this.peer && this.peer.urlHash) {
                    url += this.peer.urlHash;
                }
                container.find("." + this.peer.className("togetherjs-person-url-")).attr("href", url); // TODO !
                // FIXME: should have richer status:
                container.find("." + this.peer.className("togetherjs-person-status-")).text(this.peer.idle == "active" ? "Active" : "Inactive");
                if (this.peer.isSelf) {
                    // FIXME: these could also have consistent/reliable class names:
                    const selfName = jquery_1.default(".togetherjs-self-name");
                    selfName.each((function (_index, elem) {
                        const el = jquery_1.default(elem);
                        if (el.val() != this.peer.name) {
                            el.val(this.peer.name); // TODO !
                        }
                    }).bind(this));
                    jquery_1.default("#togetherjs-menu-avatar").attr("src", this.peer.avatar);
                    if (!this.peer.name && this.peer.defaultName) {
                        jquery_1.default("#togetherjs-menu .togetherjs-person-name-self").text(this.peer.defaultName);
                    }
                }
                if (this.peer.url != session_1.session.currentUrl()) {
                    container.find("." + this.peer.className("togetherjs-person-")).addClass("togetherjs-person-other-url");
                }
                else {
                    container.find("." + this.peer.className("togetherjs-person-")).removeClass("togetherjs-person-other-url");
                }
                if ("following" in this.peer && this.peer.following) {
                    if (this.followCheckbox) {
                        this.followCheckbox.prop("checked", true);
                    }
                }
                else {
                    if (this.followCheckbox) {
                        this.followCheckbox.prop("checked", false);
                    }
                }
                // FIXME: add some style based on following?
                updateChatParticipantList();
                this.updateFollow();
            })();
        }
        updateFollow() {
            if (!("url" in this.peer) || !this.peer.url) {
                return;
            }
            if (!this.detailElement) {
                return;
            }
            const same = this.detailElement.find(".togetherjs-same-url");
            const different = this.detailElement.find(".togetherjs-different-url");
            if (this.peer.url == session_1.session.currentUrl()) {
                same.show();
                different.hide();
            }
            else {
                same.hide();
                different.show();
            }
        }
    }
    exports.PeerSelfView = PeerSelfView;
    /* This class is bound to peers.Peer instances as peer.view. The .update() method is regularly called by peer objects when info changes. */
    class PeerView extends PeerSelfView {
        constructor(ui, peer) {
            super(ui, peer);
            this.peer = peer;
            assert(peer.isSelf !== undefined, "PeerView instantiated with non-Peer object");
        }
        update() {
            // Called d0 from PeerSelf & PeerClass
            // Only function directly called from PeerSelf
            if (!this.peer.isSelf) {
                if (this.peer.status == "live") {
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
            if (this.peer.isSelf) {
                return; // TODO see long explantion above and check that it's ok
            }
            const url = this.peer.url;
            if (!url || (url == this._lastUpdateUrlDisplay && !force)) {
                return;
            }
            this._lastUpdateUrlDisplay = url;
            const sameUrl = url == session_1.session.currentUrl();
            this.ui.chat.urlChange({
                peer: this.peer,
                url: this.peer.url,
                title: this.peer.title,
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
                if (this.dockElement) {
                    return;
                }
                this.dockElement = templating_1.templating.sub("dock-person", {
                    peer: this.peer
                });
                this.dockElement.attr("id", this.peer.className("togetherjs-dock-element-"));
                this.ui.container.find("#togetherjs-dock-participants").append(this.dockElement);
                this.dockElement.find(".togetherjs-person").animateDockEntry();
                adjustDockSize(1);
                this.detailElement = templating_1.templating.sub("participant-window", {
                    peer: this.peer
                });
                const followId = this.peer.className("togetherjs-person-status-follow-");
                this.detailElement.find('[for="togetherjs-person-status-follow"]').attr("for", followId);
                this.detailElement.find('#togetherjs-person-status-follow').attr("id", followId);
                this.detailElement.find(".togetherjs-follow").click(function () {
                    location.href = jquery_1.default(this).attr("href");
                });
                this.detailElement.find(".togetherjs-nudge").click(() => {
                    this.peer.nudge();
                });
                this.followCheckbox = this.detailElement.find("#" + followId);
                const self = this;
                this.followCheckbox.change(function () {
                    if (!this.checked) {
                        self.peer.unfollow();
                    }
                    // Following doesn't happen until the window is closed
                    // FIXME: should we tell the user this?
                });
                this.maybeHideDetailWindow = this.maybeHideDetailWindow.bind(this);
                session_1.session.on("hide-window", this.maybeHideDetailWindow);
                this.ui.container.append(this.detailElement);
                this.dockElement.click(() => {
                    var _a;
                    if (this.detailElement.is(":visible")) { // TODO ! detailElement is probably set when we click on the dock, we should find a way to signify that more clearly
                        windowing_1.windowing.hide(this.detailElement); // TODO !
                    }
                    else {
                        windowing_1.windowing.show(this.detailElement, { bind: (_a = this.dockElement) !== null && _a !== void 0 ? _a : undefined }); // TODO !
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
            if (!this.dockElement) {
                return;
            }
            this.dockElement.animateDockExit().promise().then(() => {
                this.dockElement.remove(); // TODO !
                this.dockElement = null;
                this.detailElement.remove(); // TODO !
                this.detailElement = null;
                adjustDockSize(-1);
            });
        }
        scrollTo() {
            if (this.peer.url != session_1.session.currentUrl()) {
                return;
            }
            const pos = this.peer.scrollPosition;
            if (!pos) {
                console.warn("Peer has no scroll position:", this.peer);
                return;
            }
            jquery_1.default("html, body").easeTo(elementFinder_1.elementFinder.pixelForPosition(pos));
        }
        maybeHideDetailWindow(windows) {
            if (this.detailElement && windows[0] && windows[0][0] === this.detailElement[0]) {
                if (this.followCheckbox && this.followCheckbox[0].checked) {
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
            session_1.session.off("hide-window", this.maybeHideDetailWindow);
        }
    }
    exports.PeerView = PeerView;
    class Ui {
        constructor() {
            this.PeerView = (peer) => new PeerView(this, peer);
            this.PeerSelfView = (peer) => new PeerSelfView(this, peer);
            this.chat = new Chat(this);
        }
        /* Displays some toggleable element; toggleable elements have a
        data-toggles attribute that indicates what other elements should
        be hidden when this element is shown. */
        displayToggle(elem) {
            const el = jquery_1.default(elem);
            const other = jquery_1.default(el.attr("data-toggles"));
            assert(other.length, "Cannot toggle", el[0], "selector", other.selector);
            other.hide();
            el.show();
        }
        // This is called before activateUI; it doesn't bind anything, but does display the dock
        // FIXME: because this module has lots of requirements we can't do this before those requirements are loaded.  Maybe worth splitting this out?  OTOH, in production we should have all the files combined so there's not much problem loading those modules.
        prepareUI() {
            if (!(document.readyState == "complete" || document.readyState == "interactive")) {
                // Too soon!  Wait a sec...
                deferringPrepareUI = "deferring";
                document.addEventListener("DOMContentLoaded", () => {
                    const d = deferringPrepareUI;
                    deferringPrepareUI = null;
                    this.prepareUI();
                    // This happens when ui.activateUI is called before the document has been loaded:
                    if (d == "activate") {
                        this.activateUI();
                    }
                });
                return;
            }
            const container = this.container = jquery_1.default(templates_1.templates("interface"));
            assert(container.length);
            jquery_1.default("body").append(container);
            fixupAvatars(container);
            this.container.find(".togetherjs-window > header, .togetherjs-modal > header").each(function () {
                jquery_1.default(this).append(jquery_1.default('<button class="togetherjs-close"></button>'));
            });
            TogetherJS.config.track("disableWebRTC", (hide, previous) => {
                if (hide && !previous) {
                    this.container.find("#togetherjs-audio-button").hide();
                    adjustDockSize(-1);
                }
                else if ((!hide) && previous) {
                    this.container.find("#togetherjs-audio-button").show();
                    adjustDockSize(1);
                }
            });
        }
        // After prepareUI, this actually makes the interface live.  We have to do this later because we call prepareUI when many components aren't initialized, so we don't even want the user to be able to interact with the interface.  But activateUI is called once everything is loaded and ready for interaction.
        activateUI() {
            if (deferringPrepareUI) {
                console.warn("ui.activateUI called before document is ready; waiting...");
                deferringPrepareUI = "activate";
                return;
            }
            if (!this.container) {
                this.prepareUI();
            }
            const container = this.container;
            //create the overlay
            if (jquery_1.default.browser.mobile) {
                // $("body").append( "\x3cdiv class='overlay' style='position: absolute; top: 0; left: 0; background-color: rgba(0,0,0,0); width: 120%; height: 100%; z-index: 1000; margin: -10px'>\x3c/div>" );
            }
            // The share link:
            this.prepareShareLink(container);
            container.find("input.togetherjs-share-link").on("keydown", function (event) {
                if (event.which == 27) {
                    windowing_1.windowing.hide("#togetherjs-share");
                    return false;
                }
                return undefined;
            });
            session_1.session.on("shareId", updateShareLink);
            // The chat input element:
            const input = container.find("#togetherjs-chat-input");
            //@
            input.bind("keydown", function (event) {
                if (event.which == 13 && !event.shiftKey) { // Enter without Shift pressed
                    submitChat();
                    return false;
                }
                if (event.which == 27) { // Escape
                    windowing_1.windowing.hide("#togetherjs-chat");
                    return false;
                }
                return; // just for the lint rule saying "not all path return a value"
            });
            function submitChat() {
                const val = input.val();
                if (jquery_1.default.trim(val)) {
                    input.val("");
                    // triggering the event manually to avoid the addition of newline character to the textarea:
                    input.trigger("input").trigger("propertychange");
                    chat.submit(val);
                }
            }
            // auto-resize textarea:
            input.on("input propertychange", function () {
                const $this = jquery_1.default(this);
                const actualHeight = $this.height();
                // reset the height of textarea to remove trailing empty space (used for shrinking):
                $this.height(TEXTAREA_LINE_HEIGHT);
                this.scrollTop = 0;
                // scroll to bottom:
                this.scrollTop = 9999;
                let newHeight = this.scrollTop + $this.height();
                const maxHeight = TEXTAREA_MAX_LINES * TEXTAREA_LINE_HEIGHT;
                if (newHeight > maxHeight) {
                    newHeight = maxHeight;
                    this.style.overflowY = "scroll";
                }
                else {
                    this.style.overflowY = "hidden";
                }
                this.style.height = newHeight + "px";
                const diff = newHeight - actualHeight;
                jquery_1.default("#togetherjs-chat-input-box").height(jquery_1.default("#togetherjs-chat-input-box").height() + diff);
                jquery_1.default("#togetherjs-chat-messages").height(jquery_1.default("#togetherjs-chat-messages").height() - diff);
                return false;
            });
            util_1.util.testExpose({ submitChat: submitChat });
            // Moving the window:
            // FIXME: this should probably be stickier, and not just move the window around
            // so abruptly
            let anchor = container.find("#togetherjs-dock-anchor");
            assert(anchor.length);
            // FIXME: This is in place to temporarily disable dock dragging:
            anchor = container.find("#togetherjs-dock-anchor-disabled");
            anchor.mousedown(function () {
                const iface = jquery_1.default("#togetherjs-dock");
                // FIXME: switch to .offset() and pageX/Y
                let startPos = panelPosition();
                function selectoff() {
                    return false;
                }
                function mousemove(event2) {
                    const fromRight = $window.width() + window.pageXOffset - event2.pageX;
                    const fromLeft = event2.pageX - window.pageXOffset;
                    let fromBottom = $window.height() + window.pageYOffset - event2.pageY;
                    // FIXME: this is to temporarily disable the bottom view:
                    fromBottom = 10000;
                    let pos;
                    if (fromLeft < fromRight && fromLeft < fromBottom) {
                        pos = "left";
                    }
                    else if (fromRight < fromLeft && fromRight < fromBottom) {
                        pos = "right";
                    }
                    else {
                        pos = "bottom";
                    }
                    iface.removeClass("togetherjs-dock-left");
                    iface.removeClass("togetherjs-dock-right");
                    iface.removeClass("togetherjs-dock-bottom");
                    iface.addClass("togetherjs-dock-" + pos);
                    if (startPos && pos != startPos) {
                        windowing_1.windowing.hide();
                        startPos = null;
                    }
                }
                jquery_1.default(document).bind("mousemove", mousemove);
                // If you don't turn selection off it will still select text, and show a
                // text selection cursor:
                jquery_1.default(document).bind("selectstart", selectoff);
                // FIXME: it seems like sometimes we lose the mouseup event, and it's as though
                // the mouse is stuck down:
                jquery_1.default(document).one("mouseup", function () {
                    jquery_1.default(document).unbind("mousemove", mousemove);
                    jquery_1.default(document).unbind("selectstart", selectoff);
                });
                return false;
            });
            function openDock() {
                jquery_1.default('.togetherjs-window').animate({
                    opacity: 1
                });
                jquery_1.default('#togetherjs-dock-participants').animate({
                    opacity: 1
                });
                jquery_1.default('#togetherjs-dock #togetherjs-buttons').animate({
                    opacity: 1
                });
                //for iphone
                if (jquery_1.default(window).width() < 480) {
                    jquery_1.default('.togetherjs-dock-right').animate({ width: "204px" }, { duration: 60, easing: "linear" }, "linear" // TODO adding that seems to match the prototy more closly, check that it's ok, anyway we want to remove JQuery and at worst this parameter will be ignored
                    );
                }
                //for ipad
                else {
                    jquery_1.default('.togetherjs-dock-right').animate({ width: "27%" }, { duration: 60, easing: "linear" }, "linear" // TODO see above
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
                jquery_1.default("#togetherjs-dock-anchor #togetherjs-dock-anchor-horizontal img").attr("src", src);
            }
            function closeDock() {
                //enable vertical scrolling
                jquery_1.default("body").css({
                    "position": "",
                    top: "",
                    left: ""
                });
                //replace the anchor icon
                const src = "/images/togetherjs-logo-open.png";
                jquery_1.default("#togetherjs-dock-anchor #togetherjs-dock-anchor-horizontal img").attr("src", src);
                jquery_1.default('.togetherjs-window').animate({ opacity: 0 });
                jquery_1.default('#togetherjs-dock-participants').animate({ opacity: 0 });
                jquery_1.default('#togetherjs-dock #togetherjs-buttons').animate({ opacity: 0 });
                jquery_1.default('.togetherjs-dock-right').animate({ width: "40px" }, { duration: 60, easing: "linear" }, "linear" // TODO see above
                );
                // remove bg overlay
                //$(".overlay").remove();
            }
            // Setting the anchor button + dock mobile actions
            if (jquery_1.default.browser.mobile) {
                // toggle the audio button
                jquery_1.default("#togetherjs-audio-button").click(function () {
                    windowing_1.windowing.toggle("#togetherjs-rtc-not-supported");
                });
                // toggle the profile button
                jquery_1.default("#togetherjs-profile-button").click(function () {
                    windowing_1.windowing.toggle("#togetherjs-menu-window");
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
                jquery_1.default("#togetherjs-dock-anchor #togetherjs-dock-anchor-horizontal img").attr("src", src);
                // TODO this is a very old use of the toggle function that would do cb1 on odd click and cb2 on even click
                //$("#togetherjs-dock-anchor").toggle(() => closeDock(), () => openDock());
                jquery_1.default("#togetherjs-dock-anchor").click(() => {
                    closeDock();
                    setTimeout(openDock, 1000); // TODO change: this is obviously not what should happen, it should close the dock on the 2n+1 click and open it again on the 2n click but since openDock and closeDock don't work yet I can't test it.
                });
            }
            jquery_1.default("#togetherjs-share-button").click(function () {
                windowing_1.windowing.toggle("#togetherjs-share");
            });
            jquery_1.default("#togetherjs-profile-button").click(function (event) {
                if (jquery_1.default.browser.mobile) {
                    windowing_1.windowing.show("#togetherjs-menu-window");
                    return false;
                }
                toggleMenu();
                event.stopPropagation();
                return false;
            });
            jquery_1.default("#togetherjs-menu-feedback, #togetherjs-menu-feedback-button").click(function () {
                windowing_1.windowing.hide();
                hideMenu();
                windowing_1.windowing.show("#togetherjs-feedback-form");
                // Lazy loading of content
                const feedbackForm = document.getElementById("togetherjs-feedback-form");
                const iframe = feedbackForm === null || feedbackForm === void 0 ? void 0 : feedbackForm.querySelector("iframe");
                if (iframe && iframe.dataset.src) {
                    iframe.src = iframe === null || iframe === void 0 ? void 0 : iframe.dataset.src;
                }
            });
            jquery_1.default("#togetherjs-menu-help, #togetherjs-menu-help-button").click(function () {
                windowing_1.windowing.hide();
                hideMenu();
                require(["walkthrough"], function ({ walkthrough }) {
                    windowing_1.windowing.hide();
                    walkthrough.start(false);
                });
            });
            jquery_1.default("#togetherjs-menu-update-name").click(() => {
                const input = jquery_1.default("#togetherjs-menu .togetherjs-self-name");
                input.css({
                    width: jquery_1.default("#togetherjs-menu").width() - 32 + "px"
                });
                this.displayToggle("#togetherjs-menu .togetherjs-self-name");
                jquery_1.default("#togetherjs-menu .togetherjs-self-name").focus();
            });
            jquery_1.default("#togetherjs-menu-update-name-button").click(function () {
                windowing_1.windowing.show("#togetherjs-edit-name-window");
                jquery_1.default("#togetherjs-edit-name-window input").focus();
            });
            jquery_1.default("#togetherjs-menu .togetherjs-self-name").bind("keyup change", (event) => {
                console.log("alrighty", event);
                if (event.which == 13) {
                    this.displayToggle("#togetherjs-self-name-display");
                    return;
                }
                const val = jquery_1.default("#togetherjs-menu .togetherjs-self-name").val();
                console.log("values!!", val);
                if (val) {
                    peers_1.peers.Self.update({ name: val });
                }
            });
            jquery_1.default("#togetherjs-menu-update-avatar, #togetherjs-menu-update-avatar-button").click(function () {
                hideMenu();
                windowing_1.windowing.show("#togetherjs-avatar-edit");
            });
            jquery_1.default("#togetherjs-menu-end, #togetherjs-menu-end-button").click(function () {
                hideMenu();
                windowing_1.windowing.show("#togetherjs-confirm-end");
            });
            jquery_1.default("#togetherjs-end-session").click(function () {
                session_1.session.close();
                //$(".overlay").remove();
            });
            jquery_1.default("#togetherjs-menu-update-color").click(function () {
                const picker = jquery_1.default("#togetherjs-pick-color");
                if (picker.is(":visible")) {
                    picker.hide();
                    return;
                }
                picker.show();
                bindPicker();
                picker.find(".togetherjs-swatch-active").removeClass("togetherjs-swatch-active");
                picker.find(".togetherjs-swatch[data-color=\"" + peers_1.peers.Self.color + "\"]").addClass("togetherjs-swatch-active");
            });
            jquery_1.default("#togetherjs-pick-color").click(".togetherjs-swatch", function (event) {
                const swatch = jquery_1.default(event.target);
                const color = swatch.attr("data-color");
                peers_1.peers.Self.update({
                    color: color
                });
                event.stopPropagation();
                return false;
            });
            jquery_1.default("#togetherjs-pick-color").click(function (event) {
                jquery_1.default("#togetherjs-pick-color").hide();
                event.stopPropagation();
                return false;
            });
            COLORS.forEach(function (color) {
                const el = templating_1.templating.sub("swatch", {});
                el.attr("data-color", color);
                el.css({
                    backgroundColor: color,
                    borderColor: "#333333" // TODO was tinycolor.darken(color).toHex()
                });
                jquery_1.default("#togetherjs-pick-color").append(el);
            });
            jquery_1.default("#togetherjs-chat-button").click(function () {
                windowing_1.windowing.toggle("#togetherjs-chat");
            });
            session_1.session.on("display-window", function (id, element) {
                if (id == "togetherjs-chat") {
                    if (!jquery_1.default.browser.mobile) {
                        jquery_1.default("#togetherjs-chat-input").focus();
                    }
                }
                else if (id == "togetherjs-share") {
                    const link = element.find("input.togetherjs-share-link");
                    if (link.is(":visible")) {
                        link.focus().select();
                    }
                }
            });
            container.find("#togetherjs-chat-notifier").click(function (event) {
                if (jquery_1.default(event.target).is("a") || container.is(".togetherjs-close")) {
                    return;
                }
                windowing_1.windowing.show("#togetherjs-chat");
            });
            // FIXME: Don't think this makes sense
            jquery_1.default(".togetherjs header.togetherjs-title").each(function (_index, item) {
                const button = jquery_1.default('<button class="togetherjs-minimize"></button>');
                button.click(function () {
                    const window = button.closest(".togetherjs-window");
                    windowing_1.windowing.hide(window);
                });
                jquery_1.default(item).append(button);
            });
            jquery_1.default("#togetherjs-avatar-done").click(() => {
                this.displayToggle("#togetherjs-no-avatar-edit");
            });
            jquery_1.default("#togetherjs-self-color").css({ backgroundColor: peers_1.peers.Self.color });
            const avatar = peers_1.peers.Self.avatar;
            if (avatar) {
                jquery_1.default("#togetherjs-self-avatar").attr("src", avatar);
            }
            const starterButton = jquery_1.default("#togetherjs-starter button");
            starterButton.click(function () {
                windowing_1.windowing.show("#togetherjs-about");
            }).addClass("togetherjs-running");
            if (starterButton.text() == "Start TogetherJS") {
                starterButton.attr("data-start-text", starterButton.text());
                starterButton.text("End TogetherJS Session");
            }
            this.activateAvatarEdit(container, {
                onSave: function () {
                    windowing_1.windowing.hide("#togetherjs-avatar-edit");
                }
            });
            // TODO some feature seem to be hidden in the HTML like #togetherjs-invite in interface.html
            // TODO also inviter is always null apparently???
            TogetherJS.config.track("inviteFromRoom", function (inviter) {
                if (inviter) {
                    container.find("#togetherjs-invite").show();
                }
                else {
                    container.find("#togetherjs-invite").hide();
                }
            });
            container.find("#togetherjs-menu-refresh-invite").click(refreshInvite);
            container.find("#togetherjs-menu-invite-anyone").click(function () {
                invite(null);
            });
            // The following lines should be at the end of this function (new code goes above)
            session_1.session.emit("new-element", this.container); // TODO !
            if (finishedAt && finishedAt > Date.now()) {
                setTimeout(() => {
                    finishedAt = null;
                    session_1.session.emit("ui-ready", this);
                }, finishedAt - Date.now());
            }
            else {
                session_1.session.emit("ui-ready", this);
            }
        } // End ui.activateUI()
        activateAvatarEdit(container, options = {}) {
            let pendingImage = null;
            container.find(".togetherjs-avatar-save").prop("disabled", true);
            container.find(".togetherjs-avatar-save").click(function () {
                if (pendingImage) {
                    peers_1.peers.Self.update({ avatar: pendingImage });
                    container.find(".togetherjs-avatar-save").prop("disabled", true);
                    if (options.onSave) {
                        options.onSave();
                    }
                }
            });
            container.find(".togetherjs-upload-avatar").on("change", function () {
                util_1.util.readFileImage(this).then(function (url) {
                    if (!url) {
                        return;
                    }
                    sizeDownImage(url).then(function (smallUrl) {
                        pendingImage = smallUrl !== null && smallUrl !== void 0 ? smallUrl : null;
                        container.find(".togetherjs-avatar-preview").css({
                            backgroundImage: 'url(' + pendingImage + ')'
                        });
                        container.find(".togetherjs-avatar-save").prop("disabled", false);
                        if (options.onPending) {
                            options.onPending();
                        }
                    });
                });
            });
        }
        prepareShareLink(container) {
            container.find("input.togetherjs-share-link").click(function () {
                jquery_1.default(this).select();
            }).change(function () {
                updateShareLink();
            });
            updateShareLink();
        }
        showUrlChangeMessage(peer, _url) {
            deferForContainer(() => {
                const window = templating_1.templating.sub("url-change", { peer: peer });
                this.container.append(window);
                windowing_1.windowing.show(window);
            })();
        }
        updateToolName(container) {
            container = container || jquery_1.default(document.body);
            let name = TogetherJS.config.get("toolName");
            if (setToolName && !name) {
                name = "TogetherJS";
            }
            if (name) {
                container.find(".togetherjs-tool-name").text(name);
                setToolName = true;
            }
        }
    }
    exports.Ui = Ui;
    function panelPosition() {
        const iface = jquery_1.default("#togetherjs-dock");
        if (iface.hasClass("togetherjs-dock-right")) {
            return "right";
        }
        else if (iface.hasClass("togetherjs-dock-left")) {
            return "left";
        }
        else if (iface.hasClass("togetherjs-dock-bottom")) {
            return "bottom";
        }
        else {
            throw new AssertionError("#togetherjs-dock doesn't have positioning class");
        }
    }
    exports.ui = new Ui();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function deferForContainer(func) {
        /* Defers any calls to func() until after ui.container is set
            Function cannot have a return value (as sometimes the call will
            become async).  Use like:
    
            method: deferForContainer(function (args) {...})
            */
        return function (...args) {
            // TODO I made some tests and this is always undefined apparently so no need to pretend it's usable. all "null" here were "this".
            if (exports.ui.container) {
                func.apply(null, args);
            }
            //var args = Array.prototype.slice.call(arguments) as A; // TODO use args
            session_1.session.once("ui-ready", function () {
                func.apply(null, args);
            });
        };
    }
    function sizeDownImage(imageUrl) {
        return util_1.util.Deferred(function (def) {
            const canvas = document.createElement("canvas");
            canvas.height = session_1.session.AVATAR_SIZE;
            canvas.width = session_1.session.AVATAR_SIZE;
            const context = canvas.getContext("2d"); // ! is ok because the first call to getContext can't fail if it's "2d"
            const img = new Image();
            img.src = imageUrl;
            // Sometimes the DOM updates immediately to call
            // naturalWidth/etc, and sometimes it doesn't; using setTimeout
            // gives it a chance to catch up
            setTimeout(function () {
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;
                width = width * (session_1.session.AVATAR_SIZE / height);
                height = session_1.session.AVATAR_SIZE;
                context.drawImage(img, 0, 0, width, height);
                def.resolve(canvas.toDataURL("image/png"));
            });
        });
    }
    function fixupAvatars(container) {
        /* All <div class="togetherjs-person" /> elements need an element inside,
            so we add that element here */
        container.find(".togetherjs-person").each(function () {
            const $this = jquery_1.default(this);
            const inner = $this.find(".togetherjs-person-avatar-swatch");
            if (!inner.length) {
                $this.append('<div class="togetherjs-person-avatar-swatch"></div>');
            }
        });
    }
    // Menu
    function showMenu() {
        const el = jquery_1.default("#togetherjs-menu");
        assert(el.length);
        el.show();
        bindMenu();
        jquery_1.default(document).bind("click", maybeHideMenu);
    }
    function bindMenu() {
        const el = jquery_1.default("#togetherjs-menu:visible");
        if (el.length) {
            const bound = jquery_1.default("#togetherjs-profile-button");
            const boundOffset = bound.offset(); // TODO !
            el.css({
                top: boundOffset.top + bound.height() - $window.scrollTop() + "px",
                left: (boundOffset.left + bound.width() - 10 - el.width() - $window.scrollLeft()) + "px"
            });
        }
    }
    function bindPicker() {
        const picker = jquery_1.default("#togetherjs-pick-color:visible");
        if (picker.length) {
            const menu = jquery_1.default("#togetherjs-menu-update-color");
            const menuOffset = menu.offset(); // TODO !
            picker.css({
                top: menuOffset.top + menu.height(),
                left: menuOffset.left
            });
        }
    }
    session_1.session.on("resize", function () {
        bindMenu();
        bindPicker();
    });
    function toggleMenu() {
        if (jquery_1.default("#togetherjs-menu").is(":visible")) {
            hideMenu();
        }
        else {
            showMenu();
        }
    }
    function hideMenu() {
        const el = jquery_1.default("#togetherjs-menu");
        el.hide();
        jquery_1.default(document).unbind("click", maybeHideMenu);
        exports.ui.displayToggle("#togetherjs-self-name-display");
        jquery_1.default("#togetherjs-pick-color").hide();
    }
    function maybeHideMenu(event) {
        let t = event.target;
        while (t) {
            if (t.id == "togetherjs-menu") {
                // Click inside the menu, ignore this
                return;
            }
            t = t.parentElement;
        }
        hideMenu();
    }
    function adjustDockSize(buttons) {
        /* Add or remove spots from the dock; positive number to
            add button(s), negative number to remove button(s)
            */
        assert(typeof buttons == "number");
        assert(buttons && Math.floor(buttons) == buttons);
        const iface = jquery_1.default("#togetherjs-dock");
        const newHeight = iface.height() + (BUTTON_HEIGHT * buttons);
        assert(newHeight >= BUTTON_HEIGHT * 3, "Height went too low (", newHeight, "), should never be less than 3 buttons high (", BUTTON_HEIGHT * 3, ")");
        iface.css({
            height: newHeight + "px"
        });
    }
    // Misc
    function updateShareLink() {
        const input = jquery_1.default("input.togetherjs-share-link");
        const link = jquery_1.default("a.togetherjs-share-link");
        const display = jquery_1.default("#togetherjs-session-id");
        if (!session_1.session.shareId) {
            input.val("");
            link.attr("href", "#");
            display.text("(none)");
        }
        else {
            input.val(session_1.session.shareUrl());
            link.attr("href", session_1.session.shareUrl());
            display.text(session_1.session.shareId);
        }
    }
    session_1.session.on("close", function () {
        if (jquery_1.default.browser.mobile) {
            // remove bg overlay
            //$(".overlay").remove();
            //after hitting End, reset window draggin
            jquery_1.default("body").css({
                "position": "",
                top: "",
                left: ""
            });
        }
        if (exports.ui.container) {
            exports.ui.container.remove();
            // TODO remove this @ts-expect-error
            //@ts-expect-error easier typechecking
            exports.ui.container = null;
        }
        // Clear out any other spurious elements:
        jquery_1.default(".togetherjs").remove();
        const starterButton = jquery_1.default("#togetherjs-starter button");
        starterButton.removeClass("togetherjs-running");
        if (starterButton.attr("data-start-text")) {
            starterButton.text(starterButton.attr("data-start-text"));
            starterButton.attr("data-start-text", "");
        }
    });
    session_1.session.on("display-window", function (id) {
        if (id == "togetherjs-chat") {
            exports.ui.chat.scroll();
            windowing_1.windowing.hide("#togetherjs-chat-notifier");
        }
    });
    function updateChatParticipantList() {
        const live = peers_1.peers.getAllPeers(true);
        if (live.length) {
            exports.ui.displayToggle("#togetherjs-chat-participants");
            jquery_1.default("#togetherjs-chat-participant-list").text(live.map(function (p) { return p.name; }).join(", "));
        }
        else {
            exports.ui.displayToggle("#togetherjs-chat-no-participants");
        }
    }
    function inviteHubUrl() {
        const base = TogetherJS.config.get("inviteFromRoom");
        assert(base);
        return util_1.util.makeUrlAbsolute(base, session_1.session.hubUrl());
    }
    let inRefresh = false;
    function refreshInvite() {
        if (inRefresh) {
            return;
        }
        inRefresh = true;
        require(["who"], function ({ who }) {
            const def = who.getList(inviteHubUrl());
            function addUser(user, before) {
                const item = templating_1.templating.sub("invite-user-item", { peer: user });
                item.attr("data-clientid", user.id);
                if (before) {
                    item.insertBefore(before);
                }
                else {
                    jquery_1.default("#togetherjs-invite-users").append(item);
                }
                item.click(function () {
                    invite(user.id); // TODO was user.clientId but it does not exist on any peer-like class so it was changed to id
                });
            }
            function refresh(users, finished) {
                const sorted = [];
                for (const id in users) {
                    if (Object.prototype.hasOwnProperty.call(users, id)) {
                        sorted.push(users[id]);
                    }
                }
                sorted.sort(function (a, b) {
                    return (a.name || "") < (b.name || "") ? -1 : 1;
                });
                let pos = 0;
                exports.ui.container.find("#togetherjs-invite-users .togetherjs-menu-item").each(function () {
                    const $this = jquery_1.default(this);
                    if (finished && !users[$this.attr("data-clientid")]) {
                        $this.remove();
                        return;
                    }
                    if (pos >= sorted.length) {
                        return;
                    }
                    while (pos < sorted.length && $this.attr("data-clientid") !== sorted[pos].id) {
                        addUser(sorted[pos], $this);
                        pos++;
                    }
                    while (pos < sorted.length && $this.attr("data-clientid") == sorted[pos].id) {
                        pos++;
                    }
                });
                for (let i = pos; i < sorted.length; i++) {
                    addUser(sorted[pos]);
                }
            }
            def.then(function (users) {
                if (users === undefined) {
                    console.error("users was", users);
                    return;
                }
                refresh(users, true);
                inRefresh = false;
            });
            def.progress(refresh);
        });
    }
    session_1.session.hub.on("invite", function (msg) {
        if (msg.forClientId && msg.clientId != peers_1.peers.Self.id) {
            return;
        }
        require(["who"], function (whoModule) {
            const peer = new whoModule.ExternalPeer(msg.userInfo.clientId, msg.userInfo);
            exports.ui.chat.invite({ peer: peer, url: msg.url, forEveryone: !msg.forClientId });
        });
    });
    function invite(clientId) {
        require(["who"], function ({ who }) {
            // FIXME: use the return value of this to give a signal that
            // the invite has been successfully sent:
            who.invite(inviteHubUrl(), clientId).then(function () {
                hideMenu();
            });
        });
    }
    session_1.session.hub.on("url-change-nudge", function (msg) {
        if (msg.to && msg.to != session_1.session.clientId) {
            // Not directed to us
            return;
        }
        msg.peer.urlNudge();
    });
    session_1.session.on("new-element", function (el) {
        if (TogetherJS.config.get("toolName")) {
            exports.ui.updateToolName(el);
        }
    });
    TogetherJS.config.track("toolName", function () {
        exports.ui.updateToolName(exports.ui.container);
    });
});
//return ui;
//define(["require", "jquery", "util", "session", "templates", "templating", "linkify", "peers", "windowing", "elementFinder", "visibilityApi"], uiMain);
