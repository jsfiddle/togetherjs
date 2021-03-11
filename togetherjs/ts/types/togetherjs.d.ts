declare namespace TogetherJS {

    type ValueOf<T> = T[keyof T];

    type FunctionReturningString = () => string;
    type CssSelector = string;
    type Messages = "cursor-update" | "keydown" | "scroll-update";
    type JQuerySelector = ":password";
    type Reason = "started" | "joined";

    interface TogetherJS extends On, ConfigGetter2 {
        (event?: Event): TogetherJS;
        running: boolean;
        require: Require;
        startup: Startup;
        config: ConfigFunObj;
        hub: Hub;
        requireConfig: RequireConfig;
        _loaded: boolean;
        _extend(conf: RequireConfig): RequireConfig;
        _extend(base: unknown, extensions: unknown): unknown;
        //getConfig(key: keyof Config): ValueOf<Config>;
        _requireObject: Require;
        /** Timestamp */
        pageLoaded: number;
        _startupInit: StartupInit;
        _mixinEvents(some: unknown): Hub,
        _teardown: unknown,
        _configuration: Partial<Config>,
        _defaultConfiguration: Config,
        _configTrackers: Config;
        _configClosed: Partial<Config>;
        version: string;
        baseUrl: string;
        _onmessage(msg: TogetherJS.Message): void;
        send(msg: TogetherJS.Message): void;
        shareUrl(): string | null;
        listenForShortcut(): void;
        removeShortcut(): void;
        checkForUsersOnChannel(address: string, callback: (a?: unknown) => void): void;
        startupReason: Reason;
        $: JQueryStatic;
    }

    interface KeyboardListener {
        (event: KeyboardListener): void;
        pressed: boolean;
    }

    interface Hub extends On { }

    interface StartupInit {
        /** What element, if any, was used to start the session */
        button: null,
        /** The startReason is the reason TogetherJS was started.  One of:
            null: not started
            started: hit the start button (first page view)
            joined: joined the session (first page view) */
        reason: null,
        /** Also, the session may have started on "this" page, or maybe is continued from a past page.  TogetherJS.continued indicates the difference (false the first time TogetherJS is started or joined, true on later page loads). */
        continued: false,
        /** This is set to tell the session what shareId to use, if the boot code knows (mostly because the URL indicates the id). */
        _joinShareId: null,
        /** This tells session to start up immediately (otherwise it would wait for session.start() to be run) */
        _launch: false
    }

    interface Config {
        /** Disables clicks for a certain element. (e.g., 'canvas' would not show clicks on canvas elements.) Setting this to true will disable clicks globally. */
        dontShowClicks: boolean | CssSelector,
        /** Experimental feature to echo clicks to certain elements across clients */
        cloneClicks: boolean | CssSelector,
        /** Enable Mozilla or Google analytics on the page when TogetherJS is activated: FIXME: these don't seem to be working, and probably should be removed in favor of the hub analytics */
        enableAnalytics: boolean,
        /** The code to enable (this is defaulting to a Mozilla code) */
        analyticsCode: string,
        /** The base URL of the hub (gets filled in below) */
        hubBase: string | null,
        /** A function that will return the name of the user */
        getUserName: FunctionReturningString | null,
        /** A function that will return the color of the user */
        getUserColor: FunctionReturningString | null,
        /** A function that will return the avatar of the user */
        getUserAvatar: FunctionReturningString | null,
        /** The siteName is used in the walkthrough (defaults to document.title): */
        siteName: string | null,
        /** Whether to use the minimized version of the code (overriding the built setting) */
        useMinimizedCode: undefined,
        /** Append cache-busting queries (useful for development!) */
        cacheBust: boolean,
        /** Any events to bind to */
        on: {},
        /** Hub events to bind to */
        hub_on: {[name: string]: CallbackForOn<unknown>},
        /** Enables the alt-T alt-T TogetherJS shortcut; however, this setting must be enabled early as TogetherJSConfig_enableShortcut = true; */
        enableShortcut: boolean,
        /** The name of this tool as provided to users.  The UI is updated to use this. Because of how it is used in text it should be a proper noun, e.g., "MySite's Collaboration Tool" */
        toolName: string | null,
        /** Used to auto-start TogetherJS with a {prefix: pageName, max: participants} Also with findRoom: "roomName" it will connect to the given room name */
        findRoom: null,
        /** If true, starts TogetherJS automatically (of course!) */
        autoStart: boolean,
        /** If true, then the "Join TogetherJS Session?" confirmation dialog won't come up */
        suppressJoinConfirmation: boolean,
        /** If true, then the "Invite a friend" window won't automatically come up */
        suppressInvite: boolean,
        /** A room in which to find people to invite to this session */
        inviteFromRoom: null,
        /** This is used to keep sessions from crossing over on the same domain, if for some reason you want sessions that are limited to only a portion of the domain */
        storagePrefix: string,
        /** When true, we treat the entire URL, including the hash, as the identifier of the page; i.e., if you one person is on `http://example.com/#view1` and another person is at `http://example.com/#view2` then these two people are considered to be at completely different URLs */
        includeHashInUrl: boolean,
        /** When true, the WebRTC-based mic/chat will be disabled */
        disableWebRTC: boolean,
        /** When true, youTube videos will synchronize */
        youtube: boolean,
        /** Ignores the following console messages, disables all messages if set to true */
        ignoreMessages: Messages[],
        /** Ignores the following forms (will ignore all forms if set to true) */
        ignoreForms: JQuerySelector[],
        /** When undefined, attempts to use the browser's language */
        lang?: string | null,
        fallbackLang: string,
        baseUrl?: string,
        loaded?: boolean,
        callToStart?: CallToStart,
    }

    type CallToStart = (cb: () => void) => void;

    interface BaseUrlOverride {
        expiresAt: number,
        baseUrl: string
    }

    type WithExpiration<T> = T & Expiration;

    interface Expiration {
        expiresAt: number,
    }

    interface Startup {
        button: HTMLElement | null;
        reason: Reason;
        _launch: boolean;
        _joinShareId: unknown;
        continued: boolean;
    }

    interface Peer {
        id: string;
        status: "live";
    }

    interface Message {
        sameUrl: boolean;
        clientId: string;
        peer: Peer;
        type: string;
    }

    interface CallbackForOn<T> {
        (msg: Message & T): void;
        //[name: string]: CallbackForOn<T>; // TODO weird field for once callbacks
    }

    interface Ons<T> {
        [key: string]: CallbackForOn<T>;
    }

    interface On {
        on<T>(eventName: string, cb: CallbackForOn<T>): void;
        once<T>(eventName: string, cb: CallbackForOn<T>): void;
        off<T>(eventName: string, cb: CallbackForOn<T>): void;
        removeListener<T>(eventName: string, cb: CallbackForOn<T>): void;
        emit(eventName: string, msg?: unknown): void;
        _knownEvents?: string[];
        _listeners: {[name: string]: CallbackForOn<any>[]}; // TODO any
        _listenerOffs?: [string, CallbackForOn<any>][];
    }

    interface ConfigFunObj extends ConfigGetter {
        (config: TogetherJS.Config): void;
        (attributeName: string, attributeValue: unknown): void;
        (configOrAttributeName: TogetherJS.Config | string, attributeValue?: unknown): void;
        //get<T>(thing: "on"): Ons<T>;
        //get<T>(thing: "hub_on"): Ons<T>;
        //get(thing: "useMinimizedCode"): true | undefined;
        //get(thing: "fallbackLang"): string;
        close(thing: 'cacheBust'): boolean;
        close(thing: "useMinimizedCode"): void;
        track(name: string, f: Function): void;
    }

    interface ConfigGetter {
        get(name: keyof Config): ValueOf<Config>;
        get(name: "dontShowClicks"): Config["dontShowClicks"],
        get(name: "cloneClicks"): Config["cloneClicks"],
        get(name: "enableAnalytics"): Config["enableAnalytics"],
        get(name: "analyticsCode"): Config["analyticsCode"],
        get(name: "hubBase"): Config["hubBase"],
        get(name: "getUserName"): Config["getUserName"],
        get(name: "getUserColor"): Config["getUserColor"],
        get(name: "getUserAvatar"): Config["getUserAvatar"],
        get(name: "siteName"): Config["siteName"],
        get(name: "useMinimizedCode"): Config["useMinimizedCode"],
        get(name: "cacheBust"): Config["cacheBust"],
        get(name: "on"): Config["on"],
        get(name: "hub_on"): Config["hub_on"],
        get(name: "enableShortcut"): Config["enableShortcut"],
        get(name: "toolName"): Config["toolName"],
        get(name: "findRoom"): Config["findRoom"],
        get(name: "autoStart"): Config["autoStart"],
        get(name: "suppressJoinConfirmation"): Config["suppressJoinConfirmation"],
        get(name: "suppressInvite"): Config["suppressInvite"],
        get(name: "inviteFromRoom"): Config["inviteFromRoom"],
        get(name: "storagePrefix"): Config["storagePrefix"],
        get(name: "includeHashInUrl"): Config["includeHashInUrl"],
        get(name: "disableWebRTC"): Config["disableWebRTC"],
        get(name: "youtube"): Config["youtube"],
        get(name: "ignoreMessages"): Config["ignoreMessages"],
        get(name: "ignoreForms"): Config["ignoreForms"],
        get(name: "lang"): Config["lang"],
        get(name: "fallbackLang"): Config["fallbackLang"],
        get(name: "baseUrl"): Config["baseUrl"],
        get(name: "loaded"): Config["loaded"],
        get(name: "callToStart"): Config["callToStart"],
    }

    interface ConfigGetter2 {
        getConfig(name: keyof Config): ValueOf<Config>;
        getConfig(name: "dontShowClicks"): Config["dontShowClicks"],
        getConfig(name: "cloneClicks"): Config["cloneClicks"],
        getConfig(name: "enableAnalytics"): Config["enableAnalytics"],
        getConfig(name: "analyticsCode"): Config["analyticsCode"],
        getConfig(name: "hubBase"): Config["hubBase"],
        getConfig(name: "getUserName"): Config["getUserName"],
        getConfig(name: "getUserColor"): Config["getUserColor"],
        getConfig(name: "getUserAvatar"): Config["getUserAvatar"],
        getConfig(name: "siteName"): Config["siteName"],
        getConfig(name: "useMinimizedCode"): Config["useMinimizedCode"],
        getConfig(name: "cacheBust"): Config["cacheBust"],
        getConfig(name: "on"): Config["on"],
        getConfig(name: "hub_on"): Config["hub_on"],
        getConfig(name: "enableShortcut"): Config["enableShortcut"],
        getConfig(name: "toolName"): Config["toolName"],
        getConfig(name: "findRoom"): Config["findRoom"],
        getConfig(name: "autoStart"): Config["autoStart"],
        getConfig(name: "suppressJoinConfirmation"): Config["suppressJoinConfirmation"],
        getConfig(name: "suppressInvite"): Config["suppressInvite"],
        getConfig(name: "inviteFromRoom"): Config["inviteFromRoom"],
        getConfig(name: "storagePrefix"): Config["storagePrefix"],
        getConfig(name: "includeHashInUrl"): Config["includeHashInUrl"],
        getConfig(name: "disableWebRTC"): Config["disableWebRTC"],
        getConfig(name: "youtube"): Config["youtube"],
        getConfig(name: "ignoreMessages"): Config["ignoreMessages"],
        getConfig(name: "ignoreForms"): Config["ignoreForms"],
        getConfig(name: "lang"): Config["lang"],
        getConfig(name: "fallbackLang"): Config["fallbackLang"],
        getConfig(name: "baseUrl"): Config["baseUrl"],
        getConfig(name: "loaded"): Config["loaded"],
        getConfig(name: "callToStart"): Config["callToStart"],
    }

    interface Require2 {
        (module: "session"): Session;
    }

    interface Session {
        start(): void;
        close(): void;
    }
}

