"use strict";

defineTests([
  "jquery",
  "fc/current-page-manager"
], function($, CurrentPageManager) {
  module("CurrentPageManager");
  
  function FakeWindow() {
    return {
      history: {},
      location: {
        hash: "",
        href: "",
        reload: function() { this._reloads++; },
        _reloads: 0
      },
      _listeners: {},
      addEventListener: function(name, cb) {
        if (name in this._listeners) throw new Error();
        this._listeners[name] = cb;
      }
    };
  }

  test("changePage triggers hashchange", function() {
    var w = FakeWindow();
    var cpm = CurrentPageManager({window: w});
    cpm.changePage("/newpage", "/newpage/edit");
    equal(cpm.currentPage(), "/newpage", "currentPage changed");
    equal(w.location.hash, "#/newpage", "location.hash changed");
  });
  
  test("changePage triggers pushState", function() {
    var w = FakeWindow();
    w.history = {
      _stateChanges: [],
      pushState: function(state, title, url) {
        this._stateChanges.push(["push", state, title, url]);
      },
      replaceState: function(state, title, url) {
        this._stateChanges.push(["replace", state, title, url]);
      }
    };
    w.location.href = "http://bop/";
    var cpm = CurrentPageManager({
      window: w,
      currentPage: "/blah"
    });
    cpm.changePage("/newpage", "/newpage/edit");
    equal(cpm.currentPage(), "/newpage", "currentPage changed");
    deepEqual(w.history._stateChanges, [
      ["replace", {"pageToLoad": "/blah"}, "", "http://bop/"],
      ["push", {"pageToLoad": "/newpage"}, "", "/newpage/edit"]
    ], "state changes made");
  });
  
  test("popstate triggers loadPage", function() {
    var w = FakeWindow();
    w.history = {
      pushState: function() {},
      replaceState: function() {}
    };
    var cpm = CurrentPageManager({window: w});
    w._listeners.popstate({state: {pageToLoad: "/bloop"}});
    equal(w.location._reloads, 1, "default loadPage triggered");
    equal(cpm.currentPage(), "/bloop", "currentPage changed");
  });

  test("hashchange triggers loadPage", function() {
    var w = FakeWindow();
    var cpm = CurrentPageManager({window: w});
    w.location.hash = "#/different";
    w._listeners.hashchange();
    equal(w.location._reloads, 1, "default loadPage triggered");
    equal(cpm.currentPage(), "/different", "currentPage changed");
  });
  
  test("current page is taken from location hash", function() {
    var w = FakeWindow();
    w.location.hash = "#/blorp";
    var cpm = CurrentPageManager({window: w});
    equal(cpm.currentPage(), "/blorp");
  });
});
