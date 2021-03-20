declare namespace TogetherJSNS {

    /** Types for Templating.sub */
    namespace TemplatingSub {
        interface Map {
            "swatch": Swatch,
            "walkthrough-slide-progress": WalkthroughSlideProgress,
            "focus": Focus,
            "dock-person": DockPerson,
            "participant-window": ParticipantWindow,
            "invite-user-item": InviteUserItem,
            "chat-message": ChatMessage,
            "chat-joined": ChatJoined,
            "chat-left": ChatLeft,
            "chat-system": ChatSystem,
            "url-change": UrlChange,
            "invite": Invite,
        }

        /** "swatch" */
        type Swatch = {};

        /** "walkthrough-slide-progress" */
        type WalkthroughSlideProgress = {};
        
        /** "focus" */
        interface Focus {
            peer: TogetherJSNS.PeerClass
        }

        /** "dock-person" */
        interface DockPerson {
            peer: TogetherJSNS.PeerClass
        }

        /** "participant-window" */
        interface ParticipantWindow {
            peer: TogetherJSNS.PeerClass
        }

        /** "invite-user-item" */
        interface InviteUserItem {
            peer: TogetherJSNS.PeerClass
        }

        /** "chat-message" */
        interface ChatMessage {
            peer: TogetherJSNS.PeerClass,
            content: string,
            date: number
        }

        /** "chat-joined" */
        interface ChatJoined {
            peer: TogetherJSNS.PeerClass,
            date: number
        }

        /** "chat-left" */
        interface ChatLeft {
            peer: TogetherJSNS.PeerClass,
            date: number,
            declinedJoin
        }

        /** "chat-system" */
        interface ChatSystem {
            content: string,
            date: number
        }

        /** "url-change" */
        interface UrlChange {
            peer: TogetherJSNS.PeerClass,
            date: number,
            href: string,
            title: string,
            sameUrl: boolean
        }

        /** "invite" */
        interface Invite {
            peer: TogetherJSNS.PeerClass,
            date: number,
            href: string,
            hrefTitle: string,
            forEveryone
        }
    }

    namespace SessionSend {
        interface Map {
            "chat": Chat,
            "get-logs": GetLogs,
            "cursor-click": CursorClick,
            "keydown": Keydown,
            "form-focus": ForFocus,
            "ping-back": PingBack,
            "peer-update": PeerUpdate,
            "video-something": VideoEventName,
            "rtc-ice-candidate": RTCIceCandidate,
            "rtc-offer": RTCOffer,
            "rtc-answer": RTCAnswer,
            "rtc-abort": RTCAbort,
            "playerStateChange": PlayerStateChange,
            "synchronizeVideosOfLateGuest": SynchronizeVideosOfLateGuest,
        }

        interface Chat {
            type: "chat",
            text: string,
            messageId: string
        }

        interface GetLogs {
            type: "get-logs",
            forClient: string,
            saveAs: string
        }

        interface CursorClick {
            type: "cursor-click",
            element: string,
            offsetX: number,
            offsetY: number
        }

        interface Keydown {
            type: "keydown"
        }
        
        interface ForFocus {
            type: "form-focus",
            element: string | null
        }

        interface PingBack {
            type: "ping-back"
        }
        
        interface PeerUpdate {
            type: "peer-update"
        }
        
        interface VideoEventName {
            type: "video-something", // TODO string lit
            location: string,
            position: number
        }

        interface RTCIceCandidate {
            type: "rtc-ice-candidate",
            candidate: {
                sdpMLineIndex: number,
                sdpMid: number,
                candidate: string
            }
        }

        interface RTCOffer {
            type: "rtc-offer",
            offer: string
        }

        interface RTCAnswer {
            type: "rtc-answer",
            answer: string
        }

        interface RTCAbort {
            type: "rtc-abort"
        }

        interface PlayerStateChange {
            type: "playerStateChange",
            element: string,
            playerState: 1 | 2,
            playerTime: number
        }

        interface SynchronizeVideosOfLateGuest {
            type: "synchronizeVideosOfLateGuest",
            element: string,
            videoId: string,
            playerState: 1 | 2, //this might be necessary later
            playerTime: number
        }
    }

    namespace ChannelSend {
        interface WithClientId {
            clientId: string;
        }

        interface Map {
            "route": Route,
            "who": Who,
            "invite": Invite,
        }

        interface Route {
            type: "route",
            routeId: string,
            message
        }
        interface Who {
            type: "who",
            "server-echo": boolean,
            clientId: null
        }
        interface Invite {
            type: "invite",
            inviteId: string,
            url: string,
            userInfo,
            forClientId: string,
            clientId: null,
            "server-echo": boolean
        }
    }

    type Channels = ReturnType<typeof channelsMain>;
    type Storage = ReturnType<typeof StorageMain>;
    type Session = ReturnType<typeof sessionMain>;
    type Templates = ReturnType<typeof templatesMain>;
    type Peers = ReturnType<typeof peersMain>;
    type Windowing = ReturnType<typeof windowingMain>;
    type Templating = ReturnType<typeof templatingMain>;
    type Ot = ReturnType<typeof otMain>;
    type Linkify = ReturnType<typeof linkifyMain>;
    type VisibilityApi = ReturnType<typeof visibilityApiMain>;
    type Playback = ReturnType<typeof playbackMain>;
    type Chat = ReturnType<typeof chatMain>;
    type Ui = ReturnType<typeof uiMain>;
    type Who = ReturnType<typeof whoMain>;
    type Console = ReturnType<typeof consoleMain>;
    type TogetherJSClass = ReturnType<typeof togetherjsMain>;
    type On = OnClass;
    type WebSocketChannel = ReturnType<Channels["WebSocketChannel"]>;
    type Walkabout = unknown;
    
    type ExternalPeer = Who["ExternalPeerExport"];
    type PeerClass = Peers["PeerClassExport"];
    

    type ValueOf<T> = T[keyof T];

    type FunctionReturningString = () => string;
    type CssSelector = string;
    type Messages = "cursor-update" | "keydown" | "scroll-update" | "hello" | "hello-back" | "peer-update" | "url-change-nudge" | "idle-status" | "form-focus" | "rtc-ice-candidate" | "init-connection";
    type JQuerySelector = ":password";
    type Reason = "started" | "joined";

    interface TogetherJS extends OnClass, ConfigGetter2 {
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
        _configTrackers: Partial<{[key in keyof TogetherJSNS.Config]: unknown[]}>;
        _configClosed: {[P in keyof TogetherJSNS.Config]?: boolean};
        version: string;
        baseUrl: string;
        _onmessage(msg: TogetherJSNS.Message): void;
        send(msg: TogetherJSNS.Message): void;
        shareUrl(): string | null;
        listenForShortcut(): void;
        removeShortcut(): void;
        checkForUsersOnChannel(address: string, callback: (a?: unknown) => void): void;
        startupReason: Reason;
        $: JQueryStatic;
        addTracker(TrackerClass: Tracker, skipSetInit: boolean): void;
        startTarget: HTMLElement;
    }

    interface KeyboardListener {
        (event: KeyboardEvent): void;
        pressed?: boolean;
    }

    interface Hub extends OnClass { }

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
        ignoreMessages: keyof TogetherJSNS.SessionSend.Map[] | true,
        /** Ignores the following forms (will ignore all forms if set to true) */
        ignoreForms: JQuerySelector[] | true,
        /** When undefined, attempts to use the browser's language */
        lang?: string | null,
        fallbackLang: string,
        baseUrl?: string,
        loaded?: boolean,
        callToStart?: CallToStart,
        pasteSite?: string,
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

    type PeerStatus = "live" | "active" | "inactive" | "bye";

    interface Peer {
        id: string;
        status: PeerStatus;
    }

    // TODO there seems to be many types of messages, there may be one for every event like form-update
    interface Message {
        sameUrl: boolean;
        clientId: string;
        peer: Peer;
        type: TogetherJSNS.Messages;
        url: string;
        to: string;
        peerCount?;
    }

    interface FormFocusMessage {
        sameUrl: boolean | undefined;
        type: "form-focus";
        peer: Peer;
        element;
    }

    interface FormInitMessage {
        sameUrl: boolean | undefined;
        type: "form-init";
        pageAge: number;
        updates: {
            element;
            tracker;
            value;
            basis;
        }[]
    }

    interface FormUpdateMessage {
        sameUrl: boolean | undefined;
        type: "form-update";
        /** a selector */
        element: string;
        "server-echo": boolean;
        tracker?;
        replace: {
            id;
            basis;
            delta: TextReplace;
        }
    }

    interface MessageToSend {
        type: TogetherJSNS.Messages;
        url?: string;
        to?: string;
        clientId?: string;
        idle?: PeerStatus;
        location?: string;
        position?: number;
    }

    interface CallbackForOn<T> {
        (msg: T): void;
    }

    interface CallbackForOnce<T> extends CallbackForOn<T> {
        [name: string]: CallbackForOnce<T>; // TODO weird field for once callbacks
    }

    interface Ons<T> {
        [key: string]: CallbackForOn<T>;
    }

    interface On_2 {
        on<T>(eventName: string, cb: CallbackForOn<T>): void;
        once<T>(eventName: string, cb: CallbackForOnce<T>): void;
        off<T>(eventName: string, cb: CallbackForOnce<T>): void;
        removeListener<T>(eventName: string, cb: CallbackForOn<T>): void;
        emit(eventName: string, msg?: unknown): void;
        _knownEvents?: string[];
        _listeners: {[name: string]: CallbackForOnce<any>[]}; // TODO any
        _listenerOffs?: [string, CallbackForOnce<any>][];
    }

    interface ConfigFunObj extends ConfigGetter {
        //(config: Config): void;
        <K extends keyof Config, V extends Config[K]>(attributeName: K, attributeValue: V): void;
        (configOrAttributeName: Config | string, attributeValue?: keyof Config): void;
        //get<T>(thing: "on"): Ons<T>;
        //get<T>(thing: "hub_on"): Ons<T>;
        //get(thing: "useMinimizedCode"): true | undefined;
        //get(thing: "fallbackLang"): string;
        close<K extends keyof TogetherJSNS.Config>(thing: K): Partial<TogetherJSNS.Config>[K]; // TODO is the return type it boolean?
        track<K extends keyof TogetherJSNS.Config>(name: K, callback: (value: TogetherJSNS.Config[K], previous?: TogetherJSNS.Config[K]) => any): void;
    }

    interface ConfigGetter {
        get<K extends keyof TogetherJSNS.Config>(name: K): Partial<TogetherJSNS.Config>[K];
        /*
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
        */
    }

    interface ConfigGetter2 {
        getConfig(name: keyof Config): ValueOf<Config>;
        /*
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
        */
    }

    interface Require2 {
        (module: "session"): Session;
    }

    interface CodeMirrorElement {
        CodeMirror;
    }

    interface AceEditorElement {
        env;
    }

    interface CKEditor {
        dom : {
            element;
        }
    }

    interface Tinymce {

    }
}

