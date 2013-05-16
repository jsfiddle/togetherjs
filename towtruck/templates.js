/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["util"], function (util) {
  function clean(t) {
    t = t.replace(/[<][%]\s*\/\*[\S\s\r\n]*\*\/\s*[%][>]/, "");
    t = util.trim(t);
    t = t.replace(/http:\/\/localhost:8080/g, TowTruck.baseUrl);
    return t;
  }
  return {
    "interface": clean("<%- read('interface.html')%>"),
    help: clean("<%- read('help.txt')%>"),
    walkabout: clean("<%- read('walkabout.html')%>")
  };
});
