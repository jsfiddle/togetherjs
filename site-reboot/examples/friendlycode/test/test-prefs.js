defineTests(["fc/prefs", "lscache"], function(Preferences, lscache) {
  Preferences.CACHE_KEY = "TestPreferences";

  module("Preferences", {
    setup: function() {
      Preferences.off();
      Preferences.clear();
      Preferences.save();
    }
  });

  test("is resilient when no stored value is available", function() {
    lscache.remove(Preferences.CACHE_KEY);
    Preferences.fetch();
    equal(Preferences.get("blah"), undefined);
  });

  test("is resilient with corrupt JSON", function() {
    lscache.set(Preferences.CACHE_KEY, "NO U!", 500);
    Preferences.fetch();
    equal(Preferences.get("blah"), undefined);
  });
  
  test("loads stored preferences", function() {
    lscache.set(Preferences.CACHE_KEY, {
      meh: 1
    }, 500);
    Preferences.fetch();
    equal(Preferences.get("meh"), 1);
  });
  
  test("stores preferences", function() {
    Preferences.set("blop", 5);
    Preferences.save();
    deepEqual(lscache.get(Preferences.CACHE_KEY), {
      blop: 5
    });
  });
  
  test("can be destroyed", function() {
    deepEqual(lscache.get(Preferences.CACHE_KEY), {});
    Preferences.destroy();
    equal(lscache.get(Preferences.CACHE_KEY), undefined);
  });
  
  test("triggers change events", function() {
    Preferences.on("change:foo", function() {
      ok(true, "change:foo is triggered");
    });
    Preferences.set("foo", 1);
  });
});
