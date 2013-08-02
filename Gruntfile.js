/*jshint forin:false */

var fs = require("fs");
var path = require('path');
var nunjucks = require("nunjucks");

var vars = {
  enableExample: false,
  enableHome: false,
  GA_ACCOUNT: "UA-35433268-28"
};

module.exports = function (grunt) {

  if (! grunt.option("dest")) {
    grunt.option("dest", "build");
  }

  var dumpLineNumbers = false;
  if (!! grunt.option("less-line-numbers")) {
    grunt.verbose.writeln("Enabling LESS line numbers");
    dumpLineNumbers = true;
  }

  function copyLink(src, dest) {
    if (grunt.file.isDir(src)) {
      grunt.file.mkdir(dest);
      return;
    }
    var destDir = path.dirname(dest);
    if (! grunt.file.exists(destDir)) {
      grunt.file.mkdir(destDir);
    }
    if (! grunt.option("no-hardlink")) {
      try {
        if (grunt.file.exists(dest)) {
          grunt.file.delete(dest);
        }
        fs.linkSync(src, dest);
      } catch (e) {
        grunt.file.copy(src, dest);
      }
    } else {
      grunt.file.copy(src, dest);
    }
  }

  function copyMany(src, dest, patterns) {
    var paths = grunt.file.expand({cwd: src}, patterns);
    paths.forEach(function (p) {
      var srcPath = path.join(src, p);
      var destPath = path.join(dest, p);
      copyLink(srcPath, destPath);
    });
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
          include: ["libs/almond", "jquery", "session", "peers", "ui", "chat", "webrtc", "cursor", "startup", "forms", "visibilityApi"],
          //Wrap any build bundle in a start and end text specified by wrap.
          //Use this to encapsulate the module code so that define/require are
          //not globals. The end text can expose some globals from your file,
          //making it easy to create stand-alone libraries that do not mandate
          //the end user use requirejs.
          wrap: {
            start: "(function() {",
            end: "TowTruck.require = TowTruck._requireObject = require;\nrequire([\"session\"]);\n}());"
          },
          optimize: "none",
          out: function writer(text) {
            // Fix this bug: https://github.com/jrburke/requirejs/issues/813
            // First for jQuery:
            var dest = path.join(grunt.option("dest"), "towtruck/towtruckPackage.js");
            grunt.file.write(dest, text);
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
      },
      minimal: {
        files: ["towtruck/**/*.less", "towtruck/towtruck.js", "towtruck/**/*.html", "!**/*_flymake*"],
        tasks: ["build"]
      }
    }

  });

  grunt.loadNpmTasks("grunt-contrib-less");
  grunt.loadNpmTasks("grunt-contrib-csslint");
  grunt.loadNpmTasks("grunt-contrib-jshint");
  grunt.loadNpmTasks("grunt-contrib-requirejs");
  grunt.loadNpmTasks("grunt-contrib-watch");
  grunt.loadNpmTasks('grunt-contrib-copy');

  grunt.registerTask("copylib", "copy the library", function () {
    var pattern = ["**", "!towtruck.js", "!templates.js", "!**/*.less", "!#*", "!**/*_flymake*"];
    grunt.log.writeln("Copying files from " + "towtruck/".cyan + " to " + path.join(grunt.option("dest"), "towtruck").cyan);
    if (grunt.option("exclude-tests")) {
      pattern.push("!tests/");
      pattern.push("!tests/**");
      grunt.log.writeln("  (excluding tests)");
    }
    copyMany(
      "towtruck/", path.join(grunt.option("dest"), "towtruck"),
      pattern
      );
  });

  grunt.registerTask("copysite", "copy the site (not library)", function () {
    grunt.log.writeln("Copying files from " + "site/".cyan + " to " + grunt.option("dest").cyan);
    copyMany(
      "site/", grunt.option("dest"),
      ["**", "!**/*.tmpl", "!**/*.html", "!public/**", "!**/*_flymake*"]);
    copyMany(
      "site/public/", grunt.option("dest"),
      ["**"]);
  });

  grunt.registerTask("build", ["copylib", "maybeless", "substitute", "requirejs"]);
  grunt.registerTask("buildsite", ["copysite", "render"]);
  grunt.registerTask("devwatch", ["build", "watch:minimal"]);

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
      var destBase = grunt.option("dest") || "build";
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
        dest = destBase + "/" + dest;
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
      var destFn = grunt.option("dest") + "/" + fn.substr(0, fn.length-4) + "css";
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
      var dest = grunt.option("dest") + "/" + source;
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

  grunt.registerTask("publish", "Publish to towtruck.mozillalabs.com/public/", function () {
    if (! grunt.file.isDir("towtruck.mozillalabs.com")) {
      grunt.log.writeln("Error: you must check out towtruck.mozillalabs.com");
      grunt.log.writeln("Use:");
      grunt.log.writeln("  $ git clone -b towtruck.mozillalabs.com git:git@github.com:mozilla/towtruck.git towtruck.mozillalabs.com");
      grunt.log.writeln("  $ cd towtruck.mozillalabs.com/.git");
      grunt.log.writeln("  $ echo '[remote \"staging\"]\n\turl = git@heroku.com:towtruck-staging.git\n\tpush = refs/heads/towtruck.mozillalabs.com:refs/heads/master\n[remote \"production\"]\n\turl = git@heroku.com:towtruck.git\n\tpush = refs/heads/towtruck.mozillalabs.com:refs/heads/master\n' >> config");
      grunt.fail.fatal("Must checkout towtruck.mozillalabs.com");
      return;
    }
    var versions = "towtruck.mozillalabs.com/public/versions";
    if (! grunt.file.isDir(versions)) {
      grunt.log.writeln("Error: " + versions.cyan + " does not exist");
      grunt.fail.fatal("No versions/ directory");
      return;
    }
    var tmp = "towtruck.mozillalabs.com/public_versions_tmp";
    fs.rename(versions, tmp);
    grunt.file.delete("towtruck.mozillalabs.com/public");
    grunt.file.mkdir("towtruck.mozillalabs.com/public");
    fs.rename(tmp, versions);
    grunt.option("base-url", "https://towtruck.mozillalabs.com");
    grunt.option("dest", "towtruck.mozillalabs.com/public");
    grunt.option("exclude-tests", true);
    grunt.option("no-hardlink", true);
    grunt.task.run(["build", "buildsite"]);
    grunt.task.run(["movecss"]);
    grunt.log.writeln("To actually publish you must do:");
    grunt.log.writeln("  $ cd towtruck.mozillalabs.com/");
    grunt.log.writeln("  $ git commit -a -m 'Publish'");
    grunt.log.writeln("  $ git push && git push staging");
  });

  grunt.registerTask("publishversion", "Publish to towtruck.mozillalabs.com/public/versions/", function () {
    var version = grunt.option("towtruck-version");
    if (! version) {
      grunt.log.error("You must provide a --towtruck-version=X.Y argument");
      grunt.fail.fatal("No --towtruck-version");
      return;
    }
    if (! grunt.file.isDir("towtruck.mozillalabs.com/public/versions")) {
      grunt.log.error("The directory towtruck.mozillalabs.com/public/versions does not exist");
      grunt.fail.fatal();
      return;
    }
    var destDir = "towtruck.mozillalabs.com/public/versions/" + version;
    if (grunt.file.exists(destDir)) {
      grunt.log.error("The directory " + destDir + " already exists");
      grunt.log.error("  Delete it first to re-create version");
      grunt.fail.fatal();
      return;
    }
    grunt.option("base-url", "https://towtruck.mozillalabs.com/versions/" + version);
    grunt.option("dest", destDir);
    grunt.option("exclude-tests", true);
    grunt.option("no-hardlink", true);
    grunt.task.run(["build"]);
    grunt.task.run(["movecss"]);
    var readme = grunt.file.read("towtruck.mozillalabs.com/public/versions/README.md");
    readme += "  * [" + version + "](./" + version + "/towtruck.js)\n";
    grunt.file.write("towtruck.mozillalabs.com/public/versions/README.md", readme);
  });

  grunt.registerTask("movecss", "Publish generated css files to dest", function () {
    // Can't figure out how to parameterize the less task, hence this lame move
    ["towtruck/towtruck.css", "towtruck/recorder.css"].forEach(function (css) {
      var src = path.join("build", css);
      var dest = path.join(grunt.option("dest"), css);
      grunt.file.copy(src, dest);
      grunt.log.writeln("Copying " + src.cyan + " to " + dest.cyan);
    });
  });

};
