# The model of all the ops. Responsible for applying & transforming remote deltas
# and managing the storage layer.
#
# Actual storage is handled by the database wrappers in db/*.

p = -> #require('util').debug
i = -> #require('util').inspect

hat = require 'hat'

queue = require './syncqueue'
types = require '../types'
db = require './db'
Events = require './events'

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

		if docName.match /\//
			callback false, 'Invalid document name'
			return

		meta ||= {}

		newDocData =
			snapshot:type.create()
			type:type.name
			meta:meta || {}
			v:0

		p "db.create #{docName}, #{i newDocData}"

		db.create docName, newDocData, callback

	queues = {} # docName -> syncQueue

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
		queues[docName] ||= queue (opData, callback) ->
			p "applyOpInternal v#{opData.v} #{i opData.op} to #{docName}."
			getSnapshot docName, (docData) ->
				unless docData
					callback null, 'Document does not exist'
					return

				opVersion = opData.v
				op = opData.op
				meta = opData.meta || {}
				meta.ts = Date.now()

				{v:version, snapshot, type} = docData
				p "applyOp hasdata v#{opVersion} #{i op} to #{docName}."

				submit = ->
					try
						snapshot = docData.type.apply docData.snapshot, op
					catch error
						callback null, error.message
						return

					newOpData = {op, v:opVersion, meta}
					newDocData = {snapshot, type:type.name, v:opVersion + 1, meta:docData.meta}

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
								op = docData.type.transform op, realOp.op, 'left'
								opVersion++
								p "-> #{i op}"

						catch error
							callback null, error.message
							return

						submit()
				else
					# The op is up to date already. Apply and submit.
					submit()

		# process.nextTick is used to avoid an obscure timing problem involving listenFromVersion.
		process.nextTick -> queues[docName](opData, callback)
	
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
	# listen(docName, listener, callback)
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
	
	# ------------ Auth stuffs.

	# By default, accept any client's connection + data submission.
	# Don't let anyone delete documents though.
	auth = options.auth || (client, action) ->
		if action.type in ['connect', 'read', 'create', 'update'] then action.accept() else action.reject()

	# This method wraps auth() above. It creates the action and calls auth.
	# If authentication succeeds, acceptCallback() is called if it exists.
	# otherwise userCallback(true) is called.
	#
	# If authentication fails, userCallback(null, 'forbidden') is called.
	#
	# If supplied, actionData is turned into the action.
	doAuth = (client, actionData, name, userCallback, acceptCallback) ->
		action = actionData || {}
		action.name = name
		action.type = switch name
			when 'connect' then 'connect'
			when 'create' then 'create'
			when 'get snapshot', 'get ops', 'listen' then 'read'
			when 'submit op' then 'update'
			when 'delete' then 'delete'
			else throw new Error "Invalid action name #{name}"

		responded = false
		action.reject = ->
			throw new Error 'Multiple accept/reject calls made' if responded
			responded = true
			userCallback null, 'forbidden'
		action.accept = ->
			throw new Error 'Multiple accept/reject calls made' if responded
			responded = true
			acceptCallback()

		auth client, action

	# At some stage, I'll probably pull this out into a class. No rush though.
	createClient = (data) ->
		id: hat()
		connectTime: new Date
		headers: data.headers
		remoteAddress: data.remoteAddress
		# We have access to these with socket.io, but I'm not sure we can support
		# these properties on the REST API.
		#xdomain: data.xdomain
		#secure: data.secure

	# I wish there was a cleaner way to write all of these.

	@clientConnect = (data, callback) ->
		client = createClient data
		doAuth client, null, 'connect', callback, ->
			# Maybe store a set of clients in the model?
			# clients[client.id] = client ?
			callback client

	@clientGetOps = (client, docName, start, end, callback) ->
		doAuth client, {docName, start, end}, 'get ops', callback, =>
			@getOps docName, start, end, callback

	@clientGetSnapshot = (client, docName, callback) ->
		doAuth client, {docName}, 'get snapshot', callback, =>
			@getSnapshot docName, callback
	
	@clientCreate = (client, docName, type, meta, callback) ->
		# We don't check that types[type.name] == type. That might be important at some point.
		type = types[type] if typeof type == 'string'

		doAuth client, {docName, docType:type, meta}, 'create', callback, =>
			@create docName, type, meta, callback

	# Attempt to submit an op from a client. Auth functions
	# are checked before the op is submitted.
	@clientSubmitOp = (client, docName, opData, callback) ->
		opData.meta ||= {}
		doAuth client, {docName, op:opData.op, v:opData.v, meta:opData.meta}, 'submit op', callback, =>
			@applyOp docName, opData, callback

	# Delete the named operation.
	# Callback is passed (deleted?, error message)
	@clientDelete = (client, docName, callback) ->
		doAuth client, {docName}, 'delete', callback, =>
			@delete docName, callback
	
	@clientListen = (client, docName, listener, callback) ->
		doAuth client, {docName}, 'listen', callback, =>
			@listen docName, listener, callback
	
	@clientListenFromVersion = (client, docName, version, listener, callback) ->
		# If the specified version is older than the current version, we have to also check that the
		# client is allowed to get_ops from the specified version.
		#
		# We _could_ check the version number of the document and then only check get_ops if
		# the specified version is old, but an auth check is _probably_ faster than a db roundtrip.
		doAuth client, {docName, start:version, end:null}, 'get ops', callback, =>
			doAuth client, {docName, v:version}, 'listen', callback, =>
				@listenFromVersion docName, version, listener, callback

	this
