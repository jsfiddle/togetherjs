import type { linkify } from "linkify";
import type { Analytics as AnalyticsType } from "../analytics";
import type { WebSocketChannel as WebSocketChannelType } from "../channels";
import type { Chat as ChatType } from "../chat";
import type { Console as ConsoleType } from "../console";
import type { ElementFinder as ElementFinderType } from "../elementFinder";
import type { EventMaker as EventMakerType } from "../eventMaker";
import type { TrackerClass as TrackerClassType } from "../forms";
import type { SimpleHistory as SimpleHistoryType, TextReplace as TextReplaceType } from "../ot";
import type { PeerClass as PeerClassType, Peers as PeersType, PeersSelf as PeersSelfType } from "../peers";
import type { Logs as LogsType, Playback as PlaybackType } from "../playback";
import type { Randomizer as RandomizerType } from "../randomutil";
import type { Session as SessionType } from "../session";
import type { TJSStorageWithTab } from "../storage";
import type { Templating as TemplatingType } from "../templating";
import type { PeerSelfView as PeerSelfViewType, PeerView as PeerViewType, Ui as UiType } from "../ui";
import type { Util as UtilType } from "../util";
import type { visibilityApi } from "../visibilityApi";
import type { Walkthrough as WalkthroughType } from "../walkthrough";
import type { ExternalPeer as ExternalPeerType, Who as WhoType } from "../who";
import type { Windowing as WindowingType } from "../windowing";

