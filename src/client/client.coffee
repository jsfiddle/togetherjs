# This file implements the sharejs client, as defined here:
# https://github.com/josephg/ShareJS/wiki/Client-API
#
# It works from both a node.js context and a web context (though in the latter case,
# it needs to be compiled to work.)
#
# This file is a bit of a mess. I'm dreadfully sorry about that. It passes all the tests,
# so I have hope that its *correct* even if its not clean.
#
# It should become a little nicer once I start using more of the new RPC features added
# in socket.io 0.7.
#
# Note that Variables declared in the global scope here are shared with other client files
# when built with closure. Be careful what you put in your namespace.

if WEB?
	types ||= exports.types
	throw new Error 'Must load socket.io before this library' unless window.io
	io = window.io
else
	types = require '../types'
	io = require 'socket.io-client'
	MicroEvent = require './microevent'

# An open document.
#
# Documents are event emitters - use doc.on(eventname, fn) to subscribe.
#
# Events:
#  - remoteop (op)
#  - changed (op)
#
# connection is a Connection object.
# name is the documents' docName.
# version is the version of the document _on the server_
`/** @constructor */`
Doc = (connection, @name, @version, @type, snapshot) ->
	throw new Error('Handling types without compose() defined is not currently implemented') unless @type.compose?

	# Gotta figure out a cleaner way to make this work with closure.
	setSnapshot = (s) => @snapshot = s
	setSnapshot snapshot

	# The op that is currently roundtripping to the server, or null.
	inflightOp = null
	inflightCallbacks = []

	# All ops that are waiting for the server to acknowledge @inflightOp
	pendingOp = null
	pendingCallbacks = []

	# Some recent ops, incase submitOp is called with an old op version number.
	serverOps = {}

	# Transform a server op by a client op, and vice versa.
	xf = @type.transformX or (client, server) =>
		client_ = @type.transform client, server, 'left'
		server_ = @type.transform server, client, 'right'
		return [client_, server_]
	
	otApply = (docOp, isRemote) =>
		oldSnapshot = @snapshot
		setSnapshot @type.apply(@snapshot, docOp)

		# Its important that these event handlers are called with oldSnapshot.
		# The reason is that the OT type APIs might need to access the snapshots to
		# determine information about the received op.
		@emit 'remoteop', docOp, oldSnapshot if isRemote
		@emit 'change', docOp, oldSnapshot
	
	tryFlushPendingOp = =>
		if inflightOp == null && pendingOp != null
			# Rotate null -> pending -> inflight, 
			inflightOp = pendingOp
			inflightCallbacks = pendingCallbacks

			pendingOp = null
			pendingCallbacks = []

			connection.send {'doc':@name, 'op':inflightOp, 'v':@version}, (response, error) =>
				oldInflightOp = inflightOp
				inflightOp = null

				if error
					# This will happen if the server rejects edits from the client.
					# We'll send the error message to the user and roll back the change.
					#
					# If the server isn't going to allow edits anyway, we should probably
					# figure out some way to flag that (readonly:true in the open request?)

					if type.invert

						undo = @type.invert oldInflightOp

						# Now we have to transform the undo operation by any server ops & pending ops
						if pendingOp
							[pendingOp, undo] = xf pendingOp, undo

						# ... and apply it locally, reverting the changes.
						# 
						# This call will also call @emit 'remoteop'. I'm still not 100% sure about this
						# functionality, because its really a local op. Basically, the problem is that
						# if the client's op is rejected by the server, the editor window should update
						# to reflect the undo.
						otApply undo, true
					else
						throw new Error "Op apply failed (#{response.error}) and the OT type does not define an invert function."

					callback(null, error) for callback in inflightCallbacks
				else
					throw new Error('Invalid version from server') unless response.v == @version

					serverOps[@version] = oldInflightOp
					@version++
					callback(oldInflightOp, null) for callback in inflightCallbacks

				tryFlushPendingOp()

	# Internal - do not call directly.
	# Called when an op is received from the server.
	@_onOpReceived = (msg) ->
		# msg is {doc:, op:, v:}

		# There is a bug in socket.io (produced on firefox 3.6) which causes messages
		# to be duplicated sometimes.
		# We'll just silently drop subsequent messages.
		return if msg.v < @version

		throw new Error("Expected docName '#{@name}' but got #{msg.doc}") unless msg.doc == @name
		throw new Error("Expected version #{@version} but got #{msg.v}") unless msg.v == @version

