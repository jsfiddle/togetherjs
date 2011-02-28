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
		if data.doc?
			@lastReceivedDoc = data.doc
		else
			data.doc = @lastReceivedDoc

		# Calls the registered callback for this event. If clear is truthy, remove the callback handler
		# afterwards.
		emit = (type, clear) =>
			p "emit #{data.doc} #{type}"
			callback = @callbacks[data.doc]?[type]
			if callback?
				@callbacks[data.doc][type] = null if clear
				callback(data)


		if data.snapshot != undefined
			emit 'snapshot', yes

		else if data.open?
			if data.open
				emit 'open', yes
			else
				emit 'close', yes

		else if data.v? # Result of sending an op
			if data.op?
				# Remote op
				emit 'op', no
			else
				emit 'localop', yes

	send: (msg) ->
		if msg.doc == @lastSentDoc
			delete msg.doc
		else
			@lastSentDoc = msg.doc

		@socket.send msg

	# Send open request, queue up callback.
	open: (docName, v, callback) ->
		p "open #{docName}"
		request = {doc:docName, open:true}
		request.v = v if v?
		@send request
		@on docName, 'open', callback

	# Get a document snapshot at the current version
	get: (docName, callback) ->
		p "get #{docName}"
		@send {doc:docName, snapshot:null}
		@on docName, 'snapshot', callback

	# Submit an op to the named document
	submit: (docName, op, version, callback) ->
		console.log "submit v #{version} on #{docName}", op
		@send {doc:docName, v:version, op:op}
		@on docName, 'localop', callback
	
	# Close an already open document
	close: (docName, callback) ->
		p "close #{docName}"
		@send {doc:docName, open:false}
		@on docName, 'close', callback
	
	disconnect: ->
		@socket.disconnect()
		@socket = null

#{open: open, connect: connect, get: get, submit: submit}

if window?
	window.ot ||= {}
	window.ot.DeltaStream = DeltaStream
else
	exports.DeltaStream = DeltaStream

