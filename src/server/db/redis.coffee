redis = require 'redis'

types = require '../../types'

p = ->#require('util').debug
i = ->#require('util').inspect

prefix = "OTDB"
client = null

keyForOps = (docName) -> "#{prefix}:ops:#{docName}"
keyForDoc = (docName) -> "#{prefix}:doc:#{docName}"

exports.init = (options, callback) ->
	client = redis.createClient()
	client.on 'ready', ->
		callback() if callback?

exports.prepareForTesting = ->
	client.select 15
	client.flushdb()

# Count is trimmed to the size of the document.
# If any documents are passed to the callback, the first one has v = start
# count can be null. If so, returns all documents from start onwards.
# Each document returned is in the form {op:o, meta:m}. Version isn't returned.
exports.getOps = (docName, start, count, callback) ->
	#	p "getOps #{i start} #{i count} #{callback}"
	end = if count? then start + count - 1 else -1
	client.lrange keyForOps(docName), start, end, (err, values) ->
		throw err if err?
		callback values.map((v) -> JSON.parse(v))

# Append an op to a document.
# op_data = {op:the op to append, v:version, meta:optional metadata object containing author, etc.}
# doc_data = resultant document snapshot data. {snapshot:s, type:t}
# callback = callback when op committed
exports.append = (docName, op_data, doc_data, callback) ->
	throw new Error 'snapshot missing from data' unless doc_data.snapshot != undefined
	throw new Error 'type missing from data' unless doc_data.type != undefined

	p "appending to #{docName} v: #{op_data.v}"

	# ****** NOT SAFE FOR MULTIPLE PROCESSES. Rewrite using transactions.
	
	resultingVersion = op_data.v + 1

	# The version isn't stored.
	new_op_data = {op:op_data.op, meta:op_data.meta}
	client.rpush keyForOps(docName), JSON.stringify(new_op_data), (err, response) ->
		throw err if err?

		# The response should be the new length of the op list, which should == new version.
		throw new Error 'Version mismatch in db.append' unless resultingVersion == response
	
	new_doc_data = {snapshot:doc_data.snapshot, type:doc_data.type.name, v:resultingVersion}
	client.set keyForDoc(docName), JSON.stringify(new_doc_data), (err, response) ->
		throw err if err?

		# I'm assuming the ops are sent & responses received in order.
		callback()

# Data = {v, snapshot, type}. Snapshot == null and v = 0 if the document doesn't exist.
exports.getData = (docName, callback) ->
	p "getSnapshot on '#{docName}'"

	client.get keyForDoc(docName), (err, response) ->
		throw err if err?

		if response != null
			doc_data = JSON.parse(response)
			callback {v:doc_data.v, type:types[doc_data.type], snapshot:doc_data.snapshot}
		else
			callback {v:0, type:null, snapshot:null}

exports.getVersion = (docName, callback) ->
	client.llen keyForOps(docName), (err, response) ->
		throw err if err?

		p "v: #{i response}"
		callback(response)

# Perminantly deletes a document. There is no undo.
# Callback is callback(error)
exports.delete = (docName, callback) ->
	client.del keyForOps(docName)
	client.del keyForDoc(docName), (err, response) ->
		throw err if err?
		callback(if response == 1 then yes else no)

exports.init()

