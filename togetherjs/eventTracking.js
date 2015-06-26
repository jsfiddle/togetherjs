define(function() {
  'use strict';

  /**
   * @type {{_listeners: {}, _onceListeners: {}}}
   */
  var eventHandling = {
    '_listeners': {},
    '_onceListeners': {}
  };

  /**
   * @param {string} name
   *
   * @return {boolean}
   *
   * @private
   */
  eventHandling._isMultipleEvents = function(name) {
    return name.search(" ") != -1;
  };

  /**
   * @param {string} name
   * @param {function} callback
   * @param {function} attachMethod
   */
  eventHandling._handleMultipleEvents = function(name, callback, attachMethod) {
    var i;
    var names;
    var namesLength;

    names = name.split(/ +/g);
    namesLength = names.length;

    for (i = 0; i < namesLength; i += 1) {
      attachMethod = attachMethod.bind(this);
      attachMethod(names[i], callback);
    }
  };

  /**
   * @param {function} callback
   * @param {string} errorMessage
   */
  eventHandling._abortIfCallbackIsNotAFunction = function(callback, errorMessage) {
    if (typeof callback != "function") {
      console.warn("Bad callback");
      throw new Error(errorMessage);
    }
  };

  /**
   * Creates a function that calls the callback passed then immediately removes itself from the list of listeners
   *
   * @param {string} name
   * @param {function} callback
   * @return {function}
   *
   * @private
   */
  eventHandling._createOnceCallback = function(name, callback) {
    var attr = "onceCallback_" + name;
    var onceCallback;

    if (!this._onceListeners.hasOwnProperty(attr) || this._onceListeners[attr] !== callback) {
      onceCallback = function () {
        callback.apply(this, arguments);
        this.off(name, onceCallback);
        delete this._onceListeners[attr];
      }.bind(this);

      this._onceListeners[attr] = onceCallback;
    }

    return onceCallback;
  };

  /**
   * @param {string} name
   * @param {function} callback
   */
  eventHandling.on = function(name, callback) {
    var thisString

    this._abortIfCallbackIsNotAFunction(callback, 'Error: .on() called with non-function for ' + name);

    if (this._isMultipleEvents(name)) {
      this._handleMultipleEvents(name, callback, this.on);
      return;
    }

    if (this._knownEvents && this._knownEvents.indexOf(name) == -1) {
      thisString = "" + this;
      if (thisString.length > 20) {
        thisString = thisString.substr(0, 20) + "...";
      }
      console.warn(thisString + ".on('" + name + "', ...): unknown event");
      if (console.trace) {
        console.trace();
      }
    }

    if (!this._listeners[name]) {
      this._listeners[name] = [];
    }

    if (this._listeners[name].indexOf(callback) == -1) {
      this._listeners[name].push(callback);
    }
  };

  /**
   * @param {string} name
   * @param {function} callback
   */
  eventHandling.once = function once(name, callback) {
    var onceFunction;

    this._abortIfCallbackIsNotAFunction(callback, "Error: .once() called with non-callback for " + name);
    onceFunction = this._createOnceCallback(name, callback);
    this.on(name, onceFunction);
  };

  /**
   *
   * @param {string} name
   * @param {function} callback
   */
  eventHandling.off = function off(name, callback) {
    var listeners;
    var listenersLength;
    var i;

    if (this._listenerOffs) {
      // Defer the .off() call until the .emit() is done.
      this._listenerOffs.push([name, callback]);
      return;
    }

    if (this._isMultipleEvents(name)) {
      this._handleMultipleEvents(name, callback, this.off);
      return;
    }

    if ((! this._listeners) || ! this._listeners[name]) {
      return;
    }

    listeners = this._listeners[name]
    listenersLength = listeners.length;

    for (i=0; i<listenersLength; i++) {
      if (listeners[i] == callback) {
        listeners.splice(i, 1);
        break;
      }
    }
  };

  /**
   * Bit of legacy handling
   *
   * @type {Function}
   */
  eventHandling.removeListener = eventHandling.off;

  /**
   * @param {string} name
   */
  eventHandling.emit = function emit(name) {
    var offs = this._listenerOffs = [];
    var args = Array.prototype.slice.call(arguments, 1);
    var listeners;

    if ((!this._listeners) || !this._listeners[name]) {
      return;
    }

    listeners = this._listeners[name];
    listeners.forEach(function (callback) {
      callback.apply(this, args);
    }, this);

    delete this._listenerOffs;

    if (offs.length) {
      offs.forEach(function (item) {
        this.off(item[0], item[1]);
      }, this);
    }
  };

  return eventHandling;
});
