// Because we're using requirejs to asynchronously load tests,
// we need to have manual control over the running of tests.
QUnit.config.autostart = false;

// We want to "lazily" define tests so that the order of their
// definition isn't arbitrarily determined by requirejs. This way,
// the test results will always be reported in the same order, which
// makes reading test results across multiple page reloads much
// easier.
//
// Note that this has NOTHING to do with the order of
// actual test execution--our tests should always be isolated from
// each other so that the order QUnit chooses to run them in
// doesn't matter.
function defineTests(deps, fn) {
  define(deps, function() {
    var injectedDeps = arguments;
    return function describeTests() {
      fn.apply(this, injectedDeps);
    };
  });
}

// String together a bunch of defineTests-based modules into a
// single one.
defineTests.combine = function(deps) {
  define(deps, function() {
    var args = Array.prototype.slice.call(arguments);
    return function describeManyTests() {
      args.forEach(function(describeTests) {
        describeTests();
      });
    };
  });
};

// Run the given list of defineTests-based modules.
defineTests.run = function(deps) {
  require(deps, function() {
    var args = Array.prototype.slice.call(arguments);
    args.forEach(function(describeTests) {
      describeTests();
    });

    if (QUnit.config.blocking)
      QUnit.config.autostart = true;
    else
      QUnit.start();
  });
};
