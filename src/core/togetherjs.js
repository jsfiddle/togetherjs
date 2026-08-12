/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* The TogetherJS object itself: configuration, the event mixin, startup state,
 * and the public API surface.
 *
 * This is deliberately free of any dependency on the rest of the client, so
 * that it evaluates first and every other module can `import TogetherJS from
 * "…/core/togetherjs.js"` instead of reaching for a global that may not exist
 * yet. Under RequireJS the load order made the global safe; in a single bundle
 * it would not be.
 *
 * The boot logic that actually starts a session lives in ../index.js.
 */

var defaultConfiguration = {
  // Disables clicks for a certain element.
  // (e.g., 'canvas' would not show clicks on canvas elements.)
  // Setting this to true will disable clicks globally.
  dontShowClicks: false,
  // Experimental feature to echo clicks to certain elements across clients:
  cloneClicks: false,
  // The base URL of the hub (gets filled in below):
  hubBase: null,
  // A function that will return the name of the user:
  getUserName: null,
  // A function that will return the color of the user:
  getUserColor: null,
  // A function that will return the avatar of the user:
  getUserAvatar: null,
  // The siteName is used in the walkthrough (defaults to document.title):
  siteName: null,
  // Any events to bind to
  on: {},
  // Hub events to bind to
  hub_on: {},
  // Enables the alt-T alt-T TogetherJS shortcut; however, this setting
  // must be enabled early as TogetherJSConfig_enableShortcut = true;
  enableShortcut: false,
  // The name of this tool as provided to users.  The UI is updated to use this.
  // Because of how it is used in text it should be a proper noun, e.g.,
  // "MySite's Collaboration Tool"
  toolName: null,
  // Used to auto-start TogetherJS with a {prefix: pageName, max: participants}
  // Also with findRoom: "roomName" it will connect to the given room name
  findRoom: null,
  // If true, starts TogetherJS automatically (of course!)
  autoStart: false,
  // If true, then the "Join TogetherJS Session?" confirmation dialog
  // won't come up
  suppressJoinConfirmation: false,
  // If true, then the "Invite a friend" window won't automatically come up
  suppressInvite: false,
  // A room in which to find people to invite to this session,
  inviteFromRoom: null,
  // This is used to keep sessions from crossing over on the same
  // domain, if for some reason you want sessions that are limited
  // to only a portion of the domain:
  storagePrefix: "togetherjs",
  // When true, we treat the entire URL, including the hash, as the identifier
  // of the page; i.e., if you one person is on `http://example.com/#view1`
  // and another person is at `http://example.com/#view2` then these two people
  // are considered to be at completely different URLs
  includeHashInUrl: false,
  // When true, the WebRTC-based mic/chat will be disabled
  disableWebRTC: false,
  // When true, the camera button is offered alongside the microphone.
  // Off by default: camera access is a bigger ask than the mic, and an
  // existing embed should not sprout a camera button on upgrade.
  enableVideo: false,
  // ICE servers for WebRTC. null means "just the default STUN server".
  // Supply TURN servers here if your users sit behind symmetric NATs.
  iceServers: null,
  // async () => RTCIceServer[]. Preferred over `iceServers` when TURN
  // credentials are short-lived and have to be minted per session.
  getIceServers: null,
  // The mesh is full-mesh, so uplink cost grows with the square of the
  // participant count. Past this many peers we refuse new connections
  // rather than degrading silently.
  maxRtcPeers: 6,
  // When true, youTube videos will synchronize
  youtube: true,
  // Ignores the following console messages, disables all messages if set to true
  ignoreMessages: ["cursor-update", "keydown", "scroll-update"],
  // Ignores the following forms (will ignore all forms if set to true):
  ignoreForms: [":password"],
  // When undefined, attempts to use the browser's language
  lang: undefined,
  fallbackLang: "en-US",
  // Overrides the UI's font-family; accepts any CSS font-family value,
  // including a reference to a CSS custom property already defined on
  // the host page (e.g. "var(--font-base)")
  baseFont: null,
};

