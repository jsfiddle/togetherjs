/* ot.SimpleHistory convergence, in the shape forms.js actually uses it.
   Ported from the doctest.js suite (togetherjs/tests/test_ot.js), which was
   excluded from the old Grunt runner — so this is the first time it runs.

   SimpleHistory relies on the server to serialize changes: each client queues
   local deltas, sends the head of its queue, and commits whatever the server
   broadcasts back. The property under test is that every client converges on
   the same text once the queues drain. */

import { describe, it, expect } from "vitest";
import ot from "../../src/sync/ot.js";
import Randomizer from "../../src/randomutil.js";

/* Stands in for the hub: serializes changes in arrival order and echoes each
   to every client, including the sender (which is what the real hub does for
   the originating client's own commit). */
class SerializingHub {
  constructor() {
    this.clients = [];
    this.log = [];
  }
  add(client) {
    this.clients.push(client);
  }
  /** Drain every client's outbox once, in round-robin order. */
  pump() {
    let sentAnything = false;
    for (const client of this.clients) {
      const change = client.history.getNextToSend();
      if (!change) continue;
      sentAnything = true;
      this.log.push(change);
      for (const target of this.clients) {
        target.history.commit({ id: change.id, delta: change.delta, basis: change.basis });
      }
    }
    return sentAnything;
  }
  /** Pump until nothing is left to send. */
  settle() {
    for (let i = 0; i < 1000; i++) {
      if (!this.pump()) return;
    }
    throw new Error("SimpleHistory never settled");
  }
}

function makeClient(id, hub, text) {
  const client = { id, history: ot.SimpleHistory(id, text, 1) };
  hub.add(client);
  return client;
}

describe("ot.SimpleHistory", () => {
  it("tracks local edits in its current state", () => {
    const history = ot.SimpleHistory("client1", "hello", 1);
    history.add(ot.TextReplace(5, 0, " world"));
    expect(history.current).toBe("hello world");
  });

  it("reports a selection round-trip", () => {
    const history = ot.SimpleHistory("client1", "hello world", 1);
    history.setSelection([2, 5]);
    expect(history.getSelection()).toEqual([2, 5]);
  });

  it("ignores a change whose basis does not match", () => {
    const history = ot.SimpleHistory("client1", "hello", 1);
    const changed = history.commit({
      id: "other.1",
      delta: ot.TextReplace(0, 0, "X"),
      basis: 99,
    });
    expect(changed).toBe(false);
    expect(history.current).toBe("hello");
  });

  it("converges across three clients making concurrent edits (seeded)", () => {
    const generator = new Randomizer(1);
    generator.defaultChars = "XYZ_ ";

    const hub = new SerializingHub();
    const clients = [
      makeClient("client1", hub, "abcdefg"),
      makeClient("client2", hub, "abcdefg"),
      makeClient("client3", hub, "abcdefg"),
    ];

    for (let round = 0; round < 25; round++) {
      // Everyone edits their own copy before anything is exchanged: that
      // concurrency is what transpose has to reconcile.
      for (const client of clients) {
        client.history.add(ot.TextReplace.random(client.history.current, generator));
      }
      hub.settle();
    }

    const texts = clients.map((c) => c.history.current);
    expect(new Set(texts).size, `diverged: ${JSON.stringify(texts)}`).toBe(1);
  });
});
