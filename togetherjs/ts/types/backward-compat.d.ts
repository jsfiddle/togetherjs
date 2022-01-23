/* eslint-disable no-use-before-define */
// RTC Patches

export {}

declare global {
    interface Window {
        /** @deprecated */
        mozRTCPeerConnection?: mozRTCPeerConnection;
        /** @deprecated */
        mozRTCSessionDescription?: typeof RTCSessionDescription;
        /** @deprecated */
        webkitRTCSessionDescription?: typeof RTCSessionDescription;
        /** @deprecated */
        mozRTCIceCandidate?: typeof RTCIceCandidate;
        /** @deprecated */
        webkitRTCIceCandidate?: typeof RTCIceCandidate;
    }

    interface MediaStreamEvent {

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
        /** @deprecated some traces of this field can be found here https://github.com/aquavit/DefinitelyTyped/blob/master/webrtc/RTCPeerConnection.d.ts */
        readyState: ReadyState;
    }

    interface HTMLMediaElement {
        /** @deprecated */
        mozSrcObject: string | MediaStream;
    }

    interface RTCPeerConnection extends EventTarget {
        /** @deprecated https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/setRemoteDescription */
        setRemoteDescription(description: RTCSessionDescriptionInit, successCallback: () => void, errorCallback: RTCPeerConnectionErrorCallback): void;

        /** @deprecated https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/setLocalDescription
        the mediaConstraints argument can only be found in the german mdn: https://developer.mozilla.org/de/docs/Web/API/RTCPeerConnection (2021/03/27)
        */
        setLocalDescription(sessionDescription: RTCSessionDescriptionInit, successCallback: () => void, errorCallback: RTCPeerConnectionErrorCallback, mediaConstraints?: { mandatory: TogetherJSNS.MediaConstraintsMandatory }): void;

        /** @deprecated https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createOffer */
        createOffer(successCallback: RTCSessionDescriptionCallback, errorCallback: RTCPeerConnectionErrorCallback, options?: RTCOfferOptions): void;

        /** @deprecated https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createAnswer */
        createAnswer(successCallback: RTCSessionDescriptionCallback, errorCallback: RTCPeerConnectionErrorCallback,options?: RTCOfferOptions): void;

    }

    /**
    This interface can't do what it's supposed to do because of the way `webkitRTCPeerConnection` is declared (declare var webkitRTCPeerConnection) in lib.dom.d.ts (typescript v4.2.3) and because var declarations can't be merged (https://www.typescriptlang.org/docs/handbook/declaration-merging.html)
    The only way to remove the error you might get in webrtc.ts is to edit you lib.dom.ts and add the line starting with new below to the var declaration.
    */
    interface webkitRTCPeerConnection extends RTCPeerConnection {
        /** @deprecated Not even sure this is a valid constructor, there is some notes about it here https://developer.mozilla.org/fr/docs/Web/API/WebRTC_API/Signaling_and_video_calling */
        // eslint-disable-next-line @typescript-eslint/no-misused-new
        new(configuration: RTCConfiguration, options: { "optional": [{ "DtlsSrtpKeyAgreement"?: boolean }] }): webkitRTCPeerConnection;
    }

    interface mozRTCPeerConnection extends RTCPeerConnection {
        /** @deprecated */
        // eslint-disable-next-line @typescript-eslint/no-misused-new
        new(configuration?: RTCConfiguration, options?: { "optional": [] }): mozRTCPeerConnection;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface RTCIceServer {
        /** @deprecated should be replaced by urls https://developer.mozilla.org/en-US/docs/Web/API/RTCIceServer Since we can't mark the urls field as optional adding this would not remove the type error so we update the "url" field to "urls" in the code */
        //url: string | string[];
    }
}