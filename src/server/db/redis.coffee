# This is an implementation of the OT data backend for redis.
#   http://redis.io/
#
# This implementation isn't written to support multiple frontends
# talking to a single redis backend using redis's transactions.

redis = require 'redis'
util = require 'util'
types = require '../../types'

defaultOptions = {
	# Prefix for all database keys.
	prefix: 'OTDB:'

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

	client = redis.createClient options.hostname, options.port, options.redisOptions

	client.select 15 if options.testing
		

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
	# doc_data = resultant document snapshot data. {snapshot:s, type:t}
	# callback = callback when op committed
	# 
	# op_data.v MUST be the subsequent version for the document.
	@append = (docName, op_data, doc_data, callback) ->
		throw new Error 'snapshot missing from data' unless doc_data.snapshot != undefined
		throw new Error 'type missing from data' unless doc_data.type != undefined

		#p "appending to #{docName} v: #{op_data.v}"

		# ****** NOT SAFE FOR MULTIPLE PROCESSES. Rewrite using transactions.
		
		resultingVersion = op_data.v + 1

		# The version isn't stored.
		new_op_data = {op:op_data.op, meta:op_data.meta}
		json = JSON.stringify(new_op_data)
		client.rpush keyForOps(docName), json, (err, response) ->
			throw err if err?

			unless resultingVersion == response
				# The document has been corrupted by the change. For now, throw an exception.
				# Later, rebuild the snapshot.
				throw "Version mismatch in db.append. '#{docName}' is corrupted."
		
		new_doc_data = {snapshot:doc_data.snapshot, type:doc_data.type or null, v:resultingVersion}
		client.set keyForDoc(docName), JSON.stringify(new_doc_data), (err, response) ->
			throw err if err?

			# I'm assuming the ops are sent & responses received in order.
			callback()

	# Data = {v, snapshot, type}. Snapshot == null and v = 0 if the document doesn't exist.
	@getSnapshot = (docName, callback) ->
		#p "getSnapshot on '#{docName}'"

		client.get keyForDoc(docName), (err, response) ->
			throw err if err?

			if response != null
				doc_data = JSON.parse(response)
				callback doc_data
			else
				callback {v:0, type:null, snapshot:null}

	@getVersion = (docName, callback) ->
		client.llen keyForOps(docName), (err, response) ->
			throw err if err?

			#p "v: #{i response}"
			callback(response)

	# Perminantly deletes a document. There is no undo.
	# Callback takes a single argument which is true iff something was deleted.
	@delete = (docName, callback) ->
		client.del keyForOps(docName)
		client.del keyForDoc(docName), (err, response) ->
			throw err if err?
			callback(if response == 1 then yes else no) if callback?
	
	# Close the connection to the database
	@close = ->
		client.quit()

	this
