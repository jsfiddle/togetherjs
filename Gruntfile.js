/*jshint forin:false */

var fs = require("fs");
var path = require('path');
var nunjucks = require("nunjucks");
var marked = require("marked");
var docco = require("docco");

var vars = {
  enableExample: false,
  enableHome: false,
  GA_ACCOUNT: "UA-35433268-28",
  base: ""
};

module.exports = function (grunt) {

  if (! grunt.option("dest")) {
    grunt.option("dest", "build");
  }

  var dumpLineNumbers = false;
  if (grunt.option("less-line-numbers")) {
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

  var requirejsPaths = {
            jquery: "libs/jquery-1.8.3.min",
            walkabout: "libs/walkabout/walkabout",
            esprima: "libs/walkabout/lib/esprima",
            falafel: "libs/walkabout/lib/falafel",
            tinycolor: "libs/tinycolor",
            whrandom: "libs/whrandom/random",
            jqueryui: "libs/jquery-ui.min",
            jquerypunch: "libs/jquery.ui.touch-punch.min",
            // Make sure we get the built form of this one:
            templates: path.join("..", grunt.option("dest"), "togetherjs/templates")
          };

  var libs = [];
  grunt.file.expand(
    ["togetherjs/*.js", "!togetherjs/randomutil.js", "!togetherjs/recorder.js", "!togetherjs/togetherjs.js"]
  ).forEach(function (filename) {
    filename = filename.replace(/^togetherjs\//, "");
    filename = filename.replace(/\.js$/, "");
    libs.push(filename);
  });
  grunt.file.expand("togetherjs/locale/*.json").forEach(function (langFilename) {
    var lang = path.basename(langFilename).replace(/\.json/, "");
    libs.push("templates-" + lang);
    requirejsPaths["templates-" + lang] = path.join("..", grunt.option("dest"), "togetherjs", "templates-" + lang);
  });

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    less: {
      development: {
        files: {
          "<%= grunt.option('dest') || 'build' %>/togetherjs/togetherjs.css": "togetherjs/togetherjs.less",
          "<%= grunt.option('dest') || 'build' %>/togetherjs/recorder.css": "togetherjs/recorder.less"
        },
        options: {
          dumpLineNumbers: dumpLineNumbers
        }
      }
    },

    requirejs: {
      compile: {
        options: {
          baseUrl: "togetherjs/",
          paths: requirejsPaths,
          include: ["libs/almond"].concat(libs),
          //Wrap any build bundle in a start and end text specified by wrap.
          //Use this to encapsulate the module code so that define/require are
          //not globals. The end text can expose some globals from your file,
          //making it easy to create stand-alone libraries that do not mandate
          //the end user use requirejs.
          wrap: {
            start: "(function() {",
            end: "TogetherJS.require = TogetherJS._requireObject = require;\nTogetherJS._loaded = true;\nrequire([\"session\"]);\n}());"
          },
          optimize: "none",
          out: function writer(text) {
            var dest = path.join(grunt.option("dest"), "togetherjs/togetherjsPackage.js");
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
        "togetherjs/*.js"
      ]
    },

    csslint: {
      // Check here for options: https://github.com/stubbornella/csslint/wiki/Rules
      options: {
        csslintrc: ".csslint.rc"
      },
      src: [path.join(grunt.option("dest"), "togetherjs/togetherjs.css")]
    },

    watch: {
      main: {
        files: ["togetherjs/**/*", "Gruntfile.js"],
        tasks: ["build"],
        options: {
          nospawn: true
        }
      },
      site: {
        files: ["togetherjs/**/*", "Gruntfile.js", "site/**/*", "!**/*_flymake*", "!**/*~", "!**/.*"],
        tasks: ["build", "buildsite"]
      },
      // FIXME: I thought I wouldn't have to watch for
      // togetherjs/**/*.js, but because the hard links are regularly
      // broken by git, this needs to be run often, and it's easy to
      // forget.  Then between git action the build will be over-run,
      // but that's harmless.
      minimal: {
        files: ["togetherjs/**/*.less", "togetherjs/togetherjs.js", "togetherjs/templates-localized.js", 
                "togetherjs/**/*.html", "togetherjs/**/*.js", "!**/*_flymake*", "togetherjs/locales/**/*.json"],
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
    var pattern = ["**", "!togetherjs.js", "!templates-localized.js", "!**/*.less", "!#*", "!**/*_flymake*", "!**/*.md", "!**/*.tmp", "!**/#*"];
    grunt.log.writeln("Copying files from " + "togetherjs/".cyan + " to " + path.join(grunt.option("dest"), "togetherjs").cyan);
    if (grunt.option("exclude-tests")) {
      pattern.push("!tests/");
      pattern.push("!tests/**");
      grunt.log.writeln("  (excluding tests)");
    }
    copyMany(
      "togetherjs/", path.join(grunt.option("dest"), "togetherjs"),
      pattern
      );
  });

  grunt.registerTask("copysite", "copy the site (not library)", function () {
    grunt.log.writeln("Copying files from " + "site/".cyan + " to " + grunt.option("dest").cyan);
    copyMany(
      "site/", grunt.option("dest"),
      ["**", "!**/*.tmpl", "!**/*.html", "!public/**", "!**/*_flymake*", "!**/*.md"]);
    copyMany(
      "site/public/", grunt.option("dest"),
      ["**"]);
  });

  grunt.registerTask("build", ["copylib", "maybeless", "substitute", "requirejs"]);
  grunt.registerTask("buildsite", ["copysite", "render", "rendermd", "docco"]);
  grunt.registerTask("devwatch", ["build", "watch:minimal"]);
  // For some reason doing ["build", "buildsite", "watch:site"]
  // doesn't work, it gets through buildsite and doesn't watch;
  // instead just doing watch:site seems okay:
  grunt.registerTask("sitewatch", ["buildsite", "watch:site"]);

  function escapeString(s) {
    if (typeof s != "string") {
      throw new Error("Not a string: " + s);
    }
    var data = JSON.stringify(s);
    return data.substr(1, data.length-2);
  }

  grunt.registerTask(
    "substitute",
    "Substitute templates-localized.js and parameters in togetherjs.js",
    function () {
      // FIXME: I could use grunt.file.copy(..., {process: function (content, path) {}}) here
      var baseUrl = grunt.option("base-url") || ""; // baseURL to be entered by the user
      if (! baseUrl) {
        grunt.log.writeln("No --base-url, using auto-detect");
      }
      var destBase = grunt.option("dest") || "build"; // where to put the built files. If not indicated then into build/
      var hubUrl = grunt.option("hub-url") || process.env.HUB_URL || "https://hub.togetherjs.com"; // URL of the hub server
      grunt.log.writeln("Using hub URL " + hubUrl.cyan);
      var gitCommit = process.env.GIT_COMMIT || "";
      var subs = {
        __interface_html__: grunt.file.read("togetherjs/interface.html"),
        __help_txt__: grunt.file.read("togetherjs/help.txt"), 
        __walkthrough_html__: grunt.file.read("togetherjs/walkthrough.html"),
        __baseUrl__: baseUrl,
        __hubUrl__: hubUrl,
        __gitCommit__: gitCommit
      };

      function substituteContent(content, s) {
        for (var v in s) {
          var re = new RegExp(v, "g");
          if (typeof s[v] != "string") {
            grunt.log.error("Substitution variable " + v.cyan + " is not a string")
          }
          content = content.replace(re, escapeString(s[v]));
        }
        return content;
      }

      var filenames = {
        "togetherjs.js": {
          src: "togetherjs/togetherjs.js",
          extraVariables: {__min__: "no"}
        },
        "togetherjs-min.js": {
          src: "togetherjs/togetherjs.js",
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
        content = substituteContent(content, s);
        grunt.log.writeln("writing " + src.cyan + " to " + dest.cyan);
        grunt.file.write(dest, content);
      }

      grunt.file.expand("togetherjs/locale/*.json").forEach(function (langFilename) {
        var templates = grunt.file.read("togetherjs/templates-localized.js");
        var lang = path.basename(langFilename).replace(/\.json/, "");
        var translation = JSON.parse(grunt.file.read(langFilename));
        var dest = path.join(grunt.option("dest"), "togetherjs/templates-" + lang + ".js");
        
        var translatedInterface = translateFile("togetherjs/interface.html", translation);
        var translatedHelp = translateFile("togetherjs/help.txt", translation);
        var translatedWalkthrough = translateFile("togetherjs/walkthrough.html", translation);

        var vars = subs;
        
        subs.__interface_html__ = translatedInterface;
        subs.__help_txt__ = translatedHelp;
        subs.__walkthrough_html__ = translatedWalkthrough;
        subs.__names__ = translation.names;
        templates = substituteContent(templates, subs);

        grunt.file.write(dest, templates);
        grunt.log.writeln("writing " + dest.cyan + " based on " + langFilename.cyan);
      });

      return true;
    }
  );

      
  function translateFile(source, translation) {
    var env = new nunjucks.Environment(new nunjucks.FileSystemLoader("./"));
    var tmpl = env.getTemplate(source);
    return tmpl.render({
      gettext: function (string) {
        return translation[string] || string;
      }
    });
  }

  grunt.registerTask("maybeless", "Maybe compile togetherjs.less", function () {
    var sources = grunt.file.expand(["togetherjs/**/*.less", "site/**/*.less"]);
    var found = false;
    sources.forEach(function (fn) {
      var source = fs.statSync(fn);
      var destFn = grunt.option("dest") + "/" + fn.substr(0, fn.length-4) + "css";
      if (! fs.existsSync(destFn)) {
        found = true;
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
      tmplVars.base = path.relative(path.dirname("site/" + source), "site/");
      if (tmplVars.base && tmplVars.base.search(/\/$/) == -1) {
        tmplVars.base += "/";
      }
      if (tmplVars.absoluteLinks) {
        tmplVars.base = "/";
      }
      tmplVars.base = tmplVars.base.replace(/\\/g, '/');
      var tmpl = env.getTemplate(source);
      var result = tmpl.render(tmplVars);
      grunt.file.write(dest, result);
    });
  });

  function parseMarkdownOutput(doc) {
    var title = (/<h1[^>]*>(.*)<\/h1>/i).exec(doc);
    title = title[1];
    var body = doc.replace(/<h1[^>]*>.*<\/h1>/i, "");
    return {
      title: title,
      body: body
    };
  }

  function addHeaderIds(doc) {
    var result = [];
    while (doc) {
      var match = (/(<h\d)>(.*)(<\/h\d>)/i).exec(doc);
      if (! match) {
        result.push(doc);
        break;
      }
      var id = match[2];
      id = id.toLowerCase();
      id = id.replace(/ +/g, "-");
      id = id.replace(/[^a-z0-9_\-]/g, "");
      var header = match[1] + ' id="' + id + '">' + match[2] + match[3];
      result.push(doc.substr(0, match.index));
      result.push(header);
      doc = doc.substr(match.index + match[0].length);
    }
    return result.join("");
  }

  function highlight(code, lang) {
    var hjs = require("highlight.js");
    var aliases = {
      html: "xml",
      js: "javascript"
    };
    lang = aliases[lang] || lang;
    try {
      if (lang) {
        return hjs.highlight(lang, code).value;
      } else {
        return hjs.highlightAuto(code).value;
      }
    } catch (e) {
      grunt.fail.fatal("Error highlighting: " + e);
      throw e;
    }
  }

  marked.setOptions({highlight: highlight});

  grunt.registerTask("rendermd", "Render the site Markdown files", function () {
    var env = new nunjucks.Environment(new nunjucks.FileSystemLoader("site/"));
    var sources = grunt.file.expand({cwd: "site/"}, "**/*.md", "!**/README.md");
    sources.forEach(function (source) {
      var basename = source.replace(/\.md$/, "");
      var dest = grunt.option("dest") + "/" + basename + ".html";
      grunt.log.writeln("Rendering " + source.cyan + " to " + dest.cyan);
      var data = grunt.file.read("site/" + source);
      var templateName = "generic-markdown.tmpl";
      var match = (/template:\s*([a-zA-Z_\-0-9.]*)/).exec(data);
      if (match) {
        templateName = match[1];
      }
      var html = marked(data, {
        smartypants: true
      });
      var parsed = parseMarkdownOutput(html);
      parsed.body = addHeaderIds(parsed.body);
      var tmpl = env.getTemplate(templateName);
      var tmplVars = Object.create(vars);
      tmplVars.markdownBody = parsed.body;
      tmplVars.title = parsed.title;
      tmplVars.base = path.relative(path.dirname("site/" + source), "site/");
      if (tmplVars.base && tmplVars.base.search(/\/$/) == -1) {
        tmplVars.base += "/";
      }
      tmplVars.base = tmplVars.base.replace(/\\/g, '/');
      var result = tmpl.render(tmplVars);
      grunt.file.write(dest, result);
    });
  });

  function doccoFormat(source, sections) {
    sections.forEach(function (section) {
      var code = highlight(section.codeText, "javascript");
      code = code.replace(/\s+$/, '');
      section.codeHtml = "<div class='highlight'><pre>" + code + "</pre></div>";
      section.docsHtml = marked(section.docsText);
    });
  }

  grunt.registerTask("docco", "Create comment-separating source code", function () {
    var env = new nunjucks.Environment(new nunjucks.FileSystemLoader("site/"));
    var sources = grunt.file.expand({cwd: "togetherjs/"}, "*.js");
    sources.sort();
    var sourceDescriptions = JSON.parse(grunt.file.read("togetherjs/module-descriptions.json"));
    var sourceList = [];
    sources.forEach(function (source) {
      var name = source.replace(/\.js$/, "");
      sourceList.push({
        name: name,
        link: source + ".html",
        description: marked(sourceDescriptions[name] || "", {smartypants: true})
      });
    });
    sources.forEach(function (source) {
      var sourceName = source.replace(/\.js$/, "");
      var dest = grunt.option("dest") + "/source/" + source + ".html";
      grunt.log.writeln("Rendering " + source.cyan + " to " + dest.cyan);
      var code = grunt.file.read("togetherjs/" + source);
      var sections = docco.parse(source, code, {languages:{}});
      doccoFormat(source, sections);
      sections.forEach(function (section, i) {
        section.index = i;
        section.empty = section.codeText.replace(/\s/gm, "") === "";
      });
      var first = marked.lexer(sections[0].docsText)[0];
      var hasTitle = first && first.type == 'heading' && first.depth == 1;
      var title = hasTitle ? first.text : path.basename(source, ".js");
      var tmpl = env.getTemplate("source-code.tmpl");
      var tmplVars = Object.create(vars);
      tmplVars.title = title;
      tmplVars.sections = sections;
      tmplVars.source = source;
      tmplVars.sourceName = sourceName;
      tmplVars.sourceDescription = marked(sourceDescriptions[sourceName] || "", {smartypants: true});
      tmplVars.base = "../";
      tmplVars.sourceList = sourceList;
      var result = tmpl.render(tmplVars);
      grunt.file.write(dest, result);
    });
    var tmplVars = Object.create(vars);
    tmplVars.title = "TogetherJS Source Code";
    tmplVars.sourceList = sourceList;
    tmplVars.base = "../";
    var tmpl = env.getTemplate("source-code-index.tmpl");
    grunt.file.write(grunt.option("dest") + "/source/index.html", tmpl.render(tmplVars));
  });

  grunt.registerTask("buildaddon", "Build the Firefox addon and move the XPI into the site", function () {
    var done = this.async();
    grunt.util.spawn({
      cmd: "cfx",
      args: ["xpi"],
      opts: {
        cwd: "addon/"
      }
    }, function (error, result, code) {
      if (error) {
        grunt.log.error("Error running cfx xpi: " + error.toString().cyan);
        grunt.fail.fatal("Error creating XPI");
        done();
        return;
      }
      var dest = path.join(grunt.option("dest"), "togetherjs.xpi");
      grunt.file.copy("addon/togetherjs.xpi", dest);
      grunt.log.writeln("Created " + dest.cyan);
      done();
    });
  });

  grunt.registerTask("publish", "Publish to togetherjs.mozillalabs.com/public/", function () {
    if (! grunt.file.isDir("togetherjs.mozillalabs.com")) {
      grunt.log.writeln("Error: you must check out togetherjs.mozillalabs.com");
      grunt.log.writeln("Use:");
      grunt.log.writeln("  $ git clone -b togetherjs.mozillalabs.com git:git@github.com:mozilla/togetherjs.git togetherjs.mozillalabs.com");
      grunt.log.writeln("  $ cd togetherjs.mozillalabs.com/.git");
      grunt.log.writeln("  $ echo '[remote \"staging\"]\n\turl = git@heroku.com:togetherjs-staging.git\n\tpush = refs/heads/togetherjs.mozillalabs.com:refs/heads/master\n[remote \"production\"]\n\turl = git@heroku.com:togetherjs.git\n\tpush = refs/heads/togetherjs.mozillalabs.com:refs/heads/master\n' >> config");
      grunt.fail.fatal("Must checkout togetherjs.mozillalabs.com");
      return;
    }
    var versions = "togetherjs.mozillalabs.com/public/versions";
    if (! grunt.file.isDir(versions)) {
      grunt.log.writeln("Error: " + versions.cyan + " does not exist");
      grunt.fail.fatal("No versions/ directory");
      return;
    }
    var tmp = "togetherjs.mozillalabs.com/public_versions_tmp";
    fs.rename(versions, tmp);
    grunt.file.delete("togetherjs.mozillalabs.com/public");
    grunt.file.mkdir("togetherjs.mozillalabs.com/public");
    fs.rename(tmp, versions);
    if (! grunt.option("base-url")) {
      grunt.option("base-url", "https://togetherjs.com");
    }
    grunt.option("dest", "togetherjs.mozillalabs.com/public");
    grunt.option("exclude-tests", true);
    grunt.option("no-hardlink", true);
    grunt.task.run(["build", "buildsite", "buildaddon"]);
    grunt.task.run(["movecss"]);
    grunt.log.writeln("To actually publish you must do:");
    grunt.log.writeln("  $ cd togetherjs.mozillalabs.com/");
    grunt.log.writeln("  $ git add -A");
    grunt.log.writeln("  $ git commit -a -m 'Publish'");
    grunt.log.writeln("  $ git push && git push staging");
  });

  grunt.registerTask("publishversion", "Publish to togetherjs.mozillalabs.com/public/versions/", function () {
    var version = grunt.option("togetherjs-version");
    if (! version) {
      grunt.log.error("You must provide a --togetherjs-version=X.Y argument");
      grunt.fail.fatal("No --togetherjs-version");
      return;
    }
    if (! grunt.file.isDir("togetherjs.mozillalabs.com/public/versions")) {
      grunt.log.error("The directory togetherjs.mozillalabs.com/public/versions does not exist");
      grunt.fail.fatal();
      return;
    }
    var destDir = "togetherjs.mozillalabs.com/public/versions/" + version;
    if (grunt.file.exists(destDir)) {
      grunt.log.error("The directory " + destDir + " already exists");
      grunt.log.error("  Delete it first to re-create version");
      grunt.fail.fatal();
      return;
    }
    grunt.option("base-url", "https://togetherjs.com/versions/" + version);
    grunt.option("dest", destDir);
    grunt.option("exclude-tests", true);
    grunt.option("no-hardlink", true);
    grunt.task.run(["build"]);
    grunt.task.run(["movecss"]);
    var readme = grunt.file.read("togetherjs.mozillalabs.com/public/versions/README.md");
    readme += "  * [" + version + "](./" + version + "/togetherjs.js)\n";
    grunt.file.write("togetherjs.mozillalabs.com/public/versions/README.md", readme);
  });

  grunt.registerTask("movecss", "Publish generated css files to dest", function () {
    // Can't figure out how to parameterize the less task, hence this lame move
    ["togetherjs/togetherjs.css", "togetherjs/recorder.css"].forEach(function (css) {
      var src = path.join("build", css);
      var dest = path.join(grunt.option("dest"), css);
      grunt.file.copy(src, dest);
      grunt.log.writeln("Copying " + src.cyan + " to " + dest.cyan);
    });
  });

  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('dev', function() {
    grunt.util.spawn({
      cmd: 'node',
      args: ['devserver.js']
    });
    grunt.task.run('watch');
  });

  grunt.registerTask('default', 'start');

};
