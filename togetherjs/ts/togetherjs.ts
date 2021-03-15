/* This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this file,
You can obtain one at http://mozilla.org/MPL/2.0/.
*/

class OnClass {
    _knownEvents?: string[];
    _listeners: { [name: string]: TogetherJSNS.CallbackForOnce<any>[] } = {}; // TODO any
    _listenerOffs?: [string, TogetherJSNS.CallbackForOnce<any>][];

    on<T>(name: string, callback: TogetherJSNS.CallbackForOnce<T>) {
        if(typeof callback != "function") {
            console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
            throw "Error: .once() called with non-callback";
        }
        if(name.search(" ") != -1) {
            let names = name.split(/ +/g);
            names.forEach((n) => {
                this.on(n, callback);
            }, this);
            return;
        }
        if(this._knownEvents && this._knownEvents.indexOf(name) == -1) {
            let thisString = "" + this;
            if(thisString.length > 20) {
                thisString = thisString.substr(0, 20) + "...";
            }
            console.warn(thisString + ".on('" + name + "', ...): unknown event");
            if(console.trace) {
                console.trace();
            }
        }
        if(!this._listeners) {
            this._listeners = {};
        }
        if(!this._listeners[name]) {
            this._listeners[name] = [];
        }
        if(this._listeners[name].indexOf(callback) == -1) {
            this._listeners[name].push(callback);
        }
    }

    once<T>(name: string, callback: TogetherJSNS.CallbackForOn<T>) {
        if(typeof callback != "function") {
            console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
            throw "Error: .once() called with non-callback";
        }
        let attr = "onceCallback_" + name;
        // FIXME: maybe I should add the event name to the .once attribute:
        if(!callback[attr]) {
            callback[attr] = function onceCallback(this: OnClass, msg: TogetherJSNS.Message & T) {
                callback.apply(this, [msg]);
                this.off(name, onceCallback);
                delete callback[attr];
            };
        }
        this.on(name, callback[attr]);
    }

    off<T>(name: string, callback: TogetherJSNS.CallbackForOnce<T>) {
        if(this._listenerOffs) {
            // Defer the .off() call until the .emit() is done.
            this._listenerOffs.push([name, callback]);
            return;
        }
        if(name.search(" ") != -1) {
            let names = name.split(/ +/g);
            names.forEach(function(this: OnClass, n) {
                this.off(n, callback);
            }, this);
            return;
        }
        if((!this._listeners) || !this._listeners[name]) {
            return;
        }
        let l = this._listeners[name], _len = l.length;
        for(let i = 0; i < _len; i++) {
            if(l[i] == callback) {
                l.splice(i, 1);
                break;
            }
        }
    }

    removeListener<T>(eventName: string, cb: TogetherJSNS.CallbackForOn<T>) {
        this.off(eventName, cb);
    }

    emit(name: string, ...args: any[]) {
        let offs = this._listenerOffs = [];
        if((!this._listeners) || !this._listeners[name]) {
            return;
        }
        let l = this._listeners[name];
        l.forEach(function(this: OnClass, callback) {
            callback.apply(this, arguments);
        }, this);
        delete this._listenerOffs;
        if(offs.length) {
            offs.forEach(function(this: OnClass, item) {
                this.off(item[0], item[1]);
            }, this);
        }

    }
}

function polyfillConsole() {
    // Make sure we have all of the console.* methods:
    if(typeof console == "undefined") {
        (console as unknown) = {};
    }
    if(!console.log) {
        console.log = function() { };
    }
    ["debug", "info", "warn", "error"].forEach(function(method) {
        if(!(console as any)[method]) {
            (console as any)[method] = console.log;
        }
    });
}

const defaultStartupInit: TogetherJSNS.StartupInit = {
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
}

