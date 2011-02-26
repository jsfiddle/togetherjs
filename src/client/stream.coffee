# A wrapper around the raw network IO.
# SocketIO's 'io' must be defined prior to this file being loaded.

if window?
	throw new Error 'Must load socket.io before this library' unless window.io?
	io = window.io
else
	io = require('Socket.io-node-client').io

p = -> #(x) -> console.log x

# Make 1 per server.
class DeltaStream
	constructor: (@hostname, @port) ->
		# A hash from docName -> {'open': fn, 'op': fn, 'snapshot': fn, ...}
		@callbacks = {}
		@lastReceivedDoc = null
		@lastSentDoc = null
		
		@socket = new io.Socket @hostname, {port:@port}
		@socket.on 'connect', @onConnect
		@socket.on 'message', @onMessage
		@socket.connect()

	onConnect: ->
		p 'connected'

	on: (docName, type, callback) ->
		@callbacks[docName] ||= {}
		throw new Error "Callback already exists for #{docName}, #{type}" if @callbacks[docName][type]?
		@callbacks[docName][type] = callback

	onMessage: (data) =>
		p 'message'
		setDoc = () =>
			if data.doc?
				@lastReceivedDoc = data.doc
			else
				data.doc = @lastReceivedDoc

		# Calls the registered callback for this event. If clear is truthy, remove the callback handler
		# afterwards.
		emit = (docName, type, clear) =>
			p "emit #{docName} #{type}"
			callback = @callbacks[docName]?[type]
			if callback?
				@callbacks[docName][type] = null if clear
				callback(data)

		if data.op?
			console.log 'op', data
			setDoc()
			emit data.doc, 'op', no

		else if data.snapshot != undefined
			p 'snapshot'
			setDoc()
			emit data.doc, 'snapshot', yes

		else if data.open?
			p 'open'

			@lastReceivedDoc = data.open
			emit data.open, 'open', yes

		else if data.r? # Result of sending an op
			p 'r'

			setDoc()
			emit data.doc, 'r', yes

	# Send open request, queue up callback.
	open: (docName, v, callback) ->
		p "open #{docName}"
		openRequest = {open:docName}
		openRequest.v = v if v?
		@socket.send openRequest
		@lastSentDoc = docName
		@on docName, 'open', callback

	# Get a document snapshot at the current version
	get: (docName, callback) ->
		p "get #{docName}"
		@socket.send {get:docName}
		@lastSentDoc = docName
		@on docName, 'snapshot', callback

	# Submit an op to the named document
	submit: (docName, op, version, callback) ->
		console.log "submit v #{version} on #{docName}", op
		msg = {v:version, op:op}
		msg.doc = @lastSentDoc = docName if docName != @lastSentDoc
		@socket.send msg
		@on docName, 'r', callback
	
	# Close an already open document
	close: (docName, callback) ->
		p "close #{docName}"
		msg = {close:docName}
		@lastSentDoc = docName
		@socket.send msg
	
	disconnect: ->
		@socket.disconnect()
		@socket = null

#{open: open, connect: connect, get: get, submit: submit}

if window?
	window.ot ||= {}
	window.ot.DeltaStream = DeltaStream
else
	exports.DeltaStream = DeltaStream

