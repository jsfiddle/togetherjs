declare namespace TogetherJSNS {
    /** Types for storage.get */
    namespace StorageGet {
        interface MapRaw {
            "status": { reason: Reason, shareId: string, sessionId: string, running: boolean, date: number },
            "identityId": string,
            "baseUrlOverride": BaseUrlOverride,
            "configOverride": WithExpiration<Record<string, unknown>>, // TODO unknown
            "chatlog": ChatLogs,
            "peerCache": { peers: SerializedPeer[] },
            "playback.logs": LogItem[],
            "playback.pos": number,
            "startTarget": string,
        }

        type MapForSettings = {
            [P in keyof Settings & string as `settings.${P}`]: Settings[P]
        }

        type RecordingKey = `recording.${string}`;
        type OtherKey = `other.${string}`;
        type StorageKey = keyof MapRaw | keyof MapForSettings | RecordingKey | OtherKey;

        type StorageValue<K extends string> =
              K extends RecordingKey ? string
            : K extends OtherKey     ? never // this line is just to show how to extends this type
            : K extends keyof MapForSettings ? MapForSettings[K]
            : K extends keyof MapRaw ? MapRaw[K] : never;

        //type Map = MapRaw & MapForSettings & MapForRecording;

        interface Settings {
            name: string,
            defaultName: string,
            avatar: string | null,
            stickyShare: null,
            color: string | null,
            seenIntroDialog: boolean,
            seenWalkthrough: boolean,
            dontShowRtcInfo: boolean
        }
    }

    /** Types for Templating.sub */
    namespace TemplatingSub {
        type Any = ValueOf<Map>;
        // TODO find a better way to do that base on Map
        type All = Swatch & WalkthroughSlideProgress & Focus & DockPerson & ParticipantWindow & InviteUserItem & ChatMessage & ChatJoined & ChatLeft & ChatSystem & UrlChange & Invite;

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
            peer: PeerClass
        }

        /** "dock-person" */
        interface DockPerson {
            peer: PeerClass
        }

        /** "participant-window" */
        interface ParticipantWindow {
            peer: PeerClass
        }

        /** "invite-user-item" */
        interface InviteUserItem {
            peer: PeerClass | ExternalPeer
        }

        /** "chat-message" */
        interface ChatMessage {
            peer: AnyPeer,
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
            declinedJoin: boolean
        }

        /** "chat-system" */
        interface ChatSystem {
            content: string,
            date: number
        }

        /** "url-change" */
        interface UrlChange {
            peer: PeerClass | PeerSelf,
            date?: number,
            href?: string,
            title?: string,
            sameUrl?: boolean
        }

        /** "invite" */
        interface Invite {
            peer: AnyPeer,
            date: number,
            href: string,
            hrefTitle: string,
            forEveryone: boolean,
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
            "video-something": VideoEventName, // TODO something can be any video event, try to list them with string lits
            "rtc-ice-candidate": RTCIceCandidate,
            "rtc-offer": RTCOffer,
            "rtc-answer": RTCAnswer,
            "rtc-abort": RTCAbort,
            "playerStateChange": PlayerStateChange,
            "synchronizeVideosOfLateGuest": SynchronizeVideosOfLateGuest,
            "url-change-nudge": { type: "url-change-nudge", url: string, to: string },
            "idle-status": { type: "idle-status", idle: TogetherJSNS.PeerStatus },
            "bye": { type: "bye", reason?: string },
            "hello": TogetherJSNS.On.HelloMessage,
            "hello-back": TogetherJSNS.On.HelloBackMessage,
            "cursor-update": On.CursorUpdate,
            "scroll-update": { type: "scroll-update", position: TogetherJSNS.ElementFinder.Position },
            "form-update": FormUpdateMessage,
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
            type: "peer-update",
            name?: string,
            avatar?: string,
            color?: string,
            //peer: PeerClass // TODO should be added after transit
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
                sdpMid: string,
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
            playerState: 1 | 2 | 5, //this might be necessary later
            playerTime: number
        }
    }

    namespace ChannelSend {
        interface WithClientId {
            clientId: string;
            peer: AnyPeer; // TODO check that peer always goes with clientId, according to code in session.ts/openChannel it seems to be the case
        }

        interface WithSameUrl {
            sameUrl: boolean;
        }

        /** Not a message, it's a field */
        interface UserInfo {
            name: string,
            avatar: string,
            color: string,
            url: string,
            urlHash: string | undefined,
            title: string | undefined,
            rtcSupported: boolean,
            isClient: boolean | undefined,
            starting: boolean | undefined,
            clientId: string,
        }

        type Any = Route | Who | Invite;

        interface Map {
            "route": Route,
            "who": Who,
            "invite": Invite,
            "bye": { type: "bye", clientId: string },
            "logs": { type: "logs", clientId: string, logs: string, request: TogetherJSNS.SessionSend.GetLogs },
            "hello": Hello,
            "hello-back": HelloBack,
        }

        interface Hello {
            type: "hello",
            name: string,
            avatar: string,
            color: string,
            rtcSupported: boolean,
            clientId: string,
            url: string
        }

        interface HelloBack {
            type: "hello-back",
            name: string,
            avatar: string,
            color: string,
            rtcSupported: boolean,
            clientId: string,
            url: string
        }

        interface Route {
            type: "route",
            routeId: string,
            message: AnyMessage.AnyForReceiving,
            close?: boolean
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
            forClientId: string,
            clientId: null,
            "server-echo": boolean,
            userInfo: UserInfo
        }
    }

    namespace ChannelOnMessage {
        interface Map {
            "hello": { type: "hello", peer: PeerClass };
            "hello-back": { type: "hello-back", clientId: string, peer: PeerClass };
            "get-logs": TogetherJSNS.SessionSend.GetLogs;
            "peer-update": SessionSend.PeerUpdate;
            "init-connection": { type: "init-connection", peerCount: number };
            "who": { type: "who" };
            "invite": { type: "invite" };
        }
    }

    namespace On {
        interface Map {
            // channel.on & session.on
            "close": () => void;
    
            // channel.on
            /** msg can be of type string if rawData is activated but we don't put it here */
            "message": (msg: ValueOf<AnyMessage.MapForReceiving>) => void;
    
            // session.hub.on
            "chat": (msg: { text: string, peer: PeerClass, messageId: string }) => void;
            "bye": (msg: { clientId: string, peer: PeerClass, reason: string }) => void;
            "logs": (msg: { request: { forClient: string | undefined /** id of the client or nothing if destined to everyone */, saveAs: string }, logs: string }) => void; // TODO parameter similar to GetLogs
            // TODO logs may be of type Logs[], we shoud check
            "cursor-update": (msg: On.CursorUpdate & ChannelSend.WithClientId) => void;
            "scroll-update": (msg: { peer: PeerClass, position: ElementFinder.Position }) => void;
            "cursor-click": (msg: SessionSend.CursorClick & ChannelSend.WithClientId & ChannelSend.WithSameUrl) => void;
            "keydown": (msg: { clientId: string }) => void;
            //"form-update": (msg: { sameUrl: boolean, element: string, tracker: string, replace: Change2, value?: string }) => void // TODO old version, trying below with FormUpdateMessage
            "form-update": (msg: FormUpdateMessage & AnyMessage.AfterTransit) => void
            "form-init": (msg: FormInitMessage & AnyMessage.AfterTransit) => void;
            "form-focus": (msg: { sameUrl: boolean, peer: PeerClass, element: string }) => void;
            "idle-status": (msg: AnyMessage.MapForReceiving["idle-status"]) => void;
            "ping": () => void;
            "who": () => void;
            "invite": (msg: { forClientId: boolean, clientId: string, userInfo: ExternalPeerAttributes, url: string }) => void;
            "url-change-nudge": (msg: { to: string, peer: PeerView }) => void;
            "playerStateChange": (msg: { element: string, playerState: 1 | 2, playerTime: number }) => void;
            "synchronizeVideosOfLateGuest": (msg: SessionSend.SynchronizeVideosOfLateGuest) => void;
            "differentVideoLoaded": (msg: { videoId: string, element: string }) => void;
            "rtc-offer": (msg: { offer: RTCSessionDescriptionInit }) => void;
            "rtc-answer": (msg: { answer: RTCSessionDescriptionInit }) => void;
            "rtc-ice-candidate": (msg: { candidate: RTCIceCandidateInit }) => void;
            "rtc-abort": (msg: unknown) => void; // TODO what is this unknown?
    
            // session.on
            "prepare-hello": (msg: HelloMessage | HelloBackMessage) => void;
            "ui-ready": (ui: Ui) => void;
            "reinitialize": () => void;
            "follow-peer": (peer: PeerClass) => void;
            "start": () => void;
            "refresh-user-data": () => void;
            "visibility-change": (hidden: boolean) => void;
            "hide-window": (window: JQuery[]) => void; // TODO check type of window
            "shareId": () => void;
            "display-window": (id: string, element: JQuery) => void
            "resize": () => void;
            "new-element": (element: JQuery) => void;
            "video-timeupdate": (msg: VideoTimeupdateMessage) => void;
            "video-something": (msg: VideoTimeupdateMessage) => void; // TODO something can be any video event, try to replace with string lit
    
            // peers.on
            "new-peer identity-updated status-updated": (peer: PeerClass) => void;
    
            // TogetherJS.once
            "ready": () => void;
    
            // .emit
            "new-peer": (peer: PeerClass) => void;
            "status-updated": (peer: PeerClass | PeerSelf) => void;
            "idle-updated": (peer: PeerClass | PeerSelf) => void;
            "rtc-supported": (peer: PeerClass) => void;
            "url-updated": (peer: PeerClass) => void;
            "identity-updated": (peer: PeerClass) => void;
            "self-updated": () => void;
            "startup-ready": () => void;
    
            // only for typecheck session.hub.emit(msg.type, msg); in session.ts
            "get-logs": (msg: { type: "get-logs" }) => void; // TODO may be wrong
            "ping-back": (msg: { type: "ping-back" }) => void; // TODO may be wrong
            "peer-update": (msg: SessionSend.PeerUpdate) => void; // TODO may be wrong
            "route": (msg: { type: "route" }) => void; // TODO may be wrong
            "init-connection": (msg: { type: "init-connection" }) => void; // TODO may be wrong
            
            // other
            "identityId": (msg: { type: "identityId", identityId: string }) => void, // TODO this a fictive message, peers.ts hints that a message more or less like this exists (with a identityId field) but I can't find it yet, this one is to fix "session.hub.emit(msg.type, msg);" in session.ts

            // hello
            // transit: sameUrl? peer? clientId?
            "hello": (msg: { type: "hello", sameUrl: boolean }) => void;
            "hello-back": (msg: { type: "hello-back" }) => void; // TODO may be wrong
            "hello-back hello": (msg: { type: "hello" | "hello-back", scrollPosition: ElementFinder.Position, sameUrl: boolean, peer: PeerClass }) => void;
            "hello hello-back": (msg: {type: "hello" | "hello-back", sameUrl: boolean, url: string, urlHash: string, peer: TogetherJSNS.AnyPeer, isClient: boolean}) => void;
        }

        /** Do not use this in your own code, it's just here to be inherited */
        interface HelloMessageBase {
            name: string,
            avatar: string,
            color: string,
            url: string,
            urlHash?: string, // TODO check that these optionals are correct
            title?: string,
            rtcSupported: boolean,
            isClient?: boolean,
            starting?: boolean,
            scrollPosition?: ElementFinder.Position,
        }

        interface HelloMessage extends HelloMessageBase {
            type: "hello";
            clientVersion?: string; // TODO check that this optional is correct
        }

        interface HelloBackMessage extends HelloMessageBase {
            type: "hello-back",
            identityId: string,
            status: PeerStatus, // TODO check if it's peer status or string
        }

        // TODO is this mergeable with CursorClick?
        // TODO clienId is always added by session.send
        interface CursorUpdateTopLeft {
            type: "cursor-update",
            sameUrl?: boolean,
            top: number,
            left: number
        }

        interface CursorUpdateOffset {
            type: "cursor-update",
            sameUrl?: boolean,
            offsetX: number,
            offsetY: number,
            element: string
        }

        type CursorUpdate = CursorUpdateOffset | CursorUpdateTopLeft;
    }

    namespace AnyMessage {
        type PartialWithType<T extends {type: keyof MapForSending}> = Partial<Exclude<T, "type">> & Pick<T, "type">;

        /** While a message in in the send process or in the receiving process some fields will be set, they can be undefined for a short time */
        interface InTransit {
            sameUrl?: boolean,
            peer?: PeerClass | PeerSelf,
            clientId?: string
        }

        /** After a message has been sent some field must have been set */
        type AfterTransit = {
            [P in keyof InTransit]-?: InTransit[P]
        }

        /** @deprecated */
        interface Map {
            // ChannelOnMessage
            "hello": { type: "hello", peer: PeerClass };
            "hello-back": { type: "hello-back", clientId: string, peer: PeerClass };
            "get-logs": TogetherJSNS.SessionSend.GetLogs;
            "peer-update": SessionSend.PeerUpdate;
            "init-connection": { type: "init-connection", peerCount: number };
            "who": { type: "who" };
            "invite": { type: "invite" };

            //ChannelSend
            "route": ChannelSend.Route,
            //"who": Who,
            //"invite": ChannelSend.Invite,
            "bye": { type: "bye", clientId: string },
            "logs": { type: "logs", clientId: string, logs: string, request: SessionSend.GetLogs },
            //"hello": ChannelSend.Hello,
            //"hello-back": ChannelSend.HelloBack,

            //SessionSend
            "chat": SessionSend.Chat,
            //"get-logs": SessionSend.GetLogs,
            "cursor-click": SessionSend.CursorClick,
            "keydown": SessionSend.Keydown,
            "form-focus": SessionSend.ForFocus,
            "ping-back": SessionSend.PingBack,
            //"peer-update": SessionSend.PeerUpdate,
            "video-something": SessionSend.VideoEventName, // TODO something can be any video event, try to list them with string lits
            "rtc-ice-candidate": SessionSend.RTCIceCandidate,
            "rtc-offer": SessionSend.RTCOffer,
            "rtc-answer": SessionSend.RTCAnswer,
            "rtc-abort": SessionSend.RTCAbort,
            "playerStateChange": SessionSend.PlayerStateChange,
            "synchronizeVideosOfLateGuest": SessionSend.SynchronizeVideosOfLateGuest,
            "url-change-nudge": { type: "url-change-nudge", url: string, to: string },
            "idle-status": { type: "idle-status", idle: PeerStatus },
            //"bye": { type: "bye", reason?: string },
            //"hello": On.HelloMessage,
            //"hello-back": On.HelloBackMessage,
            "cursor-update": On.CursorUpdate,
            "scroll-update": { type: "scroll-update", position: ElementFinder.Position },
            "form-update": FormUpdateMessage,
        }

        interface MapForSending {
            // ChannelOnMessage
            //"hello": { type: "hello", peer: PeerClass }; // old version
            "hello": TogetherJSNS.On.HelloMessage;
            //"hello-back": { type: "hello-back", peer: PeerClass };
            "hello-back": TogetherJSNS.On.HelloBackMessage;
            "get-logs": TogetherJSNS.SessionSend.GetLogs;
            "peer-update": SessionSend.PeerUpdate;
            "init-connection": { type: "init-connection", peerCount: number };
            "who": { type: "who", "server-echo": boolean };
            "invite": { type: "invite", inviteId: string, url: string, userInfo: ChannelSend.UserInfo, forClientId: string | null, "server-echo": boolean };

            //ChannelSend
            "route": ChannelSend.Route,
            //"who": Who,
            //"invite": ChannelSend.Invite,
            "bye": { type: "bye" },
            "logs": { type: "logs", logs: string, request: SessionSend.GetLogs },
            //"hello": ChannelSend.Hello,
            //"hello-back": ChannelSend.HelloBack,

            //SessionSend
            "chat": SessionSend.Chat,
            //"get-logs": SessionSend.GetLogs,
            "cursor-click": SessionSend.CursorClick,
            "keydown": SessionSend.Keydown,
            "form-focus": SessionSend.ForFocus,
            "ping-back": SessionSend.PingBack,
            //"peer-update": SessionSend.PeerUpdate,
            "video-something": SessionSend.VideoEventName, // TODO something can be any video event, try to list them with string lits
            "rtc-ice-candidate": SessionSend.RTCIceCandidate,
            "rtc-offer": SessionSend.RTCOffer,
            "rtc-answer": SessionSend.RTCAnswer,
            "rtc-abort": SessionSend.RTCAbort,
            "playerStateChange": SessionSend.PlayerStateChange,
            "synchronizeVideosOfLateGuest": SessionSend.SynchronizeVideosOfLateGuest,
            "url-change-nudge": { type: "url-change-nudge", url: string, to: string },
            "idle-status": { type: "idle-status", idle: PeerStatus, peer?: PeerClass },
            //"bye": { type: "bye", reason?: string },
            //"hello": On.HelloMessage,
            //"hello-back": On.HelloBackMessage,
            "cursor-update": On.CursorUpdate,
            "scroll-update": { type: "scroll-update", position: ElementFinder.Position },
            "form-update": FormUpdateMessage,

            // other
            "form-init": FormInitMessage,
            "differentVideoLoaded": { type: "differentVideoLoaded", videoId: string, element: string },
            "identityId": { type: "identityId", identityId: string }, // TODO this a fictive message, peers.ts hints that a message more or less like this exists (with a identityId field) but I can't find it yet
        }

        type MapInTransit = { [P in keyof MapForSending]: MapForSending[P] & InTransit }

        type MapForReceiving = { [P in keyof MapForSending]: MapForSending[P] & AfterTransit }

        type AnyForSending = ValueOf<MapForSending>;
        type AnyForTransit = ValueOf<MapForSending> & InTransit;
        type AnyForReceiving = ValueOf<MapForSending> & AfterTransit;
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
    type Walkabout = WalkaboutModule;
    type UtilAlias = Util;
    type PeerView = ReturnType<Ui["PeerView"]>;
    type PeerSelfView = ReturnType<Ui["PeerSelfView"]>;
    type Walkthrough = ReturnType<typeof walkthroughMain>;
    type Analytics = ReturnType<typeof analyticsMain>;
    type ExternalPeer = Who["ExternalPeerExport"];
    type PeerClass = Peers["PeerClassExport"];
    type Logs = Playback["LogsExport"];
    type PeerSelf = Peers["Self"];
    type TrackerClass = ReturnType<typeof formsMain>["trackerClassExport"];
    type TextReplace = ReturnType<typeof otMain>["TextReplaceExport"];
    type Randomizer = ReturnType<ReturnType<typeof randomutilMain>>;
    type SimpleHistory = ReturnType<typeof otMain>["SimpleHistoryExport"];
    type TogetherJS = ReturnType<typeof togetherjsMain>;

    type AnyPeer = PeerSelf | PeerClass | ExternalPeer | SerializedPeer;
    /** Those are often called an "hello message" in TJS even if it can be a peer-update */
    type HelloMessageLike = TogetherJSNS.ChannelOnMessage.Map["hello"] | TogetherJSNS.ChannelOnMessage.Map["hello-back"] | TogetherJSNS.SessionSend.PeerUpdate;

    interface TextReplaceStruct {
        start: number,
        del: number,
        text: string
    }

    type ValueOf<T> = T[keyof T];

    type FunctionReturningString = () => string;
    type CssSelector = string;
    type Messages = "cursor-update" | "keydown" | "scroll-update" | "hello" | "hello-back" | "peer-update" | "url-change-nudge" | "idle-status" | "form-focus" | "rtc-ice-candidate" | "init-connection" | "get-logs";
    type JQuerySelector = ":password";
    type Reason = "started" | "joined" | null;

    // TODO this should be removed in favor of TogetherJSClass
    interface TogetherJS2 extends OnClass {
        getConfig<K extends keyof TogetherJSNS.Config>(name: K): Partial<TogetherJSNS.Config>[K];
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
        _startupInit: Startup;
        _teardown: () => void,
        _configuration: Partial<Config>,
        _defaultConfiguration: Config,
        _configTrackers: Partial<{ [key in keyof TogetherJSNS.Config]: unknown[] }>;
        _configClosed: { [P in keyof TogetherJSNS.Config]?: boolean };
        version: string;
        baseUrl: string;
        _onmessage(msg: TogetherJSNS.AnyMessage.AnyForReceiving): void;
        send(msg: TogetherJSNS.Message): void;
        shareUrl(): string | null;
        listenForShortcut(): void;
        removeShortcut(): void;
        checkForUsersOnChannel(address: string, callback: (a?: unknown) => void): void;
        startupReason: Reason;
        $: JQueryStatic;
        addTracker(TrackerClass: TrackerClass, skipSetInit: boolean): void;
        startTarget: HTMLElement;
    }
    
    interface KeyboardListener {
        (event: KeyboardEvent): void;
        pressed?: boolean;
    }

    interface Hub extends OnClass { }

    interface Startup {
        button: HTMLElement | null;
        reason: Reason;
        _launch: boolean;
        _joinShareId: string | null;
        continued: boolean;
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
        hub_on: { [name: string]: CallbackForOn<unknown> },
        /** Enables the alt-T alt-T TogetherJS shortcut; however, this setting must be enabled early as TogetherJSConfig_enableShortcut = true; */
        enableShortcut: boolean,
        /** The name of this tool as provided to users.  The UI is updated to use this. Because of how it is used in text it should be a proper noun, e.g., "MySite's Collaboration Tool" */
        toolName: string | null,
        /** Used to auto-start TogetherJS with a {prefix: pageName, max: participants} Also with findRoom: "roomName" it will connect to the given room name */
        findRoom: null | string | { max: number, prefix: string }, // used when doing TogetherJS.config.get("findRoom")
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
        ignoreMessages: (keyof TogetherJSNS.AnyMessage.MapForSending)[] | true,
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

    type PeerStatus = "live" | "active" | "inactive" | "bye";

    // TODO there seems to be many types of messages, there may be one for every event like form-update
    interface Message {
        sameUrl: boolean;
        clientId: string;
        peer: TogetherJSNS.PeerClass;
        type: TogetherJSNS.Messages;
        url: string;
        to: string;
        peerCount?: number;
    }

    interface FormFocusMessage {
        sameUrl: boolean | undefined;
        type: "form-focus";
        peer: PeerClass;
        element: string;
    }

    interface FormInitMessage {
        type: "form-init";
        pageAge: number;
        updates: TogetherJSNS.MessageForEditor.StringElement[]
    }

    /** This namespace contains interfaces that transcribe the constraints that apply on Forms
    
    __AnyElement__: the `element` field can be either HTMLElement or string. It is used when the message has not gone through the network (because going through the network means that the HTMLElement must be translated into its css selector).
        
    __WithTracker__: the `tracker` field is present which means that it represents a change in a text editor (augmented textarea like tinymceEditor) because trackers are used only for such textarea, in this case the field `value` is always of type string.

    __WithBasis__: the `basis` field means that we have an history (like SimpleHistory) implemented which only happens for textarea, that is why the type of the `value` field is always string in this case.

    Note that it would make many possible configurations but only 6 are meaningful since WithBasis and WithoutBasis are only important on the StringElement_WithoutTracker variants.
    */
    namespace MessageForEditor {
        /** Any possible combination of (meaningful) constraints */
        type Any = StringElement | AnyElement;

        /** The `element` field is of type string */
        type StringElement = StringElement_WithTracker | StringElement_WithoutTracker;

        /** The `element` field can be either HTMLElement or string */
        type AnyElement = AnyElement_WithTracker | AnyElement_WithoutTracker;

        /** The tracker field is present and valued */
        type WithTracker = AnyElement_WithTracker | StringElement_WithTracker;
        
        /** The tracker field is not present */
        type WithoutTracker = AnyElement_WithoutTracker | StringElement_WithoutTracker;
    
        interface AnyElement_WithTracker {
            element: HTMLElement | string;
            tracker: string;
            basis?: number;
            value: string;
        }
    
        interface AnyElement_WithoutTracker {
            element: HTMLElement | string;
            basis?: number;
            value: string | boolean;
        }
        
        interface StringElement_WithTracker {
            element: string;
            tracker: string;
            basis?: number;
            value: string;
        }
    
        type StringElement_WithoutTracker = StringElement_WithoutTracker_WithBasis | StringElement_WithoutTracker_WithoutBasis;
    
        interface StringElement_WithoutTracker_WithBasis {
            element: string;
            basis: number;
            value: string;
        }
    
        interface StringElement_WithoutTracker_WithoutBasis {
            element: string;
            value: string | boolean;
        }
    }

    type FormUpdateMessage = FormUpdateMessage1a | FormUpdateMessage1b | FormUpdateMessage2;

    /** without tracker */
    interface FormUpdateMessage1a {
        type: "form-update";
        /** a selector */
        element: string;
        "server-echo"?: boolean;
        value: string | boolean;
        basis?: number; // TODO seems to be unused
    }

    /** a tracker means that value is of type string */
    interface FormUpdateMessage1b {
        type: "form-update";
        /** a selector */
        element: string;
        "server-echo"?: boolean;
        tracker: string;
        value: string;
        basis?: number; // TODO seems to be unused
    }

    interface FormUpdateMessage2 {
        type: "form-update";
        /** a selector */
        element: string;
        "server-echo"?: boolean;
        tracker?: string;
        replace: {
            id: string;
            basis: number;
            delta: TextReplaceStruct;
        };
        value?: string | boolean;
        basis?: number; // TODO seems to be unused
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
        (...args: any[]): void;
    }

    interface CallbackForOnce<T> extends CallbackForOn<T> {
        [name: string]: CallbackForOnce<T>; // TODO weird field for once callbacks
    }

    interface Ons<T> {
        [key: string]: CallbackForOn<T>;
    }

    interface ConfigFunObj {
        <K extends keyof Config, V extends Config[K]>(attributeName: K, attributeValue: V): void;
        (configOrAttributeName: Config | string, attributeValue?: keyof Config): void;
        get<K extends keyof Config>(name: K): Config[K];
        close<K extends keyof Config>(thing: K): Partial<Config>[K]; // TODO is the return type it boolean?
        track<K extends keyof Config>(name: K, callback: (value: Config[K], previous?: Config[K]) => any): (value: Config[K], previous?: Config[K]) => any;
    }

    interface ConfigGetter {
        get<K extends keyof Config>(name: K): Partial<Config>[K];
    }

    interface CodeMirrorElement {
        CodeMirror: {
            getValue: () => string,
            on: (eventName: "change", cb: () => void) => void,
            off: (eventName: "change", cb: () => void) => void,
            setValue: (text: string | undefined) => void,
        };
    }

    interface AceEditorElement {
        env: {
            document: {
                setValue: (text: string) => void,
                getValue: () => string,
                on: (eventName: "change", cb: () => void) => void,
                removeListener: (eventName: "change", cb: () => void) => void,
            }
        }
    }

    interface CKEditor {
        /** List of selector */
        instances: string[],
        dom: { // TODO better style?
            element: {
                get: (elem: HTMLElement) => {
                    getEditor: () => {
                        setValue: (text: string | undefined) => void,
                        getData: () => string,
                        on: (eventName: "change", cb: () => void) => void,
                        removeListener: (eventName: "change", cb: () => void) => void,
                        editable: () => {
                            setHtml: (html: string | undefined) => void,
                        },
                    },
                }
            },
        }
    }

    interface Tinymce {
        editors: {
            id: string,
        }
    }

    interface TinyEditor {
        getContent: () => string;
        destroy: () => void;
        setContent: (content: string, options: { format: "raw" }) => void;
        on: (events: string, cb: () => void) => void;
    }

    /** type for storage.tab.set(chatStorageKey, log); */
    interface ChatLogs extends Array<ChatLog> { }

    interface ChatLog {
        messageId: string,
        peerId: string,
        text: string,
        date: number
    }

    interface WithDate { date: number }
    type LogItem = ValueOf<AnyMessage.MapForReceiving> & WithDate;
}

declare namespace TogetherJSNS.Util {
    type Prototype = Methods;

    interface WithMethods {
        classMethods?: { [methodName: string]: (...args: any[]) => any }
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
    _TogetherJSShareId?: string;
    TogetherJSConfig_autoStart?: boolean;
    TogetherJSConfig_enableShortcut?: boolean;
    TowTruck: TogetherJSNS.TogetherJS;
    TogetherJSTestSpy?: { [k: string]: unknown };
    _gaq?: [string, string?][];
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
declare var onYouTubeIframeAPIReady: ((oldf?: () => void) => void) | undefined;

interface Navigator {
    /** @deprecated */
    mozGetUserMedia?: Navigator["getUserMedia"];
    /** @deprecated */
    webkitGetUserMedia?: Navigator["getUserMedia"];
    /** @deprecated */
    msGetUserMedia?: Navigator["getUserMedia"];
}

interface Require {
    s?: {
        contexts?: {
            togetherjs?: never;
        }
    }
}

// TODO the code using this in ui.ts should probably ve removed since it does not work
type MozActivity = any;
declare var MozActivity: MozActivity;