# The memory database is a simple map of documents stored in memory.
#
# It is mainly provided for testing and as a reference for how other
# DB implementations should behave.

module.exports = ->
	# Map from docName -> {ops:[{op:x, meta:m}], data:{snapshot, type, meta}}
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

		# Create a new document.
		#
		# data = {snapshot, type, [meta]}
		create: (docName, data, callback) ->
			if docs[docName]
				callback false, 'Document already exists'
			else
				throw new Error 'snapshot missing from data' unless data.snapshot != undefined
				throw new Error 'type missing from data' unless data.type != undefined
				throw new Error 'version missing from data' unless typeof data.v == 'number'
				throw new Error 'meta missing from data' unless typeof data.meta == 'object'

				docs[docName] = {ops:[], data:data}
				callback true

		# Perminantly delete a document.
		# Callback is callback(status) where status == true iff a document was deleted.
		delete: (docName, callback) ->
			if docs[docName]?
				delete docs[docName]
				callback yes if callback?
			else
				callback no, 'Document does not exist' if callback?

		# Append an op to a document. The document must already exist (via db.create, above).
		#
		# opData = {op:the op to append, v:version, meta:optional metadata object containing author, etc.}
		# docData = resultant document snapshot data. {snapshot:s, type:typename}
		# callback = callback when op committed
		append: (docName, opData, docData, callback) ->
			throw new Error 'snapshot missing from data' unless docData.snapshot != undefined
			throw new Error 'type missing from data' unless docData.type != undefined

			doc = docs[docName]
			throw new Error 'doc missing' unless doc?

			throw new Error 'Version mismatch in db.append' unless opData.v == doc.ops.length

			new_op_data = {op:opData.op, v:opData.v}
			new_op_data.meta = opData.meta if opData.meta?
			doc.ops.push new_op_data

			doc.data = docData
			
			callback()

		# Data = {v, snapshot, type}. Snapshot == null and v = 0 if the document doesn't exist.
		getSnapshot: (docName, callback) ->
			doc = docs[docName]
			if doc?
				# The model code will mess with the object sent to the callback. We'll
				# do a shallow copy of it here to avoid problems.
				data = {snapshot:doc.data.snapshot, v:doc.data.v, type:doc.data.type, meta:doc.data.meta}
				callback data
			else
				callback null, 'Document does not exist'

		# Get the current version of a document
		getVersion: (docName, callback) ->
			callback(docs[docName]?.ops.length ? null)

		close: ->
	}


