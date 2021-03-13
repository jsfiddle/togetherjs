/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

interface Ot {
    SimpleHistory: (clientId, initState, initBasis) => SimpleHistory,
    History: (clientId, initState) => History,
    TextReplace: (start, del, text) => TextReplace,
}

interface Change2 {
    id: string,
    delta,
    basis?,
    sent?: boolean,
}

type Delta = unknown;

/** SimpleHistory synchronizes peers by relying on the server to serialize
 * the order of all updates.  Each client maintains a queue of patches
 * which have not yet been 'committed' (by being echoed back from the
 * server).  The client is responsible for transposing its own queue
 * if 'earlier' patches are heard from the server.
 *
 * Let's say that A's edit "1" and B's edit "2" occur and get put in
 * their respective SimpleHistory queues.  The server happens to
 * handle 1 first, then 2, so those are the order that all peers
 * (both A and B) see the messages.
 *
 * A sees 1, and has 1 on its queue, so everything's fine. It
 * updates the 'committed' text to match its current text and drops
 * the patch from its queue. It then sees 2, but the basis number
 * for 2 no longer matches the committed basis, so it throws it
 * away.
 *
 * B sees 1, and has 2 on its queue. It does the OT transpose thing,
 * updating the committed text to include 1 and the 'current' text
 * to include 1+2. It updates its queue with the newly transposed
 * version of 2 (call it 2prime) and updates 2prime's basis
 * number. It them resends 2prime to the server. It then receives 2
 * (the original) but the basis number no longer matches the
 * committed basis, so it throws it away.
 *
 * Now the server sees 2prime and rebroadcasts it to both A and B.
 *
 * A is seeing it for the first time, and the basis number matches,
 * so it applies it to the current and committed text.
 *
 * B sees that 2prime matches what's on the start of its queue,
 * shifts it off, and updates the committed text to match the
 * current text.
 *
 * Note that no one tries to keep an entire history of changes,
 * which is the main difference with ot.History.  Everyone applies
 * the same patches in the same order.
 */
class SimpleHistory {
    private clientId;
    private committed;
    private current;
    private basis;
    private queue: Change2[] = [];
    private deltaId = 1;
    private selection: TextReplace | null = null;

    constructor(clientId: string, initState, initBasis) {
        this.clientId = clientId;
        this.committed = initState;
        this.current = initState;
        this.basis = initBasis;
    }

    /** Use a fake change to represent the selection. (This is the only bit that hard codes ot.TextReplace as the delta representation; override this in a subclass (or don't set the selection) if you are using a different delta representation. */
    setSelection(selection: [number, number]) {
        if(selection) {
            this.selection = new TextReplace(selection[0], selection[1] - selection[0], '@');
        } else {
            this.selection = null;
        }
    }

    /** Decode the fake change to reconstruct the updated selection. */
    getSelection() {
        if(!this.selection) {
            return null;
        }
        return [this.selection.start, this.selection.start + this.selection.del];
    }

    /** Add this delta to this client's queue. */
    add(delta: Delta) {
        let change: Change2 = {
            id: this.clientId + '.' + (this.deltaId++),
            delta: delta,
        };
        if(!this.queue.length) {
            change.basis = this.basis;
        }
        this.queue.push(change);
        this.current = delta.apply(this.current);
        return !!change.basis;
    }

