/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* The event system shared by everything in the client.
 *
 * Two ways in:
 *
 *   class Thing extends EventEmitter { ... }        for real classes
 *   var singleton = mixinEvents({ ... });           for the module singletons
 *
 * `mixinEvents` copies EventEmitter's methods onto an existing object, so
 * there is one implementation rather than two. It can also take a *function*
 * — TogetherJS itself is one.
 *
 * This module deliberately imports nothing. util.js imports it (so it cannot
 * import util.js back), and togetherjs.js is the root of the import graph.
 * The method bodies therefore only use `console`, never `util.assert`.
 */

/* Subclasses may set `_knownEvents` to an array of event names; `.on()` then
   warns about anything else, which catches typos in event names.

   EventEmitter intentionally has NO constructor. `mixinEvents` cannot run one,
   so every piece of per-emitter state below is created lazily on first use and
   the two paths stay identical. Do not "tidy" this into field declarations or
   a constructor: the nine singletons would silently lose their state. */
class EventEmitter {
  on(name, callback) {
    if (typeof callback != "function") {
      console.warn("Bad callback for", this, ".on(", name, ", ", callback, ")");
      throw new Error(".on() called with non-callback");
    }
    if (name.search(" ") != -1) {
      name.split(/ +/g).forEach(function (n) {
        this.on(n, callback);
      }, this);
      return;
    }
    if (this._knownEvents && this._knownEvents.indexOf(name) == -1) {
      var thisString = "" + this;
      if (thisString.length > 20) {
        thisString = thisString.substr(0, 20) + "...";
      }
      console.warn(thisString + ".on('" + name + "', ...): unknown event");
      if (console.trace) {
        console.trace();
      }
    }
    if (!this._listeners) {
      /* Null prototype: event names arrive off the wire, so a peer sending
         {type: "constructor"} must not find Object.prototype.constructor. */
      this._listeners = Object.create(null);
    }
    if (!this._listeners[name]) {
      this._listeners[name] = [];
    }
    if (this._listeners[name].indexOf(callback) == -1) {
      this._listeners[name].push(callback);
    }
  }

  /* The wrapper is stored per emitter and per event, keyed by the caller's
     callback. The old implementation cached it on the callback function
     itself, so the same callback passed to two emitters shared one wrapper
     and whichever fired first unregistered it from both. */
  once(name, callback) {
    if (typeof callback != "function") {
      console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
      throw new Error(".once() called with non-callback");
    }
    if (name.search(" ") != -1) {
      name.split(/ +/g).forEach(function (n) {
        this.once(n, callback);
      }, this);
      return;
    }
    if (!this._onceWrappers) {
      this._onceWrappers = Object.create(null);
    }
    if (!this._onceWrappers[name]) {
      this._onceWrappers[name] = new Map();
    }
    var wrappers = this._onceWrappers[name];
    if (wrappers.has(callback)) {
      // Already registered; .on() would ignore the duplicate anyway.
      return;
    }
    var self = this;
    var wrapper = function onceCallback() {
      self.off(name, wrapper);
      wrappers.delete(callback);
      callback.apply(this, arguments);
    };
    wrappers.set(callback, wrapper);
    this.on(name, wrapper);
  }

  off(name, callback) {
    if (this._listenerOffs) {
      // Defer the .off() call until the .emit() is done.
      this._listenerOffs.push([name, callback]);
      return;
    }
    if (name.search(" ") != -1) {
      name.split(/ +/g).forEach(function (n) {
        this.off(n, callback);
      }, this);
      return;
    }
    /* Let .off() take the callback that was passed to .once(), not just the
       wrapper that .once() actually registered. */
    if (this._onceWrappers && this._onceWrappers[name]) {
      var wrapper = this._onceWrappers[name].get(callback);
      if (wrapper) {
        this._onceWrappers[name].delete(callback);
        callback = wrapper;
      }
    }
    if (!this._listeners || !this._listeners[name]) {
      return;
    }
    var l = this._listeners[name];
    for (var i = 0; i < l.length; i++) {
      if (l[i] == callback) {
        l.splice(i, 1);
        break;
      }
    }
  }

  removeListener(name, callback) {
    return this.off(name, callback);
  }

  emit(name) {
    /* .off() during an .emit() is deferred so that removing a listener does
       not perturb the iteration. Only the outermost emit owns that window —
       a nested emit on the same object must not close it early — and the
       window is released in a `finally` so that a throwing listener cannot
       leave _listenerOffs in place, which used to wedge .off() permanently. */
    var outermost = !this._listenerOffs;
    var offs = outermost ? (this._listenerOffs = []) : this._listenerOffs;
    try {
      if (!this._listeners || !this._listeners[name]) {
        return;
      }
      var args = Array.prototype.slice.call(arguments, 1);
      // Copy: a listener may add or remove listeners while we iterate.
      this._listeners[name].slice().forEach(function (callback) {
        callback.apply(this, args);
      }, this);
    } finally {
      if (outermost) {
        delete this._listenerOffs;
        offs.forEach(function (item) {
          this.off(item[0], item[1]);
        }, this);
      }
    }
  }
}

/* Class methods are non-enumerable, so a for-in or Object.assign copy would
   find nothing. Descriptors also keep the methods non-enumerable on the
   target, which matters: these objects get iterated elsewhere (util.extend,
   the config walkers) and the event plumbing should stay out of the way. */
var EVENT_METHODS = Object.getOwnPropertyDescriptors(EventEmitter.prototype);
delete EVENT_METHODS.constructor;

/* Adds the event methods to an existing object or function, and returns it. */
export function mixinEvents(target) {
  Object.defineProperties(target, EVENT_METHODS);
  return target;
}

export { EventEmitter };
export default EventEmitter;
