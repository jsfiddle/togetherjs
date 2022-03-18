/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { peers } from "./peers";
import { session } from "./session";
import { storage } from "./storage";
import { ui } from "./ui";
import { util } from "./util";
import { windowing } from "./windowing";
import $ from "jquery";

// WebRTC support -- Note that this relies on parts of the interface code that usually goes in ui.js

//function webrtcMain(_require: Require, $: JQueryStatic, util: TogetherJSNS.Util, session: TogetherJSNS.Session, ui: TogetherJSNS.Ui, peers: TogetherJSNS.Peers, storage: TogetherJSNS.Storage, windowing: TogetherJSNS.Windowing) {
const assert: typeof util.assert = util.assert.bind(util);

session.RTCSupported = !!(window.mozRTCPeerConnection || window.webkitRTCPeerConnection || window.RTCPeerConnection);

const mediaConstraints: {mandatory: TogetherJSNS.MediaConstraintsMandatory} = {
    mandatory: {
        OfferToReceiveAudio: true,
        OfferToReceiveVideo: false,
    }
};
if(window.mozRTCPeerConnection) {
    mediaConstraints.mandatory.MozDontOfferDataChannel = true;
}

const URL = window.webkitURL || window.URL;
const RTCSessionDescription = window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.RTCSessionDescription;
const RTCIceCandidate = window.mozRTCIceCandidate || window.webkitRTCIceCandidate || window.RTCIceCandidate;

function makePeerConnection() {
    // Based roughly off: https://github.com/firebase/gupshup/blob/gh-pages/js/chat.js
    if(window.webkitRTCPeerConnection) {
        // If you have a type error here read the comment at webkitRTCPeerConnection in ts/types/backward-compat.ts
        return new webkitRTCPeerConnection(
            // TODO the key was "url" but the doc and the typing says it should be "urls", we would have liked to not update it (in the spirit of not changing the code) but it's not really possible to remove the error any other way (see backward-compat.d.ts for more explanation)
            { "iceServers": [{"urls": "stun:stun.l.google.com:19302"}] },
            // TODO fix
            // @ts-expect-error
            { "optional": [{"DtlsSrtpKeyAgreement": true}] } // TODO search DtlsSrtpKeyAgreement in the page https://developer.mozilla.org/fr/docs/Web/API/WebRTC_API/Signaling_and_video_calling
        );
    }
    if(window.mozRTCPeerConnection) {
        return new window.mozRTCPeerConnection(
            { /* Or stun:124.124.124..2 ? */ "iceServers": [{"urls": "stun:23.21.150.121"}] }, // TODO changed url to urls
            { "optional": [] });
    }
    throw new util.AssertionError("Called makePeerConnection() without supported connection");
}

