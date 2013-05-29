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
            "alien-avatar-generator": "libs/alien-avatar-generator",
            guiders: "libs/Guider-JS/guiders-1.3.0"
          },
          // FIXME: this includes everything from session features variable:
          include: ["session", "jquery", "peers", "ui", "chat", "webrtc", "cursor", "startup", "forms"],
          // FIXME: seems to have no effect?
          optimize: "none",
          namespace: "TOWTRUCK",
          out: "build/towtruck/towtruckPackage.js"
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

  grunt.registerTask("build", ["copy:main", "maybeless", "substitute"]);
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
        __baseUrl__: baseUrl,
        __hubUrl__: hubUrl,
        __gitCommit__: gitCommit
      };
      var filenames = {
        "towtruck/templates.js": "towtruck/templates.js",
        "towtruck/towtruck.js": "towtruck.js"
      };
      for (var src in filenames) {
        var dest = filenames[src];
        dest = "build/" + dest;
        var content = fs.readFileSync(src, "UTF-8");
        for (var v in subs) {
          var re = new RegExp(v, "g");
          content = content.replace(re, escapeString(subs[v]));
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
      destFn = "build/" + fn.substr(0, fn.length-4) + "css";
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
