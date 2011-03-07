# The model of all the ops. Responsible for applying & transforming remote deltas
# and managing the storage layer.

p = -> #require('util').debug
i = -> #require('util').inspect

types = require '../types'

db = require './db'

applyOpListener = null

# Hook for events code. This can be replaced with a function which takes
# (docName, {op:op, version:v, source:s}) as arguments. It is called every time an op is
# committed to the document.
exports.onApplyOp = (fn) -> applyOpListener = fn

class Record
	constructor: (@name) ->
		@ops = []
		# Version will always be ops.length
		@version = 0

		# @type and @snapshot will be set when the first op is recieved.
	
	# The initial op sets the type. It must have {"type":<typename>}. Other fields ignored.
	# This should not be called externally.
	applyInitialOp: (op, metadata, callback) ->
		if @version > 0
			callback(new Error('Type already set'), null)
			return

		typeName = op.type
		unless typeName?
			callback(new Error('Invalid op: type required'), null)
			return

		@type = types[typeName]
		unless @type?
			callback(new Error("Invalid op: type '#{typeName}' missing"), null)
			return

		@snapshot = @type.initialVersion()
		@commitOpInternal(op, metadata, callback)

	# Entrypoint for applying deltas to the object.
	# Callback is passed (err, finalVersion)
	applyOp: (version, op, metadata, callback) ->
		p "applyOp on #{@name} version #{version} with op #{i op}"

		unless 0 <= version <= @version
			callback new Error("Invalid version"), null
			return

		if version == 0
			@applyInitialOp op, metadata, callback
		else
			try
				if @type.transform?
					for v in [version...@version]
						p "XFORM Doc #{@name} op #{i op} by #{i @ops[v]}"
						op = @type.transform op, @ops[v], 'client'
						version++
						p "-> #{i op}"

				p "Server Doc #{@name} apply #{i op} to snapshot #{i @snapshot}"
				@snapshot = @type.apply @snapshot, op
			catch error
				callback error, null
				return

			@commitOpInternal(op, metadata, callback)

	# Executed once transform is done. Commits the op.
	commitOpInternal: (op, metadata, callback) ->
		@ops.push op
		
		op_data = {op:op, meta:metadata || {}, v:@version}
		doc_data = {type:@type, snapshot:@snapshot}

		# Should the handlers be called immediately, or after the op has been persisted?
		db.append @name, op_data, doc_data, ->

		@version = @version + 1
		callback null, @version - 1
		p "Server sending out #{i op}. Snapshot should be #{i @snapshot}"
		applyOpListener? @name, op_data

# Callback is called with a list of the deltas from versionFrom to versionTo, or
# to the most recent version if versionTo is null.
exports.getOps = db.getOps

# Callback is called with ({v: <version>, type: <type>, snapshot: <snapshot>})
exports.getSnapshot = db.getData

# Gets the latest version # of the document. May be more efficient than getSnapshot.
exports.getVersion = (docName, callback) ->
	exports.getSnapshot docName, (doc) ->
		callback(doc.v)

# If ops were processed immediately, a handler could apply another op, and subsequent
# handlers can recieve ops out of order. This enforces ordering.
queuedOps = []

records = {}
applyOpInternal = (docName, op_data, callback) ->
	records[docName] ?= new Record docName
	records[docName].applyOp op_data.v, op_data.op, op_data.meta, callback

# This function must not be re-entrant.
processing = no
flushOps = () ->
	return if processing

	processing = yes
	while queuedOps.length > 0
		params = queuedOps.shift()
		applyOpInternal params...
	processing = no

# The callback is passed (error, applied version #)
# op_data = {op:op, v:v, meta:metadata}
exports.applyOp = (docName, op_data, callback) ->
	queuedOps.push [docName, op_data, callback]
	flushOps()

exports.delete = db.delete
