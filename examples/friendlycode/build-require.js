/**
 * to run this script,
 *  1. install npm, `curl http://npmjs.org/install.sh | sh`
 *     https://github.com/isaacs/npm
 *  2. command `npm install` at this directory.
 *  3. command `node build-require.js` or `npm start`
 */
var requirejs = require('requirejs'),
  resolve = require('path').resolve,
  requireConfig = require('./js/require-config'),
  baseUrl = resolve(__dirname, 'js'),
  name = 'friendlycode',
  out = resolve(baseUrl, 'friendlycode-built.js');

function optimize(done) {
  requirejs.optimize(generateConfig(), done);
}

function generateConfig() {
  var config = {
    name: name,
    out: out,
    // use none optimize for debugging
    optimize: "none",
    // optimize: 'uglify',
    uglify: {
      // beautify for debugging
      // beautify: true,
      mangle: true
    },
    // TODO  above config setting is temporary, it shuould use mainConfigFile
    // https://github.com/toolness/friendlycode/pull/112#issuecomment-6625412
    // mainConfigFile: "./js/main.js",
  };
  Object.keys(requireConfig).forEach(function(name) {
    config[name] = requireConfig[name];
  });
  return config;
}

function selfTest() {
  var assert = require('assert'),
      config = generateConfig();
      
  assert('paths' in config);
  assert('jquery' in config.shim);
}

if (!module.parent) {
  if (process.argv[2] == 'test') {
    selfTest();
    console.log("Tests pass!");
    process.exit(0);
  } else {
    console.log("Generating", out);

    optimize(function (buildResponse) {
      // buildResponse is just a text output of the modules
      // included.
      console.log("Done. About " + buildResponse.split('\n').length +
                  " modules are inside the generated JS file.");
      requirejs.optimize({
        cssIn: "css/friendlycode.css",
        out: "css/friendlycode-built.css"
      }, function() {
        console.log("Optimized CSS.");
        process.exit();
      });
    });
  }
}
