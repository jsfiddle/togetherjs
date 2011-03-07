assert = require 'assert'

p = -> #require('util').debug
i = -> #require('util').inspect

# Map from docName -> {ops:[{op:x, meta:m}], data:{snapshot, type}}
# Version is implicitly defined as the length of the delta list.
docs = {}

# Count is trimmed to the size of the document.
# If any documents are passed to the callback, the first one has v = start
# count can be null. If so, returns all documents from start onwards.
# Each document returned is in the form {op:o, meta:m}. Version isn't returned.
exports.getOps = (docName, start, count, callback) ->
	ops = docs[docName]?.ops

	if ops?
		count ||= ops.length - start
		callback ops[start...(start + count)]
	else
		callback []


# Append an op to a document.
# op_data = {op:the op to append, v:version, meta:optional metadata object containing author, etc.}
# doc_data = resultant document snapshot data. {snapshot:s, type:t}
# callback = callback when op committed
exports.append = (docName, op_data, doc_data, callback) ->
	throw new Error 'snapshot missing from data' unless doc_data.snapshot != undefined
	throw new Error 'type missing from data' unless doc_data.type != undefined

	doc = docs[docName] ||= {ops:[], data:null}

	throw new Error 'Version mismatch in db.append' unless op_data.v == doc.ops.length

	# The version isn't stored.
	new_op_data = {op:op_data.op, meta:op_data.meta}
	doc.ops.push new_op_data

	doc.data = doc_data
	
	callback()

# Data = {v, snapshot, type}. Snapshot == null and v = 0 if the document doesn't exist.
exports.getData = (docName, callback) ->
	p "getSnapshot on '#{docName}'"
	doc = docs[docName]
	if doc?
		callback {v:doc.ops.length, type:doc.data.type, snapshot:doc.data.snapshot}
	else
		callback {v:0, type:null, snapshot:null}

exports.getVersion = (docName, callback) ->
	callback(docs[docName]?.ops.length || 0)

# Perminantly deletes a document. There is no undo.
# Callback is callback(error)
exports.delete = (docName, callback) ->
	if docs[docName]?
		delete docs[docName]
		callback(null)
	else
		callback(new Error 'The document does not exist')


