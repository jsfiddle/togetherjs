var require = {
  baseUrl: "js",
  shim: {
    underscore: {
      exports: function() {
        return _.noConflict();
      }
    },
    // Apparently jQuery 1.7 and above uses a named define(), which
    // makes it a bona fide module which doesn't need a shim. However,
    // it also doesn't bother calling jQuery.noConflict(), which we
    // want, so we do a bit of configuration ridiculousness to
    // accomplish this.
    "jquery.min": {
      exports: 'jQuery'
    },
    "jquery-tipsy": {
      deps: ["jquery"],
      exports: 'jQuery'
    },
    "jquery-slowparse": {
      deps: ["jquery"],
      exports: "jQuery"
    },
    backbone: {
      deps: ["underscore", "jquery"],
      exports: function() {
        return Backbone.noConflict();
      }
    },
    codemirror: {
      exports: "CodeMirror"
    },
    "codemirror/xml": {
      deps: ["codemirror"],
      exports: "CodeMirror"
    },
    "codemirror/javascript": {
      deps: ["codemirror"],
      exports: "CodeMirror"
    },
    "codemirror/css": {
      deps: ["codemirror"],
      exports: "CodeMirror"
    },
    "codemirror/html": {
      deps: [
        "codemirror/xml",
        "codemirror/javascript",
        "codemirror/css"
      ],
      exports: "CodeMirror"
    }
  },
  paths: {
    jquery: "jquery.no-conflict",
    "jquery-tipsy": "jquery.tipsy",
    "jquery-slowparse": "../slowparse/spec/errors.jquery",
    underscore: "underscore.min",
    backbone: "backbone.min",
    slowparse: "../slowparse",
    codemirror: "../codemirror2/lib/codemirror",
    "codemirror/xml": "../codemirror2/mode/xml/xml",
    "codemirror/javascript": "../codemirror2/mode/javascript/javascript",
    "codemirror/css": "../codemirror2/mode/css/css",
    "codemirror/html": "../codemirror2/mode/htmlmixed/htmlmixed",
    text: "require-plugins/text",
    template: "require-plugins/template",
    test: "../test",
    templates: "../templates"
  }
};

if (typeof(module) == 'object' && module.exports)
  module.exports = require;
else (function() {
  var RE = /^(https?:)\/\/([^\/]+)\/(.*)\/require-config\.js$/;
  var me = document.querySelector('script[src$="require-config.js"]');
  var console = window.console || {log: function() {}};
  if (me) {
    var parts = me.src.match(RE);
    if (parts) {
      var protocol = parts[1];
      var host = parts[2];
      var path = '/' + parts[3];
      if (protocol != location.protocol || host != location.host)
        console.log("origins are different. requirejs text plugin may " +
                    "not work.");
      require.baseUrl = path;
    }
  }
  console.log('require.baseUrl is ' + require.baseUrl);
})();
