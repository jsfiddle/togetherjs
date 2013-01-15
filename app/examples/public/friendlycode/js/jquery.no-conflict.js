define(["jquery.min"], function(jQuery) {
  // Prevent modules from accidentally accessing the $ global rather
  // than requesting it as a dependency.
  //
  // We would call jQuery.noConflict(true) to get rid of the jQuery
  // global as well, but tabzilla relies on it in a way that prevents
  // us from ever removing it from the global namespace.
  jQuery.noConflict();
  return jQuery;
});