const defaultConfiguration: TogetherJSNS.Config = {
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

const defaultConfiguration2: Partial<TogetherJSNS.Config> = {
    dontShowClicks: false,
    cloneClicks: false,
    enableAnalytics: false,
    analyticsCode: "UA-35433268-28",
    hubBase: "",
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

class ConfigClass {
    constructor(public tjsInstance: TogetherJSClass) { }
    
    call<K extends keyof TogetherJSNS.Config, V extends TogetherJSNS.Config[K]>(name: K, maybeValue?: V) { // TODO any
        let settings: Partial<TogetherJSNS.Config>;
        if(maybeValue === undefined) {
            if(typeof name != "object") {
                throw new Error('TogetherJS.config(value) must have an object value (not: ' + name + ')');
            }
            settings = name;
        }
        else {
            settings = {};
            settings[name] = maybeValue;
        }
        let tracker;
        let attr: keyof typeof settings;
        for(attr in settings) {
            if(settings.hasOwnProperty(attr)) {
                if(this.tjsInstance._configClosed[attr] && this.tjsInstance.running) {
                    throw new Error("The configuration " + attr + " is finalized and cannot be changed");
                }
            }
        }
        for(attr in settings) {
            if(!settings.hasOwnProperty(attr)) {
                continue;
            }
            if(attr == "loaded" || attr == "callToStart") {
                continue;
            }
            if(!this.tjsInstance._defaultConfiguration.hasOwnProperty(attr)) {
                console.warn("Unknown configuration value passed to TogetherJS.config():", attr);
            }
            let previous = this.tjsInstance._configuration[attr];

            let o = {a: 1, b: "b", c: true};
            let key: keyof typeof o = "b" as "a" | "b" | "c";
            let a = o[key];
            let b = o[key];
            o[key] = o[key];

            let value = settings[attr]; // TODO any
            this.tjsInstance._configuration[attr] = value;
            let trackers = this.tjsInstance._configTrackers[name]!;
            let failed = false;
            for(let i = 0; i < trackers.length; i++) {
                try {
                    tracker = trackers[i];
                    tracker(value, previous);
                }
                catch(e) {
                    console.warn("Error setting configuration", name, "to", value, ":", e, "; reverting to", previous);
                    failed = true;
                    break;
                }
            }
            if(failed) {
                this.tjsInstance._configuration[attr] = previous;
                for(let i = 0; i < trackers.length; i++) {
                    try {
                        tracker = trackers[i];
                        tracker(value);
                    }
                    catch(e) {
                        console.warn("Error REsetting configuration", name, "to", previous, ":", e, "(ignoring)");
                    }
                }
            }
        }
    }

    get<K extends keyof TogetherJSNS.Config>(name: K): Partial<TogetherJSNS.Config>[K] {
        let value = this.tjsInstance._configuration[name];
        if(value === undefined) {
            if(!this.tjsInstance._defaultConfiguration.hasOwnProperty(name)) {
                console.error("Tried to load unknown configuration value:", name);
            }
            value = this.tjsInstance._defaultConfiguration[name];
        }
        return value;
    }

    track<K extends keyof TogetherJSNS.Config, V extends TogetherJSNS.Config[K]>(name: K, callback: (arg: V) => any) {
        if(!this.tjsInstance._defaultConfiguration.hasOwnProperty(name)) {
            throw new Error("Configuration is unknown: " + name);
        }
        callback(this.tjsInstance.config.get(name));
        if(!this.tjsInstance._configTrackers[name]) {
            this.tjsInstance._configTrackers[name] = [];
        }
        this.tjsInstance._configTrackers[name].push(callback);
        return callback;
    }

    close<K extends keyof TogetherJSNS.Config>(name: K): Partial<TogetherJSNS.Config>[K] {
        if(!this.tjsInstance._defaultConfiguration.hasOwnProperty(name)) {
            throw new Error("Configuration is unknown: " + name);
        }
        this.tjsInstance._configClosed[name] = true;
        return this.get(name);
    }
}

// TODO we use this function because we can't really create an object with a call signature AND fields, in the future we will just use a ConfigClass object and use .call instead of a raw call
function createConfigFunObj(confObj: ConfigClass): TogetherJSNS.ConfigFunObj {
    let config: TogetherJSNS.ConfigFunObj = (<K extends keyof TogetherJSNS.Config, V extends TogetherJSNS.Config[K]>(name: K, maybeValue?: V) => confObj.call(name, maybeValue)) as TogetherJSNS.ConfigFunObj;
    config.get = <K extends keyof TogetherJSNS.Config>(name: K) => confObj.get(name);
    config.close = <K extends keyof TogetherJSNS.Config>(name: K) => confObj.close(name);
    config.track = <K extends keyof TogetherJSNS.Config, V extends TogetherJSNS.Config[K]>(name: K, callback: (arg: V) => any) => confObj.track(name, callback);
    return config;
}

class TogetherJSClass extends OnClass implements TogetherJSNS.TogetherJS {
    public running: boolean = false;
    private require: Require;
    private configObject = new ConfigClass(this);
    public readonly config: TogetherJSNS.ConfigFunObj;
    private hub: TogetherJSNS.Hub;
    private requireConfig: RequireConfig;
    private _loaded: boolean;
    private _extend(conf: RequireConfig): RequireConfig;
    private _extend(base: unknown, extensions: unknown): unknown;
    private _requireObject: Require;
    private pageLoaded: number = Date.now();
    private _startupInit: TogetherJSNS.StartupInit = defaultStartupInit;
    public startup: TogetherJSNS.Startup = this._extend(this._startupInit);
    public _configuration: Partial<TogetherJSNS.Config> = {};
    public _defaultConfiguration: TogetherJSNS.Config = defaultConfiguration2;
    public readonly _configTrackers: Partial<{[key in keyof TogetherJSNS.Config]: ((value: unknown, previous?: unknown) => any)[]}> = {};
    public _configClosed: {[P in keyof TogetherJSNS.Config]?: boolean} = {};
    private version: string;
    private baseUrl: string;

    constructor(event?: EventHtmlElement | HTMLElement | HTMLElement[]) {
        super();
        this._knownEvents = ["ready", "close"];

        this.config = createConfigFunObj(this.configObject);

        let session;
        if(this.running) {
            session = this.require("session");
            session.close();
            return;
        }
        this.startup.button = null;
        try {
            if(event && typeof event == "object") {
                if("target" in event && event.target && typeof event) {
                    this.startup.button = event.target;
                }
                else if("nodeType" in event && event.nodeType == 1) {
                    this.startup.button = event;
                }
                else if(Array.isArray(event) && event[0] && event[0].nodeType == 1) {
                    // TODO What?
                    // Probably a jQuery element
                    this.startup.button = event[0];
                }
            }
        }
        catch(e) {
            console.warn("Error determining starting button:", e);
        }
        if(window.TowTruckConfig) {
            console.warn("TowTruckConfig is deprecated; please use TogetherJSConfig");
            if(window.TogetherJSConfig) {
                console.warn("Ignoring TowTruckConfig in favor of TogetherJSConfig");
            }
            else {
                window.TogetherJSConfig = window.TowTruckConfig;
            }
        }
        if(window.TogetherJSConfig && (!window.TogetherJSConfig.loaded)) {
            this.config(window.TogetherJSConfig);
            window.TogetherJSConfig.loaded = true;
        }

        // This handles loading configuration from global variables.  This
        // includes TogetherJSConfig_on_*, which are attributes folded into
        // the "on" configuration value.
        let attr;
        let attrName: keyof TogetherJSNS.Config;
        let globalOns: TogetherJSNS.Ons<unknown> = {};
        for(attr in window) {
            if(attr.indexOf("TogetherJSConfig_on_") === 0) {
                attrName = attr.substr(("TogetherJSConfig_on_").length) as keyof TogetherJSNS.Config;
                let a = window[attr];
                globalOns[attrName] = window[attr] as unknown as TogetherJSNS.CallbackForOn<unknown>;
            }
            else if(attr.indexOf("TogetherJSConfig_") === 0) {
                attrName = attr.substr(("TogetherJSConfig_").length) as keyof TogetherJSNS.Config;
                this.config(attrName, window[attr]);
            }
            else if(attr.indexOf("TowTruckConfig_on_") === 0) {
                attrName = attr.substr(("TowTruckConfig_on_").length) as keyof TogetherJSNS.Config;
                console.warn("TowTruckConfig_* is deprecated, please rename", attr, "to TogetherJSConfig_on_" + attrName);
                globalOns[attrName] = window[attr] as unknown as TogetherJSNS.CallbackForOn<unknown>;
            }
            else if(attr.indexOf("TowTruckConfig_") === 0) {
                attrName = attr.substr(("TowTruckConfig_").length) as keyof TogetherJSNS.Config;
                console.warn("TowTruckConfig_* is deprecated, please rename", attr, "to TogetherJSConfig_" + attrName);
                this.config(attrName, window[attr]);
            }


        }
        // FIXME: copy existing config?
        // FIXME: do this directly in this.config() ?
        // FIXME: close these configs?
        let ons: TogetherJSNS.Ons<unknown> = this.config.get("on");
        for(attr in globalOns) {
            if(globalOns.hasOwnProperty(attr)) {
                // FIXME: should we avoid overwriting?  Maybe use arrays?
                ons[attr] = globalOns[attr];
            }
        }
        this.config("on", ons);
        for(attr in ons) {
            this.on(attr, ons[attr]);
        }
        let hubOns = this.config.get("hub_on");
        if(hubOns) {
            for(attr in hubOns) {
                if(hubOns.hasOwnProperty(attr)) {
                    this.hub.on(attr, hubOns[attr]);
                }
            }
        }
        if(!this.config.close('cacheBust')) {
            cacheBust = '';
            delete this.requireConfig.urlArgs;
        }

        if(!this.startup.reason) {
            // Then a call to TogetherJS() from a button must be started TogetherJS
            this.startup.reason = "started";
        }

        // FIXME: maybe I should just test for this.require:
        if(this._loaded) {
            session = this.require("session");
            addStyle();
            session.start();
            return;
        }
        // A sort of signal to session.js to tell it to actually
        // start itself (i.e., put up a UI and try to activate)
        this.startup._launch = true;

        addStyle();
        let minSetting = this.config.get("useMinimizedCode");
        this.config.close("useMinimizedCode");
        if(minSetting !== undefined) {
            min = !!minSetting;
        }
        let requireConfig: RequireConfig = this._extend(this.requireConfig);
        let deps = ["session", "jquery"];
        let lang = this.getConfig("lang");
        // [igoryen]: We should generate this value in Gruntfile.js, based on the available translations
        let availableTranslations = {
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

        if(!lang) {
            // BCP 47 mandates hyphens, not underscores, to separate lang parts
            lang = navigator.language.replace(/_/g, "-");
        }

        // TODO check if the updates of those conditions is right
        // if(/-/.test(lang) && !availableTranslations[lang]) {
        if(/-/.test(lang) && (!("lang" in availableTranslations) || !availableTranslations[lang])) {
            lang = lang.replace(/-.*$/, '');
        }
        // if(!availableTranslations[lang]) {
        if(!("lang" in availableTranslations) || !availableTranslations[lang]) {
            lang = this.config.get("fallbackLang");
        }
        // else if(availableTranslations[lang] !== true) {
        else if(availableTranslations[lang] !== true) {
            lang = availableTranslations[lang];
        }
        this.config("lang", lang);

        let localeTemplates = "templates-" + lang;
        deps.splice(0, 0, localeTemplates);
        function callback(session: TogetherJSNS.Session, jquery: JQuery) {
            this._loaded = true;
            if(!min) {
                this.require = require.config({ context: "togetherjs" });
                this._requireObject = require;
            }
        }
        if(!min) {
            if(typeof require == "function") {
                if(!require.config) {
                    console.warn("The global require (", require, ") is not requirejs; please use togetherjs-min.js");
                    throw new Error("Conflict with window.require");
                }
                this.require = require.config(requireConfig);
            }
        }
        if(typeof this.require == "function") {
            // This is an already-configured version of require
            this.require(deps, callback);
        }
        else {
            requireConfig.deps = deps;
            requireConfig.callback = callback;
            if(!min) {
                window.require = requireConfig;
            }
        }
        if(min) {
            addScript("/togetherjs/togetherjsPackage.js");
        }
        else {
            addScript("/togetherjs/libs/require.js");
        }
    };

    _extend(base: { [key: string]: unknown }, extensions?: any) {
        if(!extensions) {
            extensions = base;
            base = {};
        }
        for(let a in extensions) {
            if(extensions.hasOwnProperty(a)) {
                base[a] = extensions[a];
            }
        }
        return base;
    };

    _mixinEvents(cls: TogetherJSNS.On) {
        // TODO this function is a way to make the cls arg inherit of the On features, its use should be reworked to use TS inheritance, so fat this implementation does nothing so FIX IT
        return proto;
    };

    _teardown() {
        let requireObject = this._requireObject || window.require;
        // FIXME: this doesn't clear the context for min-case
        if(requireObject.s && requireObject.s.contexts) {
            delete requireObject.s.contexts.togetherjs;
        }
        this._loaded = false;
        this.startup = this._extend(this._startupInit);
        this.running = false;
    };

    toString() {
        return "TogetherJS";
    };

    reinitialize() {
        if(this.running && typeof this.require == "function") {
            this.require(["session"], function(session: TogetherJSNS.On) {
                session.emit("reinitialize");
            });
        }
        // If it's not set, TogetherJS has not been loaded, and reinitialization is not needed
    };

    getConfig(name: keyof TogetherJSNS.Config) { // rename into TogetherJS.config.get()?
        let value = this._configuration[name];
        if(value === undefined) {
            if(!this._defaultConfiguration.hasOwnProperty(name)) {
                console.error("Tried to load unknown configuration value:", name);
            }
            value = this._defaultConfiguration[name];
        }
        return value;
    };

    refreshUserData() {
        if(this.running && typeof this.require == "function") {
            this.require(["session"], function(session: TogetherJSNS.On) {
                session.emit("refresh-user-data");
            });
        }
    };

    _onmessage(msg: TogetherJSNS.Message) {
        let type = msg.type;
        if(type.search(/^app\./) === 0) {
            type = type.substr("app.".length);
        }
        else {
            type = "togetherjs." + type;
        }
        msg.type = type;
        this.hub.emit(msg.type, msg);
    };

    send(msg: TogetherJSNS.Message) {
        if(!this.require) {
            throw "You cannot use TogetherJS.send() when TogetherJS is not running";
        }
        let session = this.require("session");
        session.appSend(msg);
    };

    shareUrl() {
        if(!this.require) {
            return null;
        }
        let session = this.require("session");
        return session.shareUrl();
    };

    listenForShortcut() {
        console.warn("Listening for alt-T alt-T to start TogetherJS");
        this.removeShortcut();
        listener = function listener(event: KeyboardEvent) {
            if(event.which == 84 && event.altKey) {
                if(listener.pressed) {
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
        this.once("ready", this.removeShortcut);
        document.addEventListener("keyup", listener, false);
    };

    removeShortcut() {
        if(listener) {
            document.addEventListener("keyup", listener, false);
            listener = null;
        }
    };

    checkForUsersOnChannel(address, callback) {
        if(address.search(/^https?:/i) === 0) {
            address = address.replace(/^http/i, 'ws');
        }
        let socket = new WebSocket(address);
        let gotAnswer = false;
        socket.onmessage = function(event) {
            let msg = JSON.parse(event.data);
            if(msg.type != "init-connection") {
                console.warn("Got unexpected first message (should be init-connection):", msg);
                return;
            }
            if(gotAnswer) {
                console.warn("Somehow received two responses from channel; ignoring second");
                socket.close();
                return;
            }
            gotAnswer = true;
            socket.close();
            callback(msg.peerCount);
        };
        socket.onclose = socket.onerror = function() {
            if(!gotAnswer) {
                console.warn("Socket was closed without receiving answer");
                gotAnswer = true;
                callback(undefined);
            }
        };
    };
}

function baseUrl1() {
    let baseUrl = "__baseUrl__";
    if(baseUrl == "__" + "baseUrl__") {
        // Reset the variable if it doesn't get substituted
        baseUrl = "";
    }
    // Allow override of baseUrl (this is done separately because it needs
    // to be done very early)
    if(window.TogetherJSConfig && window.TogetherJSConfig.baseUrl) {
        baseUrl = window.TogetherJSConfig.baseUrl;
    }
    if(window.TogetherJSConfig_baseUrl) {
        baseUrl = window.TogetherJSConfig_baseUrl;
    }
    return baseUrl;
}

(function() {
    let styleSheet = "/togetherjs/togetherjs.css";

    function addStyle() {
        var existing = document.getElementById("togetherjs-stylesheet");
        if(!existing) {
            var link = document.createElement("link");
            link.id = "togetherjs-stylesheet";
            link.setAttribute("rel", "stylesheet");
            link.href = baseUrl + styleSheet +
                (cacheBust ? ("?bust=" + cacheBust) : '');
            document.head.appendChild(link);
        }
    }

    function addScript(url: string) {
        var script = document.createElement("script");
        script.src = baseUrl + url +
            (cacheBust ? ("?bust=" + cacheBust) : '');
        document.head.appendChild(script);
    }

    let baseUrl = baseUrl1();
    defaultConfiguration.baseUrl = baseUrl;

    // True if this file should use minimized sub-resources:
    //@ts-expect-error _min_ is replaced in packaging so comparison always looks false in code
    let min = "__min__" == "__" + "min__" ? false : "__min__" == "yes";

    let baseUrlOverrideString = localStorage.getItem("togetherjs.baseUrlOverride");
    let baseUrlOverride: TogetherJSNS.BaseUrlOverride | null;
    if(baseUrlOverrideString) {
        try {
            baseUrlOverride = JSON.parse(baseUrlOverrideString);
        }
        catch(e) {
            baseUrlOverride = null;
        }
        if((!baseUrlOverride) || baseUrlOverride.expiresAt < Date.now()) {
            // Ignore because it has expired
            localStorage.removeItem("togetherjs.baseUrlOverride");
        }
        else {
            baseUrl = baseUrlOverride.baseUrl;
            let logger = console.warn || console.log;
            logger.call(console, "Using TogetherJS baseUrlOverride:", baseUrl);
            logger.call(console, "To undo run: localStorage.removeItem('togetherjs.baseUrlOverride')");
        }
    }

    function copyConfigInWindow(configOverride: TogetherJSNS.WithExpiration<TogetherJSNS.Config> | null) {
        let shownAny = false;
        for(const _attr in configOverride) {
            const attr = _attr as keyof typeof configOverride;
            if(!configOverride.hasOwnProperty(attr)) {
                continue;
            }
            if(attr == "expiresAt" || !configOverride.hasOwnProperty(attr)) {
                continue;
            }
            if(!shownAny) {
                console.warn("Using TogetherJS configOverride");
                console.warn("To undo run: localStorage.removeItem('togetherjs.configOverride')");
            }
            (window as any)["TogetherJSConfig_" + attr] = configOverride[attr];
            console.log("Config override:", attr, "=", configOverride[attr]);
        }
    }

    let configOverrideString = localStorage.getItem("togetherjs.configOverride");
    let configOverride: TogetherJSNS.WithExpiration<TogetherJSNS.Config> | null;
    if(configOverrideString) {
        try {
            configOverride = JSON.parse(configOverrideString);
        }
        catch(e) {
            configOverride = null;
        }
        if((!configOverride) || configOverride.expiresAt < Date.now()) {
            localStorage.removeItem("togetherjs.configOverride");
        }
        else {
            copyConfigInWindow(configOverride);
        }
    }

    let version = "unknown";
    // FIXME: we could/should use a version from the checkout, at least for production
    let cacheBust = "__gitCommit__";
    if((!cacheBust) || cacheBust == "__gitCommit__") {
        cacheBust = Date.now() + "";
    }
    else {
        version = cacheBust;
    }

    polyfillConsole();

    if(!baseUrl) {
        let scripts = document.getElementsByTagName("script");
        for(let i = 0; i < scripts.length; i++) {
            let src = scripts[i].src;
            if(src && src.search(/togetherjs(-min)?.js(\?.*)?$/) !== -1) {
                baseUrl = src.replace(/\/*togetherjs(-min)?.js(\?.*)?$/, "");
                console.warn("Detected baseUrl as", baseUrl);
                break;
            }
            else if(src && src.search(/togetherjs-min.js(\?.*)?$/) !== -1) {
                baseUrl = src.replace(/\/*togetherjs-min.js(\?.*)?$/, "");
                console.warn("Detected baseUrl as", baseUrl);
                break;
            }
        }
    }
    if(!baseUrl) {
        console.warn("Could not determine TogetherJS's baseUrl (looked for a <script> with togetherjs.js and togetherjs-min.js)");
    }

    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    let TogetherJS = new TogetherJSClass();
    window["TogetherJS"] = TogetherJS;

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

    // !!!!!!!!!!!!!!!!!

    TogetherJS._mixinEvents(TogetherJS);


    let defaultHubBase = "__hubUrl__";
    if(defaultHubBase == "__" + "hubUrl" + "__") {
        // Substitution wasn't made
        defaultHubBase = "https://ks3371053.kimsufi.com:7071";
    }
    defaultConfiguration.hubBase = defaultHubBase;

    // FIXME: there's a point at which configuration can't be updated (e.g., hubBase after the TogetherJS has loaded).  We should keep track of these and signal an error if someone attempts to reconfigure too late


    TogetherJS._defaultConfiguration = defaultConfiguration;

    /* TogetherJS.config(configurationObject)
       or: TogetherJS.config(configName, value)
  
       Adds configuration to TogetherJS.  You may also set the global variable TogetherJSConfig
       and when TogetherJS is started that configuration will be loaded.
  
       Unknown configuration values will lead to console error messages.
       */

    //Config !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!





    // This should contain the output of "git describe --always --dirty"
    // FIXME: substitute this on the server (and update make-static-client)
    TogetherJS.version = version;
    TogetherJS.baseUrl = baseUrl;

    TogetherJS.hub = TogetherJS._mixinEvents({});



    let listener: TogetherJSNS.KeyboardListener | null = null;



    TogetherJS.config.track("enableShortcut", function(enable: boolean, previous: unknown) {
        if(enable) {
            TogetherJS.listenForShortcut();
        }
        else if(previous) {
            TogetherJS.removeShortcut();
        }
    });



    // It's nice to replace this early, before the load event fires, so we conflict
    // as little as possible with the app we are embedded in:
    let hash = location.hash.replace(/^#/, "");
    let m = /&?togetherjs=([^&]*)/.exec(hash);
    if(m) {
        TogetherJS.startup._joinShareId = m[1];
        TogetherJS.startup.reason = "joined";
        let newHash = hash.substr(0, m.index) + hash.substr(m.index + m[0].length);
        location.hash = newHash;
    }
    if(window._TogetherJSShareId) {
        // A weird hack for something the addon does, to force a shareId.
        // FIXME: probably should remove, it's a wonky feature.
        TogetherJS.startup._joinShareId = window._TogetherJSShareId;
        delete window._TogetherJSShareId;
    }

    function conditionalActivate() {
        if(window.TogetherJSConfig_noAutoStart) {
            return;
        }
        // A page can define this function to defer TogetherJS from starting
        let callToStart = window.TogetherJSConfig_callToStart;
        if(!callToStart && window.TowTruckConfig_callToStart) {
            callToStart = window.TowTruckConfig_callToStart;
            console.warn("Please rename TowTruckConfig_callToStart to TogetherJSConfig_callToStart");
        }
        if(window.TogetherJSConfig && window.TogetherJSConfig.callToStart) {
            callToStart = window.TogetherJSConfig.callToStart;
        }
        if(callToStart) {
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
        if(TogetherJS.startup._joinShareId) {
            TogetherJS();
        }
        else if(window._TogetherJSBookmarklet) {
            delete window._TogetherJSBookmarklet;
            TogetherJS();
        }
        else {
            // FIXME: this doesn't respect storagePrefix:
            let key = "togetherjs-session.status";
            let valueString = sessionStorage.getItem(key);
            if(valueString) {
                let value = JSON.parse(valueString) as TogetherJSNS.TogetherJS;
                if(value && value.running) {
                    TogetherJS.startup.continued = true;
                    TogetherJS.startup.reason = value.startupReason;
                    TogetherJS();
                }
            }
            else if(window.TogetherJSConfig_autoStart ||
                (window.TogetherJSConfig && window.TogetherJSConfig.autoStart)) {
                TogetherJS.startup.reason = "joined";
                TogetherJS();
            }
        }
    }

    conditionalActivate();

    // FIXME: wait until load event to double check if this gets set?
    if(window.TogetherJSConfig_enableShortcut) {
        TogetherJS.listenForShortcut();
    }

    // For compatibility:
    window.TowTruck = TogetherJS;

})();
