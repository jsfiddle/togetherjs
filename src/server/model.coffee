# The model of all the ops. Responsible for applying & transforming remote deltas
# and managing the storage layer.
#
# Actual storage is handled by the database wrappers in db/*.

p = -> #require('util').debug
i = -> #require('util').inspect

types = require '../types'
db = require './db'
Events = require('./events')

module.exports = Model = (db) ->
	return new Model(db) if !(this instanceof Model)

	# Callback is called with a list of the deltas from versionFrom to versionTo, or
	# to the most recent version if versionTo is null.
	@getOps = db.getOps

	# Gets the snapshot data for the specified document.
	# getSnapshot(docName, callback)
	# Callback is called with ({v: <version>, type: <type>, snapshot: <snapshot>})
	@getSnapshot = getSnapshot = (docName, callback) ->
		db.getSnapshot docName, (data) ->
			p "getSnapshot #{i data}"
			data.type = types[data.type] if data.type != null
			callback data

	# Gets the latest version # of the document. May be more efficient than getSnapshot.
	# getVersion(docName, callback)
	# callback is called with (version).
	@getVersion = db.getVersion

	applyOpInternal = (docName, opData, callback) ->
		p "applyOpInternal v#{opData.v} #{i opData.op} to #{docName}."
		getSnapshot docName, (docData) ->
			opVersion = opData.v
			op = opData.op
			meta = opData.meta || {}
			meta.ts = Date.now()

			version = docData.v
			snapshot = docData.snapshot
			type = docData.type
			p "applyOp hasdata v#{opVersion} #{i op} to #{docName}."

			submit = ->
				newOpData = {op:op, v:opVersion, meta:meta}
				newDocData = {snapshot:snapshot, type:type?.name ? null}

				p "submit #{i newOpData}"
				db.append docName, newOpData, newDocData, ->
					p "appended v#{opVersion} to #{docName}. Calling callback..."
					events.onApplyOp docName, newOpData
					callback null, opVersion

			if opVersion > version
				callback new Error('Op at future version'), null
				return

			if opVersion == 0 # The op sets the type of a new document.
				if version == 0
					# Set the type.
					typeName = op.type
					unless typeName?
						callback(new Error('Invalid op: type required'), null)
						return

					type = types[typeName]
					unless type?
						callback(new Error("Invalid op: type '#{typeName}' missing"), null)
						return

					snapshot = type.initialVersion()

					submit()
				else
					callback new Error('Type already set'), null
					return
				
			else # Normal op
				if opVersion < version
					# We'll need to transform the op to the current version of the document.
					db.getOps docName, opVersion, version, (ops) ->
						try
							for realOp in ops
								p "XFORM Doc #{docName} op #{i op} by #{i realOp.op}"
								op = docData.type.transform op, realOp.op, 'client'
								opVersion++
								p "-> #{i op}"

							snapshot = docData.type.apply docData.snapshot, op
						catch error
							callback error, null
							return

						submit()
				else
					# The op is up to date. Apply and submit.
					try
						snapshot = docData.type.apply docData.snapshot, op
					catch error
						callback error, null
						return

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
	@applyOp = (docName, opData, callback) ->
		p "applyOp #{docName} op #{i opData}"
		# Its important that all ops are applied in order.
		pendingOps[docName] ||= {busy:false, queue:[]}
		pendingOps[docName].queue.push [opData, callback]
		flushOps docName

	# Perminantly deletes the specified document.
	# If listeners are attached, they are removed.
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

	this
