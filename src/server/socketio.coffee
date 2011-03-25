io = require 'socket.io'
util = require 'util'

p = -> #util.debug
i = -> #util.inspect

# Attach the streaming protocol to the supplied http.Server.
#
# Options = {}
exports.attach = (server, model, options) ->
	socket = io.listen server, {log: null}

	socket.on 'connection', (client) ->
		# There is a bug here where client.request isn't set sometimes.
		p "New client connected from #{client.request.socket.remoteAddress} with sessionId #{client.sessionId}" if client.request?

		lastSentDoc = null
		lastReceivedDoc = null
		docState = {} # Map from docName -> {listener:fn, queue:[msg], busy:bool}

		send = (msg) ->
			p "Sending #{i msg}"
			# msg _must_ have the docname set. We'll remove it if its the same as lastReceivedDoc.
			if msg.doc == lastSentDoc
				delete msg.doc
			else
				lastSentDoc = msg.doc
			client.send msg

		# Attempt to follow a document with a given name. Version is optional.
		follow = (data, callback) ->
			docName = data.doc
			version = data.v
			throw new Error 'Doc already followed' if docState[docName].listener?
			p "Registering follower on #{docName} by #{client.sessionId} at #{version}"

			sendOpenConfirmation = (v) ->
				p "Following #{docName} at #{v} by #{client.sessionId}"
				send {doc:docName, follow:true, v:v}
				callback()

			docState[docName].listener = listener = (opData) ->
				throw new Error 'Consistency violation - doc listener invalid' unless docState[docName].listener == listener

				p "follow listener doc:#{docName} opdata:#{i opData} v:#{version}"

				# Skip the op if this client sent it.
				return if opData.meta?.source == client.sessionId != undefined

				opMsg =
					doc: docName
					op: opData.op
					v: opData.v
					meta: opData.meta

				send opMsg
			
			if version?
				# Tell the client the doc is open at the requested version
				model.listenFromVersion docName, version, listener, ->
					sendOpenConfirmation(version)
			else
				# If the version is blank, we'll open the doc at the most recent version
				model.listen docName, sendOpenConfirmation, listener

		# The client unfollows a document
		unfollow = (data, callback) ->
			p "Closing #{data.doc}"
			listener = docState[data.doc].listener
			throw new Error 'Doc already closed' unless listener?

			model.removeListener data.doc, listener
			docState[data.doc].listener = null
			send {doc:data.doc, follow:false}
			callback()

		# We received an op from the client
		opReceived = (data, callback) ->
			throw new Error 'No docName specified' unless data.doc?
			throw new Error 'No version specified' unless data.v?

			op_data = {v:data.v, op:data.op}
			op_data.meta = data.meta || {}
			op_data.meta.source = client.sessionId

			model.applyOp data.doc, op_data, (error, appliedVersion) ->
				msg = if error?
					p "Sending error to client: #{error.message}, #{error.stack}"
					{doc:data.doc, v:null, error: error.message}
				else
					{doc:data.doc, v:appliedVersion}

				send msg
				callback()

		# The client requested a document snapshot
		snapshotRequest = (data, callback) ->
			throw new Error 'No docName specified' unless data.doc?

			model.getSnapshot data.doc, (doc) ->
				msg = {doc:data.doc, v:doc.v, type:doc.type?.name || null, snapshot:doc.snapshot}
				send msg
				callback()

		flush = (state) ->
			p "flush state #{i state}"
			return if state.busy || state.queue.length == 0
			state.busy = true

			data = state.queue.shift()

			callback = ->
				p 'flush complete...'
				state.busy = false
				flush state

			p "processing data #{i data}"
			try
				if data.follow? # Opening a document.
					if data.follow
						follow data, callback
					else
						unfollow data, callback

				else if data.op? # The client is applying an op.
					opReceived data, callback

				else if data.snapshot != undefined # Snapshot request.
					snapshotRequest data, callback

				else
					util.debug "Unknown message received: #{util.inspect data}"

			catch error
				util.debug error.stack
				# ... And disconnect the client?
				callback()
		
		# And now the actual message handler.
		client.on 'message', (data) ->
			p 'on MESSAGE ' + i data

			try
				data = JSON.parse data if typeof(data) == 'string'

				if data.doc?
					lastReceivedDoc = data.doc
				else
					throw new Error 'msg.doc missing' unless lastReceivedDoc
					data.doc = lastReceivedDoc
			catch error
				util.debug error.stack
				return

			docState[data.doc] ||= {listener:null, queue:[], busy:no}
			docState[data.doc].queue.push data
			flush docState[data.doc]

		client.on 'disconnect', ->
			p "client #{client.sessionId} disconnected"
			for docName, state of docState
				state.busy = true
				state.queue = []
				model.removeListener docName, state.listener if state.listener?

			docState = null
	
	server
