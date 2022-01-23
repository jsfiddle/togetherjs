/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "jquery", "./channels", "./storage", "./util"], function (require, exports, jquery_1, channels_1, storage_1, util_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.session = exports.Session = void 0;
    jquery_1 = __importDefault(jquery_1);
    //function sessionMain(require: Require, util: TogetherJSNS.Util, channels: TogetherJSNS.Channels, $: JQueryStatic, storage: TogetherJSNS.Storage) {
    const assert = util_1.util.assert.bind(util_1.util);
    let DEBUG = false;
    // This is the amount of time in which a hello-back must be received after a hello for us to respect a URL change:
    const HELLO_BACK_CUTOFF = 1500;
    // We will load this module later (there's a circular import):
    let peers;
    // This is the channel to the hub:
    let channel = null;
    /****************************************
     * URLs
     */
    const includeHashInUrl = TogetherJS.config.get("includeHashInUrl");
    TogetherJS.config.close("includeHashInUrl");
    let currentUrl = (location.href + "").replace(/#.*$/, "");
    if (includeHashInUrl) {
        currentUrl = location.href;
    }
    /****************************************
     * Message handling/dispatching
     */
    let IGNORE_MESSAGES = TogetherJS.config.get("ignoreMessages");
    if (IGNORE_MESSAGES === true) {
        DEBUG = false;
        IGNORE_MESSAGES = [];
    }
    // These are messages sent by clients who aren't "part" of the TogetherJS session:
    const MESSAGES_WITHOUT_CLIENTID = ["who", "invite", "init-connection"];
    // These are Javascript files that implement features, and so must be injected at runtime because they aren't pulled in naturally via define(). ui must be the first item:
    const features = ["peers", "ui", "chat", "webrtc", "cursor", "startup", "videos", "forms", "visibilityApi", "youtubeVideos"];
    class Session extends OnClass {
        constructor() {
            super();
            /** This is the hub we connect to: */
            this.shareId = null;
            this.router = new channels_1.Router();
            /** Indicates if TogetherJS has just started (not continuing from a saved session): */
            this.firstRun = false;
            /** Setting, essentially global: */
            this.AVATAR_SIZE = 90;
            this.timeHelloSent = 0; // TODO try an init to 0 and see if it introduce any bug, it was null before
            this.hub = new OnClass();
            /** We ignore incoming messages from the channel until this is true */
            this.readyForMessages = false;
        }
        hubUrl(id = null) {
            id = id || this.shareId;
            assert(id, "URL cannot be resolved before TogetherJS.shareId has been initialized");
            const hubBase = TogetherJS.config.get("hubBase");
            assert(hubBase != null);
            return hubBase.replace(/\/*$/, "") + "/hub/" + id;
        }
        shareUrl() {
            assert(this.shareId, "Attempted to access shareUrl() before shareId is set");
            let hash = location.hash;
            const m = /\?[^#]*/.exec(location.href);
            let query = "";
            if (m) {
                query = m[0];
            }
            hash = hash.replace(/&?togetherjs-[a-zA-Z0-9]+/, "");
            hash = hash || "#";
            return location.protocol + "//" + location.host + location.pathname + query +
                hash + "&togetherjs=" + this.shareId;
        }
        recordUrl() {
            assert(this.shareId);
            let url = TogetherJS.baseUrl.replace(/\/*$/, "") + "/recorder.html";
            url += "#&togetherjs=" + this.shareId + "&hubBase=" + TogetherJS.config.get("hubBase");
            return url;
        }
        /* location.href without the hash */
        currentUrl() {
            if (includeHashInUrl) {
                return location.href;
            }
            else {
                return location.href.replace(/#.*/, "");
            }
        }
        send(msg) {
            if (DEBUG && IGNORE_MESSAGES !== true && IGNORE_MESSAGES && IGNORE_MESSAGES.indexOf(msg.type) == -1) {
                console.info("Send:", msg);
            }
            const msg2 = msg;
            msg2.clientId = this.clientId; // TODO !
            channel.send(msg2); // TODO !
        }
        appSend(msg) {
            const type = msg.type;
            if (type.search(/^togetherjs\./) === 0) {
                msg.type = type.substr("togetherjs.".length);
            }
            else if (type.search(/^app\./) === -1) {
                msg.type = `app.${type}`;
            }
            this.send(msg); // TODO cast
        }
        makeHelloMessage(helloBack) {
            let starting = false;
            if (!TogetherJS.startup.continued) {
                starting = true;
            }
            if (helloBack) {
                const msg = {
                    type: "hello-back",
                    name: peers.Self.name || peers.Self.defaultName,
                    avatar: peers.Self.avatar || "",
                    color: peers.Self.color || "",
                    url: this.currentUrl(),
                    urlHash: location.hash,
                    // FIXME: titles update, we should track those changes:
                    title: document.title,
                    rtcSupported: !!this.RTCSupported,
                    isClient: this.isClient,
                    starting: starting,
                    identityId: peers.Self.identityId,
                    status: peers.Self.status,
                };
                // This is a chance for other modules to effect the hello message:
                this.emit("prepare-hello", msg);
                return msg;
            }
            else {
                const msg = {
                    type: "hello",
                    name: peers.Self.name || peers.Self.defaultName,
                    avatar: peers.Self.avatar || "",
                    color: peers.Self.color || "",
                    url: this.currentUrl(),
                    urlHash: location.hash,
                    // FIXME: titles update, we should track those changes:
                    title: document.title,
                    rtcSupported: !!this.RTCSupported,
                    isClient: this.isClient,
                    starting: starting,
                    clientVersion: TogetherJS.version
                };
                // This is a chance for other modules to effect the hello message:
                this.emit("prepare-hello", msg);
                return msg;
            }
        }
        start() {
            initIdentityId().then(() => {
                initShareId().then(() => {
                    this.readyForMessages = false;
                    openChannel();
                    require(["ui"], (uiModule) => {
                        const ui = uiModule.ui;
                        TogetherJS.running = true;
                        ui.prepareUI();
                        require(features, () => {
                            (0, jquery_1.default)(() => {
                                const peersModule = require("peers");
                                peers = peersModule.peers;
                                const { startup } = require("startup");
                                this.emit("start");
                                this.once("ui-ready", () => {
                                    this.readyForMessages = true;
                                    startup.start();
                                });
                                ui.activateUI();
                                TogetherJS.config.close("enableAnalytics");
                                if (TogetherJS.config.get("enableAnalytics")) {
                                    require(["analytics"], function ({ analytics }) {
                                        analytics.activate();
                                    });
                                }
                                peers._SelfLoaded.then(function () {
                                    sendHello(false);
                                });
                                TogetherJS.emit("ready");
                            });
                        });
                    });
                });
            });
        }
        close(reason) {
            TogetherJS.running = false;
            const msg = { type: "bye" };
            if (reason) {
                msg.reason = reason;
            }
            this.send(msg);
            this.emit("close");
            const name = window.name;
            storage_1.storage.tab.get("status").then(saved => {
                if (!saved) {
                    console.warn("No session information saved in", "status." + name);
                }
                else {
                    saved.running = false;
                    saved.date = Date.now();
                    storage_1.storage.tab.set("status", saved);
                }
                channel.close(); // TODO !!
                channel = null;
                this.shareId = null;
                this.emit("shareId");
                TogetherJS.emit("close");
                TogetherJS._teardown();
            });
        }
        _getChannel() {
            return channel; // TODO !!
        }
    }
    exports.Session = Session;
    exports.session = new Session();
    function openChannel() {
        assert(!channel, "Attempt to re-open channel");
        console.info("Connecting to", exports.session.hubUrl(), location.href);
        const c = new channels_1.WebSocketChannel(exports.session.hubUrl());
        c.onmessage = function (msg) {
            if (!exports.session.readyForMessages) {
                if (DEBUG) {
                    console.info("In (but ignored for being early):", msg);
                }
                return;
            }
            if (DEBUG && IGNORE_MESSAGES !== true && IGNORE_MESSAGES && IGNORE_MESSAGES.indexOf(msg.type) == -1) {
                console.info("In:", msg);
            }
            if (!peers) {
                // We're getting messages before everything is fully initialized
                console.warn("Message received before all modules loaded (ignoring):", msg);
                return;
            }
            // TODO I feel that this error is "normal" since this checs the consistency at runtime
            //@ts-expect-error I feel that this error is "normal" since this checs the consistency at runtime
            if (!("clientId" in msg) && MESSAGES_WITHOUT_CLIENTID.indexOf(msg.type) == -1) {
                console.warn("Got message without clientId, where clientId is required", msg);
                return;
            }
            if ("clientId" in msg) {
                const peer = peers.getPeer(msg.clientId, msg);
                if (peer) {
                    msg.peer = peer;
                }
            }
            if (msg.type == "hello" || msg.type == "hello-back" || msg.type == "peer-update") {
                // We do this here to make sure this is run before any other hello handlers:
                // TODO code change, added the "if(peer.isSelf === false)", is it ok?
                if (msg.peer.isSelf === false) {
                    msg.peer.updateFromHello(msg);
                }
            }
            if ("peer" in msg) {
                const msg2 = msg;
                if (msg2.peer) {
                    msg2.sameUrl = msg2.peer.url == currentUrl;
                    if (!msg2.peer.isSelf) {
                        msg2.peer.updateMessageDate();
                    }
                }
            }
            exports.session.hub.emit(msg.type, msg);
            TogetherJS._onmessage(msg);
        };
        channel = c;
        exports.session.router.bindChannel(channel);
    }
    /****************************************
     * Standard message responses
     */
    /* Always say hello back, and keep track of peers: */
    function cbHelloHelloback(msg) {
        if (msg.type == "hello") {
            sendHello(true);
        }
        if (exports.session.isClient && (!msg.isClient) && exports.session.firstRun && exports.session.timeHelloSent && Date.now() - exports.session.timeHelloSent < HELLO_BACK_CUTOFF) {
            processFirstHello(msg);
        }
    }
    exports.session.hub.on("hello", cbHelloHelloback);
    exports.session.hub.on("hello-back", cbHelloHelloback);
    exports.session.hub.on("who", function () {
        sendHello(true);
    });
    function processFirstHello(msg) {
        if (!msg.sameUrl) {
            let url = msg.url;
            if (msg.urlHash) {
                url += msg.urlHash;
            }
            const { ui } = require("ui");
            ui.showUrlChangeMessage(msg.peer, url);
            location.href = url;
        }
    }
    function sendHello(helloBack) {
        const msg = exports.session.makeHelloMessage(helloBack);
        if (!helloBack) {
            exports.session.timeHelloSent = Date.now();
            peers.Self.url = msg.url;
        }
        exports.session.send(msg);
    }
    /****************************************
     * Lifecycle (start and end)
     */
    function getRoomName(prefix, maxSize) {
        const hubBase = TogetherJS.config.get("hubBase");
        assert(hubBase !== null && hubBase !== undefined); // TODO this assert was added, is it a good idea?
        const findRoom = hubBase.replace(/\/*$/, "") + "/findroom";
        return jquery_1.default.ajax({
            url: findRoom,
            dataType: "json",
            data: { prefix: prefix, max: maxSize }
        }).then(function (resp) {
            return resp.name;
        });
    }
    function initIdentityId() {
        return util_1.util.Deferred(function (def) {
            if (exports.session.identityId) {
                def.resolve();
                return;
            }
            storage_1.storage.get("identityId").then(function (identityId) {
                if (!identityId) {
                    identityId = util_1.util.generateId();
                    storage_1.storage.set("identityId", identityId);
                }
                exports.session.identityId = identityId;
                // We don't actually have to wait for the set to succede, so long as session.identityId is set
                def.resolve();
            });
        });
    }
    initIdentityId.done = initIdentityId();
    function initShareId() {
        return util_1.util.Deferred(function (def) {
            const hash = location.hash;
            let shareId = exports.session.shareId;
            let isClient = true;
            let set = true;
            let sessionId;
            exports.session.firstRun = !TogetherJS.startup.continued;
            if (!shareId) {
                if (TogetherJS.startup._joinShareId) {
                    // Like, below, this *also* means we got the shareId from the hash
                    // (in togetherjs.js):
                    shareId = TogetherJS.startup._joinShareId;
                }
            }
            if (!shareId) {
                // FIXME: I'm not sure if this will ever happen, because togetherjs.js should
                // handle it
                const m = /&?togetherjs=([^&]*)/.exec(hash);
                if (m) {
                    isClient = !m[1];
                    shareId = m[2];
                    const newHash = hash.substr(0, m.index) + hash.substr(m.index + m[0].length);
                    location.hash = newHash;
                }
            }
            return storage_1.storage.tab.get("status").then(function (saved) {
                const findRoom = TogetherJS.config.get("findRoom");
                TogetherJS.config.close("findRoom");
                if (findRoom && saved && findRoom != saved.shareId) {
                    console.info("Ignoring findRoom in lieu of continued session");
                }
                else if (findRoom && TogetherJS.startup._joinShareId) {
                    console.info("Ignoring findRoom in lieu of explicit invite to session");
                }
                if (findRoom && typeof findRoom == "string" && (!saved) && (!TogetherJS.startup._joinShareId)) {
                    isClient = true;
                    shareId = findRoom;
                    sessionId = util_1.util.generateId();
                }
                // TODO added 'typeof findRoom == "object"' check
                else if (findRoom && typeof findRoom == "object" && (!saved) && (!TogetherJS.startup._joinShareId)) {
                    assert(findRoom.prefix && typeof findRoom.prefix == "string", "Bad findRoom.prefix", findRoom);
                    assert(findRoom.max && typeof findRoom.max == "number" && findRoom.max > 0, "Bad findRoom.max", findRoom);
                    sessionId = util_1.util.generateId();
                    if (findRoom.prefix.search(/[^a-zA-Z0-9]/) != -1) {
                        console.warn("Bad value for findRoom.prefix:", JSON.stringify(findRoom.prefix));
                    }
                    getRoomName(findRoom.prefix, findRoom.max).then(function (shareId) {
                        // FIXME: duplicates code below:
                        exports.session.clientId = exports.session.identityId + "." + sessionId;
                        storage_1.storage.tab.set("status", { reason: "joined", shareId: shareId, running: true, date: Date.now(), sessionId: sessionId });
                        exports.session.isClient = true;
                        exports.session.shareId = shareId;
                        exports.session.emit("shareId");
                        def.resolve(exports.session.shareId);
                    });
                    return;
                }
                else if (TogetherJS.startup._launch) {
                    if (saved) {
                        isClient = saved.reason == "joined";
                        if (!shareId) {
                            shareId = saved.shareId;
                        }
                        sessionId = saved.sessionId;
                    }
                    else {
                        isClient = TogetherJS.startup.reason == "joined";
                        assert(!sessionId);
                        sessionId = util_1.util.generateId();
                    }
                    if (!shareId) {
                        shareId = util_1.util.generateId();
                    }
                }
                else if (saved) {
                    isClient = saved.reason == "joined";
                    TogetherJS.startup.reason = saved.reason;
                    TogetherJS.startup.continued = true;
                    shareId = saved.shareId;
                    sessionId = saved.sessionId;
                    // The only case when we don't need to set the storage status again is when
                    // we're already set to be running
                    set = !saved.running;
                }
                else {
                    throw new util_1.util.AssertionError("No saved status, and no startup._launch request; why did TogetherJS start?");
                }
                assert(exports.session.identityId);
                exports.session.clientId = exports.session.identityId + "." + sessionId;
                if (set) {
                    storage_1.storage.tab.set("status", { reason: TogetherJS.startup.reason, shareId: shareId, running: true, date: Date.now(), sessionId: sessionId });
                }
                exports.session.isClient = isClient;
                exports.session.shareId = shareId;
                exports.session.emit("shareId");
                def.resolve(exports.session.shareId);
            });
        });
    }
    exports.session.on("start", function () {
        (0, jquery_1.default)(window).on("resize", resizeEvent);
        if (includeHashInUrl) {
            (0, jquery_1.default)(window).on("hashchange", hashchangeEvent);
        }
    });
    exports.session.on("close", function () {
        (0, jquery_1.default)(window).off("resize", resizeEvent);
        if (includeHashInUrl) {
            (0, jquery_1.default)(window).off("hashchange", hashchangeEvent);
        }
    });
    function hashchangeEvent() {
        // needed because when message arrives from peer this variable will be checked to decide weather to show actions or not
        sendHello(false);
    }
    function resizeEvent() {
        exports.session.emit("resize");
    }
    if (TogetherJS.startup._launch) {
        setTimeout(() => exports.session.start());
    }
    util_1.util.testExpose({
        getChannel: function () {
            return channel;
        }
    });
});
//return session;
//define(["require", "util", "channels", "jquery", "storage"], sessionMain);