declare namespace TogetherJS.Util {
    type Prototype = Methods;

    interface WithMethods {
        classMethods?: {[methodName: string]: (...args: any[]) => any}
    }

    interface WithPrototype {
        prototype: Prototype;
    }

    interface CustomClass {
        className: string;
    }

    type ClassObject = object & WithPrototype & CustomClass & Methods;

    
    interface Methods {
        //constructor: (...args: any[]) => any,
        //[methodName: string]: (...args: any[]) => any,
    }
}

declare namespace TogetherJS.ElementFinder {
    interface Position {
        location: string,
        offset: number,
        absoluteTop: number,
        documentHeight: number
    }
}

interface Window {
    TogetherJSConfig: TogetherJS.Config;
    TogetherJSConfig_baseUrl?: string;
    TogetherJS: TogetherJS.TogetherJS;
    TowTruckConfig?: TogetherJS.Config;
    TogetherJSConfig_noAutoStart?: boolean;
    TogetherJSConfig_callToStart?: TogetherJS.CallToStart;
    TowTruckConfig_callToStart?: TogetherJS.CallToStart;
    _TogetherJSBookmarklet: unknown;
    //require?: RequireConfig;
    _TogetherJSShareId: unknown;
    TogetherJSConfig_autoStart?: boolean;
    TogetherJSConfig_enableShortcut?: boolean;
    TowTruck: TogetherJS.TogetherJS;
    TogetherJSTestSpy?: {[k: string]: unknown};
}

interface EventHtmlElement extends Event {
    target: HTMLElement | null;
}

// Only in ES6 apparently
interface Function {
    name: string;
}

// TODO type this object
//declare var TogetherJSTestSpy: {[k: string]: unknown} | undefined;