# The memory database is a simple map of documents stored in memory.
#
# It is mainly provided for testing and as a reference for how other
# DB implementations should behave.

module.exports = ->
	# Map from docName -> {ops:[{op:x, meta:m}], data:{snapshot, type}}
	# Version is implicitly defined as the length of the delta list.
	docs = {}

	{
		# If any documents are passed to the callback, the first one has v = start.
		# end can be null. If so, returns all documents from start onwards.
		# Each document returned is in the form {op:o, meta:m, v:version}.
		getOps: (docName, start, end, callback) ->
			ops = docs[docName]?.ops

			if ops?
				end ?= ops.length
				callback ops[start...end]
			else
				callback []

		# Append an op to a document.
		# op_data = {op:the op to append, v:version, meta:optional metadata object containing author, etc.}
		# doc_data = resultant document snapshot data. {snapshot:s, type:t}
		# callback = callback when op committed
		append: (docName, op_data, doc_data, callback) ->
			throw new Error 'snapshot missing from data' unless doc_data.snapshot != undefined
			throw new Error 'type missing from data' unless doc_data.type != undefined

			doc = docs[docName] ||= {ops:[], data:null}

			throw new Error 'Version mismatch in db.append' unless op_data.v == doc.ops.length

			new_op_data = {op:op_data.op, v:op_data.v}
			new_op_data.meta = op_data.meta if op_data.meta?
			doc.ops.push new_op_data

			doc.data = doc_data
			
			callback()

		# Data = {v, snapshot, type}. Snapshot == null and v = 0 if the document doesn't exist.
		getSnapshot: (docName, callback) ->
			doc = docs[docName]
			if doc?
				callback {v:doc.ops.length, type:doc.data.type, snapshot:doc.data.snapshot}
			else
				callback {v:0, type:null, snapshot:null}

		# Get the current version of a document
		getVersion: (docName, callback) ->
			callback(docs[docName]?.ops.length || 0)

		# Perminantly deletes a document. There is no undo.
		# Callback is callback(error)
		delete: (docName, callback) ->
			if docs[docName]?
				delete docs[docName]
				callback yes if callback?
			else
				callback no if callback?

		close: ->
	}