    /** Apply a delta received from the server. Return true iff the current text changed as a result. */
    commit(change: Change2) {

        // ignore it if the basis doesn't match (this patch doesn't apply)
        // if so, this delta is out of order; we expect the original client
        // to retransmit an updated delta.
        if(change.basis !== this.basis) {
            return false; // 'current' text did not change
        }

        // is this the first thing on the queue?
        if(this.queue.length && this.queue[0].id === change.id) {
            assert(change.basis === this.queue[0].basis);
            // good, apply this to commit state & remove it from queue
            this.committed = this.queue.shift().delta.apply(this.committed);
            this.basis++;
            if(this.queue.length) {
                this.queue[0].basis = this.basis;
            }
            return false; // 'current' text did not change
        }

        // Transpose all bits on the queue to put this patch first.
        var inserted = change.delta;
        this.queue = this.queue.map(function(qchange) {
            var tt = qchange.delta.transpose(inserted);
            inserted = tt[1];
            return {
                id: qchange.id,
                delta: tt[0]
            };
        });
        if(this.selection) {
            // update the selection!
            this.selection = this.selection.transpose(inserted)[0];
        }
        this.committed = change.delta.apply(this.committed);
        this.basis++;
        if(this.queue.length) {
            this.queue[0].basis = this.basis;
        }
        // Update current by replaying queued changes starting from 'committed'
        this.current = this.committed;
        this.queue.forEach((qchange) => {
            this.current = qchange.delta.apply(this.current);
        });
        return true; // The 'current' text changed.
    }

    /** Return the next change to transmit to the server, or null if there isn't one. */
    getNextToSend() {
        let qchange = this.queue[0];
        if(!qchange) {
            /* nothing to send */
            return null;
        }
        if(qchange.sent) {
            /* already sent */
            return null;
        }
        assert(qchange.basis);
        qchange.sent = true;
        return qchange;
    }
}

interface HistoryItem {
    clientId: string,
    state,
}

class TJSHistory {
    private _history = new Queue<Change>();
    private known: {[clientId: string]: unknown} = {};
    private mostRecentLocalChange = null;
    private clientId: string;

    constructor(clientId: string, initState) {
        this._history.push({
            clientId: "init",
            state: initState
        });
        this.clientId = clientId;
    }

    add(change: Change) {
        // Simplest cast, it is our change:
        if(change.clientId == this.clientId) {
            this._history.push(change);
            this.mostRecentLocalChange = change.version;
            return change.delta;
        }
        assert((!this.known[change.clientId]) || this.known[change.clientId] < change.version, "Got a change", change, "that appears older (or same as) a known change", this.known[change.clientId]);
        // Second simplest case, we get a change that we can add to our
        // history without modification:
        var last = this._history.last();
        if((last.clientId == "init" || last.isBefore(change)) &&
            change.knowsAboutAll(this.known) &&
            change.knowsAboutVersion(this.mostRecentLocalChange, this.clientId)) {
            this._history.push(change);
            this.known[change.clientId] = change.version;
            return change.delta;
        }
        // We must do work!

        this.logHistory("//");

        // First we check if we need to modify this change because we
        // know about changes that it should know about (changes that
        // preceed it that are in our local history).
        var clientsToCheck = new StringSet();
        for(var clientId in this.known) {
            if(!this.known.hasOwnProperty(clientId)) {
                continue;
            }
            if(change.maybeMissingChanges(this.known[clientId], clientId)) {
                clientsToCheck.add(clientId);
            }
        }
        if(change.maybeMissingChanges(this.mostRecentLocalChange, this.clientId)) {
            clientsToCheck.add(this.clientId);
        }
        if(!clientsToCheck.isEmpty()) {
            let indexToCheckFrom: number | null = null;
            this._history.walkBack(function(c: Change, index) {
                indexToCheckFrom = index;
                if(c.clientId == "init") {
                    return false;
                }
                if(clientsToCheck.contains(c.clientId) &&
                    !change.maybeMissingChanges(c.version, c.clientId)) {
                    clientsToCheck.remove(c.clientId);
                    if(clientsToCheck.isEmpty()) {
                        return false;
                    }
                }
                return true;
            }, this);
            this._history.walkForward(indexToCheckFrom, function(c, index) {
                if(c.clientId == "init") {
                    return true;
                }
                if(change.isBefore(c)) {
                    return false;
                }
                if(!change.knowsAboutChange(c)) {
                    var presentDelta = this.promoteDelta(c.delta, index, change);
                    if(!presentDelta.equals(c.delta)) {
                        //console.log("->rebase delta rewrite", presentDelta+"");
                    }
                    this.logChange("->rebase", change, function() {
                        var result = change.delta.transpose(presentDelta);
                        change.delta = result[0];
                        change.known[c.clientId] = c.version;
                    }, "with:", c);
                }
                return true;
            }, this);
        }

        // Next we insert the change into its proper location
        var indexToInsert = null;
        this._history.walkBack(function(c, index) {
            if(c.clientId == "init" || c.isBefore(change)) {
                indexToInsert = index + 1;
                return false;
            }
            return true;
        }, this);
        assert(indexToInsert);
        this._history.insert(indexToInsert, change);

        // Now we fix up any forward changes
        var fixupDelta = change.delta;
        this._history.walkForward(indexToInsert + 1, function(c, index) {
            if(!c.knowsAboutChange(change)) {
                var origChange = c.clone();
                this.logChange("^^fix", c, function() {
                    var fixupResult = c.delta.transpose(fixupDelta);
                    console.log("  ^^real");
                    var result = c.delta.transpose(fixupDelta);
                    c.delta = result[0];
                    c.known[change.clientId] = change.version;
                    fixupDelta = fixupResult[1];
                }, "clone:", change.delta + "");
                console.log("(trans)", fixupDelta + "");
                assert(c.knowsAboutChange(change));
            }
        }, this);

        // Finally we return the transformed delta that represents
        // changes that should be made to the state:

        this.logHistory("!!");
        return fixupDelta;
    }

