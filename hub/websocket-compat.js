/*
 * A hacked websocket module which retains compatibility with the old
 * Hixie-76 version of the standard, needed for phantom JS (and,
 * presumably, very old browsers).
 *
 * This file released into the public domain
 * by C. Scott Ananian <cscott@cscott.net> 2014-08-26
 *
 * Based on https://gist.github.com/toshirot/1428579
 */
var events = require("events");
var util = require("util");

var WebSocketRequest = require('websocket').request;
var WebSocketServer = require('websocket').server;

// Copy helpers from WebSocketServer to WebSocketRequest

WebSocketRequest.prototype.connections = [];
WebSocketRequest.prototype.handleRequestAccepted =
  WebSocketServer.prototype.handleRequestAccepted;
WebSocketRequest.prototype.handleConnectionClose =
  WebSocketServer.prototype.handleConnectionClose;
WebSocketRequest.prototype.broadcastUTF =
  WebSocketServer.prototype.broadcastUTF;

var miksagoServerFactory = require('websocket-server');
var miksagoConnection = require('../node_modules/websocket-server/lib/ws/connection');

var CompatWebSocketServer = function(options) {
  events.EventEmitter.call(this); // superclass constructor
  var self = this;
  var handleConnection;

  // node-websocket-server (hixie-75 and hixie-76 support)
  var miksagoServer = miksagoServerFactory.createServer();
  miksagoServer.server = options.httpServer;
  miksagoServer.addListener('connection', function(connection) {
    // Add remoteAddress property
    connection.remoteAddress = connection._socket.remoteAddress;

    // We want to use "sendUTF" regardless of the server implementation
    connection.sendUTF = connection.send;
    handleConnection(connection);
  });

  // WebSocket-Node config (modern websocket support)
  var wsServerConfig =  {
    // All options *except* 'httpServer' are required when bypassing
    // WebSocketServer.
    maxReceivedFrameSize: options.maxReceivedFrameSize || 0x10000,
    maxReceivedMessageSize: options.maxReceivedMessageSize || 0x100000,
    fragmentOutgoingMessages: true,
    fragmentationThreshold: 0x4000,
    keepalive: true,
    keepaliveInterval: 20000,
    assembleFragments: true,
    // autoAcceptConnections is not applicable when bypassing WebSocketServer
    // autoAcceptConnections: false,
    disableNagleAlgorithm: true,
    closeTimeout: 5000
  };

  // Handle the upgrade event ourselves instead of using WebSocketServer
  var wsRequest={};
  options.httpServer.on('upgrade', function(req, socket, head) {
    if (typeof req.headers['sec-websocket-version'] !== 'undefined') {

      // WebSocket hybi-08/-09/-10 connection (WebSocket-Node)
      wsRequest = new WebSocketRequest(socket, req, wsServerConfig);
      try {
        wsRequest.readHandshake();
      } catch (e) {
        wsRequest.reject(
          e.httpCode ? e.httpCode : 400,
          e.message,
          e.headers
        );
        return;
      }
      wsRequest.once('requestAccepted', function(connection) {
        wsRequest.handleRequestAccepted(connection);
      });
      self.emit('request', wsRequest);

    } else {

      // WebSocket hixie-75/-76/hybi-00 connection (node-websocket-server)
      if (req.method === 'GET' &&
          (req.headers.upgrade && req.headers.connection) &&
          req.headers.upgrade.toLowerCase() === 'websocket' &&
          req.headers.connection.toLowerCase() === 'upgrade') {
        new miksagoConnection(
          miksagoServer.manager, miksagoServer.options, req, socket, head
        );
      }
    }
  });

  // A connection handler for old-style websockets
  handleConnection = function(connection) {
    // fake a request
    self.emit('request', new CompatRequest(self, connection));
  };
};
util.inherits(CompatWebSocketServer, events.EventEmitter);

var CompatRequest = function(server, connection) {
  this._server = server;
  this._connection = connection;
  this.origin = connection._options.origin || '*';
  this.httpRequest = connection._req;
  // create wrapper right away in order to install event handlers promptly
  this._connectionWrapper = new CompatConnection(server, connection);
};
CompatRequest.prototype.reject = function(code, message) {
  this._connection.reject(message || "no reason");
};
CompatRequest.prototype.accept = function(proto, origin) {
  // this is faked: we've already accepted the connection
  return this._connectionWrapper;
};

var CompatConnection = function(server, connection) {
  var self = this;
  events.EventEmitter.call(this); // superclass constructor

  this._server = server;
  this._connection = connection;
  this.remoteAddress = connection.remoteAddress;

  connection.addListener('message', function(wsMessage) {
    // make the argument compatible with WebSocket-Node
    self.emit('message', {
      type: 'utf8',
      utf8Data: wsMessage
    });
  });

  connection.addListener('close', function() {
    self.emit('close');
  });
};
util.inherits(CompatConnection, events.EventEmitter);

CompatConnection.prototype.sendUTF = function(message) {
  return this._connection.sendUTF(message);
};

module.exports.server = CompatWebSocketServer;