declare global {
    namespace TogetherJSNS {
        // Utility types
        type ValueOf<T> = T[keyof T];

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
            interface Swatch { }

            /** "walkthrough-slide-progress" */
            interface WalkthroughSlideProgress { }

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
                peer: PeerClass | PeerSelf,
                content: string,
                date: number
            }

            /** "chat-joined" */
            interface ChatJoined {
                peer: PeerClass,
                date: number
            }

            /** "chat-left" */
            interface ChatLeft {
                peer: PeerClass,
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
                peer: PeerClass | PeerSelf,
                date: number,
                href: string,
                hrefTitle: string,
                forEveryone: boolean,
            }
        }

        namespace SessionSend {
            interface InitConnection { type: "init-connection", peerCount: number }

            interface IdleStatus {
                type: "idle-status",
                idle: PeerStatus
            }

            interface UrlChangeNudge {
                type: "url-change-nudge",
                url: string,
                to: string
            }

            interface ScrollUpdate {
                type: "scroll-update",
                position: ElementFinder.Position
            }

            interface Bye {
                type: "bye",
                reason?: string
            }

            interface Chat {
                type: "chat",
                text: string,
                messageId: string
            }

            interface GetLogsBase {
                forClient: string | undefined //id of the client or nothing if destined to everyone
                saveAs: string
            }

            interface GetLogs extends GetLogsBase {
                type: "get-logs",
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
            }

            interface VideoEventName<T extends string> {
                type: `video-${T}`,
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

            // { type: "who", "server-echo": boolean }
            interface Who {
                type: "who",
                "server-echo": boolean,
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

        namespace On {
            // This needs to be a type an not an interface because of the way OnClass deals with generic, see https://stackoverflow.com/questions/60697214/how-to-fix-index-signature-is-missing-in-type-error
            type Map = {
                // channel.on & session.on
                "close": () => void;
        
                // channel.on
                /** msg can be of type string if rawData is activated but we don't put it here */
                "message": (msg: ValueOf<AnyMessage.MapForReceiving>) => void;
        
                // session.hub.on
                "chat": (msg: Chat) => void;
                "bye": (msg: Bye) => void;
                "logs": (msg: Logs) => void; // TODO parameter similar to GetLogs
                // TODO logs may be of type Logs[], we shoud check
                "cursor-update": (msg: On.CursorUpdate & AnyMessage.AfterTransit) => void;
                "scroll-update": (msg: ScrollUpdate) => void;
                "cursor-click": (msg: SessionSend.CursorClick & AnyMessage.AfterTransit) => void;
                "keydown": (msg: Keydown) => void;
                //"form-update": (msg: { sameUrl: boolean, element: string, tracker: string, replace: Change2, value?: string }) => void // TODO old version, trying below with FormUpdateMessage
                "form-update": (msg: FormUpdateMessage & AnyMessage.AfterTransit) => void
                "form-init": (msg: AnyMessage.FormInitMessage & AnyMessage.AfterTransit) => void;
                "form-focus": (msg: FormFocus) => void;
                "idle-status": (msg: AnyMessage.IdleStatus & AnyMessage.AfterTransit) => void;
                "ping": () => void;
                "who": (msg: ChannelSend.Who) => void;
                "invite": (msg: Invite) => void;
                "url-change-nudge": (msg: UrlChangeNudge) => void;
                "playerStateChange": (msg: SessionSend.PlayerStateChange) => void;
                "synchronizeVideosOfLateGuest": (msg: SessionSend.SynchronizeVideosOfLateGuest) => void;
                "differentVideoLoaded": (msg: DifferentVideoLoaded) => void;
                "rtc-offer": (msg: RtcOffer) => void;
                "rtc-answer": (msg: RtcAnswer) => void;
                "rtc-ice-candidate": (msg: RtcIceCandidate) => void;
                "rtc-abort": (msg: RtcAbort) => void;
        
                // session.on
                "prepare-hello": (msg: HelloMessage | HelloBackMessage) => void;
                "video-timeupdate": (msg: SessionSend.VideoEventName<"timeupdate">) => void;
                "video-play": (msg: SessionSend.VideoEventName<"play">) => void;
                "video-pause": (msg: SessionSend.VideoEventName<"pause">) => void;
        
                // TogetherJS.once
                "ready": () => void;
        
                // only for typecheck session.hub.emit(msg.type, msg); in session.ts
                "get-logs": (msg: SessionSend.GetLogs) => void; // TODO may be wrong
                "ping-back": (msg: SessionSend.PingBack) => void; // TODO may be wrong
                "peer-update": (msg: SessionSend.PeerUpdate) => void; // TODO may be wrong
                "route": (msg: ChannelSend.Route) => void; // TODO may be wrong
                "init-connection": (msg: SessionSend.InitConnection) => void; // TODO may be wrong
                
                // other
                "identityId": (msg: IdentityId) => void, // TODO this a fictive message, peers.ts hints that a message more or less like this exists (with a identityId field) but I can't find it yet, this one is to fix "session.hub.emit(msg.type, msg);" in session.ts

                "hello": (msg: Hello2) => void;
                "hello-back": (msg: HelloBack2) => void; // TODO may be wrong

                // === === ===
                // === NOT MESSAGES

                // .emit
                "new-peer": (peer: PeerClass) => void;
                "status-updated": (peer: PeerClass | PeerSelf) => void;
                "idle-updated": (peer: PeerClass | PeerSelf) => void;
                "rtc-supported": (peer: PeerClass) => void;
                "url-updated": (peer: PeerClass) => void;
                "identity-updated": (peer: PeerClass) => void;
                "self-updated": () => void;
                "startup-ready": () => void;

                // session.on
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
            }

            interface IdentityId { type: "identityId", identityId: string }
            interface Chat { type: "chat", text: string, peer: PeerClass, messageId: string }
            interface Bye { type: "bye", clientId: string, peer: PeerClass, reason: string }
            interface Logs { type: "logs", request: SessionSend.GetLogsBase, logs: string }
            interface ScrollUpdate { type: "scroll-update", peer: PeerClass, position: ElementFinder.Position }
            interface Keydown { type: "keydown", clientId: string }
            interface Invite { type: "invite", inviteId: string, url: string, userInfo: ExternalPeerAttributes, forClientId: string | null, "server-echo": boolean, clientId?: string }
            interface FormFocus { type: "form-focus", sameUrl: boolean, peer: PeerClass, element: string }
            interface DifferentVideoLoaded { type: "differentVideoLoaded", videoId: string, element: string }
            interface UrlChangeNudge { type: "url-change-nudge", to: string, peer: PeerView }
            interface RtcAbort { } // TODO find why type: "rtc-abort" in this type cause an error
            interface RtcOffer { type: "rtc-offer", offer: RTCSessionDescriptionInit }
            interface RtcAnswer { type: "rtc-answer", answer: RTCSessionDescriptionInit }
            interface RtcIceCandidate { type: "rtc-ice-candidate", candidate: RTCIceCandidateInit }

            // TODO this should be done with (In|After)Transit and other Hello interface, no need to introduce new ones
            interface Hello2Base {
                sameUrl: boolean,
                scrollPosition: ElementFinder.Position,
                peer: PeerClass,
                isClient?: boolean,
                url: string,
                urlHash: string
            }

            interface Hello2 extends Hello2Base {
                type: "hello"
            }

            interface HelloBack2 extends Hello2Base {
                type: "hello-back"
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

            interface MapForSending {
                // ChannelOnMessage
                //"hello": { type: "hello", peer: PeerClass }, // old version
                "hello": On.HelloMessage,
                //"hello-back": { type: "hello-back", peer: PeerClass },
                "hello-back": On.HelloBackMessage,
                "get-logs": SessionSend.GetLogs,
                "peer-update": SessionSend.PeerUpdate,
                "init-connection": SessionSend.InitConnection,
                "who": ChannelSend.Who,
                "invite": On.Invite,

                //ChannelSend
                "route": ChannelSend.Route,
                //"who": Who,
                //"invite": ChannelSend.Invite,
                "bye": SessionSend.Bye,
                "logs": On.Logs,
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
                "video-timeupdate": SessionSend.VideoEventName<"timeupdate">,
                "video-play": SessionSend.VideoEventName<"play">,
                "video-pause": SessionSend.VideoEventName<"pause">,
                "rtc-ice-candidate": SessionSend.RTCIceCandidate,
                "rtc-offer": SessionSend.RTCOffer,
                "rtc-answer": SessionSend.RTCAnswer,
                "rtc-abort": SessionSend.RTCAbort,
                "playerStateChange": SessionSend.PlayerStateChange,
                "synchronizeVideosOfLateGuest": SessionSend.SynchronizeVideosOfLateGuest,
                "url-change-nudge": SessionSend.UrlChangeNudge,
                "idle-status": IdleStatus,
                //"bye": { type: "bye", reason?: string },
                //"hello": On.HelloMessage,
                //"hello-back": On.HelloBackMessage,
                "cursor-update": On.CursorUpdate,
                "scroll-update": SessionSend.ScrollUpdate,
                "form-update": FormUpdateMessage,

                // other
                "form-init": AnyMessage.FormInitMessage,
                "differentVideoLoaded": On.DifferentVideoLoaded,
                "identityId": On.IdentityId, // TODO this a fictive message, peers.ts hints that a message more or less like this exists (with a identityId field) but I can't find it yet
            }

            type AppMessageName = `app.${string}`;
            type AppMessage = {
                type: string
            }

            type MapInTransit = { [P in keyof MapForSending]: MapForSending[P] & InTransit }
            type MapForReceiving = { [P in keyof MapForSending]: MapForSending[P] & AfterTransit }
            type AnyForSending = ValueOf<MapForSending>;
            type AnyForTransit = ValueOf<MapForSending> & InTransit;
            type AnyForReceiving = ValueOf<MapForSending> & AfterTransit;

            type IdleStatus = { type: "idle-status", idle: PeerStatus, peer?: PeerClass }

            interface FormInitMessage {
                type: "form-init";
                pageAge: number;
                updates: MessageForEditor.StringElement[]
            }
        }

        type Storage = TJSStorageWithTab; 
        type Session = SessionType;
        type Peers = PeersType;
        type Windowing = WindowingType;
        type Templating = TemplatingType; 
        type Linkify = typeof linkify;
        type VisibilityApi = typeof visibilityApi;
        type Playback = PlaybackType;
        type Chat = ChatType;
        type Ui = UiType;
        type Who = WhoType;
        type Console = ConsoleType;
        type TogetherJSClass = ReturnType<typeof togetherjsMain>;
        type TogetherJS = ReturnType<typeof togetherjsMain>;
        type On<T extends { [messageName: string]: CallbackForOn<any>; }> = OnClass<T>;
        type WebSocketChannel = WebSocketChannelType;
        type Walkabout = WalkaboutModule;
        type Util = UtilType;
        type PeerView = PeerViewType;
        type PeerSelfView = PeerSelfViewType;
        type Walkthrough = WalkthroughType;
        type Analytics = AnalyticsType;
        type ExternalPeer = ExternalPeerType;
        type PeerClass = PeerClassType;
        type Logs = LogsType;
        type PeerSelf = PeersSelfType;
        type TrackerClass = TrackerClassType;
        type TextReplace = TextReplaceType;
        type Randomizer = RandomizerType;
        type SimpleHistory = SimpleHistoryType;
        type EventMaker = EventMakerType;
        type ElementFinder = ElementFinderType;

        type AnyPeer = PeerSelf | PeerClass | ExternalPeer | SerializedPeer;

        interface TextReplaceStruct {
            start: number,
            del: number,
            text: string
        }

        type FunctionReturningString = () => string;
        type CssSelector = string;
        type Messages = "cursor-update" | "keydown" | "scroll-update" | "hello" | "hello-back" | "peer-update" | "url-change-nudge" | "idle-status" | "form-focus" | "rtc-ice-candidate" | "init-connection" | "get-logs" | "who";
        type JQuerySelector = ":password";
        type Reason = "started" | "joined" | null;
        
        interface KeyboardListener {
            (event: KeyboardEvent): void;
            pressed?: boolean;
        }

        interface Hub extends OnClass<On.Map> { }

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
            ignoreMessages: (keyof AnyMessage.MapForSending)[] | true,
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
            peer: PeerClass;
            type: Messages;
            url: string;
            to: string;
            peerCount?: number;
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

        type FormUpdateMessage = FormUpdateMessage_WithoutTracker | FormUpdateMessage_WithTracker | FormUpdateMessage_WithReplace;

        /** without tracker */
        interface FormUpdateMessage_WithoutTracker {
            type: "form-update";
            /** a selector */
            element: string;
            "server-echo"?: boolean;
            value: string | boolean;
            basis?: number;
        }

        /** a tracker means that value is of type string */
        interface FormUpdateMessage_WithTracker {
            type: "form-update";
            /** a selector */
            element: string;
            "server-echo"?: boolean;
            tracker: string;
            value: string;
            basis?: number; // TODO seems to be unused
        }

        interface FormUpdateMessage_WithReplace {
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

        interface CallbackForOn<T> {
            (...args: any[]): void;
        }

        interface CallbackForOnce<T> extends CallbackForOn<T> {
            [name: string]: CallbackForOn<T>; // TODO weird field for once callbacks
        }

        interface Ons<T> {
            [key: string]: CallbackForOn<T>;
        }

        interface ConfigFunObj {
            <K extends keyof Config, V extends Config[K]>(attributeName: K, attributeValue: V): void;
            (configOrAttributeName: Config | string, attributeValue?: keyof Config): void;
            get<K extends keyof Config>(name: K): Config[K];
            close<K extends keyof Config>(thing: K): Partial<Config>[K];
            track<K extends keyof Config>(name: K, callback: (value: Config[K], previous?: Config[K]) => any): (value: Config[K], previous?: Config[K]) => any;
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

        namespace ElementFinder {
            interface Position {
                location: string,
                offset: number,
                absoluteTop: number,
                documentHeight: number
            }
        }

        interface IdleAndStatus {
            status: TogetherJSNS.PeerStatus;
            idle: TogetherJSNS.PeerStatus;
        }
        
        interface PeerClassAttributes {
            avatar: string | null;
            color: string;
            following: boolean;
            fromHelloMessage: TogetherJSNS.ValueOf<TogetherJSNS.AnyMessage.MapInTransit>;
            fromStorage?: boolean;
            id: string;
            identityId: string;
            idle: TogetherJSNS.PeerStatus;
            joined: boolean;
            lastMessageDate: number;
            name: string;
            status: TogetherJSNS.PeerStatus;
        }
        
        interface PeerSelfAttributes {
            name: string,
            avatar: string,
            defaultName: string,
            color: string,
            fromLoad: boolean,
            status: TogetherJSNS.PeerStatus,
            idle: TogetherJSNS.PeerStatus,
        }
        
        interface SerializedPeer {
            avatar: string | null,
            color: string,
            following: boolean;
            hash: string | null;
            id: string;
            identityId: string | undefined;
            idle: TogetherJSNS.PeerStatus;
            name?: string,
            rtcSupported?: boolean,
            status: TogetherJSNS.PeerStatus;
            title: string | null;
            url: string | undefined;
            fromStorage?: boolean;
        }

        interface ExternalPeerAttributes {
            identityId?: string;
            status?: TogetherJSNS.PeerStatus;
            name: string;
            avatar: string;
            color: string;
            clientId: string; // TODO is it the same thing as identityId?
        }

        interface Change2 {
            id: string,
            delta: TogetherJSNS.TextReplace,
            basis?: number,
            sent?: boolean,
        }
        
        interface Change2Mandatory {
            id: string,
            delta: TogetherJSNS.TextReplace,
            basis: number,
            sent: boolean,
        }

        interface Template {
            interface?: string;
            walkthrough?: string;
            names?: string;
            help?: string;
            walkabout?: string;
        }


    interface MediaConstraintsMandatory {
        OfferToReceiveAudio: boolean,
        OfferToReceiveVideo: boolean,
        MozDontOfferDataChannel?: boolean,
    }
    }

    interface EventHtmlElement extends Event {
        target: HTMLElement | null;
    }

    //var TogetherJS: TogetherJSNS.TogetherJS;
    let onYouTubeIframeAPIReady: ((oldf?: () => void) => void) | undefined;

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
        CKEDITOR: typeof CKEDITOR;
        tinymce: typeof tinymce;
        onYouTubeIframeAPIReady: typeof onYouTubeIframeAPIReady;
    }

    var CKEDITOR: TogetherJSNS.CKEditor | undefined;
    var tinymce: TogetherJSNS.Tinymce | undefined;

    // Only in ES6 apparently
    interface Function {
        //name: string;
    }

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

    interface Document {
        mozHidden?: boolean;
        msHidden?: boolean;
        webkitHidden?: boolean;
    }

    // TODO the code using this in ui.ts should probably be removed since it does not work
    type MozActivity = any;
    var MozActivity: MozActivity;
}
