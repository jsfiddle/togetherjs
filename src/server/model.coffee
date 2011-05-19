# The model of all the ops. Responsible for applying & transforming remote deltas
# and managing the storage layer.
#
# Actual storage is handled by the database wrappers in db/*.

p = -> #require('util').debug
i = -> #require('util').inspect

types = require '../types'
db = require './db'
Events = require('./events')

module.exports = Model = (db, options) ->
	return new Model(db) if !(this instanceof Model)

	options ?= {}

	# Callback is called with a list of the deltas from versionFrom to versionTo, or
	# to the most recent version if versionTo is null.
	# The model also checks if the document doesn't exist, and makes getOps return null
	# if it doesn't. (Later, the model will cache document data locally and that check
	# will become fast.)
	@getOps = (docName, start, end, callback) ->
		db.getVersion docName, (v) ->
			if v == null
				callback null, 'Document does not exist'
			else
				db.getOps docName, start, end, callback

	# Gets the snapshot data for the specified document.
	# getSnapshot(docName, callback)
	# Callback is called with ({v: <version>, type: <type>, snapshot: <snapshot>, meta: <meta>})
	@getSnapshot = getSnapshot = (docName, callback) ->
		db.getSnapshot docName, (data, error) ->
			p "getSnapshot #{i data}"
			if data?
				data.type = types[data.type] if data?.type
				callback data
			else
				callback data, error

	# Gets the latest version # of the document. May be more efficient than getSnapshot.
	# getVersion(docName, callback)
	# callback is called with (version).
	@getVersion = db.getVersion

	# Create a document.
	@create = (docName, type, meta, callback) ->
		type = types[type] if typeof type == 'string'
		if typeof meta == 'function'
			callback = meta
			meta = {}

		meta ||= {}

		newDocData =
			snapshot:type.initialVersion()
			type:type.name
			meta:meta || {}
			v:0

		p "db.create #{docName}, #{i newDocData}"

		db.create docName, newDocData, callback

	applyOpInternal = (docName, opData, callback) ->
		p "applyOpInternal v#{opData.v} #{i opData.op} to #{docName}."
		getSnapshot docName, (docData) ->
			unless docData
				callback null, 'Document does not exist'
				return

			opVersion = opData.v
			op = opData.op
			meta = opData.meta || {}
			meta.ts = Date.now()

			version = docData.v
			snapshot = docData.snapshot
			type = docData.type
			p "applyOp hasdata v#{opVersion} #{i op} to #{docName}."

			submit = ->
				try
					snapshot = docData.type.apply docData.snapshot, op
				catch error
					callback null, error.message
					return

				newOpData = {op:op, v:opVersion, meta:meta}
				newDocData = {snapshot:snapshot, type:type.name, v:opVersion + 1, meta:docData.meta}

				p "submit #{i newOpData}"
				db.append docName, newOpData, newDocData, ->
					p "appended v#{opVersion} to #{docName}. Calling callback..."
					events.onApplyOp docName, newOpData
					callback opVersion, undefined

			if opVersion > version
				callback null, 'Op at future version'
				return

			if opVersion < version
				# We'll need to transform the op to the current version of the document.
				db.getOps docName, opVersion, version, (ops) ->
					try
						for realOp in ops
							p "XFORM Doc #{docName} op #{i op} by #{i realOp.op}"
							op = docData.type.transform op, realOp.op, 'client'
							opVersion++
							p "-> #{i op}"

					catch error
						callback null, error.message
						return

					submit()
			else
				# The op is up to date already. Apply and submit.
				submit()

	pendingOps = {} # docName -> {busy:bool, queue:[[op, callback], [op, callback], ...]}

	flushOps = (docName) ->
		state = pendingOps[docName]

		p "flushOps #{docName} state #{i state}"
		return if state.busy || state.queue.length == 0
		p "continuing..."
		state.busy = true

		[opData, callback] = state.queue.shift()
		applyOpInternal docName, opData, (error, version) ->
			callback(error, version) if callback?
			state.busy = false
			flushOps docName

	# Apply an op to the specified document.
	# The callback is passed (error, applied version #)
	# opData = {op:op, v:v, meta:metadata}
	# 
	# Ops are queued before being applied so that the following code applies op C before op B:
	# model.applyOp 'doc', OPA, -> model.applyOp 'doc', OPB
	# model.applyOp 'doc', OPC
	@applyOp = (docName, opData, callback) ->
		p "applyOp #{docName} op #{i opData}"
		# Its important that all ops are applied in order.
		pendingOps[docName] ||= {busy:false, queue:[]}
		pendingOps[docName].queue.push [opData, callback]
		flushOps docName
	
	# Perminantly deletes the specified document.
	# If listeners are attached, they are removed.
	# 
	# The callback is called with (true) if any data was deleted, else (false).
	#
	# WARNING: This event isn't well
	# supported throughout the code. (Eg, streaming clients aren't told about the
	# deletion. Subsequent op submissions will fail).
	@delete = (docName, callback) ->
		events.removeAllListeners docName
		db.delete docName, callback

	events = new Events(this)

	# Register a listener for a particular document.
	# listen(docName, fromVersionCallback, listener)
	@listen = events.listen

	# Remove a listener for a particular document.
	# removeListener(docName, listener)
	@removeListener = events.removeListener

	# Listen to all ops from the specified version. If version is in the past, all
	# ops since that version are sent immediately to the listener.
	# Callback is called once the listener is attached, but before any ops have been passed
	# to the listener.
	# 
	# listenFromVersion(docName, version, listener, callback)
	@listenFromVersion = events.listenFromVersion

	# Generate a random document name
	@randomDocName = (length = 10) ->
		# Should use a secure random number generator if available.
		chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-="
		(chars[Math.floor(Math.random() * chars.length)] for x in [0...length]).join('')

	
	# Auth stuffs.
	options.auth ||= {}

	auth = options.auth || {}

	auth.auth ||= ->
	auth.canCreate ||= (client, docName, type, meta, result) -> result.accept()
	auth.canRead ||= (client, docName, result) -> result.accept()
	auth.canSubmitOp ||= (client, docName, opData, result) -> result.accept()
	# canDelete defaults to reject().
	auth.canDelete ||= (client, docName, result) -> result.reject()

	# Surely there's a nicer way to write these functions, below. I can imagine abstractions,
	# but they're always more complicated than the code below.

	@clientGetOps = (client, docName, start, end, callback) ->
		auth.canRead client, docName,
			accept: => @getOps docName, start, end, callback
			reject: -> callback null, 'Forbidden'

	@clientGetSnapshot = (client, docName, callback) ->
		auth.canRead client, docName,
			accept: => @getSnapshot docName, callback
			reject: -> callback undefined, 'Forbidden'
	
	@clientCreate = (client, docName, type, meta, callback) =>
		# We don't check that types[type.name] == type. That might be important at some point.
		type = types[type] if typeof type == 'string'

		auth.canCreate client, docName, type, meta,
			accept: => @create docName, type, meta, callback
			reject: -> callback false, 'Forbidden'

	# Attempt to submit an op from a client. Auth functions
	# are checked before the op is submitted.
	@clientSubmitOp = (client, docName, opData, callback) =>
		auth.canSubmitOp client, docName, opData,
			accept: => @applyOp docName, opData, callback
			reject: -> callback null, 'Forbidden'

	# Delete the named operation.
	# Callback is passed (deleted?, error message)
	@clientDelete = (client, docName, callback) ->
		auth.canDelete client, docName,
			accept: => @delete docName, callback
			reject: -> callback false, 'Forbidden'
	
	this
