/*jshint forin:false */

var fs = require("fs");
var path = require('path');
var nunjucks = require("nunjucks");

var vars = {
  enableExample: false,
  enableHome: false
};

module.exports = function (grunt) {

  var dumpLineNumbers = false;
  if (!! grunt.option("less-line-numbers")) {
    grunt.verbose.writeln("Enabling LESS line numbers");
    dumpLineNumbers = true;
  }

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    less: {
      development: {
        files: {
          "build/towtruck/towtruck.css": "towtruck/towtruck.less",
          "build/towtruck/recorder.css": "towtruck/recorder.less"
        },
        options: {
          dumpLineNumbers: dumpLineNumbers
        }
      }
    },

    requirejs: {
      compile: {
        options: {
          baseUrl: "towtruck/",
          paths: {
            jquery: "libs/jquery-1.8.3.min",
            walkabout: "libs/walkabout/walkabout",
            esprima: "libs/walkabout/lib/esprima",
            falafel: "libs/walkabout/lib/falafel",
            tinycolor: "libs/tinycolor",
            whrandom: "libs/whrandom/random",
            // Make sure we get the built form of this one:
            templates: "../build/towtruck/templates"
          },
          include: ["libs/require-nomin", "jquery", "session", "peers", "ui", "chat", "webrtc", "cursor", "startup", "forms", "visibilityApi"],
          optimize: "none",
          namespace: "TOWTRUCK",
          out: function (text) {
            // Fix this bug: https://github.com/jrburke/requirejs/issues/813
            // First for jQuery:
            text = text.replace(
              'typeof define=="function"&&define.amd&&define.amd.jQuery',
              'typeof TOWTRUCK.define=="function"&&TOWTRUCK.define.amd&&TOWTRUCK.define.amd.jQuery');
            // Another fix for tinycolor:
            text = text.replace(
              /typeof\s+define\s*!==?\s*"undefined"/g,
              'typeof TOWTRUCK.define != "undefined"');
            // And for: https://github.com/jrburke/requirejs/issues/815
            text = text.replace(
              "if (typeof require !== 'undefined' && !isFunction(require)) {",
              "if (typeof TOWTRUCK !== 'undefined' && TOWTRUCK.require !== undefined && !isFunction(TOWTRUCK.require)) {");
            // FIXME: kind of hacky followon
            text = text.replace(
              /cfg = require;/,
              "cfg = TOWTRUCK.require;");
            grunt.file.write("build/towtruck/towtruckPackage.js", text);
          }
        }
      }
    },

    jshint: {
      options: {
        curly: true,
        browser: true,
        globals: {
          define: true
        }
      },
      all: [
        "Gruntfile",
        "towtruck/*.js"
      ]
    },

    csslint: {
      // Check here for options: https://github.com/stubbornella/csslint/wiki/Rules
      options: {
        csslintrc: ".csslint.rc"
      },
      src: ["build/towtruck/towtruck.css"]
    },

    // FIXME: should use: https://npmjs.org/package/grunt-ejs-static

    copy: {
      main: {
        files: [
          {expand: true,
           src: ["towtruck/**", "!towtruck/towtruck.js", "!towtruck/templates.js", "!towtruck/towtruck.less"],
           dest: "build/"
          }
        ],
        options: {
          hardLink: true
        }
      },
      site: {
        files: [
          {expand: true,
           cwd: "site/",
           src: ["**", "!**/*.tmpl", "!**/*.html", "!public/**"],
           dest: "build/"
          },
          {expand: true,
           cwd: "site/public/",
           src: ["**"],
           dest: "build/"
          }
        ]
      }
    },

    watch: {
      main: {
        files: ["towtruck/**/*", "Gruntfile.js"],
        tasks: ["build"],
        options: {
          nospawn: true
        }
      },
      site: {
        files: ["towtruck/**/*", "Gruntfile.js", "site/**/*"],
        tasks: ["build", "buildsite"]
      }
    }

  });

  grunt.loadNpmTasks("grunt-contrib-less");
  grunt.loadNpmTasks("grunt-contrib-csslint");
  grunt.loadNpmTasks("grunt-contrib-jshint");
  grunt.loadNpmTasks("grunt-contrib-requirejs");
  grunt.loadNpmTasks("grunt-contrib-watch");
  grunt.loadNpmTasks('grunt-contrib-copy');

  grunt.registerTask("build", ["copy:main", "maybeless", "substitute", "requirejs"]);
  grunt.registerTask("buildsite", ["copy:site", "render"]);

  function escapeString(s) {
    if (typeof s != "string") {
      throw "Not a string";
    }
    var data = JSON.stringify(s);
    return data.substr(1, data.length-2);
  }

  grunt.registerTask(
    "substitute",
    "Substitute templates.js and parameters in towtruck.js",
    function () {
      // FIXME: I could use grunt.file.copy(..., {process: function (content, path) {}}) here
      var baseUrl = grunt.option("base-url") || "";
      if (! baseUrl) {
        grunt.log.writeln("No --base-url, using auto-detect");
      }
      var hubUrl = process.env.HUB_URL || "https://towtruck.mozillalabs.com";
      var gitCommit = process.env.GIT_COMMIT || "";
      var subs = {
        __interface_html__: grunt.file.read("towtruck/interface.html"),
        __help_txt__: grunt.file.read("towtruck/help.txt"),
        __walkthrough_html__: grunt.file.read("towtruck/walkthrough.html"),
        __baseUrl__: baseUrl,
        __hubUrl__: hubUrl,
        __gitCommit__: gitCommit
      };
      var filenames = {
        "towtruck/templates.js": {
          src: "towtruck/templates.js"
        },
        "towtruck.js": {
          src: "towtruck/towtruck.js",
          extraVariables: {__min__: "no"}
        },
        "towtruck-min.js": {
          src: "towtruck/towtruck.js",
          extraVariables: {__min__: "yes"}
        }
      };
      for (var dest in filenames) {
        var info = filenames[dest];
        var src = info.src;
        var extraVariables = info.extraVariables;
        dest = "build/" + dest;
        var content = fs.readFileSync(src, "UTF-8");
        var s = subs;
        if (extraVariables) {
          s = Object.create(subs);
          for (var a in extraVariables) {
            s[a] = extraVariables[a];
          }
        }
        for (var v in s) {
          var re = new RegExp(v, "g");
          content = content.replace(re, escapeString(s[v]));
        }
        grunt.log.writeln("writing " + src.cyan + " to " + dest.cyan);
        grunt.file.write(dest, content);
      }
      return true;
    }
  );

  grunt.registerTask("maybeless", "Maybe compile towtruck.less", function () {
    var sources = grunt.file.expand(["towtruck/**/*.less", "site/**/*.less"]);
    var found = false;
    sources.forEach(function (fn) {
      var source = fs.statSync(fn);
      var destFn = "build/" + fn.substr(0, fn.length-4) + "css";
      if (! fs.existsSync(destFn)) {
        found = true;
        grunt.log.writeln("Destination LESS does not exist: " + destFn.cyan);
        return;
      }
      var dest = fs.statSync(destFn);
      if (source.mtime.getTime() > dest.mtime.getTime()) {
        grunt.log.writeln("Destination LESS out of date: " + destFn.cyan);
        found = true;
      }
    });
    if (found) {
      grunt.task.run("less");
    } else {
      grunt.log.writeln("No .less files need regenerating.");
    }
  });

  grunt.registerTask("render", "Render the site", function () {
    var env = new nunjucks.Environment(new nunjucks.FileSystemLoader("site/"));
    var sources = grunt.file.expand({cwd: "site/"}, "**/*.html");
    sources.forEach(function (source) {
      var dest = "build/" + source;
      grunt.log.writeln("Rendering " + source.cyan + " to " + dest.cyan);
      var data = grunt.file.read("site/" + source);
      var tmplVars = Object.create(vars);
      while (true) {
        var match = /\{\#\s+set\s+([^\s]+)\s+([^#]+)\s*\#\}/.exec(data);
        if (! match) {
          break;
        }
        tmplVars[match[1]] = JSON.parse(match[2]);
        grunt.log.writeln("  Found variable " + match[1] + " = " + match[2]);
        data = data.substr(match.index + match[0].length);
      }
      var tmpl = env.getTemplate(source);
      var result = tmpl.render(tmplVars);
      grunt.file.write(dest, result);
    });
  });

};
