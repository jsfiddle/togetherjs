# Abstraction over raw net stream, for use by a client.

if window? and not window.ot?.DeltaStream?
	throw new Error 'delta stream must be loaded before this file'

DeltaStream = window?.ot.DeltaStream || require('stream').DeltaStream
types = window?.ot?.types || require('../types').types

exports ||= {}

class Document
	constructor: (@stream, @docName, @version, @type, @snapshot) ->
		# The op that is currently roundtripping to the server, or null.
		@inflightOp = null
		# All ops that are waiting for the server to acknowledge @inflightOp
		@pendingOp = null
		# Some recent ops, incase submitOp is called with an old op version number
		@recentOps = {}

		# Listeners for the document changing
		@listeners = []

		@stream.open @docName, @version, (msg) =>
			throw new Error("Expected docName #{@docName} but got #{msg.open}") unless msg.open == @docName
			throw new Error("Expected version #{@version} but got #{msg.v}") unless msg.v == @version
			stream.on @docName, 'op', @onOpReceived

	submitOp: (op, v) ->
		op = @type.normalize(op) if @type?.normalize?

		while v < @version
			realOp = @recentOps[v]
			throw new Error 'Op version too old' unless realOp
			op = @type.transform(op, realOp, 'client')
			v++

		# If this throws an exception, no changes should have been made to the doc
		@snapshot = @type.apply @snapshot, op

		if @pendingOp != null
			@pendingOp = @type.compose(@pendingOp, op)
		else
			@pendingOp = op

		@tryFlushPendingOp()

	tryFlushPendingOp: () ->
		if @inflightOp == null && @pendingOp != null
			@inflightOp = @pendingOp
			@pendingOp = null
			console.log "Version = #{@version}"
			@stream.submit @docName, @inflightOp, @version, (response) =>
				throw new Error(response.error) if response.r == 'error'
				@version++
				console.log 'Heard back from server.', this, response, @version

				@inflightOp = null
				@tryFlushPendingOp()

	onOpReceived: (msg) =>
		# msg is {doc:, op:, v:}
		throw new Error("Expected docName #{@docName} but got #{msg.doc}") unless msg.doc == @docName
		throw new Error("Expected version #{@version} but got #{msg.v}") unless msg.v == @version

		@snapshot = @type.apply @snapshot, msg.op
		@version++

		@pendingOp = @type.transform @pendingOp, msg.op, 'server' if @pendingOp?

		listener(msg.op) for listener in @listeners

#		@callback

	onChanged: (listener) ->
		@listeners.push(listener)



class Connection
	constructor: (hostname, port) ->
		@stream = new DeltaStream(hostname, port)
		@docs = {}

	makeDoc: (docName, version, type, snapshot) ->
		throw new Error("Document #{@docName} already open") if @docs[docName]
		doc = new Document(@stream, docName, version, type, snapshot)
		@docs[docName] = doc

	# callback is passed a Document or null
	# callback(doc)
	get: (docName, callback) ->
		return @docs[docName] if @docs[docName]?

		@stream.get @docName, (response) ->
			if response.snapshot == null
				callback(null)
			else
				type = builtin.types[response.type]
				callback @makeDoc(response.docName, response.v, type, response.snapshot)

	# Callback is passed a document or an error
	# callback(doc, error)
	getOrCreate: (docName, type, callback) ->
		if @docs[docName]?
			doc = @docs[docName]
			if doc.type == type
				callback(doc)
			else
				callback(doc, 'Document already exists with type ' + doc.type.name)

			return

		@stream.get docName, (response) =>
			if response.snapshot == null
				@stream.submit docName, {type: type.name}, 0, (response) =>
					if response.r == 'ok'
						callback @makeDoc(docName, 1, type, type.initialVersion())
					else if response.r == 'error' and response.error == 'Document already exists'
						# Somebody else has created the document. Get the snapshot again..
						@getOrCreate(docName, type, callback)
					else
						callback(null, response.error)
			else if response.type == type.name
				callback @makeDoc(docName, response.v, type, response.snapshot)
			else
				callback null, "Document already exists with type #{response.type}"

#	{get:get, getOrCreate:getOrCreate}

if window?
	window.ot.Connection = Connection
