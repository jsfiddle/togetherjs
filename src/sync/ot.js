/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import util from "../core/util.js";


var ot = util.Module("ot");
var assert = util.assert;

/* SimpleHistory synchronizes peers by relying on the server to serialize
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
ot.SimpleHistory = class SimpleHistory {

  constructor(clientId, initState, initBasis) {
    this.clientId = clientId;
    this.committed = initState;
    this.current = initState;
    this.basis = initBasis;
    this.queue = [];
    this.deltaId = 1;
    this.selection = null;
  }

  // Use a fake change to represent the selection.
  // (This is the only bit that hard codes ot.TextReplace as the delta
  // representation; override this in a subclass (or don't set the
  // selection) if you are using a different delta representation.
  setSelection(selection) {
    if (selection) {
      this.selection = new ot.TextReplace(selection[0],
                                          selection[1] - selection[0], '@');
    } else {
      this.selection = null;
    }
  }

  // Decode the fake change to reconstruct the updated selection.
  getSelection() {
    if (! this.selection) {
      return null;
    }
    return [this.selection.start, this.selection.start + this.selection.del];
  }

  // Add this delta to this client's queue.
  add(delta) {
    var change = {
      id: this.clientId + '.' + (this.deltaId++),
      delta: delta
    };
    if (! this.queue.length) {
      change.basis = this.basis;
    }
    this.queue.push(change);
    this.current = delta.apply(this.current);
    return !!change.basis;
  }

  // Apply a delta received from the server.
  // Return true iff the current text changed as a result.
  commit(change) {

    // ignore it if the basis doesn't match (this patch doesn't apply)
    // if so, this delta is out of order; we expect the original client
    // to retransmit an updated delta.
    if (change.basis !== this.basis) {
      return false; // 'current' text did not change
    }

    // is this the first thing on the queue?
    if (this.queue.length && this.queue[0].id === change.id) {
      assert(change.basis === this.queue[0].basis);
      // good, apply this to commit state & remove it from queue
      this.committed = this.queue.shift().delta.apply(this.committed);
      this.basis++;
      if (this.queue.length) {
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
    if (this.selection) {
      // update the selection!
      this.selection = this.selection.transpose(inserted)[0];
    }
    this.committed = change.delta.apply(this.committed);
    this.basis++;
    if (this.queue.length) {
      this.queue[0].basis = this.basis;
    }
    // Update current by replaying queued changes starting from 'committed'
    this.current = this.committed;
    this.queue.forEach(function(qchange) {
      this.current = qchange.delta.apply(this.current);
    }.bind(this));
    return true; // The 'current' text changed.
  }

  // Return the next change to transmit to the server, or null if there
  // isn't one.
  getNextToSend() {
    var qchange = this.queue[0];
    if (! qchange) {
      /* nothing to send */
      return null;
    }
    if (qchange.sent) {
      /* already sent */
      return null;
    }
    assert(qchange.basis);
    qchange.sent = true;
    return qchange;
  }
};

