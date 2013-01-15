var WebSocketServer = require('websocket').server;
var WebSocketRouter = require('websocket').router;
var http = require('http');
var static = require('node-static');
var parseUrl = require('url').parse;
var fs = require('fs');
var path = require('path');
var less = require('less');
var coffeeCompile = require("coffee-script").compile;

var staticRoot = new static.Server(__dirname);
// FIXME: use express for all this?

// FIXME: it would be nice if this served up examples/
// (though keeping that on a different origin is also helpful)
var server = http.createServer(function(request, response) {
  var url = parseUrl(request.url);
  var protocol = request.headers["porwarded-proto"] || "http:";
  var host = request.headers["host"];
  var base = protocol + "//" + host;
  var strippedPath = url.pathname.replace(/^\/*/, "");
  // FIXME: this probably isn't secure against some attacks:

  if (url.pathname == "/towtruck.js") {
    fs.readFile(path.join(__dirname, "towtruck.js"), "UTF-8", function (error, code) {
      if (error) {
        write500(error, response);
        return;
      }
      code = code.replace(/http:\/\/localhost:8080/g, base);
      response.setHeader("Content-Type", "application/javascript");
      response.end(code);
    });
    return;
  }

  var isJavascript = strippedPath.search(/\.js$/) != -1;
  var isCss = strippedPath.search(/\.css$/) != -1;
  if (isJavascript) {
    var basename = path.basename(strippedPath, ".js");
    var coffeeName = path.join(
      __dirname,
      path.dirname(strippedPath),
      basename + ".coffee");
    fs.exists(
      coffeeName,
      function (exists) {
        if (exists) {
          fs.readFile(coffeeName, "UTF-8", function (error, code) {
            if (error) {
              write500(error, response);
              return;
            }
            var js = coffeeCompile(code, {filename: coffeeName});
            serveJavascript(basename, js, base, response);
          });
        } else {
          fs.exists(staticRoot.resolve(url.pathname), function (exists) {
            if (exists) {
              fs.readFile(staticRoot.resolve(url.pathname), "UTF-8", function (error, code) {
                if (error) {
                  write500(error, response);
                  return;
                }
                serveJavascript(basename, code, base, response);
              });
            } else {
              write404(response);
            }
          });
        }
      }
    );
  } else if (isCss) {
    var basename = path.basename(strippedPath, ".css");
    var lessName = path.join(
      __dirname,
      path.dirname(strippedPath),
      basename + ".less");

    require('fs').exists(
      lessName,
      function (exists) {
        if (exists) {
          fs.readFile(lessName, "UTF-8", function (error, code) {
            if (error) {
              write500(error, response);
              return;
            }
            try {
              less.render(code, function (error, css) {
                if (error) {
                  write500(error, response);
                  return;
                }
                response.setHeader("Content-Type", "text/css");
                response.end(css);
              });
            } catch (e) {
              write500("Error in less.render: " + JSON.stringify(e, null, "  "), response);
              return;
            }
          });
        } else {
          serveStatic(request, response);
        }
      });
  } else {
    serveStatic(request, response);
  }
});

function serveStatic(request, response) {
  fs.exists(staticRoot.resolve(request.url.pathname), function (exists) {
    if (exists) {
      staticRoot.serve(request, response);
    } else {
      write404(response);
    }
  });
}


var JS_SYNC_TEMPLATE = "\n" + [
  "// Synchronous support:",
  "window._TowTruck_notify_script && _TowTruck_notify_script(__NAME__);"
].join("\n");

function serveJavascript(name, code, base, response) {
  response.setHeader("Content-Type", "application/javascript");
  var tmpl = JS_SYNC_TEMPLATE.replace(/__NAME__/g, JSON.stringify(name));
  code += tmpl;
  function sub() {
    var match = (/INCLUDE\(['"]([^\)]+)['"]\)/).exec(code);
    if (! match) {
      code = code.replace(/http:\/\/localhost:8080/g, base);
      response.end(code);
      return;
    }
    var filename = match[1];
    var before = code.substr(0, match.index);
    var after = code.substr(match.index + match[0].length);
    fs.readFile(path.join(__dirname, filename), "UTF-8", function (error, text) {
      if (error) {
        write500(error, response);
        return;
      }
      code = before + "(" + JSON.stringify(text) + ")" + after;
      sub();
    });
  }
  sub();
}

function write500(error, response) {
  response.writeHead(500, {"Content-Type": "text/plain"});
  if (typeof error != "string") {
    error = "\n" + JSON.stringify(error, null, "  ");
  }
  response.end("Error: " + error);
}

function write404(response) {
  response.writeHead(404, {"Content-Type": "text/plain"});
  response.end("Resource not found");
}

function startServer(port, host) {
  server.listen(port, host, function() {
    console.log((new Date()) + ' Server is listening on port ' + port);
  });
}

var wsServer = new WebSocketServer({
    httpServer: server,
    // 10Mb max size (1Mb is default, maybe this bump is unnecessary)
    maxReceivedMessageSize: 0x1000000,
    // The browser doesn't seem to break things up into frames (not sure what this means)
    // and the default of 64Kb was exceeded; raised to 1Mb
    maxReceivedFrameSize: 0x100000,
    // Using autoaccept because the origin is somewhat dynamic
    // FIXME: make this smarter?
    autoAcceptConnections: false
});

function originIsAllowed(origin) {
  // Unfortunately the origin will be whatever page you are sharing,
  // which could be any origin
  return true;
}

var allConnections = {};

var ID = 0;

wsServer.on('request', function(request) {
  if (!originIsAllowed(request.origin)) {
    // Make sure we only accept requests from an allowed origin
    request.reject();
    console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
    return;
  }

  var id = request.httpRequest.url.replace(/^\/hub\/+/, '').replace(/\/.*/, '');

  // FIXME: we should use a protocol here instead of null, but I can't
  // get it to work.  "Protocol" is what the two clients are using
  // this channel for, "towtruck" in this case.
  var connection = request.accept(null, request.origin);
  connection.ID = ID++;
  if (! allConnections[id]) {
    allConnections[id] = [];
  }
  allConnections[id].push(connection);
  console.log((new Date()) + ' Connection accepted to ' + JSON.stringify(id) + ' ID:' + connection.ID);
  connection.on('message', function(message) {
    var parsed = JSON.parse(message.utf8Data);
    console.log('Message on ' + id + ' bytes: '
                + (message.utf8Data && message.utf8Data.length)
                + ' conn ID: ' + connection.ID + ' data:' + message.utf8Data.substr(0, 20)
                + ' connections: ' + allConnections[id].length);
    for (var i=0; i<allConnections[id].length; i++) {
      var c = allConnections[id][i];
      if (c == connection) {
        continue;
      }
      if (message.type === 'utf8') {
        c.sendUTF(message.utf8Data);
      } else if (message.type === 'binary') {
        c.sendBytes(message.binaryData);
      }
    }
  });
  connection.on('close', function(reasonCode, description) {
    var index = allConnections[id].indexOf(connection);
    if (index != -1) {
      allConnections[id].splice(index, 1);
    }
    console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected, ID: ' + connection.ID);
  });
});

if (require.main == module) {
  startServer(process.env.PORT || 8080, process.env.HOST || '127.0.0.1');
}

exports.startServer = startServer;
