io = require 'socket.io'
util = require 'util'
p = util.debug

db = require './db'
events = require './events'

open = (client, state, docName, version) ->
	throw new Error 'No docName specified' unless docName?
	throw new Error 'Doc already open' if state.listeners[docName]?
	p "Opening #{docName} on #{client.sessionId} at #{version}"

	sendOpenConfirmation = (v) ->
		p "#{docName} open on #{client.sessionId}"
		client.send {open:docName, v:v}
		state.lastSentDoc = docName

	state.listeners[docName] = listener = (delta) ->
		return if delta.source == client.sessionId

		opMsg =
			op: delta.op
			v: delta.version

		if docName != state.lastSentDoc
			opMsg.doc = docName
			state.lastSentDoc = docName

		client.send opMsg
	
	if version?
		# Tell the client the doc is open at the requested version
		sendOpenConfirmation(version)
		events.listenFromVersion docName, version, listener
	else
		# If the version is blank, we'll open the doc at the most recent version
		events.listen docName, sendOpenConfirmation, listener
	

close = (client, state, docName) ->
	listener = state.listeners[docName]
	throw new Error 'Doc already closed' unless listener?

	events.removeListener docName, listener
	delete state.listeners[docName]


opReceived = (client, state, docName, version, op) ->
	docName ?= client.lastReceivedDoc
	throw new Error 'No docName specified' unless docName?
	throw new Error 'No version specified' unless version?

	delta = {version:version, op:op, source:client.sessionId}
	db.applyDelta docName, delta, (error, appliedVersion) ->
		msg = if error?
			{r:'error', error: error.message}
		else
			{r:'ok', v: appliedVersion}

		if docName != state.lastSentDoc
			msg.doc = docName
			state.lastSentDoc = docName

		client.send msg

snapshotRequest = (client, state, docName) ->
	db.getSnapshot docName, (snapshot) ->
		snapshot ||= {snapshot: null}
		snapshot.type = snapshot.type.name if snapshot.type?

		if docName != state.lastSentDoc
			snapshot.doc = docName
			state.lastSentDoc = docName

		client.send snapshot

exports.install = (server = require('./frontend').server) ->
	socket = io.listen(server)

	socket.on 'connection', (client) ->
		p "New client connected from #{client.request.socket.remoteAddress} with sessionId #{client.sessionId}"

		# This isn't very idiomatic JS... maybe rewrite using currying.
		state =
			lastSentDoc: null
			lastReceivedDoc: null
			listeners: {} # Map from docName -> listener.

		client.on 'message', (data) ->
			try
				data = JSON.parse data if typeof(data) == 'string'

				if data.open? # Opening a document.
					docName = data.open
					version = data.v

					state.lastReceivedDoc = docName
					open client, state, docName, version

				else if data.op? # Applying an op.
					docName = data.doc || state.lastReceivedDoc
					version = data.v
					op = data.op

					state.lastReceivedDoc = docName
					opReceived client, state, docName, version, op

				else if data.close?
					docName = data.close

					state.lastReceivedDoc = docName
					close client, state, docName

				else if data.get? # Snapshot request.
					docName = data.get

					state.lastReceivedDoc = docName
					snapshotRequest client, state, docName

				else
					p "Unknown message received: #{util.inspect data}"

			catch error
				p error.stack

		client.on 'disconnect', ->
			for docName, listener of state.listeners
				events.removeListener docName, listener