#		p "if: #{i @inflightOp} pending: #{i @pendingOp} doc '#{@snapshot}' op: #{i msg.op}"

		op = msg.op
		serverOps[@version] = op

		docOp = op
		if inflightOp != null
			[inflightOp, docOp] = xf inflightOp, docOp
		if pendingOp != null
			[pendingOp, docOp] = xf pendingOp, docOp
			
		@version++
		# Finally, apply the op to @snapshot and trigger any event listeners
		otApply docOp, true

	# Submit an op to the server. The op maybe held for a little while before being sent, as only one
	# op can be inflight at any time.
	@submitOp = (op, callback) ->
		op = @type.normalize(op) if @type.normalize?

		# If this throws an exception, no changes should have been made to the doc
		setSnapshot(@type.apply @snapshot, op)

		if pendingOp != null
			pendingOp = @type.compose(pendingOp, op)
		else
			pendingOp = op

		pendingCallbacks.push callback if callback

		@emit 'change', op

		# A timeout is used so if the user sends multiple ops at the same time, they'll be composed
		# together and sent together.
		setTimeout tryFlushPendingOp, 0
	
	# Force an immediate flush. This is useful for testing.
	@flush = -> tryFlushPendingOp()
	
	# Close a document.
	# No unit tests for this so far.
	@close = (callback) ->
		connection.send {'doc':@name, open:false}, =>
			callback() if callback
			@emit 'closed'
			return
	
	if @type.api
		this[k] = v for k, v of @type.api
		@_register?()
	else
		@provides = {}

	this

MicroEvent.mixin Doc

