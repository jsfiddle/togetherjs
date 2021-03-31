/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
define(["require", "exports", "./channels", "./storage", "./types/togetherjs", "./util"], function (require, exports, channels_1, storage_1, togetherjs_1, util_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.session = void 0;
    //function sessionMain(require: Require, util: TogetherJSNS.Util, channels: TogetherJSNS.Channels, $: JQueryStatic, storage: TogetherJSNS.Storage) {
    var DEBUG = true;
    // This is the amount of time in which a hello-back must be received after a hello
    // for us to respect a URL change:
    var HELLO_BACK_CUTOFF = 1500;
    var assert = util_1.util.assert;
    // We will load this module later (there's a circular import):
    var peers;
    // This is the channel to the hub:
    var channel = null;
    // This is the key we use for localStorage:
    //var localStoragePrefix = "togetherjs."; // TODO not used
    var Session = /** @class */ (function (_super) {
        __extends(Session, _super);
        function Session() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            /** This is the hub we connect to: */
            _this.shareId = null;
            _this.router = channels_1.channels.Router();
            /** Indicates if TogetherJS has just started (not continuing from a saved session): */
            _this.firstRun = false;
            /** Setting, essentially global: */
            _this.AVATAR_SIZE = 90;
            _this.timeHelloSent = 0; // TODO try an init to 0 and see if it introduce any bug, it was null before
            _this.hub = new util_1.OnClass();
            return _this;
        }
        Session.prototype.hubUrl = function (id) {
            if (id === void 0) { id = null; }
            id = id || this.shareId;
            assert(id, "URL cannot be resolved before TogetherJS.shareId has been initialized");
            togetherjs_1.TogetherJS.config.close("hubBase");
            var hubBase = togetherjs_1.TogetherJS.config.get("hubBase");
            assert(hubBase != null);
            return hubBase.replace(/\/*$/, "") + "/hub/" + id;
        };
        Session.prototype.shareUrl = function () {
            assert(this.shareId, "Attempted to access shareUrl() before shareId is set");
            var hash = location.hash;
            var m = /\?[^#]*/.exec(location.href);
            var query = "";
            if (m) {
                query = m[0];
            }
            hash = hash.replace(/&?togetherjs-[a-zA-Z0-9]+/, "");
            hash = hash || "#";
            return location.protocol + "//" + location.host + location.pathname + query +
                hash + "&togetherjs=" + this.shareId;
        };
        Session.prototype.recordUrl = function () {
            assert(this.shareId);
            var url = togetherjs_1.TogetherJS.baseUrl.replace(/\/*$/, "") + "/togetherjs/recorder.html";
            url += "#&togetherjs=" + this.shareId + "&hubBase=" + togetherjs_1.TogetherJS.config.get("hubBase");
            return url;
        };
        /* location.href without the hash */
        Session.prototype.currentUrl = function () {
            if (includeHashInUrl) {
                return location.href;
            }
            else {
                return location.href.replace(/#.*/, "");
            }
        };
        Session.prototype.send = function (msg) {
            if (DEBUG && IGNORE_MESSAGES !== true && IGNORE_MESSAGES && IGNORE_MESSAGES.indexOf(msg.type) == -1) {
                console.info("Send:", msg);
            }
            var msg2 = msg;
            msg2.clientId = exports.session.clientId; // TODO !
            channel.send(msg2); // TODO !
        };
        // TODO this function appears to never been used (since it's only caller never is), and it does weird things. Tried with a "type MapForAppSending = { [P in keyof MapForSending & string as `app.${P}`]: MapForSending[P] }" but it doesn't change the type of the `type` field and hence doesn't work
        Session.prototype.appSend = function (msg) {
            var type = msg.type;
            if (type.search(/^togetherjs\./) === 0) {
                type = type.substr("togetherjs.".length);
            }
            else if (type.search(/^app\./) === -1) {
                type = "app." + type; // TODO very abusive typing, I don't really see how to fix that except by duplicating MapForSending and all the types it uses which is a lot for a function that isn't used...
            }
            msg.type = type;
            exports.session.send(msg);
        };
        Session.prototype.makeHelloMessage = function (helloBack) {
            var starting = false;
            if (!togetherjs_1.TogetherJS.startup.continued) {
                starting = true;
            }
            if (helloBack) {
                var msg = {
                    type: "hello-back",
                    name: peers.Self.name || peers.Self.defaultName,
                    avatar: peers.Self.avatar || "",
                    color: peers.Self.color || "",
                    url: exports.session.currentUrl(),
                    urlHash: location.hash,
                    // FIXME: titles update, we should track those changes:
                    title: document.title,
                    rtcSupported: !!exports.session.RTCSupported,
                    isClient: exports.session.isClient,
                    starting: starting,
                    identityId: peers.Self.identityId,
                    status: peers.Self.status,
                };
                // This is a chance for other modules to effect the hello message:
                exports.session.emit("prepare-hello", msg);
                return msg;
            }
            else {
                var msg = {
                    type: "hello",
                    name: peers.Self.name || peers.Self.defaultName,
                    avatar: peers.Self.avatar || "",
                    color: peers.Self.color || "",
                    url: exports.session.currentUrl(),
                    urlHash: location.hash,
                    // FIXME: titles update, we should track those changes:
                    title: document.title,
                    rtcSupported: !!exports.session.RTCSupported,
                    isClient: exports.session.isClient,
                    starting: starting,
                    clientVersion: togetherjs_1.TogetherJS.version
                };
                // This is a chance for other modules to effect the hello message:
                exports.session.emit("prepare-hello", msg);
                return msg;
            }
        };
        Session.prototype.start = function () {
            initStartTarget();
            initIdentityId().then(function () {
                initShareId().then(function () {
                    readyForMessages = false;
                    openChannel();
                    require(["ui"], function (ui) {
                        togetherjs_1.TogetherJS.running = true;
                        ui.prepareUI();
                        require(features, function () {
                            $(function () {
                                peers = require("peers");
                                var startup = require("startup");
                                exports.session.emit("start");
                                exports.session.once("ui-ready", function () {
                                    readyForMessages = true;
                                    startup.start();
                                });
                                ui.activateUI();
                                togetherjs_1.TogetherJS.config.close("enableAnalytics");
                                if (togetherjs_1.TogetherJS.config.get("enableAnalytics")) {
                                    require(["analytics"], function (analytics) {
                                        analytics.activate();
                                    });
                                }
                                peers._SelfLoaded.then(function () {
                                    sendHello(false);
                                });
                                togetherjs_1.TogetherJS.emit("ready");
                            });
                        });
                    });
                });
            });
        };
        Session.prototype.close = function (reason) {
            togetherjs_1.TogetherJS.running = false;
            var msg = { type: "bye" };
            if (reason) {
                msg.reason = reason;
            }
            exports.session.send(msg);
            exports.session.emit("close");
            var name = window.name;
            storage_1.storage.tab.get("status").then(function (saved) {
                if (!saved) {
                    console.warn("No session information saved in", "status." + name);
                }
                else {
                    saved.running = false;
                    saved.date = Date.now();
                    storage_1.storage.tab.set("status", saved);
                }
                channel.close(); // TODO !
                channel = null;
                exports.session.shareId = null;
                exports.session.emit("shareId");
                togetherjs_1.TogetherJS.emit("close");
                togetherjs_1.TogetherJS._teardown();
            });
        };
        Session.prototype._getChannel = function () {
            return channel; // TODO !
        };
        return Session;
    }(util_1.OnClass));
    exports.session = new Session();
    //var MAX_SESSION_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days // TODO not used
    /****************************************
     * URLs
     */
    var includeHashInUrl = togetherjs_1.TogetherJS.config.get("includeHashInUrl");
    togetherjs_1.TogetherJS.config.close("includeHashInUrl");
    var currentUrl = (location.href + "").replace(/\#.*$/, "");
    if (includeHashInUrl) {
        currentUrl = location.href;
    }
    /****************************************
     * Message handling/dispatching
     */
    var IGNORE_MESSAGES = togetherjs_1.TogetherJS.config.get("ignoreMessages");
    if (IGNORE_MESSAGES === true) {
        DEBUG = false;
        IGNORE_MESSAGES = [];
    }
    // These are messages sent by clients who aren't "part" of the TogetherJS session:
    var MESSAGES_WITHOUT_CLIENTID = ["who", "invite", "init-connection"];
    // We ignore incoming messages from the channel until this is true:
    var readyForMessages = false;
    function openChannel() {
        assert(!channel, "Attempt to re-open channel");
        console.info("Connecting to", exports.session.hubUrl(), location.href);
        var c = channels_1.channels.WebSocketChannel(exports.session.hubUrl());
        c.onmessage = function (msg) {
            if (!readyForMessages) {
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
                var peer = peers.getPeer(msg.clientId, msg);
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
                var msg2 = msg;
                if (msg2.peer) {
                    msg2.sameUrl = msg2.peer.url == currentUrl;
                    if (!msg2.peer.isSelf) {
                        msg2.peer.updateMessageDate();
                    }
                }
            }
            exports.session.hub.emit(msg.type, msg);
            togetherjs_1.TogetherJS._onmessage(msg);
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
            var url = msg.url;
            if (msg.urlHash) {
                url += msg.urlHash;
            }
            require("ui").showUrlChangeMessage(msg.peer, url);
            location.href = url;
        }
    }
    function sendHello(helloBack) {
        var msg = exports.session.makeHelloMessage(helloBack);
        if (!helloBack) {
            exports.session.timeHelloSent = Date.now();
            peers.Self.url = msg.url;
        }
        exports.session.send(msg);
    }
    /****************************************
     * Lifecycle (start and end)
     */
    // These are Javascript files that implement features, and so must be injected at runtime because they aren't pulled in naturally via define(). ui must be the first item:
    var features = ["peers", "ui", "chat", "webrtc", "cursor", "startup", "videos", "forms", "visibilityApi", "youtubeVideos"];
    function getRoomName(prefix, maxSize) {
        var hubBase = togetherjs_1.TogetherJS.config.get("hubBase");
        assert(hubBase !== null && hubBase !== undefined); // TODO this assert was added, is it a good idea?
        var findRoom = hubBase.replace(/\/*$/, "") + "/findroom";
        return $.ajax({
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
            var hash = location.hash;
            var shareId = exports.session.shareId;
            var isClient = true;
            var set = true;
            var sessionId;
            exports.session.firstRun = !togetherjs_1.TogetherJS.startup.continued;
            if (!shareId) {
                if (togetherjs_1.TogetherJS.startup._joinShareId) {
                    // Like, below, this *also* means we got the shareId from the hash
                    // (in togetherjs.js):
                    shareId = togetherjs_1.TogetherJS.startup._joinShareId;
                }
            }
            if (!shareId) {
                // FIXME: I'm not sure if this will ever happen, because togetherjs.js should
                // handle it
                var m = /&?togetherjs=([^&]*)/.exec(hash);
                if (m) {
                    isClient = !m[1];
                    shareId = m[2];
                    var newHash = hash.substr(0, m.index) + hash.substr(m.index + m[0].length);
                    location.hash = newHash;
                }
            }
            return storage_1.storage.tab.get("status").then(function (saved) {
                var findRoom = togetherjs_1.TogetherJS.config.get("findRoom");
                togetherjs_1.TogetherJS.config.close("findRoom");
                if (findRoom && saved && findRoom != saved.shareId) {
                    console.info("Ignoring findRoom in lieu of continued session");
                }
                else if (findRoom && togetherjs_1.TogetherJS.startup._joinShareId) {
                    console.info("Ignoring findRoom in lieu of explicit invite to session");
                }
                if (findRoom && typeof findRoom == "string" && (!saved) && (!togetherjs_1.TogetherJS.startup._joinShareId)) {
                    isClient = true;
                    shareId = findRoom;
                    sessionId = util_1.util.generateId();
                }
                // TODO added 'typeof findRoom == "object"' check
                else if (findRoom && typeof findRoom == "object" && (!saved) && (!togetherjs_1.TogetherJS.startup._joinShareId)) {
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
                else if (togetherjs_1.TogetherJS.startup._launch) {
                    if (saved) {
                        isClient = saved.reason == "joined";
                        if (!shareId) {
                            shareId = saved.shareId;
                        }
                        sessionId = saved.sessionId;
                    }
                    else {
                        isClient = togetherjs_1.TogetherJS.startup.reason == "joined";
                        assert(!sessionId);
                        sessionId = util_1.util.generateId();
                    }
                    if (!shareId) {
                        shareId = util_1.util.generateId();
                    }
                }
                else if (saved) {
                    isClient = saved.reason == "joined";
                    togetherjs_1.TogetherJS.startup.reason = saved.reason;
                    togetherjs_1.TogetherJS.startup.continued = true;
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
                    storage_1.storage.tab.set("status", { reason: togetherjs_1.TogetherJS.startup.reason, shareId: shareId, running: true, date: Date.now(), sessionId: sessionId });
                }
                exports.session.isClient = isClient;
                exports.session.shareId = shareId;
                exports.session.emit("shareId");
                def.resolve(exports.session.shareId);
            });
        });
    }
    function initStartTarget() {
        var id;
        if (togetherjs_1.TogetherJS.startup.button) {
            id = togetherjs_1.TogetherJS.startup.button.id;
            if (id) {
                storage_1.storage.set("startTarget", id);
            }
            return;
        }
        storage_1.storage.get("startTarget").then(function (id) {
            if (id) {
                var el = document.getElementById(id);
                if (el) {
                    togetherjs_1.TogetherJS.startup.button = el;
                }
            }
        });
    }
    exports.session.on("start", function () {
        $(window).on("resize", resizeEvent);
        if (includeHashInUrl) {
            $(window).on("hashchange", hashchangeEvent);
        }
    });
    exports.session.on("close", function () {
        $(window).off("resize", resizeEvent);
        if (includeHashInUrl) {
            $(window).off("hashchange", hashchangeEvent);
        }
    });
    function hashchangeEvent() {
        // needed because when message arives from peer this variable will be checked to
        // decide weather to show actions or not
        sendHello(false);
    }
    function resizeEvent() {
        exports.session.emit("resize");
    }
    if (togetherjs_1.TogetherJS.startup._launch) {
        setTimeout(exports.session.start);
    }
    util_1.util.testExpose({
        getChannel: function () {
            return channel;
        }
    });
});
//return session;
//define(["require", "util", "channels", "jquery", "storage"], sessionMain);
