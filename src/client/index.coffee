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

unless WEB?
	Connection = require('./connection').Connection

# Open a document with the given name. The connection is created implicitly and reused.
#
# There are no unit tests for this function. :(
#
# This function uses a local (private) set of connections to support .open().
exports.open = do ->
	# This is a private connection pool for implicitly created connections.
	connections = {}

	getConnection = (origin) ->
		if WEB?
			location = window.location
			origin ?= "#{location.protocol}//#{location.hostname}/sjs"
		
		unless connections[origin]
			c = new Connection origin
			c.numDocs = 0

			del = -> delete connections[origin]
			c.on 'disconnecting', del
			c.on 'connect failed', del
			connections[origin] = c
		
		connections[origin]

	(docName, type, origin, callback) ->
		if typeof origin == 'function'
			callback = origin
			origin = null

		c = getConnection origin
		c.numDocs++
		c.open docName, type, (doc, error) ->
			if doc == null
				c.numDocs--
				c.disconnect() if c.numDocs == 0
				callback null, error
			else
				# If you're using the bare API, connections are cleaned up as soon as there's no
				# documents using them.
				doc.on 'closed', ->
					c.numDocs--
					if c.numDocs == 0
						c.disconnect()

				callback doc
		
		c.on 'connect failed'


unless WEB?
	exports.Doc = require('./doc').Doc
	exports.Connection = require('./connection').Connection