    promoteDelta(delta: Delta, deltaIndex: number, untilChange: Change) {
        this._history.walkForward(deltaIndex + 1, function(c, index) {
            if(untilChange.isBefore(c)) {
                return false;
            }
            // FIXME: not sure if this clientId check here is right.  Maybe
            // if untilChange.knowsAbout(c)?
            if(untilChange.knowsAboutChange(c)) {
                var result = c.delta.transpose(delta);
                delta = result[1];
            }
            return true;
        }, null);
        return delta;
    }

    logHistory(prefix: string = "") {
        var postfix = Array.prototype.slice.call(arguments, 1);
        console.log.apply(console, [prefix + "history", this.clientId, ":"].concat(postfix));
        console.log(prefix + " state:", JSON.stringify(this.getStateSafe()));
        let hstate;
        this._history.walkForward(0, function(c, index) {
            if(!index) {
                assert(c.clientId == "init");
                console.log(prefix + " init:", JSON.stringify(c.state));
                hstate = c.state;
            } else {
                try {
                    hstate = c.delta.apply(hstate);
                } catch(e) {
                    hstate = "Error: " + e;
                }
                console.log(prefix + "  ", index, c + "", JSON.stringify(hstate));
            }
        }, null);
    }

    logChange(prefix: string, change:, callback: () => void) {
        prefix = prefix || "before";
        var postfix = Array.prototype.slice.call(arguments, 3);
        console.log.apply(
            console,
            [prefix, this.clientId, ":", change + ""].concat(postfix).concat([JSON.stringify(this.getStateSafe(true))]));
        try {
            callback();
        } finally {
            console.log(prefix + " after:", change + "", JSON.stringify(this.getStateSafe()));
        }
    }

    addDelta(delta: Delta) {
        var version = this._createVersion();
        var change = new Change(version, this.clientId, delta, util.extend(this.knownVersions));
        this.add(change);
        return change;
    }

    _createVersion() {
        var max = 1;
        for(var id in this.knownVersions) {
            max = Math.max(max, this.knownVersions[id]);
        }
        max = Math.max(max, this.mostRecentLocalChange);
        return max + 1;
    }

    fault(change: Change) {
        throw new Error('Fault');
    }

    getState() {
        let state;
        this._history.walkForward(0, function(c) {
            if(c.clientId == "init") {
                // Initialization, has the state
                state = c.state;
            } else {
                state = c.delta.apply(state);
            }
        }, this);
        return state;
    }

