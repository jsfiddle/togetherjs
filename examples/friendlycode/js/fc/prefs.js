define(["backbone", "lscache"], function(Backbone, lscache) {
  
  var Preferences = Backbone.Model.extend({
    // Amount of time, in minutes, to store text size setting.
    CACHE_TIME_LIMIT: 9000,
    // Key to store our Preferences JSON blob in.
    CACHE_KEY: 'FriendlycodePreferences',
    // Used so that Model.isNew() is always false.
    id: 1,
    sync: function(method, model, options) {
      var json;
      
      if (method == "create" || method == "update") {
        json = model.toJSON();
        lscache.set(this.CACHE_KEY, json, this.CACHE_TIME_LIMIT);
        options.success(json);
      } else if (method == "delete") {
        lscache.remove(this.CACHE_KEY);
      } else if (method == "read") {
        json = lscache.get(this.CACHE_KEY);
        if (!json || typeof(json) != "object")
          json = {};
        options.success(json);
      }
    }
  });
  
  return new Preferences();
});