ot.TextReplace = class TextReplace {

  constructor(start, del, text) {
    assert(typeof start == "number" && typeof del == "number" && typeof text == "string", start, del, text);
    assert(start >=0 && del >= 0, start, del);
    this.start = start;
    this.del = del;
    this.text = text;
  }

  toString() {
    if (this.empty()) {
      return '[no-op]';
    }
    if (! this.del) {
      return '[insert ' + JSON.stringify(this.text) + ' @' + this.start + ']';
    } else if (! this.text) {
      return '[delete ' + this.del + ' chars @' + this.start + ']';
    } else {
      return '[replace ' + this.del + ' chars with ' + JSON.stringify(this.text) + ' @' + this.start + ']';
    }
  }

  equals(other) {
    return other.constructor === this.constructor &&
        other.del === this.del &&
        other.start === this.start &&
        other.text === this.text;
  }

  clone(start, del, text) {
    if (start === undefined) {
      start = this.start;
    }
    if (del === undefined) {
      del = this.del;
    }
    if (text === undefined) {
      text = this.text;
    }
    return new ot.TextReplace(start, del, text);
  }

  empty() {
    return (! this.del) && (! this.text);
  }

  apply(text) {
    if (this.empty()) {
      return text;
    }
    if (this.start > text.length) {
      console.trace();
      throw new util.AssertionError("Start after end of text (" + JSON.stringify(text) + "/" + text.length + "): " + this);
    }
    if (this.start + this.del > text.length) {
      throw new util.AssertionError("Start+del after end of text (" + JSON.stringify(text) + "/" + text.length + "): " + this);
    }
    return text.substr(0, this.start) + this.text + text.substr(this.start+this.del);
  }

  transpose(delta) {
    /* Transform this delta as though the other delta had come before it.
       Returns a [new_version_of_this, transformed_delta], where transformed_delta
       satisfies:

       result1 = new_version_of_this.apply(delta.apply(text));
       result2 = transformed_delta.apply(this.apply(text));
       assert(result1 == result2);

       Does not modify this object.
    */
    var overlap;
    assert(delta instanceof ot.TextReplace, "Transposing with non-TextReplace:", delta);
    if (this.empty()) {
      //console.log("  =this is empty");
      return [this.clone(), delta.clone()];
    }
    if (delta.empty()) {
      //console.log("  =other is empty");
      return [this.clone(), delta.clone()];
    }
    if (delta.before(this)) {
      //console.log("  =this after other");
      return [this.clone(this.start + delta.text.length - delta.del),
              delta.clone()];
    } else if (this.before(delta)) {
      //console.log("  =this before other");
      return [this.clone(), delta.clone(delta.start + this.text.length - this.del)];
    } else if (delta.sameRange(this)) {
      //console.log("  =same range");
      return [this.clone(this.start+delta.text.length, 0),
              delta.clone(undefined, 0)];
    } else if (delta.contains(this)) {
      //console.log("  =other contains this");
      return [this.clone(delta.start+delta.text.length, 0, this.text),
              delta.clone(undefined, delta.del - this.del + this.text.length, delta.text + this.text)];
    } else if (this.contains(delta)) {
      //console.log("  =this contains other");
      return [this.clone(undefined, this.del - delta.del + delta.text.length, delta.text + this.text),
              delta.clone(this.start, 0, delta.text)];
    } else if (this.overlapsStart(delta)) {
      //console.log("  =this overlaps start of other");
      overlap = this.start + this.del - delta.start;
      return [this.clone(undefined, this.del - overlap),
              delta.clone(this.start + this.text.length, delta.del - overlap)];
    } else {
      //console.log("  =this overlaps end of other");
      assert(delta.overlapsStart(this), delta+"", "does not overlap start of", this+"", delta.before(this));
      overlap = delta.start + delta.del - this.start;
      return [this.clone(delta.start + delta.text.length, this.del - overlap),
              delta.clone(undefined, delta.del - overlap)];
    }
  }

  before(other) {
    return this.start + this.del <= other.start;
  }

  contains(other) {
    return other.start >= this.start && other.start + other.del < this.start + this.del;
  }

  sameRange(other) {
    return other.start == this.start && other.del == this.del;
  }

  overlapsStart(other) {
    return this.start < other.start && this.start + this.del > other.start;
  }


    /* Make a new ot.TextReplace that converts oldValue to newValue. */
  static fromChange(oldValue, newValue) {
    assert(typeof oldValue == "string");
    assert(typeof newValue == "string");
    var commonStart = 0;
    while (commonStart < newValue.length &&
           newValue.charAt(commonStart) == oldValue.charAt(commonStart)) {
      commonStart++;
    }
    var commonEnd = 0;
    while (commonEnd < (newValue.length - commonStart) &&
           commonEnd < (oldValue.length - commonStart) &&
           newValue.charAt(newValue.length - commonEnd - 1) ==
           oldValue.charAt(oldValue.length - commonEnd - 1)) {
      commonEnd++;
    }
    var removed = oldValue.substr(commonStart, oldValue.length - commonStart - commonEnd);
    var inserted = newValue.substr(commonStart, newValue.length - commonStart - commonEnd);
    if (! (removed.length || inserted)) {
      return null;
    }
    return new this(commonStart, removed.length, inserted);
  }

  static random(source, generator) {
    var text, start, len;
    var ops = ["ins", "del", "repl"];
    if (! source.length) {
      ops = ["ins"];
    }
    switch (generator.pick(ops)) {
    case "ins":
      if (! generator.number(2)) {
        text = generator.string(1);
      } else {
        text = generator.string(generator.number(3)+1);
      }
      if (! generator.number(4)) {
        start = 0;
      } else if (! generator.number(3)) {
        start = source.length-1;
      } else {
        start = generator.number(source.length);
      }
      return new this(start, 0, text);

    case "del":
      if (! generator.number(20)) {
        return new this(0, source.length, "");
      }
      start = generator.number(source.length-1);
      if (! generator.number(2)) {
        len = 1;
      } else {
        len = generator.number(5)+1;
      }
      len = Math.min(len, source.length - start);
      return new this(start, len, "");

    case "repl":
      start = generator.number(source.length-1);
      len = generator.number(5);
      len = Math.min(len, source.length - start);
      text = generator.string(generator.number(2)+1);
      return new this(start, len, text);
    }
    throw new Error('Unreachable');
  }
};

export default ot;