    getStateSafe() {
        try {
            return this.getState();
        } catch(e) {
            return 'Error: ' + e;
        }
    }
}

class TextReplace {
    constructor(
        public readonly start: number,
        public readonly del: number,
        private text: string
    ) {
        assert(typeof start == "number" && typeof del == "number" && typeof text == "string", start, del, text);
        assert(start >= 0 && del >= 0, start, del);
    }

    toString() {
        if(this.empty()) {
            return '[no-op]';
        }
        if(!this.del) {
            return '[insert ' + JSON.stringify(this.text) + ' @' + this.start + ']';
        } else if(!this.text) {
            return '[delete ' + this.del + ' chars @' + this.start + ']';
        } else {
            return '[replace ' + this.del + ' chars with ' + JSON.stringify(this.text) + ' @' + this.start + ']';
        }
    }

    equals(other: TextReplace) {
        return other.constructor === this.constructor && other.del === this.del && other.start === this.start && other.text === this.text;
    }

    clone(start: number = this.start, del: number = this.del, text: string = this.text) {
        return new TextReplace(start, del, text);
    }

    empty() {
        return (!this.del) && (!this.text);
    }

    apply(text: string) {
        if(this.empty()) {
            return text;
        }
        if(this.start > text.length) {
            console.trace();
            throw new util.AssertionError("Start after end of text (" + JSON.stringify(text) + "/" + text.length + "): " + this);
        }
        if(this.start + this.del > text.length) {
            throw new util.AssertionError("Start+del after end of text (" + JSON.stringify(text) + "/" + text.length + "): " + this);
        }
        return text.substr(0, this.start) + this.text + text.substr(this.start + this.del);
    }

    transpose(delta: TextReplace) {
        /* Transform this delta as though the other delta had come before it.
            Returns a [new_version_of_this, transformed_delta], where transformed_delta
            satisfies:
    
            result1 = new_version_of_this.apply(delta.apply(text));
            result2 = transformed_delta.apply(this.apply(text));
            assert(result1 == result2);
    
            Does not modify this object.
        */
        var overlap;
        assert(delta instanceof TextReplace, "Transposing with non-TextReplace:", delta);
        if(this.empty()) {
            //console.log("  =this is empty");
            return [this.clone(), delta.clone()];
        }
        if(delta.empty()) {
            //console.log("  =other is empty");
            return [this.clone(), delta.clone()];
        }

        if(delta.before(this)) {
            //console.log("  =this after other");
            return [this.clone(this.start + delta.text.length - delta.del),
            delta.clone()];
        }
        else if(this.before(delta)) {
            //console.log("  =this before other");
            return [this.clone(), delta.clone(delta.start + this.text.length - this.del)];
        } else if(delta.sameRange(this)) {
            //console.log("  =same range");
            return [this.clone(this.start + delta.text.length, 0),
            delta.clone(undefined, 0)];
        }
        else if(delta.contains(this)) {
            //console.log("  =other contains this");
            return [this.clone(delta.start + delta.text.length, 0, this.text),
            delta.clone(undefined, delta.del - this.del + this.text.length, delta.text + this.text)];
        }
        else if(this.contains(delta)) {
            //console.log("  =this contains other");
            return [this.clone(undefined, this.del - delta.del + delta.text.length, delta.text + this.text),
            delta.clone(this.start, 0, delta.text)];
        }
        else if(this.overlapsStart(delta)) {
            //console.log("  =this overlaps start of other");
            overlap = this.start + this.del - delta.start;
            return [this.clone(undefined, this.del - overlap),
            delta.clone(this.start + this.text.length, delta.del - overlap)];
        }
        else {
            //console.log("  =this overlaps end of other");
            assert(delta.overlapsStart(this), delta + "", "does not overlap start of", this + "", delta.before(this));
            overlap = delta.start + delta.del - this.start;
            return [this.clone(delta.start + delta.text.length, this.del - overlap),
            delta.clone(undefined, delta.del - overlap)];
        }
        throw 'Should not happen';
    }

