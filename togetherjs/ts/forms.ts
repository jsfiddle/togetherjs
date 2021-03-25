/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

declare var CKEDITOR: TogetherJSNS.CKEditor | undefined;
declare var tinymce: TogetherJSNS.Tinymce | undefined;

function formsMain($: JQueryStatic, util: Util, session: TogetherJSNS.Session, elementFinder: ElementFinder, eventMaker: EventMaker, templating: TogetherJSNS.Templating, ot: TogetherJSNS.Ot) {
    // TODO this is apparently an empty module object
    const assert: typeof util.assert = util.assert;

    // This is how much larger the focus element is than the element it surrounds
    // (this is padding on each side)
    var FOCUS_BUFFER = 5;

    var inRemoteUpdate = false;

    function suppressSync(element: HTMLElement | JQuery) {
        var ignoreForms = TogetherJS.config.get("ignoreForms");
        if(ignoreForms === true) {
            return true;
        }
        else if(ignoreForms === undefined) {
            return false;
        }
        else {
            return $(element).is(ignoreForms.join(","));
        }
    }

    function maybeChange(event: Event) {
        // Called when we get an event that may or may not indicate a real change (like keyup in a textarea)
        var tag = (event.target as HTMLTextAreaElement | HTMLInputElement).tagName; // TODO may be null
        if(tag == "TEXTAREA" || tag == "INPUT") {
            change(event);
        }
    }

    function change(event: Event) {
        sendData({
            element: event.target as HTMLElement,
            value: getValue(event.target as HTMLElement)
        });
    }

    interface SendDataAttributes {
        /** a selector */
        element: string | HTMLElement;
        tracker?: string;
        value: string | boolean;
    }

    function sendData(attrs: SendDataAttributes) {
        const el = $(attrs.element);
        assert(el);
        var tracker = attrs.tracker;
        var value = attrs.value;
        if(inRemoteUpdate) {
            return;
        }
        if(elementFinder.ignoreElement(el) ||
            (elementTracked(el) && !tracker) ||
            suppressSync(el)) {
            return;
        }
        var location = elementFinder.elementLocation(el);
        let msg: TogetherJSNS.FormUpdateMessage = {
            type: "form-update",
            element: location,
        };

        if(isText(el[0]) || tracker) {
            var history = el.data("togetherjsHistory");
            if(history) {
                if(history.current == value) {
                    return;
                }
                var delta = ot.TextReplace.fromChange(history.current, value);
                assert(delta);
                history.add(delta);
                maybeSendUpdate(location, history, tracker);
                return;
            }
            else {
                msg.value = value; // TODO these 2 fields don't seem to be used anywhere
                msg.basis = 1;
                el.data("togetherjsHistory", ot.SimpleHistory(session.clientId!, value, 1)); // TODO ! on clientId
            }
        }
        else {
            msg.value = value;
        }
        session.send(msg);
    }

    function isCheckable(element: HTMLElement | JQuery) {
        const el = $(element);
        var type = (el.prop("type") || "text").toLowerCase();
        if(el.prop("tagName") == "INPUT" && ["radio", "checkbox"].indexOf(type) != -1) {
            return true;
        }
        return false;
    }

    let editTrackers: {[trackerName: string]: TrackerClass} = {};
    let liveTrackers: Tracker[] = [];

    TogetherJS.addTracker = function(TrackerClass: TrackerClass, skipSetInit: boolean) {
        //assert(typeof TrackerClass === "function", "You must pass in a class");
        //assert(typeof TrackerClass.prototype.trackerName === "string", "Needs a .prototype.trackerName string");
        // Test for required instance methods.
        "destroy update init makeInit tracked".split(/ /).forEach(function(m) {
            //assert(typeof TrackerClass.prototype[m] === "function", "Missing required tracker method: " + m);
        });
        // Test for required class methods.
        "scan tracked".split(/ /).forEach(function(m) {
            //assert(typeof TrackerClass[m] === "function", "Missing required tracker class method: " + m);
        });
        editTrackers[TrackerClass.trackerName] = TrackerClass;
        if(!skipSetInit) {
            setInit();
        }
    };


    interface MessageForEditor {
        element: HTMLElement;
        tracker: string;
        value: string;
    }

    abstract class Editor<T = HTMLElement> {
        constructor(public trackerName: string, protected element: T) { }
        /*
        abstract destroy(el): void;
        abstract update(msg): void;
        abstract init(update, msg): void;
        abstract makeInit();
        abstract _editor();
        abstract _change(e);
        abstract getContent();
        abstract tracked(el);
        */
    }

    // TODO factorize code between editors
    class AceEditor extends Editor<TogetherJSNS.AceEditorElement & HTMLElement> {
        public static readonly trackerName = "AceEditor";

        constructor(el: JQuery) {
            super("AceEditor", $(el)[0] as TogetherJSNS.AceEditorElement & HTMLElement);
            assert($(this.element).hasClass("ace_editor"));
            this._change = this._change.bind(this);
            this._editor().document.on("change", this._change);
        }

        tracked2(el: JQuery): boolean { // TODO this function is set in the original js file but is overwritten
            return this.element === $(el)[0];
        }

        destroy(): void {
            this._editor().document.removeListener("change", this._change);
        }

        update(msg: MessageForEditor) {
            this._editor().document.setValue(msg.value);
        }

        init(update: MessageForEditor): void {
            this.update(update);
        }

        makeInit(): MessageForEditor {
            return {
                element: this.element,
                tracker: this.trackerName,
                value: this._editor().document.getValue()
            };
        }

        _editor() {
            return this.element.env;
        }

        _change() {
            // FIXME: I should have an internal .send() function that automatically
            // asserts !inRemoteUpdate, among other things
            if(inRemoteUpdate) {
                return;
            }
            sendData({
                tracker: this.trackerName,
                element: this.element,
                value: this.getContent()
            });
        }

        getContent(): string {
            return this._editor().document.getValue();
        }

        static scan() {
            return $(".ace_editor");
        }

        /** Non-static version */
        tracked(el: JQuery | HTMLElement) {
            return AceEditor.tracked(el);
        }
    
        static tracked(el: HTMLElement | JQuery): boolean {
            return !!$(el).closest(".ace_editor").length;
        }
    }

    TogetherJS.addTracker(AceEditor, true /* skip setInit */);

    class CodeMirrorEditor extends Editor<TogetherJSNS.CodeMirrorElement & HTMLElement> {
        public static readonly trackerName = "CodeMirrorEditor";

        constructor(el: JQuery) {
            super("CodeMirrorEditor", $(el)[0] as TogetherJSNS.CodeMirrorElement & HTMLElement);
            assert("CodeMirror" in this.element);
            this._change = this._change.bind(this);
            this._editor().on("change", this._change);
        }

        tracked2(el: JQuery) { // was in original js but was also overwritten
            return this.element === $(el)[0];
        }

        destroy() {
            this._editor().off("change", this._change);
        }

        update(msg: MessageForEditor) {
            this._editor().setValue(msg.value);
        }

        init(msg: MessageForEditor) {
            if(msg.value) {
                this.update(msg);
            }
        }

        makeInit(): MessageForEditor {
            return {
                element: this.element,
                tracker: this.trackerName,
                value: this._editor().getValue()
            };
        }

        _change() {
            if(inRemoteUpdate) {
                return;
            }
            sendData({
                tracker: this.trackerName,
                element: this.element,
                value: this.getContent()
            });
        }

        _editor() {
            return this.element.CodeMirror;
        }

        getContent(): string {
            return this._editor().getValue();
        }

        static scan() {
            var result: HTMLElement[] = [];
            var els = document.body.getElementsByTagName("*");
            var _len = els.length;
            for(var i = 0; i < _len; i++) {
                var el = els[i];
                if("CodeMirror" in el) {
                    result.push(el);
                }
            }
            return $(result);
        }

        /** Non-static version */
        tracked(el: JQuery | HTMLElement) {
            return CodeMirrorEditor.tracked(el);
        }
    
        static tracked(e: JQuery | HTMLElement): boolean {
            let el: Node | null = $(e)[0];
            while(el) {
                if("CodeMirror" in el) {
                    return true;
                }
                el = el.parentNode;
            }
            return false;
        }
    }

    TogetherJS.addTracker(CodeMirrorEditor, true /* skip setInit */);

    class CKEditor extends Editor {
        public static readonly trackerName = "CKEditor";

        constructor(el: JQuery) {
            super("CKEditor", $(el)[0]);
            assert(CKEDITOR);
            assert(CKEDITOR.dom.element.get(this.element));
            this._change = this._change.bind(this);
            // FIXME: change event is available since CKEditor 4.2
            this._editor().on("change", this._change);
        }

        tracked2(el: JQuery) { // TODO was in original JS but was overridden
            return this.element === $(el)[0];
        }

        destroy() {
            this._editor().removeListener("change", this._change);
        }

        update(msg: MessageForEditor) {
            //FIXME: use setHtml instead of setData to avoid frame reloading overhead
            this._editor().editable().setHtml(msg.value);
        }

        init(update: MessageForEditor) {
            this.update(update);
        }

        makeInit(): MessageForEditor {
            return {
                element: this.element,
                tracker: this.trackerName,
                value: this.getContent()
            };
        }

        _change() {
            if(inRemoteUpdate) {
                return;
            }
            sendData({
                tracker: this.trackerName,
                element: this.element,
                value: this.getContent()
            });
        }

        _editor() {
            return CKEDITOR.dom.element.get(this.element).getEditor();
        }

        getContent(): string {
            return this._editor().getData();
        }

        static scan() {
            var result = [];
            if(typeof CKEDITOR == "undefined") {
                return;
            }
            var editorInstance;
            for(var instanceIdentifier in CKEDITOR.instances) {
                editorInstance = document.getElementById(instanceIdentifier) || document.getElementsByName(instanceIdentifier)[0];
                if(editorInstance) {
                    result.push(editorInstance);
                }
            }
            return $(result);
        }

        /** Non-static version */
        tracked(el: JQuery | HTMLElement) {
            return CKEditor.tracked(el);
        }
    
        static tracked(el: JQuery | HTMLElement) {
            if(typeof CKEDITOR == "undefined") {
                return false;
            }
            const elem = $(el)[0];
            return !!(CKEDITOR.dom.element.get(elem) && CKEDITOR.dom.element.get(elem).getEditor());
        }
    }

    TogetherJS.addTracker(CKEditor, true /* skip setInit */);

    //////////////////// BEGINNING OF TINYMCE ////////////////////////
    class tinymceEditor extends Editor {
        public static readonly trackerName = "tinymceEditor";

        constructor(el: JQuery) {
            super("tinymceEditor", $(el)[0]);
            assert($(this.element).attr('id').indexOf('mce_') != -1);
            this._change = this._change.bind(this);
            this._editor().on("input keyup cut paste change", this._change);
        }

        tracked2(el: JQuery) { // TODO was in original js but was overriden
            return this.element === $(el)[0];
        }

        destroy() {
            this._editor().destory();
        }

        update(msg: MessageForEditor) {
            this._editor().setContent(msg.value, { format: 'raw' });
        }

        init(update: MessageForEditor) {
            this.update(update);
        }

        makeInit() {
            return {
                element: this.element,
                tracker: this.trackerName,
                value: this.getContent()
            };
        }

        _change() {
            if(inRemoteUpdate) {
                return;
            }
            sendData({
                tracker: this.trackerName,
                element: this.element,
                value: this.getContent()
            });
        }

        _editor() {
            if(typeof tinymce == "undefined") {
                return;
            }
            return $(this.element).data("tinyEditor");
        }

        getContent(): string {
            return this._editor().getContent();
        }

        static scan() {
            //scan all the elements that contain tinyMCE editors
            if(typeof window.tinymce == "undefined") {
                return;
            }
            var result: JQuery[] = [];
            $(window.tinymce.editors).each(function(i, ed) {
                result.push($('#' + ed.id));
                //its impossible to retrieve a single editor from a container, so lets store it
                $('#' + ed.id).data("tinyEditor", ed);
            });
            return $(result);
        }

        /** Non-static version */
        tracked(el: JQuery | HTMLElement) {
            return tinymceEditor.tracked(el);
        }
    
        static tracked(el: JQuery | HTMLElement) {
            if(typeof tinymce == "undefined") {
                return false;
            }
            const elem = $(el)[0];
            return !!$(elem).data("tinyEditor");
            /*var flag = false;
            $(window.tinymce.editors).each(function (i, ed) {
              if (el.id == ed.id) {
                flag = true;
              }
            });
            return flag;*/
        }
    }

    type Tracker = tinymceEditor | CKEditor | CodeMirrorEditor | AceEditor;
    type TrackerClass = typeof tinymceEditor | typeof CKEditor | typeof CodeMirrorEditor | typeof AceEditor;

    TogetherJS.addTracker(tinymceEditor, true);
    ///////////////// END OF TINYMCE ///////////////////////////////////

    function buildTrackers() {
        assert(!liveTrackers.length);
        util.forEachAttr(editTrackers, function(TrackerClass: TrackerClass) {
            const els = TrackerClass.scan();
            if(els) {
                $.each(els, function(this: JQuery) {
                    var tracker = new TrackerClass(this);
                    $(this).data("togetherjsHistory", ot.SimpleHistory(session.clientId, tracker.getContent(), 1));
                    liveTrackers.push(tracker);
                });
            }
        });
    }

    function destroyTrackers() {
        liveTrackers.forEach(function(tracker) {
            tracker.destroy();
        });
        liveTrackers = [];
    }

    function elementTracked(el: HTMLElement | JQuery) {
        var result = false;
        util.forEachAttr(editTrackers, function(TrackerClass) {
            if(TrackerClass.tracked(el)) {
                result = true;
            }
        });
        return result;
    }

    function getTracker(e: HTMLElement | JQuery, name: string) {
        const el = $(e)[0];
        for(var i = 0; i < liveTrackers.length; i++) {
            var tracker = liveTrackers[i];
            if(tracker.tracked(el)) {
                //FIXME: assert statement below throws an exception when data is submitted to the hub too fast
                //in other words, name == tracker.trackerName instead of name == tracker when someone types too fast in the tracked editor
                //commenting out this assert statement solves the problem
                assert((!name) || name == tracker.trackerName, "Expected to map to a tracker type", name, "but got", tracker.trackerName);
                return tracker;
            }
        }
        return null;
    }

    var TEXT_TYPES = ("color date datetime datetime-local email " + "tel text time week").split(/ /g);

    function isText(e: HTMLElement): e is (HTMLTextAreaElement | HTMLInputElement) {
        const el = $(e);
        var tag = el.prop("tagName");
        var type = (el.prop("type") || "text").toLowerCase();
        if(tag == "TEXTAREA") {
            return true;
        }
        if(tag == "INPUT" && TEXT_TYPES.indexOf(type) != -1) {
            return true;
        }
        return false;
    }

    function getValue(e: HTMLElement): boolean | string {
        const el = $(e);
        if(isCheckable(el)) {
            return el.prop("checked") as boolean; // "as boolean" serves as a reminder of the type of the value
        }
        else {
            return el.val();
        }
    }

    function getElementType(e: HTMLElement) {
        const el = $(e)[0];
        if(el.tagName == "TEXTAREA") {
            return "textarea";
        }
        if(el.tagName == "SELECT") {
            return "select";
        }
        if(el.tagName == "INPUT") {
            return (el.getAttribute("type") || "text").toLowerCase();
        }
        return "?";
    }

    function setValue(e: HTMLElement | JQuery, value: string) {
        const el = $(e);
        var changed = false;
        if(isCheckable(el)) {
            var checked = !!el.prop("checked");
            const boolValue = !!value;
            if(checked != boolValue) {
                changed = true;
                el.prop("checked", boolValue);
            }
        }
        else {
            if(el.val() != value) {
                changed = true;
                el.val(value);
            }
        }
        if(changed) {
            eventMaker.fireChange(el);
        }
    }

    /** Send the top of this history queue, if it hasn't been already sent. */
    function maybeSendUpdate(element: string, history: SimpleHistory, tracker?: string) {
        var change = history.getNextToSend();
        if(!change) {
            /* nothing to send */
            return;
        }
        var msg: TogetherJSNS.FormUpdateMessage = {
            type: "form-update",
            element: element,
            "server-echo": true,
            replace: {
                id: change.id,
                basis: change.basis,
                delta: {
                    start: change.delta.start,
                    del: change.delta.del,
                    text: change.delta.text
                }
            }
        };
        if(tracker) {
            msg.tracker = tracker;
        }
        session.send(msg);
    }

    session.hub.on("form-update", function(msg) {
        if(!msg.sameUrl) {
            return;
        }
        const el = $(elementFinder.findElement(msg.element));
        const el0 = el[0] as HTMLInputElement | HTMLTextAreaElement; // TODO is this cast right?
        var tracker;
        if(msg.tracker) {
            tracker = getTracker(el, msg.tracker);
            assert(tracker);
        }
        var focusedEl = el0.ownerDocument.activeElement as HTMLInputElement | HTMLTextAreaElement;
        let focusedElSelection: [number, number];
        if(isText(focusedEl)) {
            focusedElSelection = [focusedEl.selectionStart || 0, focusedEl.selectionEnd || 0];
        }
        let selection: [number, number] | undefined;
        if(isText(el0)) {
            //assert(el0.selectionStart);
            //assert(el0.selectionEnd);
            selection = [el0.selectionStart || 0, el0.selectionEnd || 0];
        }
        var value;
        if(msg.replace) {
            let history: SimpleHistory = el.data("togetherjsHistory");
            if(!history) {
                console.warn("form update received for uninitialized form element");
                return;
            }
            history.setSelection(selection);
            // make a real TextReplace object.
            msg.replace.delta = new ot.TextReplace(msg.replace.delta.start, msg.replace.delta.del, msg.replace.delta.text);
            // apply this change to the history
            var changed = history.commit(msg.replace);
            var trackerName = undefined;
            if(typeof tracker != "undefined") {
                trackerName = tracker.trackerName;
            }
            maybeSendUpdate(msg.element, history, trackerName);
            if(!changed) {
                return;
            }
            value = history.current;
            selection = history.getSelection() || undefined;
        }
        else {
            value = msg.value;
        }
        inRemoteUpdate = true;
        try {
            if(tracker) {
                tracker.update({ value: value });
            }
            else {
                setValue(el, value);
            }
            if(isText(el0)) {
                el0.selectionStart = selection[0];
                el0.selectionEnd = selection[1];
            }
            // return focus to original input:
            if(focusedEl != el0) {
                focusedEl.focus();
                if(isText(focusedEl)) {
                    focusedEl.selectionStart = focusedElSelection[0];
                    focusedEl.selectionEnd = focusedElSelection[1];
                }
            }
        }
        finally {
            inRemoteUpdate = false;
        }
    });

    var initSent = false;

    function sendInit() {
        initSent = true;
        var msg: TogetherJSNS.FormInitMessage = {
            type: "form-init",
            pageAge: Date.now() - TogetherJS.pageLoaded,
            updates: []
        };
        var els = $("textarea, input, select");
        els.each(function(this: JQuery) {
            if(elementFinder.ignoreElement(this) || elementTracked(this) ||
                suppressSync(this)) {
                return;
            }
            var el = $(this);
            const el0 = el[0];
            var value = getValue(el0);
            var upd = {
                element: elementFinder.elementLocation(this),
                //elementType: getElementType(el), // added in 5cbb88c9a but unused
                value: value
            };
            if(isText(el0)) {
                var history = el.data("togetherjsHistory");
                if(history) {
                    upd.value = history.committed;
                    upd.basis = history.basis;
                }
            }
            msg.updates.push(upd);
        });
        liveTrackers.forEach(function(tracker) {
            var init = tracker.makeInit();
            assert(tracker.tracked(init.element));
            var history = $(init.element).data("togetherjsHistory");
            if(history) {
                init.value = history.committed;
                init.basis = history.basis;
            }
            init.element = elementFinder.elementLocation($(init.element));
            msg.updates.push(init);
        });
        if(msg.updates.length) {
            session.send(msg);
        }
    }

    function setInit() {
        var els = $("textarea, input, select");
        els.each(function(this: JQuery) {
            if(elementTracked(this)) {
                return;
            }
            if(elementFinder.ignoreElement(this)) {
                return;
            }
            var el = $(this);
            var value = getValue(el[0]);
            el.data("togetherjsHistory", ot.SimpleHistory(session.clientId!, value, 1)); // TODO !
        });
        destroyTrackers();
        buildTrackers();
    }

    session.on("reinitialize", setInit);

    session.on("ui-ready", setInit);

    session.on("close", destroyTrackers);

    session.hub.on("form-init", function(msg) {
        if(!msg.sameUrl) {
            return;
        }
        if(initSent) {
            // In a 3+-peer situation more than one client may init; in this case
            // we're probably the other peer, and not the peer that needs the init
            // A quick check to see if we should init...
            var myAge = Date.now() - TogetherJS.pageLoaded;
            if(msg.pageAge < myAge) {
                // We've been around longer than the other person...
                return;
            }
        }
        // FIXME: need to figure out when to ignore inits
        msg.updates.forEach(function(update) {
            var el;
            try {
                el = elementFinder.findElement(update.element);
            } catch(e) {
                /* skip missing element */
                console.warn(e);
                return;
            }
            inRemoteUpdate = true;
            try {
                if(update.tracker) {
                    var tracker = getTracker(el, update.tracker);
                    assert(tracker);
                    tracker.init(update, msg);
                } else {
                    setValue(el, update.value);
                }
                if(update.basis) {
                    var history = $(el).data("togetherjsHistory");
                    // don't overwrite history if we're already up to date
                    // (we might have outstanding queued changes we don't want to lose)
                    if(!(history && history.basis === update.basis &&
                        // if history.basis is 1, the form could have lingering
                        // edits from before togetherjs was launched.  that's too bad,
                        // we need to erase them to resynchronize with the peer
                        // we just asked to join.
                        history.basis !== 1)) {
                        $(el).data("togetherjsHistory", ot.SimpleHistory(session.clientId, update.value, update.basis));
                    }
                }
            }
            finally {
                inRemoteUpdate = false;
            }
        });
    });

    var lastFocus: HTMLElement | null = null;

    function focus(event: Event) {
        const target = event.target as HTMLElement;
        if(elementFinder.ignoreElement(target) || elementTracked(target)) {
            blur(event);
            return;
        }
        if(target != lastFocus) {
            lastFocus = target;
            session.send({ type: "form-focus", element: elementFinder.elementLocation(target) });
        }
    }

    function blur(event: Event) {
        var target = event.target;
        if(lastFocus) {
            lastFocus = null;
            session.send({ type: "form-focus", element: null });
        }
    }

    var focusElements: {[peerId: string]: JQuery} = {};

    session.hub.on("form-focus", function(msg) {
        if(!msg.sameUrl) {
            return;
        }
        let current: JQuery | null = focusElements[msg.peer.id];
        if(current) {
            current.remove();
            current = null;
        }
        if(!msg.element) {
            // A blur
            return;
        }
        var element = elementFinder.findElement(msg.element);
        var el = createFocusElement(msg.peer, element);
        if(el) {
            focusElements[msg.peer.id] = el;
        }
    });

    function createFocusElement(peer: TogetherJSNS.PeerClass, around: HTMLElement | JQuery) {
        around = $(around);
        var aroundOffset = around.offset();
        if(!aroundOffset) {
            console.warn("Could not get offset of element:", around[0]);
            return null;
        }
        var el = templating.sub("focus", { peer: peer });
        el = el.find(".togetherjs-focus");
        el.css({
            top: aroundOffset.top - FOCUS_BUFFER + "px",
            left: aroundOffset.left - FOCUS_BUFFER + "px",
            width: around.outerWidth() + (FOCUS_BUFFER * 2) + "px",
            height: around.outerHeight() + (FOCUS_BUFFER * 2) + "px"
        });
        $(document.body).append(el);
        return el;
    }

    session.on("ui-ready", function() {
        $(document).on("change", change);
        // note that textInput, keydown, and keypress aren't appropriate events
        // to watch, since they fire *before* the element's value changes.
        $(document).on("input keyup cut paste", maybeChange);
        $(document).on("focusin", focus);
        $(document).on("focusout", blur);
    });

    session.on("close", function() {
        $(document).off("change", change);
        $(document).off("input keyup cut paste", maybeChange);
        $(document).off("focusin", focus);
        $(document).off("focusout", blur);
    });

    session.hub.on("hello", function(msg) {
        if(msg.sameUrl) {
            setTimeout(function() {
                sendInit();
                if(lastFocus) {
                    session.send({ type: "form-focus", element: elementFinder.elementLocation(lastFocus) });
                }
            });
        }
    });

    return {trackerClassExport: null} as unknown as {trackerClassExport: TrackerClass}; // TODO ugly export
}

define(["jquery", "util", "session", "elementFinder", "eventMaker", "templating", "ot"], formsMain);
