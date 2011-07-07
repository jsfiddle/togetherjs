# This is an implementation of the OT data backend for redis.
#   http://redis.io/
#
# This implementation isn't written to support multiple frontends
# talking to a single redis backend using redis's transactions.

redis = require 'redis'

defaultOptions = {
	# Prefix for all database keys.
	prefix: 'ShareJS:'

	# Inherit the default options from redis. (Hostname: 127.0.0.1, port: 6379)
	hostname: null
	port: null
	redisOptions: null

	# If this is set to true, the client will select db 15 and wipe all data in
	# this database.
	testing: false
}

# Valid options as above.
module.exports = RedisDb = (options) ->
	return new Db if !(this instanceof RedisDb)

	options ?= {}
	options[k] ?= v for k, v of defaultOptions

	keyForOps = (docName) -> "#{options.prefix}ops:#{docName}"
	keyForDoc = (docName) -> "#{options.prefix}doc:#{docName}"

	client = redis.createClient options.port, options.hostname, options.redisOptions

	client.select 15 if options.testing

	# Creates a new document.
	# data = {snapshot, type:typename, [meta]}
	# calls callback(true) if the document was created or callback(false) if a document with that name
	# already exists.
	@create = (docName, data, callback) ->
		value = JSON.stringify(data)
		client.setnx keyForDoc(docName), value, (err, result) ->
			throw err if err?

			if callback
				if result
					callback true
				else
					callback false, 'Document already exists'

	# Get all ops with version = start to version = end. Noninclusive.
	# end is trimmed to the size of the document.
	# If any documents are passed to the callback, the first one has v = start
	# end can be null. If so, returns all documents from start onwards.
	# Each document returned is in the form {op:o, meta:m, v:version}.
	@getOps = (docName, start, end, callback) ->
		if start == end
			callback []
			return

		# In redis, lrange values are inclusive.
		if end?
			end--
		else
			end = -1

		client.lrange keyForOps(docName), start, end, (err, values) ->
			throw err if err?
			v = start
			ops = for value in values
				data = JSON.parse value
				data.v = v++
				data
			
			callback ops

	# Append an op to a document.
	# op_data = {op:the op to append, v:version, meta:optional metadata object containing author, etc.}
	# doc_data = resultant document snapshot data. {snapshot:s, type:t, meta}
	# callback = callback when op committed
	# 
	# op_data.v MUST be the subsequent version for the document.
	#
	# This function has UNDEFINED BEHAVIOUR if you call append before calling create().
	# (its either that, or I have _another_ check when you append an op that the document already exists
	# ... and that would slow it down a bit.)
	@append = (docName, op_data, doc_data, callback) ->
		throw new Error 'snapshot missing from data' unless doc_data.snapshot != undefined
		throw new Error 'type missing from data' unless doc_data.type != undefined

		# ****** NOT SAFE FOR MULTIPLE PROCESSES. Rewrite using transactions.
		
		resultingVersion = op_data.v + 1
		throw new Error 'version missing or incorrect in doc data' unless doc_data.v == resultingVersion

		# The version isn't stored.
		new_op_data = {op:op_data.op, meta:op_data.meta}
		json = JSON.stringify(new_op_data)
		client.rpush keyForOps(docName), json, (err, response) ->
			throw err if err?

			unless resultingVersion == response
				# The document has been corrupted by the change. For now, throw an exception.
				# Later, rebuild the snapshot.
				throw "Version mismatch in db.append. '#{docName}' is corrupted."
		
		client.set keyForDoc(docName), JSON.stringify(doc_data), (err, response) ->
			throw err if err?

			# I'm assuming the ops are sent & responses received in order.
			callback()

	# Data = {v, snapshot, type}. Snapshot == null and v = 0 if the document doesn't exist.
	@getSnapshot = (docName, callback) ->
		client.get keyForDoc(docName), (err, response) ->
			throw err if err?

			if response != null
				doc_data = JSON.parse(response)
				callback doc_data
			else
				callback null, 'Document does not exist'

	@getVersion = (docName, callback) ->
		client.llen keyForOps(docName), (err, response) ->
			throw err if err?

			if response == 0
				# The document might not exist at all.
				client.exists keyForDoc(docName), (err, response) ->
					throw err if err?
					if response
						callback 0
					else
						callback null
			else
				callback response

	# Perminantly deletes a document. There is no undo.
	# Callback takes a single argument which is true iff something was deleted.
	@delete = (docName, callback) ->
		client.del keyForOps(docName)
		client.del keyForDoc(docName), (err, response) ->
			throw err if err?
			if callback
				if response == 1
					# Something was deleted.
					callback true
				else
					callback false, 'Document does not exist'
	
	# Close the connection to the database
	@close = ->
		client.quit()

	this
