# A wrapper around the raw network IO.
# SocketIO's 'io' must be defined prior to this file being loaded.

if window?
	throw new Error 'Must load socket.io before this library' unless window.io?
	io = window.io
else
	io = require('../../thirdparty/Socket.io-node-client').io

p = -> #(x) -> console.log x

# Make 1 per server.
#
# Consider refactoring this to use microevent.
class OpStream
	constructor: (host, port, path) ->
		resource = if path then path + '/socket.io' else 'socket.io'

		@socket = new io.Socket host, {port:port, resource:resource}
		@socket.on 'connect', @onConnect
		@socket.on 'message', @onMessage
		@socket.connect()

		# A hash from docName -> {'follow': fn, 'op': fn, 'snapshot': fn, ...}
		@callbacks = {}
		@lastReceivedDoc = null
		@lastSentDoc = null

	onConnect: ->
		p 'connected'

	on: (docName, type, callback) ->
		@callbacks[docName] ||= {}
		throw new Error "Callback already exists for #{docName}, #{type}" if @callbacks[docName][type]?
		@callbacks[docName][type] = callback
	
	removeListener: (docName, type, listener) ->
		delete @callbacks[docName]?[type]

	onMessage: (data) =>
		p 'message'
		p data
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

		else if data.follow?
			if data.follow
				emit 'follow', yes
			else
				emit 'unfollow', yes

		else if data.v != undefined # Result of sending an op
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

	# Send follow request, queue up callback.
	follow: (docName, v, callback) ->
		p "follow #{docName}"
		request = {doc:docName, follow:true}
		request.v = v if v?
		@send request
		@on docName, 'follow', callback

	# Get a document snapshot at the current version
	get: (docName, callback) ->
		p "get #{docName}"
		@send {doc:docName, snapshot:null}
		@on docName, 'snapshot', callback

	# Submit an op to the named document
	submit: (docName, op, version, callback) ->
		p "submit"
		#console.log "submit v #{version} on #{docName}", op
		@send {doc:docName, v:version, op:op}
		@on docName, 'localop', callback
	
	# Unfollow a document
	unfollow: (docName, callback) ->
		p "unfollow #{docName}"
		@send {doc:docName, follow:false}
		@on docName, 'unfollow', callback
	
	disconnect: ->
		@socket.disconnect()
		@socket = null

#{follow: follow, connect: connect, get: get, submit: submit}

if window?
	window.sharejs ||= {}
	window.sharejs.OpStream = OpStream
else
	exports.OpStream = OpStream

