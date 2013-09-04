// This simple module is just a helper that allows us to go from this code:
//
//   _.extend(object, Backbone.Events)
//
// to this code:
//
//   BackboneEvents.mixin(object)
// 
// This is useful in two ways:
//
// * A bunch of our modules only import underscore and backbone for
//   the sole purpose of using Backbone.Events. Importing one module
//   and using a one-argument function call is easier than importing two
//   modules and using a two-argument function call.
//
// * If we "standardize" on the Backbone.Events interface and module name,
//   it becomes easier for AMD modules from other projects to declare it as
//   a dependency. AMD-based projects that use backbone and underscore
//   can use a file like this one to provide backbone-events, while
//   smaller projects that don't need the full power of underscore and
//   backbone can provide a more lightweight alternative.

define(["underscore", "backbone"], function(_, Backbone) {
  return {
    mixin: function(target) {
      return _.extend(target, Backbone.Events);
    }
  };
});
