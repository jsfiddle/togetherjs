# Abstraction over raw net stream, for use by a client.

if WEB?
	types ||= exports.types
else
	OpStream = require('./opstream').OpStream
	types = require('../types')
	MicroEvent = require './microevent'

p = -> #require('util').debug
i = -> #require('util').inspect

# An open document.
#
# Documents are event emitters - use doc.on(eventname, fn) to subscribe.
#
# Events:
#  - remoteop (op)
#  - changed (op)
class Document
	# stream is a OpStream object.
	# name is the documents' docName.
	# version is the version of the document _on the server_
	constructor: (@stream, @name, @version, @type, snapshot) ->
		throw new Error('Handling types without compose() defined is not currently implemented') unless @type.compose?

		# Gotta figure out a better way to make this work with closure.
		@['snapshot'] = snapshot

		# The op that is currently roundtripping to the server, or null.
		@inflightOp = null
		@inflightCallbacks = []

		# All ops that are waiting for the server to acknowledge @inflightOp
		@pendingOp = null
		@pendingCallbacks = []

		# Some recent ops, incase submitOp is called with an old op version number.
		@serverOps = {}

		# Listeners for the document changing
		@listeners = []

		@created = no

		@follow()
	
	# Internal
	follow: (callback) ->
		@stream.on @name, 'op', @onOpReceived

		@stream.follow @name, @version, (msg) =>
			throw new Error("Expected version #{@version} but got #{msg['v']}") unless msg['v'] == @version
			callback() if callback?

	# Internal.
	unfollow: (callback) ->
		# Ignore all inflight ops.
		# I think there is a bug here if you send an op then immediately unfollow the document, and a server op
		# happens before your op reaches the server.
		@stream.removeListener @name, 'op', @onOpReceived
		@stream.unfollow @name, callback

	# Internal - do not call directly.
	tryFlushPendingOp: =>
		if @inflightOp == null && @pendingOp != null
			# Rotate null -> pending -> inflight, 
			@inflightOp = @pendingOp
			@inflightCallbacks = @pendingCallbacks

			@pendingOp = null
			@pendingCallbacks = []

			@stream.submit @name, @inflightOp, @version, (response) =>
				if response['v'] == null
					# Currently, it should be impossible to reach this case.
					# This case is currently untested.
					callback(null) for callback in @inflightCallbacks
					@inflightOp = null
					# Perhaps the op should be removed from the local document...
					# @snapshot = @type.apply @snapshot, type.invert(@inflightOp) if type.invert?
					throw new Error(response['error'])

				throw new Error('Invalid version from server') unless response['v'] == @version

				@serverOps[@version] = @inflightOp
				@version++
				callback(@inflightOp, null) for callback in @inflightCallbacks
#				console.log 'Heard back from server.', this, response, @version

				@inflightOp = null
				@tryFlushPendingOp()

	# Internal - do not call directly.
	# Called when an op is received from the server.
	onOpReceived: (msg) =>
		# msg is {doc:, op:, v:}

		# There is a bug in socket.io (produced on firefox 3.6) which causes messages
		# to be duplicated sometimes.
		# We'll just silently drop subsequent messages.
		return if msg['v'] < @version

		throw new Error("Expected docName #{@name} but got #{msg['doc']}") unless msg['doc'] == @name
		throw new Error("Expected version #{@version} but got #{msg['v']}") unless msg['v'] == @version

#		p "if: #{i @inflightOp} pending: #{i @pendingOp} doc '#{@snapshot}' op: #{i msg.op}"

		op = msg['op']
		@serverOps[@version] = op

		# Transform a server op by a client op, and vice versa.
		xf = @type.transformX or (server, client) =>
			server_ = @type.transform server, client, 'server'
			client_ = @type.transform client, server, 'client'
			return [server_, client_]

		docOp = op
		if @inflightOp != null
			[docOp, @inflightOp] = xf docOp, @inflightOp
		if @pendingOp != null
			[docOp, @pendingOp] = xf docOp, @pendingOp
			
		@['snapshot'] = @type.apply @['snapshot'], docOp
		@version++

		@emit 'remoteop', docOp
		@emit 'change', docOp

	# Submit an op to the server. The op maybe held for a little while before being sent, as only one
	# op can be inflight at any time.
	submitOp: (op, v = @version, callback) ->
		if typeof v == 'function'
			callback = v
			v = @version

		op = @type.normalize(op) if @type?.normalize?

		while v < @version
			realOp = @recentOps[v]
			throw new Error 'Op version too old' unless realOp
			op = @type.transform(op, realOp, 'client')
			v++

		# If this throws an exception, no changes should have been made to the doc
		@['snapshot'] = @type.apply @['snapshot'], op

		if @pendingOp != null
			@pendingOp = @type.compose(@pendingOp, op)
		else
			@pendingOp = op

		@pendingCallbacks.push callback if callback

		@emit 'change', op

		# A timeout is used so if the user sends multiple ops at the same time, they'll be composed
		# together and sent together.
		setTimeout @tryFlushPendingOp, 0
	
	# Close a document.
	# No unit tests for this so far.
	close: (callback) ->
		@unfollow =>
			callback() if callback
			@emit 'closed'
			return

