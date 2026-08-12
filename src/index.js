/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Boot module: folds page configuration into TogetherJS, then starts or stops
 * a session. Importing core/togetherjs.js first guarantees the TogetherJS
 * object exists before any other module's top-level code runs. */

import TogetherJS from "./core/togetherjs.js";
import session from "./core/session.js";
import * as registry from "./core/registry.js";
import storage from "./core/storage.js";
import util from "./core/util.js";

/* Feature modules. Order matters: session.js must finish evaluating before
   these do, because they attach handlers to the session object at load time.
   RequireJS expressed this as session.js's `features` array; here it is just
   import order. Each of these registers itself with core/registry.js so the
   modules on an import cycle can find one another at call time. */
import "./ui/ui.js";
import "./core/peers.js";
import "./core/who.js";
import "./core/startup.js";
import "./ui/windowing.js";
import "./ui/walkthrough.js";
import "./ui/chat.js";
import "./ui/visibility.js";
import "./sync/cursor.js";
import "./sync/forms.js";
import "./sync/videos.js";
import "./sync/youtube.js";
import "./rtc/index.js";

/* Fold TogetherJSConfig / TogetherJSConfig_* page globals into the config. */
function applyPageConfiguration() {
  if (window.TowTruckConfig) {
    console.warn("TowTruckConfig is deprecated; please use TogetherJSConfig");
    if (window.TogetherJSConfig) {
      console.warn("Ignoring TowTruckConfig in favor of TogetherJSConfig");
    } else {
      window.TogetherJSConfig = window.TowTruckConfig;
    }
  }
  if (window.TogetherJSConfig && !window.TogetherJSConfig.loaded) {
    TogetherJS.config(window.TogetherJSConfig);
    window.TogetherJSConfig.loaded = true;
  }

  // TogetherJSConfig_on_* are folded into the "on" configuration value.
  var globalOns = {};
  var attr;
  var attrName;
  for (attr in window) {
    if (attr.indexOf("TogetherJSConfig_on_") === 0) {
      attrName = attr.substr("TogetherJSConfig_on_".length);
      globalOns[attrName] = window[attr];
    } else if (attr.indexOf("TogetherJSConfig_") === 0) {
      attrName = attr.substr("TogetherJSConfig_".length);
      TogetherJS.config(attrName, window[attr]);
    } else if (attr.indexOf("TowTruckConfig_on_") === 0) {
      attrName = attr.substr("TowTruckConfig_on_".length);
      console.warn("TowTruckConfig_* is deprecated, please rename", attr, "to TogetherJSConfig_on_" + attrName);
      globalOns[attrName] = window[attr];
    } else if (attr.indexOf("TowTruckConfig_") === 0) {
      attrName = attr.substr("TowTruckConfig_".length);
      console.warn("TowTruckConfig_* is deprecated, please rename", attr, "to TogetherJSConfig_" + attrName);
      TogetherJS.config(attrName, window[attr]);
    }
  }

  var ons = TogetherJS.config.get("on");
  for (attr in globalOns) {
    if (Object.prototype.hasOwnProperty.call(globalOns, attr)) {
      ons[attr] = globalOns[attr];
    }
  }
  TogetherJS.config("on", ons);
  for (attr in ons) {
    TogetherJS.on(attr, ons[attr]);
  }
  var hubOns = TogetherJS.config.get("hub_on");
  if (hubOns) {
    for (attr in hubOns) {
      if (Object.prototype.hasOwnProperty.call(hubOns, attr)) {
        TogetherJS.hub.on(attr, hubOns[attr]);
      }
    }
  }
}

/* Work out which element, if any, started the session, so the dock can fly out
   of it. Accepts an event, an element, or a jQuery-ish array. */
function startTargetFrom(event) {
  try {
    if (event && typeof event == "object") {
      if (event.target && typeof event) {
        return event.target;
      }
      if (event.nodeType == 1) {
        return event;
      }
      if (event[0] && event[0].nodeType == 1) {
        return event[0];
      }
    }
  } catch (e) {
    console.warn("Error determining starting button:", e);
  }
  return null;
}

TogetherJS._boot = function (event) {
  if (TogetherJS.running) {
    session.close();
    return;
  }
  TogetherJS.startup.button = startTargetFrom(event);
  applyPageConfiguration();

  if (!TogetherJS.startup.reason) {
    // A call to TogetherJS() from a button must have started TogetherJS
    TogetherJS.startup.reason = "started";
  }

  TogetherJS.addStyle();
  TogetherJS._loaded = true;
  // initShareId() distinguishes a fresh launch from a continued session by
  // this flag; without it, it throws and the whole start chain dies silently.
  TogetherJS.startup._launch = true;
  session.start();
};

/* Escape hatch for tests and debugging. The RequireJS build exposed the whole
   module graph through TogetherJS.require(); this is the deliberate, much
   smaller replacement. Not part of the supported API. */
TogetherJS._internals = { session: session, registry: registry, storage: storage, util: util };

TogetherJS.reinitialize = function () {
  if (TogetherJS.running) {
    session.emit("reinitialize");
  }
};

TogetherJS.refreshUserData = function () {
  if (TogetherJS.running) {
    session.emit("refresh-user-data");
  }
};

TogetherJS.send = function (msg) {
  if (!TogetherJS.running) {
    throw new Error("You cannot use TogetherJS.send() when TogetherJS is not running");
  }
  session.appSend(msg);
};

TogetherJS.shareUrl = function () {
  return TogetherJS.running ? session.shareUrl() : null;
};

// It's nice to replace this early, before the load event fires, so we conflict
// as little as possible with the app we are embedded in:
var hash = location.hash.replace(/^#/, "");
var m = /&?togetherjs=([^&]*)/.exec(hash);
if (m) {
  TogetherJS.startup._joinShareId = m[1];
  TogetherJS.startup.reason = "joined";
  location.hash = hash.substr(0, m.index) + hash.substr(m.index + m[0].length);
}

function onload() {
  if (TogetherJS.startup._joinShareId) {
    TogetherJS();
    return;
  }
  if (window._TogetherJSBookmarklet) {
    delete window._TogetherJSBookmarklet;
    TogetherJS();
    return;
  }
  var prefix = TogetherJS.config.get("storagePrefix");
  var value = sessionStorage.getItem(prefix + "-session.status");
  if (value) {
    value = JSON.parse(value);
    if (value && value.running) {
      TogetherJS.startup.continued = true;
      TogetherJS.startup.reason = value.startupReason;
      TogetherJS();
    }
  } else if (
    window.TogetherJSConfig_autoStart ||
    (window.TogetherJSConfig && window.TogetherJSConfig.autoStart)
  ) {
    TogetherJS.startup.reason = "joined";
    TogetherJS();
  }
}

function conditionalActivate() {
  if (window.TogetherJSConfig_noAutoStart) {
    return;
  }
  // A page can define this function to defer TogetherJS from starting
  var callToStart = window.TogetherJSConfig_callToStart;
  if (!callToStart && window.TowTruckConfig_callToStart) {
    callToStart = window.TowTruckConfig_callToStart;
    console.warn("Please rename TowTruckConfig_callToStart to TogetherJSConfig_callToStart");
  }
  if (window.TogetherJSConfig && window.TogetherJSConfig.callToStart) {
    callToStart = window.TogetherJSConfig.callToStart;
  }
  if (callToStart) {
    callToStart(onload);
  } else {
    onload();
  }
}

conditionalActivate();

if (window.TogetherJSConfig_enableShortcut) {
  TogetherJS.listenForShortcut();
}

export default TogetherJS;
export { TogetherJS };