// Substituted by build/build.mjs.
var BUILD_HUB_URL = __HUB_URL__;
var BUILD_GIT_COMMIT = __GIT_COMMIT__;
var BUILD_BASE_URL = __BASE_URL__;

defaultConfiguration.hubBase = BUILD_HUB_URL;

/* Resolve the base URL the client was served from; images and the stylesheet
   are fetched relative to it. */
function resolveBaseUrl() {
  if (window.TogetherJSConfig && window.TogetherJSConfig.baseUrl) {
    return window.TogetherJSConfig.baseUrl;
  }
  if (window.TogetherJSConfig_baseUrl) {
    return window.TogetherJSConfig_baseUrl;
  }
  if (BUILD_BASE_URL) {
    return BUILD_BASE_URL;
  }
  // import.meta.url is not available in an IIFE bundle, so fall back to
  // locating our own <script> tag, as the loader has always done.
  if (document.currentScript && document.currentScript.src) {
    return document.currentScript.src.replace(/\/*togetherjs(\.min)?\.js(\?.*)?$/, "");
  }
  var scripts = document.getElementsByTagName("script");
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].src;
    if (src && /togetherjs(\.min)?\.js(\?.*)?$/.test(src)) {
      return src.replace(/\/*togetherjs(\.min)?\.js(\?.*)?$/, "");
    }
  }
  console.warn("Could not determine TogetherJS's baseUrl");
  return "";
}

var baseUrl = resolveBaseUrl();

/* Development overrides stashed in localStorage; see the docs. */
function readOverride(key) {
  var raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    parsed = null;
  }
  if (!parsed || parsed.expiresAt < Date.now()) {
    localStorage.removeItem(key);
    return null;
  }
  return parsed;
}

var baseUrlOverride = readOverride("togetherjs.baseUrlOverride");
if (baseUrlOverride && baseUrlOverride.baseUrl) {
  baseUrl = baseUrlOverride.baseUrl;
  console.warn("Using TogetherJS baseUrlOverride:", baseUrl);
  console.warn("To undo run: localStorage.removeItem('togetherjs.baseUrlOverride')");
}

/* The callable TogetherJS() entry point. The body that actually starts a
   session is registered by ../index.js via TogetherJS._boot, keeping this
   module free of app dependencies. */
var TogetherJS = function TogetherJS(event) {
  return TogetherJS._boot(event);
};

TogetherJS._boot = function () {
  throw new Error("TogetherJS was loaded without its boot module");
};

TogetherJS.pageLoaded = Date.now();

TogetherJS._extend = function (base, extensions) {
  if (!extensions) {
    extensions = base;
    base = {};
  }
  for (var a in extensions) {
    if (Object.prototype.hasOwnProperty.call(extensions, a)) {
      base[a] = extensions[a];
    }
  }
  return base;
};

TogetherJS._startupInit = {
  // What element, if any, was used to start the session:
  button: null,
  // The startReason is the reason TogetherJS was started.  One of:
  //   null: not started
  //   started: hit the start button (first page view)
  //   joined: joined the session (first page view)
  reason: null,
  // Also, the session may have started on "this" page, or maybe is continued
  // from a past page.  TogetherJS.continued indicates the difference (false the
  // first time TogetherJS is started or joined, true on later page loads).
  continued: false,
  // This is set to tell the session what shareId to use, if the boot
  // code knows (mostly because the URL indicates the id).
  _joinShareId: null,
  // This tells session to start up immediately (otherwise it would wait
  // for session.start() to be run)
  _launch: false,
};
TogetherJS.startup = TogetherJS._extend(TogetherJS._startupInit);
TogetherJS.running = false;

TogetherJS._mixinEvents = function (proto) {
  proto.on = function on(name, callback) {
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
      this._listeners = {};
    }
    if (!this._listeners[name]) {
      this._listeners[name] = [];
    }
    if (this._listeners[name].indexOf(callback) == -1) {
      this._listeners[name].push(callback);
    }
  };
  proto.once = function once(name, callback) {
    if (typeof callback != "function") {
      console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
      throw new Error(".once() called with non-callback");
    }
    var attr = "onceCallback_" + name;
    if (!callback[attr]) {
      callback[attr] = function onceCallback() {
        callback.apply(this, arguments);
        this.off(name, onceCallback);
        delete callback[attr];
      };
    }
    this.on(name, callback[attr]);
  };
  proto.off = proto.removeListener = function off(name, callback) {
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
  };
  proto.emit = function emit(name) {
    var offs = (this._listenerOffs = []);
    if (!this._listeners || !this._listeners[name]) {
      delete this._listenerOffs;
      return;
    }
    var args = Array.prototype.slice.call(arguments, 1);
    // Copy: a listener may add or remove listeners while we iterate.
    this._listeners[name].slice().forEach(function (callback) {
      callback.apply(this, args);
    }, this);
    delete this._listenerOffs;
    offs.forEach(function (item) {
      this.off(item[0], item[1]);
    }, this);
  };
  return proto;
};

/* Finalizes the unloading of TogetherJS. Modules are singletons inside the
   bundle now, so unlike the RequireJS version this cannot discard their state;
   modules that hold session state reset themselves on session "close". */
TogetherJS._teardown = function () {
  TogetherJS._loaded = false;
  TogetherJS.startup = TogetherJS._extend(TogetherJS._startupInit);
  TogetherJS.running = false;
};

TogetherJS._mixinEvents(TogetherJS);
TogetherJS._knownEvents = ["ready", "close"];
TogetherJS.toString = function () {
  return "TogetherJS";
};

TogetherJS._configuration = {};
TogetherJS._defaultConfiguration = defaultConfiguration;
TogetherJS._configTrackers = {};
TogetherJS._configClosed = {};

TogetherJS.getConfig = function (name) {
  var value = TogetherJS._configuration[name];
  if (value === undefined) {
    if (!Object.prototype.hasOwnProperty.call(TogetherJS._defaultConfiguration, name)) {
      console.error("Tried to load unknown configuration value:", name);
    }
    value = TogetherJS._defaultConfiguration[name];
  }
  return value;
};

/* TogetherJS.config(configurationObject)
   or: TogetherJS.config(configName, value)

   Adds configuration to TogetherJS.  You may also set the global variable
   TogetherJSConfig and when TogetherJS is started that configuration will be
   loaded.

   Unknown configuration values will lead to console error messages.
   */
TogetherJS.config = function (name, maybeValue) {
  var settings;
  if (arguments.length == 1) {
    if (typeof name != "object") {
      throw new Error("TogetherJS.config(value) must have an object value (not: " + name + ")");
    }
    settings = name;
  } else {
    settings = {};
    settings[name] = maybeValue;
  }
  var attr;
  for (attr in settings) {
    if (Object.prototype.hasOwnProperty.call(settings, attr)) {
      if (TogetherJS._configClosed[attr] && TogetherJS.running) {
        throw new Error("The configuration " + attr + " is finalized and cannot be changed");
      }
    }
  }
  for (attr in settings) {
    if (!Object.prototype.hasOwnProperty.call(settings, attr)) {
      continue;
    }
    if (attr == "loaded" || attr == "callToStart") {
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(TogetherJS._defaultConfiguration, attr)) {
      console.warn("Unknown configuration value passed to TogetherJS.config():", attr);
    }
    var previous = TogetherJS._configuration[attr];
    var value = settings[attr];
    TogetherJS._configuration[attr] = value;
    // Note: the original indexed _configTrackers by `name`, which is the
    // *object* when config() is called with one argument — so trackers only
    // ever fired for the two-argument form. Index by attr so both work.
    var trackers = TogetherJS._configTrackers[attr] || [];
    var failed = false;
    var i;
    var tracker;
    for (i = 0; i < trackers.length; i++) {
      try {
        tracker = trackers[i];
        tracker(value, previous);
      } catch (e) {
        console.warn(
          "Error setting configuration",
          attr,
          "to",
          value,
          ":",
          e,
          "; reverting to",
          previous,
        );
        failed = true;
        break;
      }
    }
    if (failed) {
      TogetherJS._configuration[attr] = previous;
      for (i = 0; i < trackers.length; i++) {
        try {
          tracker = trackers[i];
          tracker(previous, value);
        } catch (e) {
          console.warn("Error REsetting configuration", attr, "to", previous, ":", e, "(ignoring)");
        }
      }
    }
  }
};

TogetherJS.config.get = TogetherJS.getConfig;

TogetherJS.config.track = function (name, callback) {
  if (!Object.prototype.hasOwnProperty.call(TogetherJS._defaultConfiguration, name)) {
    throw new Error("Configuration is unknown: " + name);
  }
  callback(TogetherJS.config.get(name));
  if (!TogetherJS._configTrackers[name]) {
    TogetherJS._configTrackers[name] = [];
  }
  TogetherJS._configTrackers[name].push(callback);
  return callback;
};

TogetherJS.config.close = function (name) {
  if (!Object.prototype.hasOwnProperty.call(TogetherJS._defaultConfiguration, name)) {
    throw new Error("Configuration is unknown: " + name);
  }
  TogetherJS._configClosed[name] = true;
  return TogetherJS.config.get(name);
};

TogetherJS.version = BUILD_GIT_COMMIT || "unknown";
TogetherJS.baseUrl = baseUrl;

TogetherJS.hub = TogetherJS._mixinEvents({});

TogetherJS._onmessage = function (msg) {
  var type = msg.type;
  if (type.search(/^app\./) === 0) {
    type = type.substr("app.".length);
  } else {
    type = "togetherjs." + type;
  }
  msg.type = type;
  TogetherJS.hub.emit(msg.type, msg);
};

/* Injects the stylesheet. Called on start rather than at load so that merely
   including the script does not restyle the host page. */
TogetherJS.addStyle = function () {
  if (document.getElementById("togetherjs-stylesheet")) {
    return;
  }
  var link = document.createElement("link");
  link.id = "togetherjs-stylesheet";
  link.setAttribute("rel", "stylesheet");
  link.href = baseUrl + "/togetherjs.css";
  document.head.appendChild(link);
};

var listener = null;

TogetherJS.listenForShortcut = function () {
  console.warn("Listening for alt-T alt-T to start TogetherJS");
  TogetherJS.removeShortcut();
  listener = function listener(event) {
    if (event.which == 84 && event.altKey) {
      if (listener.pressed) {
        // Second hit
        TogetherJS();
      } else {
        listener.pressed = true;
      }
    } else {
      listener.pressed = false;
    }
  };
  TogetherJS.once("ready", TogetherJS.removeShortcut);
  document.addEventListener("keyup", listener, false);
};

TogetherJS.removeShortcut = function () {
  if (listener) {
    // Was addEventListener here, so the shortcut could never be removed.
    document.removeEventListener("keyup", listener, false);
    listener = null;
  }
};

TogetherJS.config.track("enableShortcut", function (enable, previous) {
  if (enable) {
    TogetherJS.listenForShortcut();
  } else if (previous) {
    TogetherJS.removeShortcut();
  }
});

TogetherJS.checkForUsersOnChannel = function (address, callback) {
  if (address.search(/^https?:/i) === 0) {
    address = address.replace(/^http/i, "ws");
  }
  var socket = new WebSocket(address);
  var gotAnswer = false;
  socket.onmessage = function (event) {
    var msg = JSON.parse(event.data);
    if (msg.type != "init-connection") {
      console.warn("Got unexpected first message (should be init-connection):", msg);
      return;
    }
    if (gotAnswer) {
      console.warn("Somehow received two responses from channel; ignoring second");
      socket.close();
      return;
    }
    gotAnswer = true;
    socket.close();
    callback(msg.peerCount);
  };
  socket.onclose = socket.onerror = function () {
    if (!gotAnswer) {
      console.warn("Socket was closed without receiving answer");
      gotAnswer = true;
      callback(undefined);
    }
  };
};

window.TogetherJS = TogetherJS;
// For compatibility:
window.TowTruck = TogetherJS;

export default TogetherJS;
