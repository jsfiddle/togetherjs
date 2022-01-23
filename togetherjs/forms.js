/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define(["require", "exports", "jquery", "./elementFinder", "./eventMaker", "./ot", "./session", "./templating", "./util"], function (require, exports, jquery_1, elementFinder_1, eventMaker_1, ot_1, session_1, templating_1, util_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    jquery_1 = __importDefault(jquery_1);
    //function formsMain($: JQueryStatic, util: TogetherJSNS.Util, session: TogetherJSNS.Session, elementFinder: TogetherJSNS.ElementFinder, eventMaker: TogetherJSNS.EventMaker, templating: TogetherJSNS.Templating, ot: TogetherJSNS.Ot) {
    const assert = util_1.util.assert.bind(util_1.util);
    // This is how much larger the focus element is than the element it surrounds
    // (this is padding on each side)
    const FOCUS_BUFFER = 5;
    let inRemoteUpdate = false;
    function suppressSync(element) {
        const ignoreForms = TogetherJS.config.get("ignoreForms");
        if (ignoreForms === true) {
            return true;
        }
        else if (ignoreForms === undefined) {
            return false;
        }
        else {
            return (0, jquery_1.default)(element).is(ignoreForms.join(","));
        }
    }
    function maybeChange(event) {
        var _a;
        // Called when we get an event that may or may not indicate a real change (like keyup in a textarea)
        const tag = (_a = event.target) === null || _a === void 0 ? void 0 : _a.tagName;
        if (tag && (tag == "TEXTAREA" || tag == "INPUT")) {
            change(event);
        }
    }
    function change(event) {
        sendData({
            element: event.target,
            value: getValue(event.target)
        });
    }
    function sendData(attrs) {
        const el = (0, jquery_1.default)(attrs.element);
        assert(el);
        const tracker = "tracker" in attrs ? attrs.tracker : undefined;
        const value = attrs.value;
        if (inRemoteUpdate) {
            return;
        }
        if (elementFinder_1.elementFinder.ignoreElement(el) || (elementTracked(el) && !tracker) || suppressSync(el)) {
            return;
        }
        const location = elementFinder_1.elementFinder.elementLocation(el);
        const msg = {
            type: "form-update",
            element: location,
            value: value,
        };
        // TODO I added this typeof value == "string" check because normally value is a string when isText(el[0]) but TS doesn't know that, maybe there is a better way to do that
        if (typeof value == "string" && (isText(el[0]) || tracker)) {
            const history = el.data("togetherjsHistory");
            if (history) {
                if (history.current == value) {
                    return;
                }
                const delta = ot_1.TextReplace.fromChange(history.current, value);
                assert(delta);
                history.add(delta);
                maybeSendUpdate(location, history, tracker);
                return;
            }
            else {
                msg.basis = 1;
                el.data("togetherjsHistory", new ot_1.SimpleHistory(session_1.session.clientId, value, 1));
            }
        }
        session_1.session.send(msg);
    }
    function isCheckable(element) {
        const el = (0, jquery_1.default)(element);
        const type = (el.prop("type") || "text").toLowerCase();
        if (el.prop("tagName") == "INPUT" && ["radio", "checkbox"].indexOf(type) != -1) {
            return true;
        }
        return false;
    }
    class Editor {
        constructor(trackerName, element) {
            this.trackerName = trackerName;
            this.element = element;
        }
    }
    // TODO factorize code between editors
    class AceEditor extends Editor {
        constructor(el) {
            super("AceEditor", (0, jquery_1.default)(el)[0]);
            assert((0, jquery_1.default)(this.element).hasClass("ace_editor"));
            this._change = this._change.bind(this);
            this._editor().document.on("change", this._change);
        }
        destroy() {
            this._editor().document.removeListener("change", this._change);
        }
        update(msg) {
            this._editor().document.setValue(msg.value);
        }
        init(update) {
            this.update(update);
        }
        makeInit() {
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
            // FIXME: I should have an internal .send() function that automatically asserts !inRemoteUpdate, among other things
            if (inRemoteUpdate) {
                return;
            }
            sendData({
                tracker: this.trackerName,
                element: this.element,
                value: this.getContent()
            });
        }
        getContent() {
            return this._editor().document.getValue();
        }
        static scan() {
            return (0, jquery_1.default)(".ace_editor");
        }
        /** Non-static version */
        tracked(el) {
            return AceEditor.tracked(el);
        }
        static tracked(el) {
            return !!(0, jquery_1.default)(el).closest(".ace_editor").length;
        }
    }
    AceEditor.trackerName = "AceEditor";
    class CodeMirrorEditor extends Editor {
        constructor(el) {
            super("CodeMirrorEditor", (0, jquery_1.default)(el)[0]);
            assert("CodeMirror" in this.element);
            this._change = this._change.bind(this);
            this._editor().on("change", this._change);
        }
        tracked2(el) {
            return this.element === (0, jquery_1.default)(el)[0];
        }
        destroy() {
            this._editor().off("change", this._change);
        }
        update(msg) {
            this._editor().setValue(msg.value);
        }
        init(msg) {
            if (msg.value) {
                this.update(msg);
            }
        }
        makeInit() {
            return {
                element: this.element,
                tracker: this.trackerName,
                value: this._editor().getValue()
            };
        }
        _change() {
            if (inRemoteUpdate) {
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
        getContent() {
            return this._editor().getValue();
        }
        static scan() {
            const result = [];
            const els = document.body.getElementsByTagName("*");
            const _len = els.length;
            for (let i = 0; i < _len; i++) {
                const el = els[i];
                if ("CodeMirror" in el) {
                    result.push(el);
                }
            }
            return (0, jquery_1.default)(result);
        }
        /** Non-static version */
        tracked(el) {
            return CodeMirrorEditor.tracked(el);
        }
        static tracked(e) {
            let el = (0, jquery_1.default)(e)[0];
            while (el) {
                if ("CodeMirror" in el) {
                    return true;
                }
                el = el.parentNode;
            }
            return false;
        }
    }
    CodeMirrorEditor.trackerName = "CodeMirrorEditor";
    class CKEditor extends Editor {
        constructor(el) {
            super("CKEditor", (0, jquery_1.default)(el)[0]);
            assert(CKEDITOR);
            assert(CKEDITOR.dom.element.get(this.element));
            this._change = this._change.bind(this);
            // FIXME: change event is available since CKEditor 4.2
            this._editor().on("change", this._change);
        }
        tracked2(el) {
            return this.element === (0, jquery_1.default)(el)[0];
        }
        destroy() {
            this._editor().removeListener("change", this._change);
        }
        update(msg) {
            //FIXME: use setHtml instead of setData to avoid frame reloading overhead
            this._editor().editable().setHtml(msg.value);
        }
        init(update) {
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
            if (inRemoteUpdate) {
                return;
            }
            sendData({
                tracker: this.trackerName,
                element: this.element,
                value: this.getContent()
            });
        }
        _editor() {
            assert(CKEDITOR); // TODO assert added
            return CKEDITOR.dom.element.get(this.element).getEditor();
        }
        getContent() {
            return this._editor().getData();
        }
        static scan() {
            const result = [];
            if (typeof CKEDITOR == "undefined") {
                return;
            }
            let editorInstance;
            for (const instanceIdentifier in CKEDITOR.instances) {
                editorInstance = document.getElementById(instanceIdentifier) || document.getElementsByName(instanceIdentifier)[0];
                if (editorInstance) {
                    result.push(editorInstance);
                }
            }
            return (0, jquery_1.default)(result);
        }
        /** Non-static version */
        tracked(el) {
            return CKEditor.tracked(el);
        }
        static tracked(el) {
            if (typeof CKEDITOR == "undefined") {
                return false;
            }
            const elem = (0, jquery_1.default)(el)[0];
            return !!(CKEDITOR.dom.element.get(elem) && CKEDITOR.dom.element.get(elem).getEditor());
        }
    }
    CKEditor.trackerName = "CKEditor";
    class tinymceEditor extends Editor {
        constructor(el) {
            super("tinymceEditor", (0, jquery_1.default)(el)[0]);
            assert((0, jquery_1.default)(this.element).attr('id').indexOf('mce_') != -1);
            this._change = this._change.bind(this);
            this._editor().on("input keyup cut paste change", this._change);
        }
        tracked2(el) {
            return this.element === (0, jquery_1.default)(el)[0];
        }
        destroy() {
            this._editor().destroy(); // TODO was "destory", probably a typo, fixed
        }
        update(msg) {
            this._editor().setContent(msg.value, { format: 'raw' });
        }
        init(update) {
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
            if (inRemoteUpdate) {
                return;
            }
            sendData({
                tracker: this.trackerName,
                element: this.element,
                value: this.getContent()
            });
        }
        _editor() {
            if (typeof tinymce == "undefined") {
                throw new Error("TinyEditor is undefined");
                //return; // TODO was returning undefined, remove for now for easier typechecking
            }
            return (0, jquery_1.default)(this.element).data("tinyEditor");
        }
        getContent() {
            return this._editor().getContent();
        }
        static scan() {
            //scan all the elements that contain tinyMCE editors
            if (typeof window.tinymce == "undefined") {
                return;
            }
            const result = [];
            (0, jquery_1.default)(window.tinymce.editors).each(function (_i, ed) {
                result.push((0, jquery_1.default)('#' + ed.id));
                //its impossible to retrieve a single editor from a container, so lets store it
                (0, jquery_1.default)('#' + ed.id).data("tinyEditor", ed);
            });
            return (0, jquery_1.default)(result);
        }
        /** Non-static version */
        tracked(el) {
            return tinymceEditor.tracked(el);
        }
        static tracked(el) {
            if (typeof tinymce == "undefined") {
                return false;
            }
            const elem = (0, jquery_1.default)(el)[0];
            return !!(0, jquery_1.default)(elem).data("tinyEditor");
            /*var flag = false;
            $(window.tinymce.editors).each(function (i, ed) {
                if (el.id == ed.id) {
                flag = true;
                }
            });
            return flag;*/
        }
    }
    tinymceEditor.trackerName = "tinymceEditor";
    const editTrackers = {};
    let liveTrackers = [];
    TogetherJS.addTracker = function (TrackerClass, skipSetInit) {
        //assert(typeof TrackerClass === "function", "You must pass in a class");
        //assert(typeof TrackerClass.prototype.trackerName === "string", "Needs a .prototype.trackerName string");
        // Test for required instance methods.
        /*
        "destroy update init makeInit tracked".split(/ /).forEach(function(m) {
            //assert(typeof TrackerClass.prototype[m] === "function", "Missing required tracker method: " + m);
        });
        // Test for required class methods.
        "scan tracked".split(/ /).forEach(function(m) {
            //assert(typeof TrackerClass[m] === "function", "Missing required tracker class method: " + m);
        });
        */
        editTrackers[TrackerClass.trackerName] = TrackerClass;
        if (!skipSetInit) {
            setInit();
        }
    };
    TogetherJS.addTracker(AceEditor, true /* skip setInit */);
    TogetherJS.addTracker(CodeMirrorEditor, true /* skip setInit */);
    TogetherJS.addTracker(CKEditor, true /* skip setInit */);
    TogetherJS.addTracker(tinymceEditor, true);
    function buildTrackers() {
        assert(!liveTrackers.length);
        util_1.util.forEachAttr(editTrackers, function (TrackerClass) {
            const els = TrackerClass.scan();
            if (els) {
                jquery_1.default.each(els, function () {
                    const tracker = new TrackerClass(this);
                    (0, jquery_1.default)(this).data("togetherjsHistory", new ot_1.SimpleHistory(session_1.session.clientId, tracker.getContent(), 1));
                    liveTrackers.push(tracker);
                });
            }
        });
    }
    function destroyTrackers() {
        liveTrackers.forEach(function (tracker) {
            tracker.destroy();
        });
        liveTrackers = [];
    }
    function elementTracked(el) {
        let result = false;
        util_1.util.forEachAttr(editTrackers, function (TrackerClass) {
            if (TrackerClass.tracked(el)) {
                result = true;
            }
        });
        return result;
    }
    function getTracker(e, name) {
        if (name === null) {
            return null;
        }
        const el = (0, jquery_1.default)(e)[0];
        for (let i = 0; i < liveTrackers.length; i++) {
            const tracker = liveTrackers[i];
            if (tracker.tracked(el)) {
                // TODO read the comment below, weird!
                //FIXME: assert statement below throws an exception when data is submitted to the hub too fast
                //in other words, name == tracker.trackerName instead of name == tracker when someone types too fast in the tracked editor
                //commenting out this assert statement solves the problem
                assert((!name) || name == tracker.trackerName, "Expected to map to a tracker type", name, "but got", tracker.trackerName);
                return tracker;
            }
        }
        return null;
    }
    const TEXT_TYPES = ("color date datetime datetime-local email " + "tel text time week").split(/ /g);
    function isText(e) {
        const el = (0, jquery_1.default)(e);
        const tag = el.prop("tagName");
        const type = (el.prop("type") || "text").toLowerCase();
        if (tag == "TEXTAREA") {
            return true;
        }
        if (tag == "INPUT" && TEXT_TYPES.indexOf(type) != -1) {
            return true;
        }
        return false;
    }
    function getValue(e) {
        var _a;
        const el = (0, jquery_1.default)(e);
        if (isCheckable(el)) {
            return el.prop("checked"); // "as boolean" serves as a reminder of the type of the value
        }
        else {
            return (_a = el.val()) !== null && _a !== void 0 ? _a : ""; // .val() sometimes returns null (for a <select> with no children for example), we still need to return a string in this case because return null causes problem in other places
        }
    }
    function setValue(e, value) {
        const el = (0, jquery_1.default)(e);
        let changed = false;
        if (isCheckable(el)) {
            assert(typeof value == "boolean"); // TODO normally any checkable element should be with a boolean value, getting a clearer logic might be good
            const checked = !!el.prop("checked");
            if (checked != value) {
                changed = true;
                el.prop("checked", value);
            }
        }
        else {
            assert(typeof value == "string"); // see above
            if (el.val() != value) {
                changed = true;
                el.val(value);
            }
        }
        if (changed) {
            eventMaker_1.eventMaker.fireChange(el);
        }
    }
    /** Send the top of this history queue, if it hasn't been already sent. */
    function maybeSendUpdate(element, history, tracker) {
        const change = history.getNextToSend();
        if (!change) {
            /* nothing to send */
            return;
        }
        const msg = {
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
        if (tracker) {
            msg.tracker = tracker;
        }
        session_1.session.send(msg);
    }
    session_1.session.hub.on("form-update", function (msg) {
        var _a;
        if (!msg.sameUrl) {
            return;
        }
        const el = (0, jquery_1.default)(elementFinder_1.elementFinder.findElement(msg.element));
        const el0 = el[0]; // TODO is this cast right?
        if (typeof msg.value === "boolean") {
            setValue(el, msg.value);
            return;
        }
        let tracker;
        if ("tracker" in msg) {
            // TODO weird gymnastic with tmp var here
            const tracker0 = getTracker(el, (_a = msg.tracker) !== null && _a !== void 0 ? _a : null);
            assert(tracker0);
            tracker = tracker0;
        }
        const focusedEl = el0.ownerDocument.activeElement;
        let focusedElSelection;
        if (isText(focusedEl)) {
            focusedElSelection = [focusedEl.selectionStart || 0, focusedEl.selectionEnd || 0];
        }
        let selection;
        if (isText(el0)) {
            //assert(el0.selectionStart);
            //assert(el0.selectionEnd);
            selection = [el0.selectionStart || 0, el0.selectionEnd || 0];
        }
        let value;
        if ("replace" in msg) {
            const history = el.data("togetherjsHistory");
            if (!history) {
                console.warn("form update received for uninitialized form element");
                return;
            }
            history.setSelection(selection);
            // make a real TextReplace object.
            const delta = new ot_1.TextReplace(msg.replace.delta.start, msg.replace.delta.del, msg.replace.delta.text);
            const change = { id: msg.replace.id, delta: delta, basis: msg.replace.basis };
            // apply this change to the history
            const changed = history.commit(change);
            let trackerName = undefined;
            if (typeof tracker != "undefined") {
                trackerName = tracker.trackerName;
            }
            maybeSendUpdate(msg.element, history, trackerName);
            if (!changed) {
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
            if ("tracker" in msg && tracker) {
                tracker.update({ value: value });
            }
            else {
                setValue(el, value);
            }
            if (isText(el0)) {
                el0.selectionStart = selection[0]; // TODO ! these are in a try block so we are probably good. It's kind of a ugly way to deal with the problem, we should change it (similar comment below)
                el0.selectionEnd = selection[1];
            }
            // return focus to original input:
            if (focusedEl != el0) {
                focusedEl.focus();
                if (isText(focusedEl)) {
                    focusedEl.selectionStart = focusedElSelection[0]; // TODO ! same remark as above
                    focusedEl.selectionEnd = focusedElSelection[1];
                }
            }
        }
        finally {
            inRemoteUpdate = false;
        }
    });
    let initSent = false;
    function sendInit() {
        initSent = true;
        const msg = {
            type: "form-init",
            pageAge: Date.now() - TogetherJS.pageLoaded,
            updates: []
        };
        const els = (0, jquery_1.default)("textarea, input, select");
        els.each(function () {
            if (elementFinder_1.elementFinder.ignoreElement(this) || elementTracked(this) || suppressSync(this)) {
                return;
            }
            const el = (0, jquery_1.default)(this);
            const el0 = el[0];
            const value = getValue(el0);
            // TODO old code in /**/
            /*
            let upd: TogetherJSNS.MessageForEditor.StringElement_WithoutTracker = {
                element: elementFinder.elementLocation(this),
                //elementType: getElementType(el), // added in 5cbb88c9a but unused
                value: value
            };
            */
            // TODO added this typeof check because isText(el0) implies that value is of type string but TS doesn't know that
            // TODO logic has been changed to typecheck reasons, we need to verify that the behavior is the same
            if (isText(el0)) {
                const history = el.data("togetherjsHistory");
                if (history) {
                    const upd = {
                        element: elementFinder_1.elementFinder.elementLocation(this),
                        value: history.committed,
                        basis: history.basis,
                    };
                    msg.updates.push(upd);
                }
                else {
                    const upd = {
                        element: elementFinder_1.elementFinder.elementLocation(this),
                        value: value,
                    };
                    msg.updates.push(upd);
                }
            }
            else {
                const upd = {
                    element: elementFinder_1.elementFinder.elementLocation(this),
                    value: value,
                };
                msg.updates.push(upd);
            }
        });
        liveTrackers.forEach(function (tracker) {
            const init0 = tracker.makeInit();
            assert(tracker.tracked(init0.element));
            const history = (0, jquery_1.default)(init0.element).data("togetherjsHistory");
            // TODO check the logic change
            const init = {
                element: elementFinder_1.elementFinder.elementLocation((0, jquery_1.default)(init0.element)),
                tracker: init0.tracker,
                value: init0.value,
            };
            if (history) {
                init.value = history.committed;
                init.basis = history.basis;
            }
            msg.updates.push(init);
        });
        if (msg.updates.length) {
            session_1.session.send(msg);
        }
    }
    function setInit() {
        const els = (0, jquery_1.default)("textarea, input, select");
        els.each(function () {
            if (elementTracked(this)) {
                return;
            }
            if (elementFinder_1.elementFinder.ignoreElement(this)) {
                return;
            }
            const el = (0, jquery_1.default)(this);
            const value = getValue(el[0]);
            if (typeof value === "string") { // no need to create an History if it's not a string value
                // TODO maybe we should find a way to have a better use of getValue so that we can "guess" the type depending on the argument
                el.data("togetherjsHistory", new ot_1.SimpleHistory(session_1.session.clientId, value, 1)); // TODO !
            }
        });
        destroyTrackers();
        buildTrackers();
    }
    session_1.session.on("reinitialize", setInit);
    session_1.session.on("ui-ready", setInit);
    session_1.session.on("close", destroyTrackers);
    session_1.session.hub.on("form-init", function (msg) {
        if (!msg.sameUrl) {
            return;
        }
        if (initSent) {
            // In a 3+-peer situation more than one client may init; in this case
            // we're probably the other peer, and not the peer that needs the init
            // A quick check to see if we should init...
            const myAge = Date.now() - TogetherJS.pageLoaded;
            if (msg.pageAge < myAge) {
                // We've been around longer than the other person...
                return;
            }
        }
        // FIXME: need to figure out when to ignore inits
        msg.updates.forEach(function (update) {
            let el;
            try {
                el = elementFinder_1.elementFinder.findElement(update.element);
            }
            catch (e) {
                /* skip missing element */
                console.warn(e);
                return;
            }
            inRemoteUpdate = true;
            try {
                if ("tracker" in update && update.tracker) {
                    const tracker = getTracker(el, update.tracker);
                    assert(tracker);
                    tracker.init(update); // TODO remove arg msg that was unused in the called function
                }
                else {
                    setValue(el, update.value);
                }
                if ("basis" in update && update.basis) {
                    const history = (0, jquery_1.default)(el).data("togetherjsHistory");
                    // don't overwrite history if we're already up to date
                    // (we might have outstanding queued changes we don't want to lose)
                    if (!(history && history.basis === update.basis && history.basis !== 1)) {
                        // we check "history.basis !== 1" because if history.basis is 1, the form could have lingering edits from before togetherjs was launched.  that's too bad, we need to erase them to resynchronize with the peer we just asked to join.
                        (0, jquery_1.default)(el).data("togetherjsHistory", new ot_1.SimpleHistory(session_1.session.clientId, update.value, update.basis));
                    }
                }
            }
            finally {
                inRemoteUpdate = false;
            }
        });
    });
    let lastFocus = null;
    function focus(event) {
        const target = event.target;
        if (elementFinder_1.elementFinder.ignoreElement(target) || elementTracked(target)) {
            blur();
            return;
        }
        if (target != lastFocus) {
            lastFocus = target;
            session_1.session.send({ type: "form-focus", element: elementFinder_1.elementFinder.elementLocation(target) });
        }
    }
    function blur() {
        if (lastFocus) {
            lastFocus = null;
            session_1.session.send({ type: "form-focus", element: null });
        }
    }
    const focusElements = {};
    session_1.session.hub.on("form-focus", function (msg) {
        if (!msg.sameUrl) {
            return;
        }
        let current = focusElements[msg.peer.id];
        if (current) {
            current.remove();
            current = null;
        }
        if (!msg.element) {
            // A blur
            return;
        }
        const element = elementFinder_1.elementFinder.findElement(msg.element);
        const el = createFocusElement(msg.peer, element);
        if (el) {
            focusElements[msg.peer.id] = el;
        }
    });
    function createFocusElement(peer, around) {
        around = (0, jquery_1.default)(around);
        const aroundOffset = around.offset();
        if (!aroundOffset) {
            console.warn("Could not get offset of element:", around[0]);
            return null;
        }
        let el = templating_1.templating.sub("focus", { peer: peer });
        el = el.find(".togetherjs-focus");
        el.css({
            top: aroundOffset.top - FOCUS_BUFFER + "px",
            left: aroundOffset.left - FOCUS_BUFFER + "px",
            width: around.outerWidth() + (FOCUS_BUFFER * 2) + "px",
            height: around.outerHeight() + (FOCUS_BUFFER * 2) + "px"
        });
        (0, jquery_1.default)(document.body).append(el);
        return el;
    }
    session_1.session.on("ui-ready", function () {
        (0, jquery_1.default)(document).on("change", change);
        // note that textInput, keydown, and keypress aren't appropriate events
        // to watch, since they fire *before* the element's value changes.
        (0, jquery_1.default)(document).on("input keyup cut paste", maybeChange);
        (0, jquery_1.default)(document).on("focusin", focus);
        (0, jquery_1.default)(document).on("focusout", blur);
    });
    session_1.session.on("close", function () {
        (0, jquery_1.default)(document).off("change", change);
        (0, jquery_1.default)(document).off("input keyup cut paste", maybeChange);
        (0, jquery_1.default)(document).off("focusin", focus);
        (0, jquery_1.default)(document).off("focusout", blur);
    });
    session_1.session.hub.on("hello", function (msg) {
        if (msg.sameUrl) {
            setTimeout(function () {
                sendInit();
                if (lastFocus) {
                    session_1.session.send({ type: "form-focus", element: elementFinder_1.elementFinder.elementLocation(lastFocus) });
                }
            });
        }
    });
});
//}
//define(["jquery", "util", "session", "elementFinder", "eventMaker", "templating", "ot"], formsMain);
