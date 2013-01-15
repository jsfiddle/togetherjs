# This file implements the sharejs client, as defined here:
# https://github.com/josephg/ShareJS/wiki/Client-API
#
# It works from both a node.js context and a web context (though in the latter case,
# it needs to be compiled to work.)
#
# It should become a little nicer once I start using more of the new RPC features added
# in socket.io 0.7.
#
# Note that anything declared in the global scope here is shared with other files
# built by closure. Be careful what you put in this namespace.


if WEB?
  hasBCSocket = window.BCSocket isnt undefined
  hasSockJS = window.SockJS isnt undefined
  throw new Error 'Must load socks or browserchannel before this library' unless hasBCSocket or hasSockJS
  useSockJS = true if hasSockJS and !hasBCSocket
else
  Connection = require('./connection').Connection

# Open a document with the given name. The connection is created implicitly and reused.
#
# This function uses a local (private) set of connections to support .open().
#
# Open returns the connection its using to access the document.
exports.open = do ->
  # This is a private connection pool for implicitly created connections.
  connections = {}

  getConnection = (origin, authentication) ->
    if WEB?
      location = window.location
      # default to browserchannel
      path = if useSockJS then 'sockjs' else 'channel'
      origin ?= "#{location.protocol}//#{location.host}/#{path}"

    unless connections[origin]
      c = new Connection origin, authentication

      del = -> delete connections[origin]
      c.on 'disconnected', del
      c.on 'connect failed', del
      connections[origin] = c

    connections[origin]

  # If you're using the bare API, connections are cleaned up as soon as there's no
  # documents using them.
  maybeClose = (c) ->
    numDocs = 0
    for name, doc of c.docs
      numDocs++ if doc.state isnt 'closed' || doc.autoOpen

    if numDocs == 0
      c.disconnect()

  (docName, type, options, callback) ->
    if typeof options == 'function'
      callback = options
      options = {}

    if typeof options == 'string'
      options = {
        'origin': options
      }

    origin = options.origin
    authentication = options.authentication

    c = getConnection origin, authentication
    c.numDocs++
    c.open docName, type, (error, doc) ->
      if error
        callback error
        maybeClose c
      else
        doc.on 'closed', -> maybeClose c

        callback null, doc

    c.on 'connect failed'
    return c


unless WEB?
  exports.Doc = require('./doc').Doc
  exports.Connection = require('./connection').Connection

