module.exports = function (grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    less: {
      development: {
        options: {
          dumpLineNumbers: "all",
          paths: ["towtruck/"]
        },
        files: {
          "build/towtruck/towtruck.css": "towtruck/towtruck.less"
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
          // FIXME: this includes everything from session features:
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
      },
      src: ["build/towtruck/towtruck.css"]
    },

    // FIXME: should use: https://npmjs.org/package/grunt-ejs-static

    copy: {
      main: {
        files: [
          {src: ["towtruck/**"], dest: "build/"}
        ]
      }
    },

    watch: {
      files: ["towtruck/**/*"],
      tasks: ["build"]
    }

  });

  grunt.loadNpmTasks("grunt-contrib-less");
  grunt.loadNpmTasks("grunt-contrib-csslint");
  grunt.loadNpmTasks("grunt-contrib-jshint");
  grunt.loadNpmTasks("grunt-contrib-requirejs");
  grunt.loadNpmTasks("grunt-contrib-watch");
  grunt.loadNpmTasks('grunt-contrib-copy');

  grunt.registerTask("build", ["copy", "less"]);

};