declare namespace TogetherJSNS.Util {
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

declare namespace TogetherJSNS.ElementFinder {
    interface Position {
        location: string,
        offset: number,
        absoluteTop: number,
        documentHeight: number
    }
}

interface Window {
    TogetherJSConfig: TogetherJSNS.Config;
    TogetherJSConfig_baseUrl?: string;
    TogetherJS: TogetherJSNS.TogetherJS;
    TowTruckConfig?: TogetherJSNS.Config;
    TogetherJSConfig_noAutoStart?: boolean;
    TogetherJSConfig_callToStart?: TogetherJSNS.CallToStart;
    TowTruckConfig_callToStart?: TogetherJSNS.CallToStart;
    _TogetherJSBookmarklet: unknown;
    //require?: RequireConfig;
    _TogetherJSShareId: unknown;
    TogetherJSConfig_autoStart?: boolean;
    TogetherJSConfig_enableShortcut?: boolean;
    TowTruck: TogetherJSNS.TogetherJS;
    TogetherJSTestSpy?: {[k: string]: unknown};
    _gaq?: [string, string?][];
    onYouTubeIframeAPIReady?: unknown;
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

declare var TogetherJS: TogetherJSNS.TogetherJS;



// RTC Patches
interface Window {
    /** @deprecated */
    mozRTCPeerConnection?: typeof RTCPeerConnection;
    /** @deprecated */
    mozRTCSessionDescription?: typeof RTCSessionDescription;
    /** @deprecated */
    webkitRTCSessionDescription?: typeof RTCSessionDescription;
    /** @deprecated */
    mozRTCIceCandidate?: typeof RTCIceCandidate;
    /** @deprecated */
    webkitRTCIceCandidate?: typeof RTCIceCandidate;
}

interface Navigator {
    /** @deprecated */
    mozGetUserMedia?: Navigator["getUserMedia"];
    /** @deprecated */
    webkitGetUserMedia?: Navigator["getUserMedia"];
    /** @deprecated */
    msGetUserMedia?: Navigator["getUserMedia"];
}

interface RTCPeerConnection {
    /** @deprecated */
    onaddstream: (event: MediaStreamEvent) => void;
    /** @deprecated */
    onstatechange: () => void;
    /** @deprecated */
    addStream(stream: MediaStream): void;
    /** @deprecated */
    addIceCandidate(iceCandidate: RTCIceCandidate): void;
}

interface HTMLMediaElement {
    /** @deprecated */
    mozSrcObject: string;
}