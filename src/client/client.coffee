# Abstraction over raw net stream, for use by a client.

# NOTE: Variables declared in the global scope here are shared with other client files
# when built with closure. Be careful what you put in your namespace.

if WEB?
	types ||= exports.types
	throw new Error 'Must load socket.io before this library' unless window['io']
	io = window['io']
else
	types = require('../types')
	io = require('../../thirdparty/Socket.io-node-client').io
	MicroEvent = require './microevent'

# An open document.
#
# Documents are event emitters - use doc.on(eventname, fn) to subscribe.
#
# Events:
#  - remoteop (op)
#  - changed (op)
#
# stream is a OpStream object.
# name is the documents' docName.
# version is the version of the document _on the server_
Document = (connection, @name, @version, @type, snapshot) ->
	throw new Error('Handling types without compose() defined is not currently implemented') unless @type.compose?

	# Gotta figure out a cleaner way to make this work with closure.
	@setSnapshot = (s) -> @['snapshot'] = @snapshot = s
	@setSnapshot(snapshot)

	# The op that is currently roundtripping to the server, or null.
	inflightOp = null
	inflightCallbacks = []

	# All ops that are waiting for the server to acknowledge @inflightOp
	pendingOp = null
	pendingCallbacks = []

	# Some recent ops, incase submitOp is called with an old op version number.
	serverOps = {}

	# Listeners for the document changing
	listeners = []

	# Internal - do not call directly.
	tryFlushPendingOp = =>
		if inflightOp == null && pendingOp != null
			# Rotate null -> pending -> inflight, 
			inflightOp = pendingOp
			inflightCallbacks = pendingCallbacks

			pendingOp = null
			pendingCallbacks = []

			connection.send {'doc':@name, 'op':inflightOp, 'v':@version}, (response) =>
				if response['v'] == null
					# Currently, it should be impossible to reach this case.
					# This case is currently untested.
					callback(null) for callback in inflightCallbacks
					inflightOp = null
					# Perhaps the op should be removed from the local document...
					# @snapshot = @type.apply @snapshot, type.invert(@inflightOp) if type.invert?
					throw new Error(response['error'])

				throw new Error('Invalid version from server') unless response['v'] == @version

				serverOps[@version] = inflightOp
				@version++
				callback(inflightOp, null) for callback in inflightCallbacks

				inflightOp = null
				tryFlushPendingOp()

	# Internal - do not call directly.
	# Called when an op is received from the server.
	@_onOpReceived = (msg) ->
		# msg is {doc:, op:, v:}

		# There is a bug in socket.io (produced on firefox 3.6) which causes messages
		# to be duplicated sometimes.
		# We'll just silently drop subsequent messages.
		return if msg['v'] < @version

		throw new Error("Expected docName #{@name} but got #{msg['doc']}") unless msg['doc'] == @name
		throw new Error("Expected version #{@version} but got #{msg['v']}") unless msg['v'] == @version

#		p "if: #{i @inflightOp} pending: #{i @pendingOp} doc '#{@snapshot}' op: #{i msg.op}"

		op = msg['op']
		serverOps[@version] = op

		# Transform a server op by a client op, and vice versa.
		xf = @type.transformX or (client, server) =>
			client_ = @type.transform client, server, 'left'
			server_ = @type.transform server, client, 'right'
			return [client_, server_]

		docOp = op
		if inflightOp != null
			[inflightOp, docOp] = xf inflightOp, docOp
		if pendingOp != null
			[pendingOp, docOp] = xf pendingOp, docOp
			
		oldSnapshot = @snapshot
		@setSnapshot(@type.apply oldSnapshot, docOp)
		@version++

		@emit 'remoteop', docOp, oldSnapshot
		@emit 'change', docOp, oldSnapshot

	# Submit an op to the server. The op maybe held for a little while before being sent, as only one
	# op can be inflight at any time.
	@['submitOp'] = @submitOp = (op, v = @version, callback) ->
		if typeof v == 'function'
			callback = v
			v = @version

		op = @type.normalize(op) if @type?.normalize?

		while v < @version
			# TODO: Add tests for this
			realOp = serverOps[v]
			throw new Error 'Op version too old' unless realOp
			op = @type.transform op, realOp, 'left'
			v++

		# If this throws an exception, no changes should have been made to the doc
		@setSnapshot(@type.apply @snapshot, op)

		if pendingOp != null
			pendingOp = @type.compose(pendingOp, op)
		else
			pendingOp = op

		pendingCallbacks.push callback if callback

		@emit 'change', op

		# A timeout is used so if the user sends multiple ops at the same time, they'll be composed
		# together and sent together.
		setTimeout tryFlushPendingOp, 0
	
	# Close a document.
	# No unit tests for this so far.
	@['close'] = @close = (callback) ->
		connection.send {'doc':@name, open:false}, =>
			callback() if callback
			@emit 'closed'
			return
	
	if @type.api
		this[k] = v for k, v of @type.api
		@_register()
	else
		@provides = @['provides'] = {}

	this

