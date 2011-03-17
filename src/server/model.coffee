# The model of all the ops. Responsible for applying & transforming remote deltas
# and managing the storage layer.

p = -> #require('util').debug
i = -> #require('util').inspect

types = require '../types'

db = require './db'

# Set the database to something else.
exports.setDb = (newDb) -> db = newDb

applyOpListener = null

# Hook for events code. This can be replaced with a function which takes
# (docName, {op:op, version:v, source:s}) as arguments. It is called every time an op is
# committed to the document.
exports.onApplyOp = (fn) -> applyOpListener = fn

# Callback is called with a list of the deltas from versionFrom to versionTo, or
# to the most recent version if versionTo is null.
exports.getOps = db.getOps

# Callback is called with ({v: <version>, type: <type>, snapshot: <snapshot>})
exports.getSnapshot = (docName, callback) -> db.getSnapshot docName, callback

# Gets the latest version # of the document. May be more efficient than getSnapshot.
exports.getVersion = db.getVersion

applyOpInternal = (docName, opData, callback) ->
	p "applyOpInternal v#{opData.v} #{i opData.op} to #{docName}."
	db.getSnapshot docName, (docData) ->
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
			newDocData = {snapshot:snapshot, type:type}

			p "submit #{i newOpData}"
			db.append docName, newOpData, newDocData, ->
				p "appended v#{opVersion} to #{docName}. Calling callback..."
				applyOpListener? docName, newOpData
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

# The callback is passed (error, applied version #)
# op_data = {op:op, v:v, meta:metadata}
exports.applyOp = (docName, opData, callback) ->
	p "applyOp #{docName} op #{i opData}"
	# Its important that all ops are applied in order.
	pendingOps[docName] ||= {busy:false, queue:[]}
	pendingOps[docName].queue.push [opData, callback]
	flushOps docName

exports.delete = db.delete
