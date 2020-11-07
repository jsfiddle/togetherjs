"use strict";
/* This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this file,
You can obtain one at http://mozilla.org/MPL/2.0/.
*/
(function () {
    var defaultConfiguration = {
        dontShowClicks: false,
        cloneClicks: false,
        enableAnalytics: false,
        analyticsCode: "UA-35433268-28",
        hubBase: null,
        getUserName: null,
        getUserColor: null,
        getUserAvatar: null,
        siteName: null,
        useMinimizedCode: undefined,
        cacheBust: true,
        on: {},
        hub_on: {},
        enableShortcut: false,
        toolName: null,
        findRoom: null,
        autoStart: false,
        suppressJoinConfirmation: false,
        suppressInvite: false,
        inviteFromRoom: null,
        storagePrefix: "togetherjs",
        includeHashInUrl: false,
        disableWebRTC: false,
        youtube: true,
        ignoreMessages: ["cursor-update", "keydown", "scroll-update"],
        ignoreForms: [":password"],
        lang: undefined,
        fallbackLang: "en-US"
    };
    var styleSheet = "/togetherjs/togetherjs.css";
    var baseUrl = "__baseUrl__";
    if (baseUrl == "__" + "baseUrl__") {
        // Reset the variable if it doesn't get substituted
        baseUrl = "";
    }
    // Allow override of baseUrl (this is done separately because it needs
    // to be done very early)
    if (window.TogetherJSConfig && window.TogetherJSConfig.baseUrl) {
        baseUrl = window.TogetherJSConfig.baseUrl;
    }
    if (window.TogetherJSConfig_baseUrl) {
        baseUrl = window.TogetherJSConfig_baseUrl;
    }
    defaultConfiguration.baseUrl = baseUrl;
    // True if this file should use minimized sub-resources:
    var min = "__min__" == "__" + "min__" ? false : "__min__" == "yes";
    var baseUrlOverrideString = localStorage.getItem("togetherjs.baseUrlOverride");
    var baseUrlOverride;
    if (baseUrlOverrideString) {
        try {
            baseUrlOverride = JSON.parse(baseUrlOverrideString);
        }
        catch (e) {
            baseUrlOverride = null;
        }
        if ((!baseUrlOverride) || baseUrlOverride.expiresAt < Date.now()) {
            // Ignore because it has expired
            localStorage.removeItem("togetherjs.baseUrlOverride");
        }
        else {
            baseUrl = baseUrlOverride.baseUrl;
            var logger = console.warn || console.log;
            logger.call(console, "Using TogetherJS baseUrlOverride:", baseUrl);
            logger.call(console, "To undo run: localStorage.removeItem('togetherjs.baseUrlOverride')");
        }
    }
    function copyConfigInWindow(configOverride) {
        var shownAny = false;
        for (var _attr in configOverride) {
            var attr = _attr;
            if (!configOverride.hasOwnProperty(attr)) {
                continue;
            }
            if (attr == "expiresAt" || !configOverride.hasOwnProperty(attr)) {
                continue;
            }
            if (!shownAny) {
                console.warn("Using TogetherJS configOverride");
                console.warn("To undo run: localStorage.removeItem('togetherjs.configOverride')");
            }
            window["TogetherJSConfig_" + attr] = configOverride[attr];
            console.log("Config override:", attr, "=", configOverride[attr]);
        }
    }
    var configOverrideString = localStorage.getItem("togetherjs.configOverride");
    var configOverride;
    if (configOverrideString) {
        try {
            configOverride = JSON.parse(configOverrideString);
        }
        catch (e) {
            configOverride = null;
        }
        if ((!configOverride) || configOverride.expiresAt < Date.now()) {
            localStorage.removeItem("togetherjs.configOverride");
        }
        else {
            copyConfigInWindow(configOverride);
        }
    }
    var version = "unknown";
    // FIXME: we could/should use a version from the checkout, at least for production
    var cacheBust = "__gitCommit__";
    if ((!cacheBust) || cacheBust == "__gitCommit__") {
        cacheBust = Date.now() + "";
    }
    else {
        version = cacheBust;
    }
    function polyfillConsole() {
        // Make sure we have all of the console.* methods:
        if (typeof console == "undefined") {
            console = {};
        }
        if (!console.log) {
            console.log = function () { };
        }
        ["debug", "info", "warn", "error"].forEach(function (method) {
            if (!console[method]) {
                console[method] = console.log;
            }
        });
    }
    polyfillConsole();
    if (!baseUrl) {
        var scripts = document.getElementsByTagName("script");
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].src;
            if (src && src.search(/togetherjs(-min)?.js(\?.*)?$/) !== -1) {
                baseUrl = src.replace(/\/*togetherjs(-min)?.js(\?.*)?$/, "");
                console.warn("Detected baseUrl as", baseUrl);
                break;
            }
            else if (src && src.search(/togetherjs-min.js(\?.*)?$/) !== -1) {
                baseUrl = src.replace(/\/*togetherjs-min.js(\?.*)?$/, "");
                console.warn("Detected baseUrl as", baseUrl);
                break;
            }
        }
    }
    if (!baseUrl) {
        console.warn("Could not determine TogetherJS's baseUrl (looked for a <script> with togetherjs.js and togetherjs-min.js)");
    }
    function addStyle() {
        var existing = document.getElementById("togetherjs-stylesheet");
        if (!existing) {
            var link = document.createElement("link");
            link.id = "togetherjs-stylesheet";
            link.setAttribute("rel", "stylesheet");
            link.href = baseUrl + styleSheet +
                (cacheBust ? ("?bust=" + cacheBust) : '');
            document.head.appendChild(link);
        }
    }
    function addScript(url) {
        var script = document.createElement("script");
        script.src = baseUrl + url +
            (cacheBust ? ("?bust=" + cacheBust) : '');
        document.head.appendChild(script);
    }
    var TogetherJS = function (event) {
        var session;
        if (TogetherJS.running) {
            session = TogetherJS.require("session");
            session.close();
            return;
        }
        TogetherJS.startup.button = null;
        try {
            if (event && typeof event == "object") {
                if ("target" in event && event.target && typeof event) {
                    TogetherJS.startup.button = event.target;
                }
                else if ("nodeType" in event && event.nodeType == 1) {
                    TogetherJS.startup.button = event;
                }
                else if (Array.isArray(event) && event[0] && event[0].nodeType == 1) {
                    // TODO What?
                    // Probably a jQuery element
                    TogetherJS.startup.button = event[0];
                }
            }
        }
        catch (e) {
            console.warn("Error determining starting button:", e);
        }
        if (window.TowTruckConfig) {
            console.warn("TowTruckConfig is deprecated; please use TogetherJSConfig");
            if (window.TogetherJSConfig) {
                console.warn("Ignoring TowTruckConfig in favor of TogetherJSConfig");
            }
            else {
                window.TogetherJSConfig = window.TowTruckConfig;
            }
        }
        if (window.TogetherJSConfig && (!window.TogetherJSConfig.loaded)) {
            TogetherJS.config(window.TogetherJSConfig);
            window.TogetherJSConfig.loaded = true;
        }
        // This handles loading configuration from global variables.  This
        // includes TogetherJSConfig_on_*, which are attributes folded into
        // the "on" configuration value.
        var attr;
        var attrName;
        var globalOns = {};
        for (attr in window) {
            if (attr.indexOf("TogetherJSConfig_on_") === 0) {
                attrName = attr.substr(("TogetherJSConfig_on_").length);
                var a = window[attr];
                globalOns[attrName] = window[attr];
            }
            else if (attr.indexOf("TogetherJSConfig_") === 0) {
                attrName = attr.substr(("TogetherJSConfig_").length);
                TogetherJS.config(attrName, window[attr]);
            }
            else if (attr.indexOf("TowTruckConfig_on_") === 0) {
                attrName = attr.substr(("TowTruckConfig_on_").length);
                console.warn("TowTruckConfig_* is deprecated, please rename", attr, "to TogetherJSConfig_on_" + attrName);
                globalOns[attrName] = window[attr];
            }
            else if (attr.indexOf("TowTruckConfig_") === 0) {
                attrName = attr.substr(("TowTruckConfig_").length);
                console.warn("TowTruckConfig_* is deprecated, please rename", attr, "to TogetherJSConfig_" + attrName);
                TogetherJS.config(attrName, window[attr]);
            }
        }
        // FIXME: copy existing config?
        // FIXME: do this directly in TogetherJS.config() ?
        // FIXME: close these configs?
        var ons = TogetherJS.config.get("on");
        for (attr in globalOns) {
            if (globalOns.hasOwnProperty(attr)) {
                // FIXME: should we avoid overwriting?  Maybe use arrays?
                ons[attr] = globalOns[attr];
            }
        }
        TogetherJS.config("on", ons);
        for (attr in ons) {
            TogetherJS.on(attr, ons[attr]);
        }
        var hubOns = TogetherJS.config.get("hub_on");
        if (hubOns) {
            for (attr in hubOns) {
                if (hubOns.hasOwnProperty(attr)) {
                    TogetherJS.hub.on(attr, hubOns[attr]);
                }
            }
        }
        if (!TogetherJS.config.close('cacheBust')) {
            cacheBust = '';
            delete TogetherJS.requireConfig.urlArgs;
        }
        if (!TogetherJS.startup.reason) {
            // Then a call to TogetherJS() from a button must be started TogetherJS
            TogetherJS.startup.reason = "started";
        }
        // FIXME: maybe I should just test for TogetherJS.require:
        if (TogetherJS._loaded) {
            session = TogetherJS.require("session");
            addStyle();
            session.start();
            return;
        }
        // A sort of signal to session.js to tell it to actually
        // start itself (i.e., put up a UI and try to activate)
        TogetherJS.startup._launch = true;
        addStyle();
        var minSetting = TogetherJS.config.get("useMinimizedCode");
        TogetherJS.config.close("useMinimizedCode");
        if (minSetting !== undefined) {
            min = !!minSetting;
        }
        var requireConfig = TogetherJS._extend(TogetherJS.requireConfig);
        var deps = ["session", "jquery"];
        var lang = TogetherJS.getConfig("lang");
        // [igoryen]: We should generate this value in Gruntfile.js, based on the available translations
        var availableTranslations = {
            "en-US": true,
            "en": "en-US",
            "es": "es-BO",
            "es-BO": true,
            "ru": true,
            "ru-RU": "ru",
            "pl": "pl-PL",
            "pl-PL": true,
            "de-DE": true,
            "de": "de-DE"
        };
        if (!lang) {
            // BCP 47 mandates hyphens, not underscores, to separate lang parts
            lang = navigator.language.replace(/_/g, "-");
        }
        // TODO check if the updates of those conditions is right
        // if(/-/.test(lang) && !availableTranslations[lang]) {
        if (/-/.test(lang) && (!("lang" in availableTranslations) || !availableTranslations[lang])) {
            lang = lang.replace(/-.*$/, '');
        }
        // if(!availableTranslations[lang]) {
        if (!("lang" in availableTranslations) || !availableTranslations[lang]) {
            lang = TogetherJS.config.get("fallbackLang");
        }
        // else if(availableTranslations[lang] !== true) {
        else if (availableTranslations[lang] !== true) {
            lang = availableTranslations[lang];
        }
        TogetherJS.config("lang", lang);
        var localeTemplates = "templates-" + lang;
        deps.splice(0, 0, localeTemplates);
        function callback(session, jquery) {
            TogetherJS._loaded = true;
            if (!min) {
                TogetherJS.require = require.config({ context: "togetherjs" });
                TogetherJS._requireObject = require;
            }
        }
        if (!min) {
            if (typeof require == "function") {
                if (!require.config) {
                    console.warn("The global require (", require, ") is not requirejs; please use togetherjs-min.js");
                    throw new Error("Conflict with window.require");
                }
                TogetherJS.require = require.config(requireConfig);
            }
        }
        if (typeof TogetherJS.require == "function") {
            // This is an already-configured version of require
            TogetherJS.require(deps, callback);
        }
        else {
            requireConfig.deps = deps;
            requireConfig.callback = callback;
            if (!min) {
                window.require = requireConfig;
            }
        }
        if (min) {
            addScript("/togetherjs/togetherjsPackage.js");
        }
        else {
            addScript("/togetherjs/libs/require.js");
        }
    };
    window.TogetherJS = TogetherJS;
    TogetherJS.pageLoaded = Date.now();
    TogetherJS._extend = function (base, extensions) {
        if (!extensions) {
            extensions = base;
            base = {};
        }
        for (var a in extensions) {
            if (extensions.hasOwnProperty(a)) {
                base[a] = extensions[a];
            }
        }
        return base;
    };
    TogetherJS._startupInit = {
        // What element, if any, was used to start the session:
        button: null,
        // The startReason is the reason TogetherJS was started.  One of:
        //   null: not started
        //   started: hit the start button (first page view)
        //   joined: joined the session (first page view)
        reason: null,
        // Also, the session may have started on "this" page, or maybe is continued
        // from a past page.  TogetherJS.continued indicates the difference (false the
        // first time TogetherJS is started or joined, true on later page loads).
        continued: false,
        // This is set to tell the session what shareId to use, if the boot
        // code knows (mostly because the URL indicates the id).
        _joinShareId: null,
        // This tells session to start up immediately (otherwise it would wait
        // for session.start() to be run)
        _launch: false
    };
    TogetherJS.startup = TogetherJS._extend(TogetherJS._startupInit);
    TogetherJS.running = false;
    TogetherJS.requireConfig = {
        context: "togetherjs",
        baseUrl: baseUrl + "/togetherjs",
        urlArgs: "bust=" + cacheBust,
        paths: {
            jquery: "libs/jquery-1.11.1.min",
            walkabout: "libs/walkabout/walkabout",
            esprima: "libs/walkabout/lib/esprima",
            falafel: "libs/walkabout/lib/falafel",
            tinycolor: "libs/tinycolor",
            whrandom: "libs/whrandom/random"
        }
    };
    TogetherJS._mixinEvents = function (proto) {
        proto.on = function on(name, callback) {
            var _this = this;
            if (typeof callback != "function") {
                console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
                throw "Error: .once() called with non-callback";
            }
            if (name.search(" ") != -1) {
                var names = name.split(/ +/g);
                names.forEach(function (n) {
                    _this.on(n, callback);
                }, this);
                return;
            }
            if (this._knownEvents && this._knownEvents.indexOf(name) == -1) {
                var thisString = "" + this;
                if (thisString.length > 20) {
                    thisString = thisString.substr(0, 20) + "...";
                }
                console.warn(thisString + ".on('" + name + "', ...): unknown event");
                if (console.trace) {
                    console.trace();
                }
            }
            if (!this._listeners) {
                this._listeners = {};
            }
            if (!this._listeners[name]) {
                this._listeners[name] = [];
            }
            if (this._listeners[name].indexOf(callback) == -1) {
                this._listeners[name].push(callback);
            }
        };
        proto.once = function once(name, callback) {
            if (typeof callback != "function") {
                console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
                throw "Error: .once() called with non-callback";
            }
            var attr = "onceCallback_" + name;
            // FIXME: maybe I should add the event name to the .once attribute:
            if (!callback[attr]) {
                callback[attr] = function onceCallback() {
                    callback.apply(this, arguments);
                    this.off(name, onceCallback);
                    delete callback[attr];
                };
            }
            this.on(name, callback[attr]);
        };
        proto.off = proto.removeListener = function off(name, callback) {
            if (this._listenerOffs) {
                // Defer the .off() call until the .emit() is done.
                this._listenerOffs.push([name, callback]);
                return;
            }
            if (name.search(" ") != -1) {
                var names = name.split(/ +/g);
                names.forEach(function (n) {
                    this.off(n, callback);
                }, this);
                return;
            }
            if ((!this._listeners) || !this._listeners[name]) {
                return;
            }
            var l = this._listeners[name], _len = l.length;
            for (var i = 0; i < _len; i++) {
                if (l[i] == callback) {
                    l.splice(i, 1);
                    break;
                }
            }
        };
        proto.emit = function emit(name) {
            var offs = this._listenerOffs = [];
            if ((!this._listeners) || !this._listeners[name]) {
                return;
            }
            var args = Array.prototype.slice.call(arguments, 1);
            var l = this._listeners[name];
            l.forEach(function (callback) {
                callback.apply(this, args);
            }, this);
            delete this._listenerOffs;
            if (offs.length) {
                offs.forEach(function (item) {
                    this.off(item[0], item[1]);
                }, this);
            }
        };
        return proto;
    };
    /* This finalizes the unloading of TogetherJS, including unloading modules */
    TogetherJS._teardown = function () {
        var requireObject = TogetherJS._requireObject || window.require;
        // FIXME: this doesn't clear the context for min-case
        if (requireObject.s && requireObject.s.contexts) {
            delete requireObject.s.contexts.togetherjs;
        }
        TogetherJS._loaded = false;
        TogetherJS.startup = TogetherJS._extend(TogetherJS._startupInit);
        TogetherJS.running = false;
    };
    TogetherJS._mixinEvents(TogetherJS);
    TogetherJS._knownEvents = ["ready", "close"];
    TogetherJS.toString = function () {
        return "TogetherJS";
    };
    var defaultHubBase = "__hubUrl__";
    if (defaultHubBase == "__" + "hubUrl" + "__") {
        // Substitution wasn't made
        defaultHubBase = "https://hub.togetherjs.mozillalabs.com";
    }
    defaultConfiguration.hubBase = defaultHubBase;
    TogetherJS._configuration = {};
    TogetherJS._defaultConfiguration = {
        dontShowClicks: false,
        cloneClicks: false,
        enableAnalytics: false,
        analyticsCode: "UA-35433268-28",
        hubBase: defaultHubBase,
        getUserName: null,
        getUserColor: null,
        getUserAvatar: null,
        siteName: null,
        useMinimizedCode: undefined,
        on: {},
        hub_on: {},
        enableShortcut: false,
        toolName: null,
        findRoom: null,
        autoStart: false,
        suppressJoinConfirmation: false,
        suppressInvite: false,
        inviteFromRoom: null,
        storagePrefix: "togetherjs",
        includeHashInUrl: false,
        lang: null
    };
    // FIXME: there's a point at which configuration can't be updated
    // (e.g., hubBase after the TogetherJS has loaded).  We should keep
    // track of these and signal an error if someone attempts to
    // reconfigure too late
    TogetherJS.getConfig = function (name) {
        var value = TogetherJS._configuration[name];
        if (value === undefined) {
            if (!TogetherJS._defaultConfiguration.hasOwnProperty(name)) {
                console.error("Tried to load unknown configuration value:", name);
            }
            value = TogetherJS._defaultConfiguration[name];
        }
        return value;
    };
    TogetherJS._defaultConfiguration = defaultConfiguration;
    TogetherJS._configTrackers = {};
    TogetherJS._configClosed = {};
    /* TogetherJS.config(configurationObject)
       or: TogetherJS.config(configName, value)
  
       Adds configuration to TogetherJS.  You may also set the global variable TogetherJSConfig
       and when TogetherJS is started that configuration will be loaded.
  
       Unknown configuration values will lead to console error messages.
       */
    TogetherJS.config = function (name, maybeValue) {
        var settings;
        if (arguments.length == 1) {
            if (typeof name != "object") {
                throw new Error('TogetherJS.config(value) must have an object value (not: ' + name + ')');
            }
            settings = name;
        }
        else {
            settings = {};
            settings[name] = maybeValue;
        }
        var i;
        var tracker;
        var attr;
        for (attr in settings) {
            if (settings.hasOwnProperty(attr)) {
                if (TogetherJS._configClosed[attr] && TogetherJS.running) {
                    throw new Error("The configuration " + attr + " is finalized and cannot be changed");
                }
            }
        }
        for (attr in settings) {
            if (!settings.hasOwnProperty(attr)) {
                continue;
            }
            if (attr == "loaded" || attr == "callToStart") {
                continue;
            }
            if (!TogetherJS._defaultConfiguration.hasOwnProperty(attr)) {
                console.warn("Unknown configuration value passed to TogetherJS.config():", attr);
            }
            var previous = TogetherJS._configuration[attr];
            var value = settings[attr];
            TogetherJS._configuration[attr] = value;
            var trackers = TogetherJS._configTrackers[name] || [];
            var failed = false;
            for (i = 0; i < trackers.length; i++) {
                try {
                    tracker = trackers[i];
                    tracker(value, previous);
                }
                catch (e) {
                    console.warn("Error setting configuration", name, "to", value, ":", e, "; reverting to", previous);
                    failed = true;
                    break;
                }
            }
            if (failed) {
                TogetherJS._configuration[attr] = previous;
                for (i = 0; i < trackers.length; i++) {
                    try {
                        tracker = trackers[i];
                        tracker(value);
                    }
                    catch (e) {
                        console.warn("Error REsetting configuration", name, "to", previous, ":", e, "(ignoring)");
                    }
                }
            }
        }
    };
    TogetherJS.config.get = function (name) {
        var value = TogetherJS._configuration[name];
        if (value === undefined) {
            if (!TogetherJS._defaultConfiguration.hasOwnProperty(name)) {
                console.error("Tried to load unknown configuration value:", name);
            }
            value = TogetherJS._defaultConfiguration[name];
        }
        return value;
    };
    TogetherJS.config.track = function (name, callback) {
        if (!TogetherJS._defaultConfiguration.hasOwnProperty(name)) {
            throw new Error("Configuration is unknown: " + name);
        }
        callback(TogetherJS.config.get(name));
        if (!TogetherJS._configTrackers[name]) {
            TogetherJS._configTrackers[name] = [];
        }
        TogetherJS._configTrackers[name].push(callback);
        return callback;
    };
    TogetherJS.config.close = function (name) {
        if (!TogetherJS._defaultConfiguration.hasOwnProperty(name)) {
            throw new Error("Configuration is unknown: " + name);
        }
        TogetherJS._configClosed[name] = true;
        return this.get(name);
    };
    TogetherJS.reinitialize = function () {
        if (TogetherJS.running && typeof TogetherJS.require == "function") {
            TogetherJS.require(["session"], function (session) {
                session.emit("reinitialize");
            });
        }
        // If it's not set, TogetherJS has not been loaded, and reinitialization is not needed
    };
    TogetherJS.refreshUserData = function () {
        if (TogetherJS.running && typeof TogetherJS.require == "function") {
            TogetherJS.require(["session"], function (session) {
                session.emit("refresh-user-data");
            });
        }
    };
    // This should contain the output of "git describe --always --dirty"
    // FIXME: substitute this on the server (and update make-static-client)
    TogetherJS.version = version;
    TogetherJS.baseUrl = baseUrl;
    TogetherJS.hub = TogetherJS._mixinEvents({});
    TogetherJS._onmessage = function (msg) {
        var type = msg.type;
        if (type.search(/^app\./) === 0) {
            type = type.substr("app.".length);
        }
        else {
            type = "togetherjs." + type;
        }
        msg.type = type;
        TogetherJS.hub.emit(msg.type, msg);
    };
    TogetherJS.send = function (msg) {
        if (!TogetherJS.require) {
            throw "You cannot use TogetherJS.send() when TogetherJS is not running";
        }
        var session = TogetherJS.require("session");
        session.appSend(msg);
    };
    TogetherJS.shareUrl = function () {
        if (!TogetherJS.require) {
            return null;
        }
        var session = TogetherJS.require("session");
        return session.shareUrl();
    };
    var listener = null;
    TogetherJS.listenForShortcut = function () {
        console.warn("Listening for alt-T alt-T to start TogetherJS");
        TogetherJS.removeShortcut();
        listener = function listener(event) {
            if (event.which == 84 && event.altKey) {
                if (listener.pressed) {
                    // Second hit
                    TogetherJS();
                }
                else {
                    listener.pressed = true;
                }
            }
            else {
                listener.pressed = false;
            }
        };
        TogetherJS.once("ready", TogetherJS.removeShortcut);
        document.addEventListener("keyup", listener, false);
    };
    TogetherJS.removeShortcut = function () {
        if (listener) {
            document.addEventListener("keyup", listener, false);
            listener = null;
        }
    };
    TogetherJS.config.track("enableShortcut", function (enable, previous) {
        if (enable) {
            TogetherJS.listenForShortcut();
        }
        else if (previous) {
            TogetherJS.removeShortcut();
        }
    });
    TogetherJS.checkForUsersOnChannel = function (address, callback) {
        if (address.search(/^https?:/i) === 0) {
            address = address.replace(/^http/i, 'ws');
        }
        var socket = new WebSocket(address);
        var gotAnswer = false;
        socket.onmessage = function (event) {
            var msg = JSON.parse(event.data);
            if (msg.type != "init-connection") {
                console.warn("Got unexpected first message (should be init-connection):", msg);
                return;
            }
            if (gotAnswer) {
                console.warn("Somehow received two responses from channel; ignoring second");
                socket.close();
                return;
            }
            gotAnswer = true;
            socket.close();
            callback(msg.peerCount);
        };
        socket.onclose = socket.onerror = function () {
            if (!gotAnswer) {
                console.warn("Socket was closed without receiving answer");
                gotAnswer = true;
                callback(undefined);
            }
        };
    };
    // It's nice to replace this early, before the load event fires, so we conflict
    // as little as possible with the app we are embedded in:
    var hash = location.hash.replace(/^#/, "");
    var m = /&?togetherjs=([^&]*)/.exec(hash);
    if (m) {
        TogetherJS.startup._joinShareId = m[1];
        TogetherJS.startup.reason = "joined";
        var newHash = hash.substr(0, m.index) + hash.substr(m.index + m[0].length);
        location.hash = newHash;
    }
    if (window._TogetherJSShareId) {
        // A weird hack for something the addon does, to force a shareId.
        // FIXME: probably should remove, it's a wonky feature.
        TogetherJS.startup._joinShareId = window._TogetherJSShareId;
        delete window._TogetherJSShareId;
    }
    function conditionalActivate() {
        if (window.TogetherJSConfig_noAutoStart) {
            return;
        }
        // A page can define this function to defer TogetherJS from starting
        var callToStart = window.TogetherJSConfig_callToStart;
        if (!callToStart && window.TowTruckConfig_callToStart) {
            callToStart = window.TowTruckConfig_callToStart;
            console.warn("Please rename TowTruckConfig_callToStart to TogetherJSConfig_callToStart");
        }
        if (window.TogetherJSConfig && window.TogetherJSConfig.callToStart) {
            callToStart = window.TogetherJSConfig.callToStart;
        }
        if (callToStart) {
            // FIXME: need to document this:
            callToStart(onload);
        }
        else {
            onload();
        }
    }
    // FIXME: can we push this up before the load event?
    // Do we need to wait at all?
    function onload() {
        if (TogetherJS.startup._joinShareId) {
            TogetherJS();
        }
        else if (window._TogetherJSBookmarklet) {
            delete window._TogetherJSBookmarklet;
            TogetherJS();
        }
        else {
            // FIXME: this doesn't respect storagePrefix:
            var key = "togetherjs-session.status";
            var valueString = sessionStorage.getItem(key);
            if (valueString) {
                var value = JSON.parse(valueString);
                if (value && value.running) {
                    TogetherJS.startup.continued = true;
                    TogetherJS.startup.reason = value.startupReason;
                    TogetherJS();
                }
            }
            else if (window.TogetherJSConfig_autoStart ||
                (window.TogetherJSConfig && window.TogetherJSConfig.autoStart)) {
                TogetherJS.startup.reason = "joined";
                TogetherJS();
            }
        }
    }
    conditionalActivate();
    // FIXME: wait until load event to double check if this gets set?
    if (window.TogetherJSConfig_enableShortcut) {
        TogetherJS.listenForShortcut();
    }
    // For compatibility:
    window.TowTruck = TogetherJS;
})();