MicroEvent.mixin Document

# Export the functions for the closure compiler
Document.prototype['submitOp'] = Document.prototype.submitOp
Document.prototype['close'] = Document.prototype.close


# A connection to a sharejs server
class Connection
	constructor: (host, port, basePath) ->
		@stream = new OpStream(host, port, basePath)
		@docs = {}
		@numDocs = 0

	makeDoc: (name, version, type, snapshot) ->
		throw new Error("Document #{name} already followed") if @docs[name]

		doc = new Document(@stream, name, version, type, snapshot)
		@docs[name] = doc
		@numDocs++

		doc.on 'closed', =>
			delete @docs[name]
			@numDocs--

		doc

	# Open a document that already exists
	# callback is passed a Document or null
	# callback(doc)
	openExisting: (docName, callback) ->
		return @docs[docName] if @docs[docName]?

		@stream.get docName, (response) =>
			if response['snapshot'] == null
				callback(null)
			else
				type = types[response['type']]
				callback @makeDoc(response['doc'], response['v'], type, response['snapshot'])

	# Open a document. It will be created if it doesn't already exist.
	# Callback is passed a document or an error
	# type is either a type name (eg 'text' or 'simple') or the actual type object.
	# Types must be supported by the server.
	# callback(doc, error)
	open: (docName, type, callback) ->
		if typeof type == 'function'
			callback = type
			type = 'text'

		callback ||= ->

		type = types[type] if typeof type == 'string'

		if @docs[docName]?
			doc = @docs[docName]
			if doc.type == type
				callback doc
			else
				callback doc, 'Document already exists with type ' + doc.type.name

			return

		@stream.get docName, (response) =>
			if response['snapshot'] == null
				@stream.submit docName, {'type': type.name}, 0, (response) =>
					if response['v']?
						doc = @makeDoc(docName, 1, type, type.initialVersion())
						doc.created = yes
						callback doc
					else if response['v'] == null and response['error'] == 'Type already set'
						# Somebody else has created the document. Get the snapshot again..
						@open docName, type, callback
					else
						callback null, response['error']
			else if response['type'] == type.name
				callback @makeDoc(docName, response['v'], type, response['snapshot'])
			else
				callback null, "Document already exists with type #{response['type']}"

	# To be written. Create a new document with a random name.
	# Prefix is an optional string to put on the front of the document name.
	create: (type, prefix) ->
		throw new Error('Not implemented')

	disconnect: () ->
		if @stream?
			@emit 'disconnected'
			@stream.disconnect()
			@stream = null

Connection.prototype['openExisting'] = Connection.prototype.openExisting
Connection.prototype['open'] = Connection.prototype.open

MicroEvent.mixin Connection

# This is a private connection pool for implicitly created connections.
connections = {}

getConnection = (host, port, basePath) ->
	if WEB?
		host ?= window.location.hostname
		port ?= window.location.port
	
	address = host
	address += ":#{port}" if port?

	unless connections[address]
		c = new Connection(host, port, basePath)
		c.on 'disconnected', -> delete connections[address]
		connections[address] = c
	
	connections[address]

# Open a document with the given name. The connection is created implicitly and reused.
#
# There are no unit tests for this function. :(
open = (docName, type, options, callback) ->
	if typeof options == 'function'
		callback = options
		options = null

	options ?= {}
	c = getConnection options.host, options.port, options.basePath
	c.open docName, type, (doc) ->
		# If you're using the bare API, connections are cleaned up as soon as there's no
		# documents using them.
		doc.on 'closed', ->
			setTimeout ->
					if c.numDocs == 0
						c.disconnect()
				, 0

		callback(doc)

if WEB?
	exports['Connection'] = Connection
	exports['Document'] = Document
	exports['open'] = open
	window['sharejs'] = exports
else
	exports.Connection = Connection
	exports.open = open
