const fs = require("fs");
const walkabout = require(__dirname + "/walkabout.js");
const path = require("path");

var optionAliases = {
  n: "simulate",
  h: "help"
};

var listOptions = {
  exclude: true,
  "extra-js": true,
  "copy-file": true
};

function main() {
  var args = [];
  var options = [];
  for (var i=2; i<process.argv.length; i++) {
    var arg = process.argv[i];
    if (arg.indexOf('-') === 0) {
      var value, name;
      arg = arg.substr(1);
      if (arg.indexOf('-') === 0) {
        arg = arg.substr(1);
        if (arg.indexOf('=') != -1) {
          value = arg.substr(arg.indexOf('=')+1);
          name = arg.substr(0, arg.indexOf('='));
        } else {
          value = true;
          name = arg;
        }
      } else {
        value = arg.substr(1) || true;
        name = arg.charAt(0);
      }
      name = optionAliases[name] || name;
      if (listOptions[name]) {
        if (name in options) {
          options[name].push(value);
        } else {
          options[name] = [value];
        }
      } else {
        options[name] = value;
      }
    } else {
      if (! fs.existsSync(arg)) {
        console.log("File does not exist:", arg);
        process.exit(1);
      }
      args.push(arg);
    }
  }
  if (options.help) {
    help();
    return;
  }
  if (options.exclude) {
    options.exclude = options.exclude.map(function (r) {return new RegExp(r);});
  }
  options["copy-file"] = options["copy-file"] || [];
  options["copy-file"] = options["copy-file"].map(function (f) {
    var pos = f.indexOf(":");
    if (pos == -1) {
      throw "--copy-file=" + f + " has no :";
    }
    var name = f.substr(0, pos);
    var filename = f.substr(pos+1);
    if (! fs.existsSync(filename)) {
      throw "--copy-file=" + f + " does not exist";
    }
    return {name: name, filename: filename};
  });
  if (options.copy) {
    options["copy-file"].push({
      name: "walkabout.js",
      filename: path.join(__dirname, "walkabout.js")
    });
  }
  if (options.simulate) {
    console.log("Simulating (not writing)");
  }
  if (! options['no-js']) {
    if ((! options["script"]) && (! options["copy"])) {
      console.log("You must provide --script=URL to rewrite Javascript");
      process.exit(1);
    }
    rewriteJavascript(options, args);
  }
  if (! options['no-html']) {
    rewriteHtml(options, args);
  }
}

function help() {
  console.log(
"Usage: " + process.argv[0] + " " + path.basename(process.argv[1]) + " --script=URL [OPTIONS] DIRS\n" +
"  Rewrites .js and .html files for walkabout.js\n" +
"  Options:\n" +
"    DIRS: \n" +
"      directories to look for files in\n" +
"    -h --help:\n" +
"      this help\n" +
"    --script=URL\n" +
"      the URL of walkabout.js to inject into HTML files\n" +
"    -n --simulate\n" +
"      Don't actually write or change files\n" +
"    --copy\n" +
"      Copy walkabout.js into each directory with HTML files\n" +
"    --exclude=REGEX\n" +
"      Exclude any files whose FULL PATH matches the regular expression\n" +
"    --extra-js=CODE\n" +
"      Include extra code at the beginning of each file (after walkabout.js)\n" +
"    --copy-file=FILENAME:LOCATION\n" +
"      As well as walkabout.js, also copy the file in LOCATION to FILENAME\n"
);
}

function rewriteJavascript(options, dirs) {
  var files = findFiles(dirs, '.js', options.exclude, options["copy-file"]);
  files.forEach(function (f) {
    var content = fs.readFileSync(f, "UTF-8");
    try {
      var newContent = walkabout.rewriteListeners(content);
    } catch (e) {
      console.warn("Error parsing:", f);
      throw e;
    }
    if (content === newContent) {
      console.log("File not changed:", f);
      return;
    }
    console.log("Changing:", f);
    if (! options.simulate) {
      fs.writeFileSync(f, newContent, "UTF-8");
    }
  });
}

function rewriteHtml(options, dirs) {
  var extra = options["extra-js"] && options["extra-js"].join("");
  var files = findFiles(dirs, ".html", options.exclude, options["copy-file"]);
  var script = options.script;
  if (options.copy) {
    script = "walkabout.js";
  }
  var writtenDirs = {};
  files.forEach(function (f) {
    var content = fs.readFileSync(f, "UTF-8");
    var newContent = walkabout.rewriteHtml(content, script, extra);
    if (content === newContent) {
      console.log("File not changed:", f);
    } else {
      console.log("Changing:", f);
      if (! options.simulate) {
        fs.writeFileSync(f, newContent, "UTF-8");
      }
    }
    var dir = path.dirname(f);
    if (! writtenDirs[dir]) {
      writtenDirs[dir] = true;
      options["copy-file"].forEach(function (c) {
        var filePath = path.join(dir, c.name);
        if (fs.existsSync(filePath)) {
          console.log("File exists:", filePath);
        } else {
          console.log("Linking", c.filename, "to", filePath);
          if (! options.simulate) {
            fs.symlinkSync(path.resolve(c.filename), filePath);
          }
        }
      });
    }
  });
}

function findFiles(dirs, ext, excludes, copied, files) {
  files = files || [];
  dirs.forEach(function (d) {
    fs.readdirSync(d).forEach(function (f) {
      if (f == "walkabout.js") {
        return;
      }
      if (copied) {
        var found = false;
        copied.forEach(function (c) {
          if (f == c.name) {
            found = true;
          }
        });
        if (found) {
          return;
        }
      }
      f = path.join(d, f);
      if (fs.statSync(f).isDirectory()) {
        findFiles([f], ext, excludes, copied, files);
        return;
      }
      if (path.extname(f) != ext) {
        return;
      }
      if (exclude(excludes, f)) {
        return;
      }
      files.push(f);
    });
  });
  return files;
}

function exclude(excludes, filename) {
  if (! excludes) {
    return false;
  }
  for (var i=0; i<excludes.length; i++) {
    if (filename.search(excludes[i]) != -1) {
      return true;
    }
  }
  return false;
}

if (require.main == module) {
  main();
}
