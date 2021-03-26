/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

function sessionMain(require: Require, util: Util, channels: TogetherJSNS.Channels, $: JQueryStatic, storage: TogetherJSNS.Storage) {

    var DEBUG = true;

    // This is the amount of time in which a hello-back must be received after a hello
    // for us to respect a URL change:
    var HELLO_BACK_CUTOFF = 1500;

    var assert: typeof util.assert = util.assert;

    // We will load this module later (there's a circular import):
    var peers: TogetherJSNS.Peers;

    // This is the channel to the hub:
    let channel: TogetherJSNS.WebSocketChannel | null = null;

    // This is the key we use for localStorage:
    var localStoragePrefix = "togetherjs.";

    class Session extends OnClass {
        /** This is the hub we connect to: */
        public shareId: string | null = null;
        /** This is the ID that identifies this client: */
        public clientId: string | null = null;
        public readonly router = channels.Router();
        /** Indicates if TogetherJS has just started (not continuing from a saved session): */
        public firstRun = false;
        /** Setting, essentially global: */
        public readonly AVATAR_SIZE = 90;
        timeHelloSent: number = 0; // TODO try an init to 0 and see if it introduce any bug, it was null before
        public identityId?: string;
        public RTCSupported: boolean | undefined;

        public readonly hub = new OnClass();
        public isClient: boolean;

        hubUrl(id: string | null = null) {
            id = id || this.shareId;
            assert(id, "URL cannot be resolved before TogetherJS.shareId has been initialized");
            TogetherJS.config.close("hubBase");
            var hubBase = TogetherJS.config.get("hubBase");
            assert(hubBase != null);
            return hubBase.replace(/\/*$/, "") + "/hub/" + id;
        }

        shareUrl() {
            assert(this.shareId, "Attempted to access shareUrl() before shareId is set");
            var hash = location.hash;
            var m = /\?[^#]*/.exec(location.href);
            var query = "";
            if(m) {
                query = m[0];
            }
            hash = hash.replace(/&?togetherjs-[a-zA-Z0-9]+/, "");
            hash = hash || "#";
            return location.protocol + "//" + location.host + location.pathname + query +
                hash + "&togetherjs=" + this.shareId;
        }

        recordUrl() {
            assert(this.shareId);
            var url = TogetherJS.baseUrl.replace(/\/*$/, "") + "/togetherjs/recorder.html";
            url += "#&togetherjs=" + this.shareId + "&hubBase=" + TogetherJS.config.get("hubBase");
            return url;
        }

        /* location.href without the hash */
        currentUrl() {
            if(includeHashInUrl) {
                return location.href;
            } else {
                return location.href.replace(/#.*/, "");
            }
        }

        send<K extends keyof TogetherJSNS.AnyMessage.MapForSending>(msg: TogetherJSNS.AnyMessage.MapForSending[K]) {
            if(DEBUG && IGNORE_MESSAGES !== true && IGNORE_MESSAGES && IGNORE_MESSAGES.indexOf(msg.type) == -1) {
                console.info("Send:", msg);
            }
            const msg2 = msg as TogetherJSNS.SessionSend.Map[K] & TogetherJSNS.ChannelSend.WithClientId;
            msg2.clientId = session.clientId!; // TODO !
            channel.send<K, never>(msg2);
        }

        // TODO this function appears to never been used, and it does weird things
        appSend<T extends keyof TogetherJSNS.AnyMessage.MapForSending>(msg: TogetherJSNS.AnyMessage.MapForSending[T]) {
            let type = msg.type;
            if(type.search(/^togetherjs\./) === 0) {
                type = type.substr("togetherjs.".length);
            }
            else if(type.search(/^app\./) === -1) {
                type = "app." + type;
            }
            msg.type = type;
            session.send(msg);
        }

        makeHelloMessage(helloBack: true): TogetherJSNS.AnyMessage.MapForSending["hello-back"];
        makeHelloMessage(helloBack: false): TogetherJSNS.AnyMessage.MapForSending["hello"];
        makeHelloMessage(helloBack: boolean): TogetherJSNS.AnyMessage.MapForSending["hello-back"] | TogetherJSNS.AnyMessage.MapForSending["hello"];
        makeHelloMessage(helloBack: boolean) {
            let starting: boolean = false;
            if(!TogetherJS.startup.continued) {
                starting = true;
            }
            if(helloBack) {
                let msg: TogetherJSNS.On.HelloBackMessage = {
                    type: "hello-back",
                    name: peers.Self.name || peers.Self.defaultName,
                    avatar: peers.Self.avatar || "", // TODO find a way to remove this || "", maybe the value in self should be non-null (other occurences of this below)
                    color: peers.Self.color || "", // same as above
                    url: session.currentUrl(),
                    urlHash: location.hash,
                    // FIXME: titles update, we should track those changes:
                    title: document.title,
                    rtcSupported: !!session.RTCSupported,
                    isClient: session.isClient,
                    starting: starting
                };
                // This is a chance for other modules to effect the hello message:
                session.emit("prepare-hello", msg);
                return msg;
            }
            else {
                let msg: TogetherJSNS.On.HelloMessage = {
                    type: "hello",
                    name: peers.Self.name || peers.Self.defaultName,
                    avatar: peers.Self.avatar || "", // same as above
                    color: peers.Self.color || "", // same as above
                    url: session.currentUrl(),
                    urlHash: location.hash,
                    // FIXME: titles update, we should track those changes:
                    title: document.title,
                    rtcSupported: !!session.RTCSupported,
                    isClient: session.isClient,
                    starting: starting,
                    clientVersion: TogetherJS.version
                };
                // This is a chance for other modules to effect the hello message:
                session.emit("prepare-hello", msg);
                return msg;
            }
        }

        start() {
            initStartTarget();
            initIdentityId().then(function() {
                initShareId().then(function() {
                    readyForMessages = false;
                    openChannel();
                    require(["ui"], function(ui: TogetherJSNS.Ui) {
                        TogetherJS.running = true;
                        ui.prepareUI();
                        require(features, function() {
                            $(function() {
                                peers = require("peers");
                                var startup = require("startup");
                                session.emit("start");
                                session.once("ui-ready", function() {
                                    readyForMessages = true;
                                    startup.start();
                                });
                                ui.activateUI();
                                TogetherJS.config.close("enableAnalytics");
                                if(TogetherJS.config.get("enableAnalytics")) {
                                    require(["analytics"], function(analytics: TogetherJSNS.Analytics) {
                                        analytics.activate();
                                    });
                                }
                                peers._SelfLoaded.then(function() {
                                    sendHello(false);
                                });
                                TogetherJS.emit("ready");
                            });
                        });
                    });
                });
            });
        }

        close(reason?: string) {
            TogetherJS.running = false;
            var msg: TogetherJSNS.SessionSend.Map["bye"] = { type: "bye" };
            if(reason) {
                msg.reason = reason;
            }
            session.send(msg);
            session.emit("close");
            var name = window.name;
            storage.tab.get("status").then(function(saved) {
                if(!saved) {
                    console.warn("No session information saved in", "status." + name);
                } else {
                    saved.running = false;
                    saved.date = Date.now();
                    storage.tab.set("status", saved);
                }
                channel.close();
                channel = null;
                session.shareId = null;
                session.emit("shareId");
                TogetherJS.emit("close");
                TogetherJS._teardown();
            });
        }

        _getChannel() {
            return channel!; // TODO !
        }
    }

    const session = new Session();

    var MAX_SESSION_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

    /****************************************
     * URLs
     */
    var includeHashInUrl = TogetherJS.config.get("includeHashInUrl");
    TogetherJS.config.close("includeHashInUrl");
    var currentUrl = (location.href + "").replace(/\#.*$/, "");
    if(includeHashInUrl) {
        currentUrl = location.href;
    }



    /****************************************
     * Message handling/dispatching
     */

    var IGNORE_MESSAGES = TogetherJS.config.get("ignoreMessages");
    if(IGNORE_MESSAGES === true) {
        DEBUG = false;
        IGNORE_MESSAGES = [];
    }
    // These are messages sent by clients who aren't "part" of the TogetherJS session:
    var MESSAGES_WITHOUT_CLIENTID = ["who", "invite", "init-connection"];

    // We ignore incoming messages from the channel until this is true:
    var readyForMessages = false;

    function openChannel() {
        assert(!channel, "Attempt to re-open channel");
        console.info("Connecting to", session.hubUrl(), location.href);
        var c = channels.WebSocketChannel(session.hubUrl());
        c.onmessage = function(msg) {
            if(!readyForMessages) {
                if(DEBUG) {
                    console.info("In (but ignored for being early):", msg);
                }
                return;
            }
            if(DEBUG && IGNORE_MESSAGES !== true && IGNORE_MESSAGES && IGNORE_MESSAGES.indexOf(msg.type) == -1) {
                console.info("In:", msg);
            }
            if(!peers) {
                // We're getting messages before everything is fully initialized
                console.warn("Message received before all modules loaded (ignoring):", msg);
                return;
            }
            if((!("clientId" in msg)) && MESSAGES_WITHOUT_CLIENTID.indexOf(msg.type) == -1) {
                console.warn("Got message without clientId, where clientId is required", msg);
                return;
            }
            if("clientId" in msg) {
                const msg2 = msg as typeof msg & { clientId: string, peer?: TogetherJSNS.AnyPeer };
                const peer = peers.getPeer(msg2.clientId, msg2);
                if(peer) {
                    msg2.peer = peer
                }
            }
            if(msg.type == "hello" || msg.type == "hello-back" || msg.type == "peer-update") {
                // We do this here to make sure this is run before any other hello handlers:
                msg.peer.updateFromHello(msg);
            }
            if("peer" in msg) {
                const msg2 = msg as (typeof msg & { peer: TogetherJSNS.PeerClass, sameUrl?: boolean });
                if(msg2.peer) {
                    msg2.sameUrl = msg2.peer.url == currentUrl;
                    if(!msg2.peer.isSelf) {
                        msg2.peer.updateMessageDate(msg);
                    }
                }
            }
            session.hub.emit(msg.type, msg); // TODO emit error
            TogetherJS._onmessage(msg);
        };
        channel = c;
        session.router.bindChannel(channel);
    }

    /****************************************
     * Standard message responses
     */

    /* Always say hello back, and keep track of peers: */
    session.hub.on("hello hello-back", function(msg) {
        if(msg.type == "hello") {
            sendHello(true);
        }
        if(session.isClient && (!msg.isClient) &&
            session.firstRun && session.timeHelloSent &&
            Date.now() - session.timeHelloSent < HELLO_BACK_CUTOFF) {
            processFirstHello(msg);
        }
    });

    session.hub.on("who", function() {
        sendHello(true);
    });

    function processFirstHello(msg: {sameUrl: boolean, url: string, urlHash: string, peer: TogetherJSNS.AnyPeer}) {
        if(!msg.sameUrl) {
            var url = msg.url;
            if(msg.urlHash) {
                url += msg.urlHash;
            }
            require("ui").showUrlChangeMessage(msg.peer, url);
            location.href = url;
        }
    }

    function sendHello(helloBack: boolean) {
        var msg = session.makeHelloMessage(helloBack);
        if(!helloBack) {
            session.timeHelloSent = Date.now();
            peers.Self.url = msg.url;
        }
        session.send(msg);
    }

    /****************************************
     * Lifecycle (start and end)
     */

    // These are Javascript files that implement features, and so must be injected at runtime because they aren't pulled in naturally via define(). ui must be the first item:
    var features = ["peers", "ui", "chat", "webrtc", "cursor", "startup", "videos", "forms", "visibilityApi", "youtubeVideos"];

    function getRoomName(prefix: string, maxSize: number) {
        const hubBase = TogetherJS.config.get("hubBase");
        util.assert(hubBase !== null && hubBase !== undefined); // TODO this assert was added, is it a good idea?
        var findRoom = hubBase.replace(/\/*$/, "") + "/findroom";
        return $.ajax({
            url: findRoom,
            dataType: "json",
            data: { prefix: prefix, max: maxSize }
        }).then(function(resp) {
            return resp.name;
        });
    }

    function initIdentityId() {
        return util.Deferred(function(def) {
            if(session.identityId) {
                def.resolve();
                return;
            }
            storage.get("identityId").then(function(identityId) {
                if(!identityId) {
                    identityId = util.generateId();
                    storage.set("identityId", identityId);
                }
                session.identityId = identityId;
                // We don't actually have to wait for the set to succede, so
                // long as session.identityId is set
                def.resolve();
            });
        });
    }

    initIdentityId.done = initIdentityId();

    function initShareId() {
        return util.Deferred(function(def) {
            var hash = location.hash;
            var shareId = session.shareId;
            var isClient = true;
            var set = true;
            var sessionId: string;
            session.firstRun = !TogetherJS.startup.continued;
            if(!shareId) {
                if(TogetherJS.startup._joinShareId) {
                    // Like, below, this *also* means we got the shareId from the hash
                    // (in togetherjs.js):
                    shareId = TogetherJS.startup._joinShareId;
                }
            }
            if(!shareId) {
                // FIXME: I'm not sure if this will ever happen, because togetherjs.js should
                // handle it
                var m = /&?togetherjs=([^&]*)/.exec(hash);
                if(m) {
                    isClient = !m[1];
                    shareId = m[2];
                    var newHash = hash.substr(0, m.index) + hash.substr(m.index + m[0].length);
                    location.hash = newHash;
                }
            }
            return storage.tab.get("status").then(function(saved) {
                var findRoom = TogetherJS.config.get("findRoom");
                TogetherJS.config.close("findRoom");
                if(findRoom && saved && findRoom != saved.shareId) {
                    console.info("Ignoring findRoom in lieu of continued session");
                }
                else if(findRoom && TogetherJS.startup._joinShareId) {
                    console.info("Ignoring findRoom in lieu of explicit invite to session");
                }
                if(findRoom && typeof findRoom == "string" && (!saved) && (!TogetherJS.startup._joinShareId)) {
                    isClient = true;
                    shareId = findRoom;
                    sessionId = util.generateId();
                }
                // TODO added 'typeof findRoom == "object"' check
                else if(findRoom && typeof findRoom == "object" && (!saved) && (!TogetherJS.startup._joinShareId)) {
                    assert(findRoom.prefix && typeof findRoom.prefix == "string", "Bad findRoom.prefix", findRoom);
                    assert(findRoom.max && typeof findRoom.max == "number" && findRoom.max > 0, "Bad findRoom.max", findRoom);
                    sessionId = util.generateId();
                    if(findRoom.prefix.search(/[^a-zA-Z0-9]/) != -1) {
                        console.warn("Bad value for findRoom.prefix:", JSON.stringify(findRoom.prefix));
                    }
                    getRoomName(findRoom.prefix, findRoom.max).then(function(shareId) {
                        // FIXME: duplicates code below:
                        session.clientId = session.identityId + "." + sessionId;
                        storage.tab.set("status", { reason: "joined", shareId: shareId, running: true, date: Date.now(), sessionId: sessionId });
                        session.isClient = true;
                        session.shareId = shareId;
                        session.emit("shareId");
                        def.resolve(session.shareId);
                    });
                    return;
                }
                else if(TogetherJS.startup._launch) {
                    if(saved) {
                        isClient = saved.reason == "joined";
                        if(!shareId) {
                            shareId = saved.shareId;
                        }
                        sessionId = saved.sessionId;
                    } else {
                        isClient = TogetherJS.startup.reason == "joined";
                        assert(!sessionId);
                        sessionId = util.generateId();
                    }
                    if(!shareId) {
                        shareId = util.generateId();
                    }
                }
                else if(saved) {
                    isClient = saved.reason == "joined";
                    TogetherJS.startup.reason = saved.reason;
                    TogetherJS.startup.continued = true;
                    shareId = saved.shareId;
                    sessionId = saved.sessionId;
                    // The only case when we don't need to set the storage status again is when
                    // we're already set to be running
                    set = !saved.running;
                } else {
                    throw new util.AssertionError("No saved status, and no startup._launch request; why did TogetherJS start?");
                }
                assert(session.identityId);
                session.clientId = session.identityId + "." + sessionId;
                if(set) {
                    storage.tab.set("status", { reason: TogetherJS.startup.reason, shareId: shareId, running: true, date: Date.now(), sessionId: sessionId });
                }
                session.isClient = isClient;
                session.shareId = shareId;
                session.emit("shareId");
                def.resolve(session.shareId);
            });
        });
    }

    function initStartTarget() {
        var id;
        if(TogetherJS.startup.button) {
            id = TogetherJS.startup.button.id;
            if(id) {
                storage.set("startTarget", id);
            }
            return;
        }
        storage.get("startTarget").then(function(id) {
            if(id) {
                var el = document.getElementById(id);
                if(el) {
                    TogetherJS.startup.button = el;
                }
            }
        });
    }

    session.on("start", function() {
        $(window).on("resize", resizeEvent);
        if(includeHashInUrl) {
            $(window).on("hashchange", hashchangeEvent);
        }
    });

    session.on("close", function() {
        $(window).off("resize", resizeEvent);
        if(includeHashInUrl) {
            $(window).off("hashchange", hashchangeEvent);
        }
    });

    function hashchangeEvent() {
        // needed because when message arives from peer this variable will be checked to
        // decide weather to show actions or not
        sendHello(false);
    }

    function resizeEvent() {
        session.emit("resize");
    }

    if(TogetherJS.startup._launch) {
        setTimeout(session.start);
    }

    util.testExpose({
        getChannel: function() {
            return channel;
        }
    });

    return session;
}

define(["require", "util", "channels", "jquery", "storage"], sessionMain);
