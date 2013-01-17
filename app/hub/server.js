var WebSocketServer = require('websocket').server;
var WebSocketRouter = require('websocket').router;
var http = require('http');
var static = require('node-static');
var parseUrl = require('url').parse;
var fs = require('fs');
var path = require('path');
var less = require('less');
var coffeeCompile = require("coffee-script").compile;
var logger = require('../../lib/logger');

var server = http.createServer(function(request, response) {
  var url = parseUrl(request.url);
  var protocol = request.headers["porwarded-proto"] || "http:";
  var host = request.headers["host"];
  var base = protocol + "//" + host;
});


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
    logger.info('HUB Server listening on port ' + port);
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
  startServer(process.env.HUB_SERVER_PORT || 8080, process.env.HOST || '127.0.0.1');
}

exports.startServer = startServer;
