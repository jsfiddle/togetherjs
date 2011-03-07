io = require 'socket.io'
util = require 'util'

model = require './model'
events = require './events'

p = util.debug
i = util.inspect
p = ->
i = ->

exports.install = (server = require('./frontend').server) ->
	socket = io.listen server, {log:null}

	socket.on 'connection', (client) ->
		p "New client connected from #{client.request.socket.remoteAddress} with sessionId #{client.sessionId}"

		lastSentDoc = null
		lastReceivedDoc = null
		listeners = {} # Map from docName -> listener.

		send = (msg) ->
			# msg _must_ have the docname set. We'll remove it if its the same as lastReceivedDoc.
			delete msg.doc if msg.doc == lastSentDoc
			lastSentDoc = msg.doc
			client.send msg

		# Attempt to open a document with a given name. Version is optional.
		open = (data) ->
			docName = data.doc
			version = data.v
			throw new Error 'Doc already open' if listeners[docName]?
			p "Opening #{docName} on #{client.sessionId} at #{version}"

			sendOpenConfirmation = (v) ->
				p "#{docName} open on #{client.sessionId}"
				send {doc:docName, open:true, v:v}

			listeners[docName] = listener = (op_data) ->
				#p "doc:#{docName} delta:#{i delta} v:#{version}"

				# Skip the op if this client sent it.
				return if op_data.meta?.source == client.sessionId != undefined

				opMsg =
					op: op_data.op
					v: op_data.v

				send opMsg
			
			if version?
				# Tell the client the doc is open at the requested version
				sendOpenConfirmation(version)
				events.listenFromVersion docName, version, listener
			else
				# If the version is blank, we'll open the doc at the most recent version
				events.listen docName, sendOpenConfirmation, listener

		# The client closes a document
		close = (data) ->
			listener = listeners[data.doc]
			throw new Error 'Doc already closed' unless listener?

			events.removeListener data.doc, listener
			delete listeners[data.doc]
			send {doc:data.doc, open:false}

		# We received an op from the client
		opReceived = (data) ->
			throw new Error 'No docName specified' unless data.doc?
			throw new Error 'No version specified' unless data.v?

			op_data = {v:data.v, op:data.op, meta:{source:client.sessionId}}
			model.applyOp data.doc, op_data, (error, appliedVersion) ->
				msg = if error?
					p "Sending error to client: #{error.message}, #{error.stack}"
					{doc:data.doc, v:null, error: error.message}
				else
					{doc:data.doc, v:appliedVersion}

				send msg

		# The client requested a document snapshot
		snapshotRequest = (data) ->
			throw new Error 'Snapshot request at version not currently implemented' if data.v?
			throw new Error 'No docName specified' unless data.doc?

			model.getSnapshot data.doc, (doc) ->
				msg = {doc:data.doc, v:doc.v, type:doc.type?.name || null, snapshot:doc.snapshot}
				send msg

		# And now the actual message handler.
		client.on 'message', (data) ->
			p 'message ' + i data
			if data.doc?
				lastReceivedDoc = data.doc
			else
				data.doc = lastReceivedDoc

			try
				data = JSON.parse data if typeof(data) == 'string'

				if data.open? # Opening a document.
					if data.open
						open data
					else
						close data

				else if data.op? # The client is applying an op.
					opReceived data

				else if data.snapshot != undefined # Snapshot request.
					snapshotRequest data

				else
					p "Unknown message received: #{util.inspect data}"

			catch error
				util.debug error.stack
				# ... And disconnect the client?

		client.on 'disconnect', ->
			for docName, listener of listeners
				events.removeListener docName, listener

