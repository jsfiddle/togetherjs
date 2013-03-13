/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Shows a panel (typically describing the addon) the first time an addon is installed.

const { Panel } = require("panel");
const ss = require("simple-storage");
const { setTimeout } = require("timers");
const { publicConstructor } = require("api-utils");
const { env } = require('api-utils/environment');
const self = require("self");

// Show panel 1 second after startup:
var DEFAULT_TIMEOUT = 1000;

function StartupPanel(options) {
  this.name = options.name;
  if (! this.name) {
    throw 'You must give the panel a name';
  }
  options.width = options.width || 400;
  options.height = options.height || 400;
  // FIXME: should append this if necessary:
  options.contentScript = SCRIPT;
  this.options = options;
  var seen = ss.storage[this.name + '-seen'];
  if (env.SHOW_STARTUP_PANEL) {
    // Primarily for development/testing
    seen = false;
  }
  if (self.loadReason == "install" || self.loadReason == "enable") {
    // Re-installed or re-enabled:
    seen = false;
  }
  if (! seen) {
    setTimeout(this.display.bind(this), options.startupTimeout || DEFAULT_TIMEOUT);
  }
};

StartupPanel.prototype = {
  display: function () {
    this.panel = Panel(this.options);
    this.panel.on("hide", (function () {
      ss.storage[this.name + '-seen'] = true;
    }).bind(this));
    this.panel.port.on("Close", (function () {
      this.panel.hide();
    }).bind(this));
    this.panel.show();
  }
};

var SCRIPT = [
'window.addEventListener("load", function () {',
'  var el = document.getElementById("close");',
'  if (! el) {',
'    el = document.createElement("A");',
'    el.innerHTML = "&times;";',
'    el.href = "#";',
'    el.setAttribute("style", "position: absolute; font-weight: bold; top: 2px; right: 6px; text-decoration: none; color: #000;");',
'    document.body.appendChild(el);',
'  }',
'  el.addEventListener("click", function () {',
'    self.port.emit("Close");',
'  }, false);',
'}, false);'
].join("\n");

exports.StartupPanel = publicConstructor(StartupPanel);