    before(other: TextReplace) {
        return this.start + this.del <= other.start;
    }

    contains(other: TextReplace) {
        return other.start >= this.start && other.start + other.del < this.start + this.del;
    }

    sameRange(other: TextReplace) {
        return other.start == this.start && other.del == this.del;
    }

    overlapsStart(other: TextReplace) {
        return this.start < other.start && this.start + this.del > other.start;
    }

    /* Make a new ot.TextReplace that converts oldValue to newValue. */
    static fromChange(oldValue: string, newValue: string) {
        assert(typeof oldValue == "string");
        assert(typeof newValue == "string");
        var commonStart = 0;
        while(commonStart < newValue.length &&
            newValue.charAt(commonStart) == oldValue.charAt(commonStart)) {
            commonStart++;
        }
        var commonEnd = 0;
        while(commonEnd < (newValue.length - commonStart) &&
            commonEnd < (oldValue.length - commonStart) &&
            newValue.charAt(newValue.length - commonEnd - 1) ==
            oldValue.charAt(oldValue.length - commonEnd - 1)) {
            commonEnd++;
        }
        var removed = oldValue.substr(commonStart, oldValue.length - commonStart - commonEnd);
        var inserted = newValue.substr(commonStart, newValue.length - commonStart - commonEnd);
        if(!(removed.length || inserted)) {
            return null;
        }
        return new this(commonStart, removed.length, inserted);
    }

    static random(source: string, generator: Randomizer) {
        var text, start, len;
        var ops = ["ins", "del", "repl"];
        if(!source.length) {
            ops = ["ins"];
        }
        switch(generator.pick(ops)) {
            case "ins":
                if(!generator.number(2)) {
                    text = generator.string(1);
                } else {
                    text = generator.string(generator.number(3) + 1);
                }
                if(!generator.number(4)) {
                    start = 0;
                } else if(!generator.number(3)) {
                    start = source.length - 1;
                } else {
                    start = generator.number(source.length);
                }
                return new this(start, 0, text);

            case "del":
                if(!generator.number(20)) {
                    return new this(0, source.length, "");
                }
                start = generator.number(source.length - 1);
                if(!generator.number(2)) {
                    len = 1;
                } else {
                    len = generator.number(5) + 1;
                }
                len = Math.min(len, source.length - start);
                return new this(start, len, "");

            case "repl":
                start = generator.number(source.length - 1);
                len = generator.number(5);
                len = Math.min(len, source.length - start);
                text = generator.string(generator.number(2) + 1);
                return new this(start, len, text);
        }
        throw 'Unreachable';
    }
}

class Queue<T> {
    private _q: T[] = [];
    private _deleted = 0;
    private _size: number | undefined;

    constructor(size?: number) {
        this._size = size;
    }

    _trim() {
        if(this._size) {
            if(this._q.length > this._size) {
                this._q.splice(0, this._q.length - this._size);
                this._deleted += this._q.length - this._size;
            }
        }
    }

    push(item: T) {
        this._q.push(item);
        this._trim();
    }

    last() {
        return this._q[this._q.length - 1];
    }

    walkBack<ThisArg>(callback: (this: ThisArg, item: T, index: number) => any, thisArg: ThisArg) {
        var result = true;
        for(var i = this._q.length - 1; i >= 0; i--) {
            var item = this._q[i];
            result = callback.call(thisArg, item, i + this._deleted);
            if(result === false) {
                return result;
            } else if(!result) {
                result = true;
            }
        }
        return result;
    }

    walkForward<ThisArg>(index: number, callback: (this: ThisArg, item: T, index: number) => any, thisArg: ThisArg) {
        var result = true;
        for(var i = index; i < this._q.length; i++) {
            var item = this._q[i - this._deleted];
            result = callback.call(thisArg, item, i);
            if(result === false) {
                return result;
            } else if(!result) {
                result = true;
            }
        }
        return result;
    }

