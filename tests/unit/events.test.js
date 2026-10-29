/* The event system: EventEmitter and the mixinEvents() form, which must
   behave identically. Three of these cover bugs that the pre-2026
   TogetherJS._mixinEvents had. */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import EventEmitter, { mixinEvents } from "../../src/core/events.js";

class Emitter extends EventEmitter {}

/* Every test runs against both entry points, since mixinEvents() copies
   EventEmitter's own methods and a regression in one would be a regression in
   the other. */
const makers = {
  "EventEmitter subclass": () => new Emitter(),
  "mixinEvents(object)": () => mixinEvents({}),
  "mixinEvents(function)": () => mixinEvents(function target() {}),
};

for (const [label, make] of Object.entries(makers)) {
  describe(label, () => {
    it("calls a listener with the emitted arguments", () => {
      const obj = make();
      const seen = [];
      obj.on("ping", (a, b) => seen.push([a, b]));
      obj.emit("ping", 1, 2);
      expect(seen).toEqual([[1, 2]]);
    });

    it("stops calling a listener after off()", () => {
      const obj = make();
      const fn = vi.fn();
      obj.on("ping", fn);
      obj.off("ping", fn);
      obj.emit("ping");
      expect(fn).not.toHaveBeenCalled();
    });

    it("ignores a duplicate on() for the same callback", () => {
      const obj = make();
      const fn = vi.fn();
      obj.on("ping", fn);
      obj.on("ping", fn);
      obj.emit("ping");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("registers and removes space-separated event names", () => {
      const obj = make();
      const fn = vi.fn();
      obj.on("a b", fn);
      obj.emit("a");
      obj.emit("b");
      expect(fn).toHaveBeenCalledTimes(2);
      obj.off("a b", fn);
      obj.emit("a");
      obj.emit("b");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("calls a once() listener exactly once", () => {
      const obj = make();
      const fn = vi.fn();
      obj.once("ping", fn);
      obj.emit("ping");
      obj.emit("ping");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("lets off() cancel a once() listener by the original callback", () => {
      const obj = make();
      const fn = vi.fn();
      obj.once("ping", fn);
      obj.off("ping", fn);
      obj.emit("ping");
      expect(fn).not.toHaveBeenCalled();
    });

    it("defers an off() made from inside a listener", () => {
      // Otherwise removing a listener mid-emit would shift the iteration.
      const obj = make();
      const second = vi.fn();
      const first = () => obj.off("ping", second);
      obj.on("ping", first);
      obj.on("ping", second);
      obj.emit("ping");
      expect(second).toHaveBeenCalledTimes(1); // this emit still reaches it
      obj.emit("ping");
      expect(second).toHaveBeenCalledTimes(1); // but the next one does not
    });

    it("keeps off() working after a listener throws", () => {
      // The old emit() only released the deferral window on the happy path,
      // so one exception left _listenerOffs in place and off() silently
      // queued forever after. session.hub.emit() runs for every inbound
      // message, so this wedged the whole client.
      const obj = make();
      const fn = vi.fn();
      obj.on("boom", () => {
        throw new Error("listener failed");
      });
      expect(() => obj.emit("boom")).toThrow("listener failed");
      obj.on("ping", fn);
      obj.off("ping", fn);
      obj.emit("ping");
      expect(fn).not.toHaveBeenCalled();
    });

    it("keeps the deferral window open across a nested emit", () => {
      const obj = make();
      const late = vi.fn();
      obj.on("outer", () => {
        obj.emit("inner"); // used to close the outer window on return
        obj.off("outer", late);
      });
      obj.on("outer", late);
      obj.emit("outer");
      expect(late).toHaveBeenCalledTimes(1);
      obj.emit("outer");
      expect(late).toHaveBeenCalledTimes(1);
    });

    it("does not treat Object.prototype keys as registered events", () => {
      // Event names come off the wire: session.hub.emit(msg.type, msg).
      const obj = make();
      expect(() => obj.emit("constructor", {})).not.toThrow();
      expect(() => obj.emit("toString", {})).not.toThrow();
    });

    it("throws when given a non-callback", () => {
      const obj = make();
      vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(() => obj.on("ping", undefined)).toThrow("non-callback");
      expect(() => obj.once("ping", undefined)).toThrow("non-callback");
    });
  });
}

describe("once() across two emitters", () => {
  // The wrapper used to be cached on the callback function itself as
  // callback["onceCallback_" + name], so two emitters sharing a callback
  // shared one wrapper and whichever fired first unregistered both.
  it("fires on each emitter independently", () => {
    const a = new Emitter();
    const b = mixinEvents({});
    const fn = vi.fn();
    a.once("ping", fn);
    b.once("ping", fn);
    a.emit("ping");
    expect(fn).toHaveBeenCalledTimes(1);
    b.emit("ping");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("_knownEvents", () => {
  let warn;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "trace").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("warns about an event name outside the list", () => {
    const obj = mixinEvents({ _knownEvents: ["ready"], toString: () => "thing" });
    obj.on("ready", () => {});
    expect(warn).not.toHaveBeenCalled();
    obj.on("raedy", () => {});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("unknown event"));
  });
});

describe("mixinEvents", () => {
  it("returns the same object it was given", () => {
    const obj = {};
    expect(mixinEvents(obj)).toBe(obj);
  });

  it("adds the methods non-enumerably", () => {
    // These objects get walked elsewhere (util.extend, the config trackers),
    // so the event plumbing should not show up as data.
    const obj = mixinEvents({ real: 1 });
    expect(Object.keys(obj)).toEqual(["real"]);
    expect(typeof obj.emit).toBe("function");
  });

  it("does not copy a constructor onto the target", () => {
    const obj = mixinEvents({});
    expect(Object.prototype.hasOwnProperty.call(obj, "constructor")).toBe(false);
  });
});
