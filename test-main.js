var allTestFiles = [];
var TEST_REGEXP = /(spec|test)\.js$/i;

Object.keys(window.__karma__.files).forEach(function(file) {
  if (TEST_REGEXP.test(file)) {
    // Normalize paths to RequireJS module names.
    allTestFiles.push(file);
  }
});

require.config({
  // Karma serves files under /base, which is the basePath from your config file
  baseUrl: '/base/togetherjs',

  // dynamically load all test files
  deps: allTestFiles,

  // paths to dependencies
  paths: {
    'jquery': 'libs/jquery-1.11.1.min',
    'almond': 'libs/almond',
    'tinycolor': 'libs/tinycolor',
    'mersenne': 'libs/whrandom/mersenne',
    'random': 'libs/whrandom/random'
  },

  // we have to kickoff jasmine, as it is asynchronous
  callback: window.__karma__.start
});