function ensureCryptoLine(sdp: string) {
    if(!window.mozRTCPeerConnection) {
        return sdp;
    }

    const sdpLinesIn = sdp.split('\r\n');
    const sdpLinesOut = [];

    // Search for m line.
    for(let i = 0; i < sdpLinesIn.length; i++) {
        sdpLinesOut.push(sdpLinesIn[i]);
        if(sdpLinesIn[i].search('m=') !== -1) {
            sdpLinesOut.push("a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        }
    }

    sdp = sdpLinesOut.join('\r\n');
    return sdp;
}

function getUserMedia(options: MediaStreamConstraints, success: NavigatorUserMediaSuccessCallback, failure: NavigatorUserMediaErrorCallback) {
    failure = failure || function(error) {
        console.error("Error in getUserMedia:", error);
    };
    (navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia || navigator.msGetUserMedia).call(navigator, options, success, failure);
}

/****************************************
 * getUserMedia Avatar support
 */

session.on("ui-ready", function() {
    let avatarData: string | undefined;
    const $preview = $("#togetherjs-self-avatar-preview");
    const $accept = $("#togetherjs-self-avatar-accept");
    const $cancel = $("#togetherjs-self-avatar-cancel");
    const $takePic = $("#togetherjs-avatar-use-camera");
    const $video = $("#togetherjs-avatar-video");
    const video0 = $video[0] as HTMLVideoElement;
    const $upload = $("#togetherjs-avatar-upload");
    let streaming = false;

    $("#togetherjs-self-avatar").click(function() {
        const avatar = peers.Self.avatar;
        if(avatar) {
            $preview.attr("src", avatar);
        }
        ui.displayToggle("#togetherjs-avatar-edit");
    });
    if(!session.RTCSupported) {
        $("#togetherjs-avatar-edit-rtc").hide();
    }

    $takePic.click(function() {
        if(!streaming) {
            startStreaming();
            return;
        }
        takePicture();
    });

    function savePicture(dataUrl: string) {
        avatarData = dataUrl;
        $preview.attr("src", avatarData);
        $accept.attr("disabled", null);
    }

    $accept.click(function() {
        peers.Self.update({avatar: avatarData});
        ui.displayToggle("#togetherjs-no-avatar-edit");
        // FIXME: these probably shouldn't be two elements:
        $("#togetherjs-participants-other").show();
        $accept.attr("disabled", "1");
    });

    $cancel.click(function() {
        ui.displayToggle("#togetherjs-no-avatar-edit");
        // FIXME: like above:
        $("#togetherjs-participants-other").show();
    });

    function startStreaming() {
        const constraints = {
            video: true,
            audio: false
        }
        if (navigator.mediaDevices)
            navigator.mediaDevices.getUserMedia(constraints).then(stream => {
                streaming = true;
                // was "video0.src = URL.createObjectURL(stream);", check that it does the same, see https://stackoverflow.com/questions/57090422/javascript-createobjecturl-url-fails-for-mediastream
                video0.srcObject = stream;
                video0.play();
            }).catch(e => { throw new Error(e) })
        else
            getUserMedia(constraints,
                function(stream) {
                    streaming = true;
                    $video[0].src = URL.createObjectURL(stream);
                    $video[0].play();
                },
                function(err) {
                    // FIXME: should pop up help or something in the case of a user
                    // cancel
                    console.error("getUserMedia error:", err);
                }
            );
    }

    function takePicture() {
        assert(streaming);
        let height = video0.videoHeight;
        let width = video0.videoWidth;
        width = width * (session.AVATAR_SIZE / height);
        height = session.AVATAR_SIZE;
        const canvas0 = document.createElement("canvas");
        canvas0.height = session.AVATAR_SIZE;
        canvas0.width = session.AVATAR_SIZE;
        const context = canvas0.getContext("2d")!; // ! is ok because the first call to getContext can't fail if it's "2d"
        context.arc(session.AVATAR_SIZE / 2, session.AVATAR_SIZE / 2, session.AVATAR_SIZE / 2, 0, Math.PI * 2);
        context.closePath();
        context.clip();
        context.drawImage(video0, (session.AVATAR_SIZE - width) / 2, 0, width, height);
        savePicture(canvas0.toDataURL("image/png"));
    }

    $upload.on("change", function(this: DataTransfer) { // TODO is this really a DataTransfer? It was the most relevant type with a files field
        const reader = new FileReader();
        reader.onload = function() {
            // FIXME: I don't actually know it's JPEG, but it's probably a good enough guess:
            const url = "data:image/jpeg;base64," + util.blobToBase64(this.result!); // TODO !
            convertImage(url, function(result) {
                savePicture(result);
            });
        };
        reader.onerror = function() {
            console.error("Error reading file:", this.error);
        };
        reader.readAsArrayBuffer(this.files[0]);
    });

    function convertImage(imageUrl: string, callback: (url: string) => void) {
        const canvas = document.createElement("canvas");
        canvas.height = session.AVATAR_SIZE;
        canvas.width = session.AVATAR_SIZE;
        const context = canvas.getContext("2d")!; // ! is ok because the first call to getContext can't fail if it's "2d"
        const img = new Image();
        img.src = imageUrl;
        // Sometimes the DOM updates immediately to call
        // naturalWidth/etc, and sometimes it doesn't; using setTimeout
        // gives it a chance to catch up
        setTimeout(function() {
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;
            width = width * (session.AVATAR_SIZE / height);
            height = session.AVATAR_SIZE;
            context.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL("image/png"));
        });
    }

});

/****************************************
 * RTC support
 */

function audioButton(selector: string) {
    ui.displayToggle(selector);
    if(selector == "#togetherjs-audio-incoming") {
        $("#togetherjs-audio-button").addClass("togetherjs-animated").addClass("togetherjs-color-alert");
    }
    else {
        $("#togetherjs-audio-button").removeClass("togetherjs-animated").removeClass("togetherjs-color-alert");
    }
}

session.on("ui-ready", function() {
    $("#togetherjs-audio-button").click(function() {
        if($("#togetherjs-rtc-info").is(":visible")) {
            windowing.hide();
            return;
        }
        if(session.RTCSupported) {
            enableAudio();
        }
        else {
            windowing.show("#togetherjs-rtc-not-supported");
        }
    });

    if(!session.RTCSupported) {
        audioButton("#togetherjs-audio-unavailable");
        return;
    }
    audioButton("#togetherjs-audio-ready");

    let audioStream: MediaStream | null = null;
    let accepted = false;
    const connected = false;
    const $audio = $("#togetherjs-audio-element");
    let offerSent: RTCSessionDescriptionInit | null = null;
    let offerReceived: RTCSessionDescriptionInit | null = null;
    let offerDescription = false;
    let answerSent: RTCSessionDescriptionInit | null = null;
    let answerReceived: RTCSessionDescriptionInit | null = null;
    let answerDescription = false;
    let _connection: RTCPeerConnection | null = null;
    let iceCandidate: RTCIceCandidateInit | null = null;

    function enableAudio() {
        accepted = true;
        storage.settings.get("dontShowRtcInfo").then(function(dontShow) {
            if(!dontShow) {
                windowing.show("#togetherjs-rtc-info");
            }
        });
        if(!audioStream) {
            startStreaming(connect);
            return;
        }
        if(!connected) {
            connect();
        }
        toggleMute();
    }

    ui.container.find("#togetherjs-rtc-info .togetherjs-dont-show-again").change(function(this: HTMLInputElement) {
        storage.settings.set("dontShowRtcInfo", this.checked);
    });

    function error(...args: any[]) {
        console.warn(args);
        let s = "";
        for(let i = 0; i < args.length; i++) {
            if(s) {
                s += " ";
            }
            const a = args[i];
            if(typeof a == "string") {
                s += a;
            }
            else {
                let repl;
                try {
                    repl = JSON.stringify(a);
                }
                catch(e) {
                    repl = "" + a;
                }
                s += repl;
            }
        }
        audioButton("#togetherjs-audio-error");
        // FIXME: this title doesn't seem to display?
        $("#togetherjs-audio-error").attr("title", s);
    }

    function startStreaming(callback: () => void) {
        /** @deprecated https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getUserMedia */
        const constraints = {
            video: false,
            audio: true
        }
        if (navigator.mediaDevices)
            navigator.mediaDevices.getUserMedia(constraints).then(stream => {
                audioStream = stream;
                attachMedia("#togetherjs-local-audio", stream);
                if(callback) {
                    callback();
                }
            }).catch(e => { throw new Error(e) })
        else
            getUserMedia(constraints,
                function (stream) {
                    audioStream = stream;
                    attachMedia("#togetherjs-local-audio", stream);
                    if (callback) {
                        callback();
                    }
                },
                function (err) {
                    // TODO this code can't work. getUserMedia gets a MediaStreamError but this callback act as if it was receiving a MediaError (https://developer.mozilla.org/en-US/docs/Web/API/MediaError) where a code of 1 would mean "The fetching of the associated resource was aborted by the user's request". I know that it can't work because MediaStreamError doesn't have a `code` field.
                    // FIXME: handle cancel case
                    if (err && (err as any).code == 1) { // TODO does .code actually exists? Maybe it's a MediaError and not a MediaStreamError
                        // User cancel
                        return;
                    }
                    error("getUserMedia error:", err);
                }
            );
    }

    function attachMedia(element: HTMLMediaElement | JQuery | string, media: MediaStream) {
        element = $(element)[0] as HTMLMediaElement;
        console.log("Attaching", media, "to", element);
        if(window.mozRTCPeerConnection) {
            element.mozSrcObject = media;
            element.play();
        }
        else {
            element.autoplay = true;
            // was "element.src = URL.createObjectURL(media);", check that it does the same, see https://stackoverflow.com/questions/57090422/javascript-createobjecturl-url-fails-for-mediastream
            element.srcObject = media;
        }
    }

    function getConnection() {
        assert(audioStream);
        if(_connection) {
            return _connection;
        }
        try {
            _connection = makePeerConnection();
        }
        catch(e) {
            error("Error creating PeerConnection:", e);
            throw e;
        }
        _connection.onaddstream = function(event: MediaStreamEvent) {
            console.log("got event", event.type, event);
            if (!event.stream && (!event.streams || !event.streams.length)) {
                console.error("stream was null in the event", event);
                return;
            }
            attachMedia($audio, event.stream || event.streams[0]);
            audioButton("#togetherjs-audio-active");
        };
        _connection.onstatechange = function() {
            // FIXME: this doesn't seem to work:
            // Actually just doesn't work on Firefox
            assert(_connection !== null); // TODO assert added
            console.log("state change", _connection?.readyState);
            if(_connection.readyState == "closed") {
                audioButton("#togetherjs-audio-ready");
            }
        };
        _connection.onicecandidate = function(event) {
            if(event.candidate) {
                session.send({
                    type: "rtc-ice-candidate",
                    candidate: {
                        sdpMLineIndex: event.candidate.sdpMLineIndex!, // TODO !
                        sdpMid: event.candidate.sdpMid!, // TODO !
                        candidate: event.candidate.candidate
                    }
                });
            }
        };
        _connection.addStream(audioStream);
        return _connection;
    }

    function addIceCandidate() {
        if(iceCandidate) {
            console.log("adding ice", iceCandidate);
            assert(_connection !== null); // TODO assert added
            _connection.addIceCandidate(new RTCIceCandidate(iceCandidate));
        }
    }

    function connect() {
        const connection = getConnection();
        if(offerReceived && (!offerDescription)) {
            connection.setRemoteDescription(
                new RTCSessionDescription({
                    type: "offer",
                    sdp: offerReceived.toString() // TODO added toString to follow rules here https://developer.mozilla.org/en-US/docs/Web/API/RTCSessionDescription/RTCSessionDescription
                    // using RTCSessionDescription constructor is @deprecated
                }), // TODO setRemoteDescription returns a promise so the 2 callbacks should probably be used in a .then()
            //).then( // TODO TRY like this for example
                function() {
                    offerDescription = true;
                    addIceCandidate();
                    connect();
                },
                function(err) {
                    error("Error doing RTC setRemoteDescription:", err);
                }
            );
            return;
        }
        if(!(offerSent || offerReceived)) {
            connection.createOffer(function(offer: RTCSessionDescriptionInit) {
                console.log("made offer", offer);
                if(offer.sdp !== undefined) { // TODO if add for typecheck
                    offer.sdp = ensureCryptoLine(offer.sdp);
                }
                connection.setLocalDescription(
                    offer,
                //).then( // TODO toggle to switch to promise mode (the new api)
                    function() { // TODO this returns a promise so the 2 callbacks should probably be used in a .then(), see https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createOffer
                        session.send({
                            type: "rtc-offer",
                            offer: offer.sdp! // TODO !
                        });
                        offerSent = offer;
                        audioButton("#togetherjs-audio-outgoing");
                    },
                    function(err) {
                        error("Error doing RTC setLocalDescription:", err);
                    },
                    mediaConstraints
                );
            }, function(err) {
                error("Error doing RTC createOffer:", err);
            });
        }
        else if(!(answerSent || answerReceived)) {
            // FIXME: I might have only needed this due to my own bugs, this might not actually time out
            const timeout = setTimeout(function() {
                if(!answerSent) {
                    error("createAnswer Timed out; reload or restart browser");
                }
            }, 2000);
            connection.createAnswer(function(answer) {
                if(answer.sdp !== undefined) { // TODO if added for typecheck
                    answer.sdp = ensureCryptoLine(answer.sdp);
                }
                clearTimeout(timeout);
                connection.setLocalDescription(
                    answer,
                //).then(
                    function() { // TODO this returns a promise so the 2 callbacks should probably be used in a .then()
                        session.send({
                            type: "rtc-answer",
                            answer: answer.sdp ?? "" // TODO added ?? ""
                        });
                        answerSent = answer;
                    },
                    function(err) {
                        clearTimeout(timeout);
                        error("Error doing RTC setLocalDescription:", err);
                    },
                    mediaConstraints
                );
            }, function(err) {
                error("Error doing RTC createAnswer:", err);
            });
        }
    }

    function toggleMute() {
        // FIXME: implement.  Actually, wait for this to be implementable - currently
        // muting of localStreams isn't possible
        // FIXME: replace with hang-up?
    }

    session.hub.on("rtc-offer", function(msg) {
        if(offerReceived || answerSent || answerReceived || offerSent) {
            abort();
        }
        offerReceived = msg.offer;
        if(!accepted) {
            audioButton("#togetherjs-audio-incoming");
            return;
        }
        function run() {
            const connection = getConnection();
            connection.setRemoteDescription(
                new RTCSessionDescription({
                    type: "offer",
                    sdp: offerReceived?.toString() // TODO check that the .toString() that was added does not cause any problem
                }), // TODO this returns a promise so the 2 callbacks should probably be used in a .then()
                function() {
                    offerDescription = true;
                    addIceCandidate();
                    connect();
                },
                function(err) {
                    error("Error doing RTC setRemoteDescription:", err);
                }
            );
        }
        if(!audioStream) {
            startStreaming(run);
        }
        else {
            run();
        }
    });

    session.hub.on("rtc-answer", function(msg) {
        if(answerSent || answerReceived || offerReceived || (!offerSent)) {
            abort();
            // Basically we have to abort and try again.  We'll expect the other
            // client to restart when appropriate
            session.send({type: "rtc-abort"});
            return;
        }
        answerReceived = msg.answer;
        assert(offerSent);
        assert(audioStream);
        const connection = getConnection();
        connection.setRemoteDescription(
            new RTCSessionDescription({
                type: "answer",
                sdp: answerReceived.toString() // TODO check that the .toString() that was added does not cause any problem
            }), // TODO this returns a promise so the 2 callbacks should probably be used in a .then()
        //).then(
            function() {
                answerDescription = true;
                // FIXME: I don't think this connect is ever needed?
                connect();
            },
            function(err) {
                error("Error doing RTC setRemoteDescription:", err);
            }
        );
    });

    session.hub.on("rtc-ice-candidate", function(msg) {
        iceCandidate = msg.candidate;
        if(offerDescription || answerDescription) {
            addIceCandidate();
        }
    });

    session.hub.on("rtc-abort", function() {
        abort();
        if(!accepted) {
            return;
        }
        if(!audioStream) {
            startStreaming(function() {
                connect();
            });
        }
        else {
            connect();
        }
    });

    session.hub.on("hello", function() {
        // FIXME: displayToggle should be set due to _connection.onstatechange, but that's not working, so instead:
        audioButton("#togetherjs-audio-ready");
        if(accepted && (offerSent || answerSent)) {
            abort();
            connect();
        }
    });

    function abort() {
        answerSent = answerReceived = offerSent = offerReceived = null;
        answerDescription = offerDescription = false;
        _connection = null;
        $audio[0].removeAttribute("src");
    }
});

//define(["require", "jquery", "util", "session", "ui", "peers", "storage", "windowing"], webrtcMain);