MicroEvent.mixin Document

# A connection to a sharejs server
class Connection
	constructor: (host, port, basePath) ->
		resource = if basePath then path + '/socket.io' else 'socket.io'

		@socket = new io['Socket'] host, {port:port, resource:resource}

		@socket['on'] 'connect', @connected
		@socket['on'] 'disconnect', @disconnected
		@socket['on'] 'message', @onMessage
		@socket['connect']()

		@docs = {}
		@numDocs = 0

	disconnected: =>
		# Start reconnect sequence
		@emit 'disconnect'

	connected: =>
		# Stop reconnect sequence
		@emit 'connect'

	# Send the specified message to the server. The server's response will be passed
	# to callback. If the message is 'open', ops will be sent to follower()
	send: (msg, callback) ->
		docName = msg['doc']

		if docName == @lastSentDoc
			delete msg['doc']
		else
			@lastSentDoc = docName

		@socket['send'] msg
		
		if callback
			register = (type) =>
				cb = (response) =>
					if response['doc'] == docName
						@removeListener type, cb
						callback(response)

				@on type, cb

			register (if msg['open'] == true then 'open'
			else if msg['open'] == false then 'close'
			else if msg['create'] then 'create'
			else if msg['snapshot'] == null then 'snapshot'
			else if msg['op'] then 'op response')

	onMessage: (msg) =>
		docName = msg['doc']

		if docName != undefined
			@lastReceivedDoc = docName
		else
			msg['doc'] = docName = @lastReceivedDoc

		@emit 'message', msg

		type = if msg['open'] == true or (msg['open'] == false and msg['error']) then 'open'
		else if msg['open'] == false then 'close'
		else if msg['snapshot'] != undefined then 'snapshot'
		else if msg['create'] then 'create'
		else if msg['op'] then 'op'
		else if msg['v'] != undefined then 'op response'

		@emit type, msg

		if type == 'op'
			doc = @docs[docName]
			doc._onOpReceived msg if doc

	makeDoc: (params) ->
		name = params['doc']
		throw new Error("Document #{name} already followed") if @docs[name]

		type = params['type']
		type = types[type] if typeof type == 'string'
		doc = new Document(@, name, params['v'], type, params['snapshot'])
		doc['created'] = !!params['create']
		@docs[name] = doc
		@numDocs++

		doc.on 'closed', =>
			delete @docs[name]
			@numDocs--

		doc

	# Open a document that already exists
	# callback is passed a Document or null
	# callback(doc, error)
	'openExisting': (docName, callback) ->
		return @docs[docName] if @docs[docName]?

		@send {'doc':docName, 'open':true, 'snapshot':null}, (response) =>
			if response.error
				callback null, new Error(response.error)
			else
				# response['doc'] is used instead of docName to allow docName to be null.
				# In that case, the server generates a random docName to use.
				callback @makeDoc(response)

	# Open a document. It will be created if it doesn't already exist.
	# Callback is passed a document or an error
	# type is either a type name (eg 'text' or 'simple') or the actual type object.
	# Types must be supported by the server.
	# callback(doc, error)
	'open': (docName, type, callback) ->
		if typeof type == 'function'
			callback = type
			type = 'text'

		callback ||= ->

		type = types[type] if typeof type == 'string'

		if docName? and @docs[docName]?
			doc = @docs[docName]
			if doc.type == type
				callback doc
			else
				callback doc, 'Type mismatch'

			return

		@send {'doc':docName, 'open':true, 'create':true, 'snapshot':null, 'type':type.name}, (response) =>
			if response.error
				callback null, response.error
			else
				response['snapshot'] = type.create() unless response['snapshot'] != undefined
				response['type'] = type
				callback @makeDoc(response)

	# To be written. Create a new document with a random name.
	'create': (type, callback) ->
		open null, type, callback

	'disconnect': () ->
		if @stream?
			@emit 'disconnected'
			@stream.disconnect()
			@stream = null

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
	c.open docName, type, (doc, error) ->
		if doc == null
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

if WEB?
	exports['Connection'] = Connection
	exports['Document'] = Document
	exports['open'] = open
	window['sharejs'] = exports
else
	exports.Connection = Connection
	exports.open = open
