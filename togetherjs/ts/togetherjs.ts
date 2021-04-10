/* This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this file,
You can obtain one at http://mozilla.org/MPL/2.0/.
*/

class OnClass<Map extends {[messageName: string]: TogetherJSNS.CallbackForOn<void>}> {
    _knownEvents?: string[];
    _listeners: { [name: string]: TogetherJSNS.CallbackForOn<void>[] } = {};
    _listenerOffs?: [string, TogetherJSNS.CallbackForOn<void>][];

    on<T extends Extract<keyof Map, string>>(name: T, callback: Map[T]) {
        if(typeof callback != "function") {
            console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
            throw "Error: .once() called with non-callback";
        }
        if(name.search(" ") != -1) {
            const names = name.split(/ +/g);
            names.forEach((n) => {
                this.on(n as Extract<keyof Map, string>, callback); // TODO this cast is abusive, changing the name argument to be a array of event could solve that
            });
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

        if(!this._listeners[name]) {
            this._listeners[name] = [];
        }

        if(this._listeners[name].indexOf(callback) == -1) {
            this._listeners[name].push(callback);
        }
    }

    once<T extends Extract<keyof Map, string>>(name: T, callback: Map[T]) {
        if(typeof callback != "function") {
            console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
            throw "Error: .once() called with non-callback";
        }
        const cb = callback as unknown as TogetherJSNS.CallbackForOnce<void>; // TODO how to avoid this cast?
        const attr = "onceCallback_" + name;
        // FIXME: maybe I should add the event name to the .once attribute:
        if(!cb[attr]) {
            const onceCallback = function (this: OnClass<Map>, ...args: any[]) {
                cb.apply(this, args);
                this.off(name, onceCallback);
                delete cb[attr];
            } as Map[T];
            cb[attr] = onceCallback;
        }
        this.on(name, cb[attr] as Map[T]); // TODO cast
    }

    off<T extends Extract<keyof Map, string>>(name: T, callback: Map[T]) {
        if(this._listenerOffs) {
            // Defer the .off() call until the .emit() is done.
            this._listenerOffs.push([name, callback]);
            return;
        }
        if(name.search(" ") != -1) {
            const names = name.split(/ +/g);
            names.forEach(function(this: OnClass<Map>, n) {
                this.off(n as Extract<keyof Map, string>, callback); // TODO cast as keyof TogetherJSNS.OnMap is abusive, we should forbid passing multiple events (as a space separated string) to this function
            }, this);
            return;
        }
        if(!this._listeners[name]) {
            return;
        }
        const l = this._listeners[name], _len = l.length;
        for(let i = 0; i < _len; i++) {
            if(l[i] == callback) {
                l.splice(i, 1);
                break;
            }
        }
    }

    removeListener = this.off.bind(this); // TODO can be removed apparently

    emit<T extends Extract<keyof Map, string>>(name: T, ...args: Parameters<Map[T]>) {
        const offs = this._listenerOffs = [];
        if((!this._listeners) || !this._listeners[name]) {
            return;
        }
        const l = this._listeners[name];
        l.forEach(function(this: OnClass<Map>, callback) {
            callback.apply(this, args);
        }, this);
        delete this._listenerOffs;
        if(offs.length) {
            offs.forEach(function(this: OnClass<Map>, item) {
                this.off(item[0], item[1]);
            }, this);
        }
    }

    forProtocol<Map2 extends {[messageName: string]: unknown}>() {
        return this as unknown as OnClass<{[M in keyof Map2]: (msg: Map2[M]) => void}>; // TODO cast
    }
}

// True if this file should use minimized sub-resources:
//@ts-expect-error _min_ is replaced in packaging so comparison always looks false in raw code
// eslint-disable-next-line no-constant-condition
let min = "__min__" == "__" + "min__" ? false : "__min__" == "yes";

// eslint-disable-next-line no-var
var TogetherJS: TogetherJSNS.TogetherJSClass = togetherjsMain();

function togetherjsMain() {
    const styleSheet = "/togetherjs.css";
    let listener: TogetherJSNS.KeyboardListener | null = null;

    const defaultStartupInit: TogetherJSNS.Startup = {
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
        analyticsCode: "UA-", // No code
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
        youtube: false,
        ignoreMessages: ["cursor-update", "keydown", "scroll-update"],
        ignoreForms: [":password"],
        lang: undefined,
        fallbackLang: "en-US"
    };

    let version = "unknown";
    // FIXME: we could/should use a version from the checkout, at least for production
    let cacheBust = "__gitCommit__";
    if((!cacheBust) || cacheBust == "__gitCommit__") {
        cacheBust = Date.now() + "";
    }
    else {
        version = cacheBust;
    }

    class ConfigClass {
        public _configClosed: { [P in keyof TogetherJSNS.Config]?: boolean } = {};

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
                if(Object.prototype.hasOwnProperty.call(settings, attr)) {
                    if(this._configClosed[attr] && this.tjsInstance.running) {
                        throw new Error("The configuration " + attr + " is finalized and cannot be changed");
                    }
                }
            }
            for(attr in settings) {
                if(!Object.prototype.hasOwnProperty.call(settings, attr)) {
                    continue;
                }
                if(attr == "loaded" || attr == "callToStart") {
                    continue;
                }
                if(!Object.prototype.hasOwnProperty.call(this.tjsInstance._defaultConfiguration, attr)) {
                    console.warn("Unknown configuration value passed to TogetherJS.config():", attr);
                }
                const previous = this.tjsInstance._configuration[attr];
                const value = settings[attr];
                this.tjsInstance._configuration[attr] = value as any; // TODO any, how to remove this any
                const trackers = this.tjsInstance._configTrackers[name] ?? [];
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
                    this.tjsInstance._configuration[attr] = previous as any; // TODO any, how to remove this any?
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

        // We need this for this weird reason: https://github.com/microsoft/TypeScript/issues/31675
        private getValueOrDefault<T, K extends keyof T>(obj: Partial<T>, key: K, defaultValue: T[K]): T[K] {
            return obj[key] ?? defaultValue;
        }

        get<K extends keyof TogetherJSNS.Config>(name: K): TogetherJSNS.Config[K] {
            return this.getValueOrDefault(this.tjsInstance._configuration, name, this.tjsInstance._defaultConfiguration[name]);
        }

        track<K extends keyof TogetherJSNS.Config>(name: K, callback: (value: TogetherJSNS.Config[K], previous?: TogetherJSNS.Config[K]) => void) {
            if(!Object.prototype.hasOwnProperty.call(this.tjsInstance._defaultConfiguration, name)) {
                throw new Error("Configuration is unknown: " + name);
            }
            const v = this.tjsInstance.config.get(name);
            callback(v);
            if(!this.tjsInstance._configTrackers[name]) {
                this.tjsInstance._configTrackers[name] = [];
            }
            // TODO any how to make callback typecheck?
            this.tjsInstance._configTrackers[name]!.push(callback as any); // TODO ! and any cast
            return callback;
        }

        close<K extends keyof TogetherJSNS.Config>(name: K): Partial<TogetherJSNS.Config>[K] {
            if(!Object.prototype.hasOwnProperty.call(this.tjsInstance._defaultConfiguration, name)) {
                throw new Error("Configuration is unknown: " + name);
            }
            this._configClosed[name] = true;
            return this.get(name);
        }
    }

    // TODO we use this function because we can't really create an object with a call signature AND fields, in the future we will just use a ConfigClass object and use .call instead of a raw call
    function createConfigFunObj(confObj: ConfigClass): TogetherJSNS.ConfigFunObj {
        const config: TogetherJSNS.ConfigFunObj = (<K extends keyof TogetherJSNS.Config, V extends TogetherJSNS.Config[K]>(name: K, maybeValue?: V) => confObj.call(name, maybeValue)) as TogetherJSNS.ConfigFunObj;
        config.get = <K extends keyof TogetherJSNS.Config>(name: K) => confObj.get(name);
        config.close = <K extends keyof TogetherJSNS.Config>(name: K) => confObj.close(name);
        config.track = <K extends keyof TogetherJSNS.Config>(name: K, callback: (arg: TogetherJSNS.Config[K]) => void) => confObj.track(name, callback);
        return config;
    }

    class TogetherJSClass extends OnClass<TogetherJSNS.On.Map> {
        public startupReason: TogetherJSNS.Reason | null = null;
        public running = false;
        public require!: Require; // TODO !
        private configObject = new ConfigClass(this);
        public readonly config: TogetherJSNS.ConfigFunObj;
        public hub: TogetherJSNS.Hub = new OnClass<TogetherJSNS.On.Map>();
        public requireConfig!: RequireConfig; // TODO !
        private _loaded?: boolean;
        private _requireObject!: Require; // TODO !
        public pageLoaded: number = Date.now();
        private _startupInit: TogetherJSNS.Startup = defaultStartupInit;
        public startup: TogetherJSNS.Startup = Object.assign({}, this._startupInit);
        public _configuration: Partial<TogetherJSNS.Config> = {};
        public _defaultConfiguration: TogetherJSNS.Config = defaultConfiguration;
        //public readonly _configTrackers2: Partial<{[key in keyof TogetherJSNS.Config]: ((value: TogetherJSNS.Config[key], previous?: TogetherJSNS.Config[key]) => any)[]}> = {};
        public readonly _configTrackers: Partial<{ [key in keyof TogetherJSNS.Config]: ((value: unknown, previous?: unknown) => any)[] }> = {};
        public version!: string; // TODO !
        public baseUrl!: string; // TODO !
        public readonly editTrackers: { [trackerName: string]: TogetherJSNS.TrackerClass } = {};
        public startTarget?: HTMLElement;

        constructor() {
            super();
            this._knownEvents = ["ready", "close"];
            this.config = createConfigFunObj(this.configObject);
            this.startup.button = null;
        }

        start(event?: EventHtmlElement | HTMLElement | HTMLElement[]) {
            let session;
            if(this.running) {
                session = this.require("session").session;
                session.close();
                return;
            }

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
            if(window.TogetherJSConfig && (!window.TogetherJSConfig.loaded)) {
                this.config(window.TogetherJSConfig);
                window.TogetherJSConfig.loaded = true;
            }

            // This handles loading configuration from global variables.  This
            // includes TogetherJSConfig_on_*, which are attributes folded into
            // the "on" configuration value.
            let attr: string;
            let attrName: keyof TogetherJSNS.Config;
            const globalOns: TogetherJSNS.Ons<unknown> = {};
            for(attr in window) {
                if(attr.indexOf("TogetherJSConfig_on_") === 0) {
                    attrName = attr.substr(("TogetherJSConfig_on_").length) as keyof TogetherJSNS.Config;
                    globalOns[attrName] = window[attr] as unknown as TogetherJSNS.CallbackForOn<unknown>;
                }
                else if(attr.indexOf("TogetherJSConfig_") === 0) {
                    attrName = attr.substr(("TogetherJSConfig_").length) as keyof TogetherJSNS.Config;
                    this.config(attrName, window[attr] as unknown as TogetherJSNS.Config[keyof TogetherJSNS.Config]); // TODO this cast is here because Window has an index signature that always return a Window
                }
            }
            // FIXME: copy existing config?
            // FIXME: do this directly in this.config() ?
            // FIXME: close these configs?
            const ons: TogetherJSNS.Ons<unknown> = this.config.get("on") || {};
            for(attr in globalOns) {
                if(Object.prototype.hasOwnProperty.call(globalOns, attr)) {
                    // FIXME: should we avoid overwriting?  Maybe use arrays?
                    ons[attr] = globalOns[attr];
                }
            }
            this.config("on", ons);
            for(attr in ons) {
                this.on(attr as keyof TogetherJSNS.On.Map, ons[attr]); // TODO check cast
            }
            const hubOns = this.config.get("hub_on");
            if(hubOns) {
                for(attr in hubOns) {
                    if(Object.prototype.hasOwnProperty.call(hubOns, attr)) {
                        this.hub.on(attr as keyof TogetherJSNS.On.Map, hubOns[attr]); // TODO check cast
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
                session = this.require("session").session;
                addStyle();
                session.start();
                return;
            }
            // A sort of signal to session.js to tell it to actually
            // start itself (i.e., put up a UI and try to activate)
            this.startup._launch = true;

            addStyle();
            const minSetting = this.config.get("useMinimizedCode");
            this.config.close("useMinimizedCode");
            if(minSetting !== undefined) {
                min = !!minSetting;
            }
            const requireConfig: RequireConfig = Object.assign({}, this.requireConfig);
            const deps = ["session", "jquery"];
            let lang = this.getConfig("lang");
            // [igoryen]: We should generate this value in Gruntfile.js, based on the available translations
            const availableTranslations = {
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

            const localeTemplates = "templates-" + lang;
            deps.splice(0, 0, localeTemplates);
            const callback = (/*_session: TogetherJSNS.Session, _jquery: JQuery*/) => {
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
                    // TODO I really don't know what happens here... note that this is only executed if !min which means that at some point addScriptInner("/libs/require.js"); (see below) will be executed
                    //@ts-expect-error weird stuff
                    window.require = requireConfig;
                }
            }
            if(min) {
                addScriptInner("/togetherjsPackage.js");
            }
            else {
                addScriptInner("/libs/require.js");
            }
        }

        _teardown() {
            const requireObject = this._requireObject || window.require;
            // FIXME: this doesn't clear the context for min-case
            if(requireObject.s && requireObject.s.contexts) {
                delete requireObject.s.contexts.togetherjs;
            }
            this._loaded = false;
            this.startup = Object.assign({}, this._startupInit);
            this.running = false;
        }

        toString() {
            return "TogetherJS";
        }

        reinitialize() {
            if(this.running && typeof this.require == "function") {
                this.require(["session"], function({ session }) {
                    session.emit("reinitialize");
                });
            }
            // If it's not set, TogetherJS has not been loaded, and reinitialization is not needed
        }

        getConfig<K extends keyof TogetherJSNS.Config>(name: K): Partial<TogetherJSNS.Config>[K] { // rename into TogetherJS.config.get()?
            let value = this._configuration[name];
            if(value === undefined) {
                if(!Object.prototype.hasOwnProperty.call(this._defaultConfiguration, name)) {
                    console.error("Tried to load unknown configuration value:", name);
                }
                value = this._defaultConfiguration[name];
            }
            return value;
        }

        refreshUserData() {
            if(this.running && typeof this.require == "function") {
                this.require(["session"], function({ session }) {
                    session.emit("refresh-user-data");
                });
            }
        }

        _onmessage(msg: TogetherJSNS.AnyMessage.AnyForTransit) {
            const type = msg.type;
            let type2: string = type;
            if(type.search(/^app\./) === 0) {
                type2 = type2.substr("app.".length);
            }
            else {
                type2 = "togetherjs." + type2;
            }
            msg.type = type2 as typeof msg.type; // TODO cast!!!
            this.hub.emit(msg.type, msg); // TODO emit error
        }

        /** Use this method if you want you app to send custom messages */
        send<Map>(msg: {type: Extract<keyof Map, string>}) {
            if(!this.require) {
                throw "You cannot use TogetherJS.send() when TogetherJS is not running";
            }
            const session = this.require("session").session;
            session.appSend(msg);
        }

        shareUrl() {
            if(!this.require) {
                return null;
            }
            const session = this.require("session").session;
            return session.shareUrl();
        }

        listenForShortcut() {
            console.warn("Listening for alt-T alt-T to start TogetherJS");
            this.removeShortcut();
            listener = function(this: TogetherJSNS.KeyboardListener, event: KeyboardEvent) {
                if(event.which == 84 && event.altKey) {
                    if(this.pressed) {
                        // Second hit
                        TogetherJS.start();
                    }
                    else {
                        this.pressed = true;
                    }
                }
                else {
                    this.pressed = false;
                }
            };
            this.once("ready", this.removeShortcut);
            document.addEventListener("keyup", listener, false);
        }

        removeShortcut() {
            if(listener) {
                document.addEventListener("keyup", listener, false);
                listener = null;
            }
        }

        // TODO can peerCount (in the callback) really be undefined?
        checkForUsersOnChannel(address: string, callback: (peerCount?: number) => void) {
            if(address.search(/^https?:/i) === 0) {
                address = address.replace(/^http/i, 'ws');
            }
            const socket = new WebSocket(address);
            let gotAnswer = false;
            socket.onmessage = function(event) {
                const msg = JSON.parse(event.data) as TogetherJSNS.Message;
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
        }

        // TODO put the function here maybe? So far it's too integrated with the form.js logic to be possible
        public addTracker: undefined | ((TrackerClass: TogetherJSNS.TrackerClass, skipSetInit: boolean) => void);
    }

    function baseUrl1Inner() {
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

    let baseUrl = baseUrl1Inner();

    function addStyle() {
        const existing = document.getElementById("togetherjs-stylesheet");
        if(!existing) {
            const link = document.createElement("link");
            link.id = "togetherjs-stylesheet";
            link.setAttribute("rel", "stylesheet");
            link.href = baseUrl + styleSheet +
                (cacheBust ? ("?bust=" + cacheBust) : '');
            document.head.appendChild(link);
        }
    }

    function addScriptInner(url: string) {
        const script = document.createElement("script");
        script.src = baseUrl + url + (cacheBust ? ("?bust=" + cacheBust) : '');
        document.head.appendChild(script);
    }

    defaultConfiguration.baseUrl = baseUrl;

    const baseUrlOverrideString = localStorage.getItem("togetherjs.baseUrlOverride");
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
            const logger = console.warn || console.log;
            logger.call(console, "Using TogetherJS baseUrlOverride:", baseUrl);
            logger.call(console, "To undo run: localStorage.removeItem('togetherjs.baseUrlOverride')");
        }
    }

    function copyConfigInWindow(configOverride: TogetherJSNS.WithExpiration<TogetherJSNS.Config> | null) {
        const shownAny = false;
        for(const _attr in configOverride) {
            const attr = _attr as keyof typeof configOverride;
            if(!Object.prototype.hasOwnProperty.call(configOverride, attr)) {
                continue;
            }
            if(attr == "expiresAt" || !Object.prototype.hasOwnProperty.call(configOverride, attr)) {
                continue;
            }
            if(!shownAny) {
                console.warn("Using TogetherJS configOverride");
                console.warn("To undo run: localStorage.removeItem('togetherjs.configOverride')");
            }
            const k = `TogetherJSConfig_${attr}` as const;
            (window as unknown as TogetherJSNS.TogetherJsConfigForWindow)[k] = configOverride[attr] as any; // TODO any
            console.log("Config override:", attr, "=", configOverride[attr]);
        }
    }

    const configOverrideString = localStorage.getItem("togetherjs.configOverride");
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

    if(!baseUrl) {
        const scripts = document.getElementsByTagName("script");
        for(let i = 0; i < scripts.length; i++) {
            const src = scripts[i].src;
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

    const tjsInstance = new TogetherJSClass();

    window["TogetherJS"] = tjsInstance;

    tjsInstance.requireConfig = {
        context: "togetherjs",
        baseUrl: baseUrl,
        urlArgs: "bust=" + cacheBust,
        paths: {
            jquery: "libs/jquery-1.11.1.min",
            "jquery-private": "libs/jquery-private",
            walkabout: "libs/walkabout/walkabout",
            esprima: "libs/walkabout/lib/esprima",
            falafel: "libs/walkabout/lib/falafel",
            whrandom: "libs/whrandom/random"
        },
        map: {
            '*': { 'jquery': 'jquery-private' },
            'jquery-private': { 'jquery': 'jquery' }
        }
    };

    let defaultHubBase = "__hubUrl__";
    if(defaultHubBase == "__" + "hubUrl" + "__") {
        // Substitution wasn't made
        defaultHubBase = "https://ks3371053.kimsufi.com:7071";
    }
    defaultConfiguration.hubBase = defaultHubBase;

    // FIXME: there's a point at which configuration can't be updated (e.g., hubBase after the TogetherJS has loaded).  We should keep track of these and signal an error if someone attempts to reconfigure too late


    tjsInstance._defaultConfiguration = defaultConfiguration;

    /* TogetherJS.config(configurationObject)
       or: TogetherJS.config(configName, value)
  
       Adds configuration to TogetherJS.  You may also set the global variable TogetherJSConfig
       and when TogetherJS is started that configuration will be loaded.
  
       Unknown configuration values will lead to console error messages.
       */

    //Config !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


    // This should contain the output of "git describe --always --dirty"
    // FIXME: substitute this on the server (and update make-static-client)
    tjsInstance.version = version;
    tjsInstance.baseUrl = baseUrl;

    tjsInstance.config.track("enableShortcut", function(enable: boolean, previous: unknown) {
        if(enable) {
            tjsInstance.listenForShortcut();
        }
        else if(previous) {
            tjsInstance.removeShortcut();
        }
    });

    // It's nice to replace this early, before the load event fires, so we conflict
    // as little as possible with the app we are embedded in:
    const hash = location.hash.replace(/^#/, "");
    const m = /&?togetherjs=([^&]*)/.exec(hash);
    if(m) {
        tjsInstance.startup._joinShareId = m[1];
        tjsInstance.startup.reason = "joined";
        const newHash = hash.substr(0, m.index) + hash.substr(m.index + m[0].length);
        location.hash = newHash;
    }
    if(window._TogetherJSShareId) {
        // A weird hack for something the addon does, to force a shareId.
        // FIXME: probably should remove, it's a wonky feature.
        tjsInstance.startup._joinShareId = window._TogetherJSShareId;
        delete window._TogetherJSShareId;
    }

    function conditionalActivate() {
        if(window.TogetherJSConfig_noAutoStart) {
            return;
        }
        // A page can define this function to defer TogetherJS from starting
        let callToStart = window.TogetherJSConfig_callToStart;
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
        if(tjsInstance.startup._joinShareId) {
            TogetherJS.start();
        }
        else if(window._TogetherJSBookmarklet) {
            delete window._TogetherJSBookmarklet;
            TogetherJS.start();
        }
        else {
            // FIXME: this doesn't respect storagePrefix:
            const key = "togetherjs-session.status";
            const valueString = sessionStorage.getItem(key);
            if(valueString) {
                const value = JSON.parse(valueString) as TogetherJSNS.TogetherJS;
                if(value && value.running) {
                    tjsInstance.startup.continued = true;
                    tjsInstance.startup.reason = value.startupReason;
                    TogetherJS.start();
                }
            }
            else if(window.TogetherJSConfig_autoStart ||
                (window.TogetherJSConfig && window.TogetherJSConfig.autoStart)) {
                tjsInstance.startup.reason = "joined";
                TogetherJS.start();
            }
        }
    }

    conditionalActivate();

    // FIXME: wait until load event to double check if this gets set?
    if(window.TogetherJSConfig_enableShortcut) {
        tjsInstance.listenForShortcut();
    }

    // For compatibility:
    return tjsInstance;
}