    insert(index: number, item: T) {
        this._q.splice(index - this._deleted, 0, item);
    }

}

/** Set that only supports string items */
class StringSet {
    private _items: { [key: string]: null } = {};
    private _count = 0;

    contains(k: string) {
        assert(typeof k == "string");
        return this._items.hasOwnProperty(k);
    }
    add(k: string) {
        assert(typeof k == "string");
        if(this.contains(k)) {
            return;
        }
        this._items[k] = null;
        this._count++;
    }
    remove(k: string) {
        assert(typeof k == "string");
        if(!this.contains(k)) {
            return;
        }
        delete this._items[k];
        this._count++;
    }
    isEmpty() {
        return this._count === 0;
    }
}

class Change {
    public readonly version;
    public readonly clientId;
    public readonly delta;
    private known;
    private outOfOrder;

    constructor(version, clientId, delta, known, outOfOrder: boolean = false) {
        this.version = version;
        this.clientId = clientId;
        this.delta = delta;
        this.known = known;
        this.outOfOrder = outOfOrder;
        assert(typeof version == "number" && typeof clientId == "string", "Bad Change():", version, clientId);
    }

    toString() {
        var s = "[Change " + this.version + "." + this.clientId + ": ";
        s += this.delta + " ";
        if(this.outOfOrder) {
            s += "(out of order) ";
        }
        var cids = [];
        for(var a in this.known) {
            if(this.known.hasOwnProperty(a)) {
                cids.push(a);
            }
        }
        cids.sort();
        s += "{";
        if(!cids.length) {
            s += "nothing known";
        } else {
            cids.forEach(function(a, index) {
                if(index) {
                    s += ";";
                }
                s += a + ":" + this.known[a];
            }, this);
        }
        return s + "}]";
    }

    clone() {
        return new Change(this.version, this.clientId, this.delta.clone(), util.extend(this.known), this.outOfOrder);
    }

    isBefore(otherChange: Change) {
        assert(otherChange !== this, "Tried to compare a change to itself", this);
        return otherChange.version > this.version || (otherChange.version == this.version && otherChange.clientId > this.clientId);
    }

    knowsAboutAll(versions) {
        for(var clientId in versions) {
            if(!versions.hasOwnProperty(clientId)) {
                continue;
            }
            if(!versions[clientId]) {
                continue;
            }
            if((!this.known[clientId]) || this.known[clientId] < versions[clientId]) {
                return false;
            }
        }
        return true;
    }

    knowsAboutChange(change) {
        return change.clientId == this.clientId || (this.known[change.clientId] && this.known[change.clientId] >= change.version);
    }

    knowsAboutVersion(version, clientId) {
        if((!version) || clientId == this.clientId) {
            return true;
        }
        return this.known[clientId] && this.known[clientId] >= version;
    }

    maybeMissingChanges(mostRecentVersion, clientId) {
        if(!mostRecentVersion) {
            // No actual changes for clientId exist
            return false;
        }
        if(!this.known[clientId]) {
            // We don't even know about clientId, so we are definitely missing something
            return true;
        }
        if(this.known[clientId] >= mostRecentVersion) {
            // We know about all versions through mostRecentVersion
            return false;
        }
        if((clientId > this.clientId && this.known[clientId] >= this.version - 1) ||
            (clientId < this.clientId && this.known[clientId] == this.version)) {
            // We know about all versions from clientId that could exist before this
            // version
            return false;
        }
        // We may or may not be missing something
        return true;
    }
}

define(["util"], function(util: Util) {
    const assert: typeof util.assert = util.assert;

    const ot: Ot = {
        SimpleHistory: (clientId, initState, initBasis) => new SimpleHistory(clientId, initState, initBasis),
        History: (clientId, initState) => new History(clientId, initState),
        TextReplace: (start, del, text) => new TextReplace(start, del, text),
    }

    return ot;
});
