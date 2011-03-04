# An in-memory DB
p = -> #require('util').debug
i = -> #require('util').inspect

types = require '../types'

applyDeltaListener = null

# Hook for events code. This can be replaced with a function which takes
# (docName, {op:op, version:v, source:s}) as arguments. It is called every time an op is
# committed to the document.
exports.onApplyDelta = (fn) -> applyDeltaListener = fn

class Record
	constructor: (@name) ->
		@ops = []
		# Version will always be ops.length
		@version = 0

		# @type and @snapshot will be set when the first op is recieved.
	
	# The initial op sets the type. It must have {"type":<typename>}. Other fields ignored.
	# This should not be called externally.
	applyInitialOp: (delta, callback) ->
		if @version > 0
			callback(new Error('Type already set'), null)
			return

		typeName = delta.op.type
		unless typeName?
			callback(new Error('Invalid op: type required'), null)
			return

		@type = types[typeName]
		unless @type?
			callback(new Error("Invalid op: type '#{typeName}' missing"), null)
			return

		@snapshot = @type.initialVersion()
		@commitDeltaInternal(delta, callback)

	# Entrypoint for applying deltas to the object.
	# Callback is passed (err, finalVersion)
	# delta = {op:op, version:v, source:s}
	applyDelta: (delta, callback) ->
		p "applyOp on #{@name} version #{delta.version} with delta #{i delta}"

		unless delta.op?
			callback new Error('Op missing from delta'), null
			return

		unless 0 <= delta.version <= @version
			callback new Error("Invalid version"), null
			return

		if delta.version == 0
			@applyInitialOp delta, callback
		else
			try
				if @type.transform?
					for v in [delta.version...@version]
						p "XFORM Doc #{@name} delta #{i delta} by #{i @ops[v]}"
						delta.op = @type.transform delta.op, @ops[v], 'client'
						delta.version++
						p "-> #{i delta}"

				p "Server Doc #{@name} apply #{i delta} to snapshot #{i @snapshot}"
				@snapshot = @type.apply @snapshot, delta.op
			catch error
				callback error, null
				return

			@commitDeltaInternal(delta, callback)

	# Executed once transform is done. Commits the op.
	commitDeltaInternal: (delta, callback) ->
		@ops.push delta.op
		@version = @version + 1
		p "version is #{@version}"
		callback null, @version - 1
		p "Server sending out #{i delta}. Snapshot should be #{i @snapshot}"
		applyDeltaListener? @name, delta

# Map from "docName" -> Record instance
ops = {}

# Callback is called with a list of the ops from versionFrom to versionTo, or
# to the most recent version if versionTo is null.
exports.getOps = (docName, versionFrom, versionTo, callback) ->
	record = ops[docName]

	if record?
		if versionTo?
			callback record.ops[versionFrom..versionTo]
		else
			callback record.ops[versionFrom..]
	else
		callback []

# Callback is called with ({v: <version>, type: <type>, snapshot: <snapshot>})
# IF the record doesn't exist, this calls callback(null)
exports.getSnapshot = (docName, callback) ->
	record = ops[docName]
	p "getSnapshot on '#{docName}': #{i record}"
	if record?.snapshot?
		callback {v:record.version, type:record.type, snapshot:record.snapshot}
	else
		callback {v:0, type:null, snapshot:null}

# Gets the latest version # of the document. May be more efficient than getSnapshot.
exports.getVersion = (docName, callback) ->
	exports.getSnapshot docName, (doc) ->
		callback(doc.v)

# To make sure all the ops (and their event handlers) are processed in order, ops are added
# to a queue and processed from the front.
queuedDeltas = []

applyDeltaInternal = (docName, delta, callback) ->
	ops[docName] ?= new Record docName
	ops[docName].applyDelta delta, callback

# This function must not be re-entrant.
processing = no
sendDeltas = () ->
	return if processing

	processing = yes
	while queuedDeltas.length > 0
		params = queuedDeltas.shift()
		applyDeltaInternal params...
	processing = no

# Atomic.
# The callback is passed (error, applied version #)
# delta = {op:op, version:v, source:s}
exports.applyDelta = (docName, delta, callback) ->
	queuedDeltas.push [docName, delta, callback]
	sendDeltas()

# Perminantly deletes a document. There is no undo.
# Callback is callback(error)
exports.delete = (docName, callback) ->
	if ops[docName]?
		delete ops[docName]
		callback(null)
	else
		callback(new Error 'The document does not exist')