# A connection to a sharejs server
class Connection
	constructor: (origin) ->
		@docs = {}
		@numDocs = 0

		# Map of docName -> map of type -> function(data, error)
		#
		# Once socket.io isn't buggy, this will be rewritten to use socket.io's RPC.
		@handlers = {}

		# We can't reuse connections because the socket.io server doesn't
		# emit connected events when a new connection comes in. Multiple documents
		# are already multiplexed over the connection by socket.io anyway, so it
		# shouldn't matter too much unless you're doing something particularly wacky.
		@socket = io.connect origin, 'force new connection': true

		@socket.on 'connect', @connected
		@socket.on 'disconnect', @disconnected
		@socket.on 'message', @onMessage
		@socket.on 'connect_failed', (error) =>
			error = 'forbidden' if error == 'unauthorized' # For consistency with the server
			@socket = null
			@emit 'connect failed', error
			# Cancel all hanging messages
			for docName, h of @handlers
				for t, callbacks of h
					callback null, error for callback in callbacks

		# This avoids a bug in socket.io-client (v0.7.9) which causes
		# subsequent connections on the same host to not fire a .connect event
		if @socket.socket.connected
			setTimeout (=> @connected()), 0


	disconnected: =>
		# Start reconnect sequence
		@emit 'disconnect'

	connected: =>
		# Stop reconnect sequence
		@emit 'connect'

	# Send the specified message to the server. The server's response will be passed
	# to callback. If the message is 'open', ops will be sent to follower()
	#
	# The callback is optional. It takes (data, error). Data might be missing if the
	# error was a connection error.
	send: (msg, callback) ->
		throw new Error 'Cannot send messages to a closed connection' if @socket == null

		docName = msg.doc

		if docName == @lastSentDoc
			delete msg.doc
		else
			@lastSentDoc = docName

		@socket.json.send msg
		
		if callback
			type = if msg.open == true then 'open'
			else if msg.open == false then 'close'
			else if msg.create then 'create'
			else if msg.snapshot == null then 'snapshot'
			else if msg.op then 'op response'

			#cb = (response) =>
				#	if response.doc == docName
				#	@removeListener type, cb
				#	callback response, response.error

			docHandlers = (@handlers[docName] ||= {})
			callbacks = (docHandlers[type] ||= [])
			callbacks.push callback

	onMessage: (msg) =>
		docName = msg.doc

		if docName != undefined
			@lastReceivedDoc = docName
		else
			msg.doc = docName = @lastReceivedDoc

		@emit 'message', msg

		# This should probably be rewritten to use socketio's message response stuff instead.
		# (it was originally written for socket.io 0.6)
		type = if msg.open == true or (msg.open == false and msg.error) then 'open'
		else if msg.open == false then 'close'
		else if msg.snapshot != undefined then 'snapshot'
		else if msg.create then 'create'
		else if msg.op then 'op'
		else if msg.v != undefined then 'op response'

		callbacks = @handlers[docName]?[type]
		if callbacks
			delete @handlers[docName][type]
			c msg, msg.error for c in callbacks

		if type == 'op'
			doc = @docs[docName]
			doc._onOpReceived msg if doc

	makeDoc: (params) ->
		name = params.doc
		throw new Error("Doc #{name} already open") if @docs[name]

		type = params.type
		type = types[type] if typeof type == 'string'
		doc = new Doc(@, name, params.v, type, params.snapshot)
		doc.created = !!params.create
		@docs[name] = doc
		@numDocs++

		doc.on 'closed', =>
			delete @docs[name]
			@numDocs--

		doc

	# Open a document that already exists
	# callback is passed a Doc or null
	# callback(doc, error)
	'openExisting': (docName, callback) ->
		if @socket == null # The connection is perminantly disconnected
			callback null, 'connection closed'
			return

		return @docs[docName] if @docs[docName]?

		@send {'doc':docName, 'open':true, 'snapshot':null}, (response, error) =>
			if error
				callback null, error
			else
				# response.doc is used instead of docName to allow docName to be null.
				# In that case, the server generates a random docName to use.
				callback @makeDoc(response)

	# Open a document. It will be created if it doesn't already exist.
	# Callback is passed a document or an error
	# type is either a type name (eg 'text' or 'simple') or the actual type object.
	# Types must be supported by the server.
	# callback(doc, error)
	open: (docName, type, callback) ->
		if @socket == null # The connection is perminantly disconnected
			callback null, 'connection closed'
			return

		if typeof type == 'function'
			callback = type
			type = 'text'

		callback ||= ->

		type = types[type] if typeof type == 'string'

		throw new Error "OT code for document type missing" unless type

		if docName? and @docs[docName]?
			doc = @docs[docName]
			if doc.type == type
				callback doc
			else
				callback doc, 'Type mismatch'

			return

		@send {'doc':docName, 'open':true, 'create':true, 'snapshot':null, 'type':type.name}, (response, error) =>
			if error
				callback null, error
			else
				response.snapshot = type.create() unless response.snapshot != undefined
				response.type = type
				callback @makeDoc(response)

	# To be written. Create a new document with a random name.
	create: (type, callback) ->
		open null, type, callback

	disconnect: () ->
		if @socket
			@emit 'disconnected'
			@socket.disconnect()
			@socket = null

MicroEvent.mixin Connection

# This is a private connection pool for implicitly created connections.
connections = {}

getConnection = (origin) ->
	if WEB?
		location = window.location
		origin ?= "#{location.protocol}//#{location.hostname}/sjs"
	
	unless connections[origin]
		c = new Connection origin
		c.on 'disconnected', -> delete connections[origin]
		c.on 'connect failed', -> delete connections[origin]
		connections[origin] = c
	
	connections[origin]

# Open a document with the given name. The connection is created implicitly and reused.
#
# There are no unit tests for this function. :(
open = (docName, type, origin, callback) ->
	if typeof origin == 'function'
		callback = origin
		origin = null

	c = getConnection origin
	c.open docName, type, (doc, error) ->
		if doc == null
			c.disconnect() if c.numDocs == 0
			callback null, error
		else
			# If you're using the bare API, connections are cleaned up as soon as there's no
			# documents using them.
			doc.on 'closed', ->
				setTimeout ->
						if c.numDocs == 0
							c.disconnect()
					, 0

			callback doc
	
	c.on 'connect failed'

exports.Connection = Connection
exports.Doc = Doc
exports.open = open
