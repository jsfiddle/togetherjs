# Tests for the REST-ful interface

http = require 'http'
testCase = require('nodeunit').testCase

util = require 'util'

server = require '../src/server'
types = require '../src/types'

{makePassPart, newDocName} = require './helpers'

# Async fetch. Aggregates whole response and sends to callback.
# Callback should be function(response, data) {...}
fetch = (method, port, path, postData, extraHeaders, callback) ->
	if typeof extraHeaders == 'function'
		callback = extraHeaders
		extraHeaders = null

	headers = extraHeaders || {'x-testing': 'booyah'}

	request = http.request {method, path, host: 'localhost', port, headers}, (response) ->
		data = ''
		response.on 'data', (chunk) -> data += chunk
		response.on 'end', ->
			if response.headers['content-type'] == 'application/json'
				data = JSON.parse(data)

			callback response, data, response.headers

	if postData?
		postData = JSON.stringify(postData) if typeof(postData) == 'object'
		request.write postData

	request.end()

# Frontend tests
module.exports = testCase
	setUp: (callback) ->
		@name = 'testingdoc'

		@auth = (client, action) -> action.accept()

		# Create a new server which just exposes the REST interface with default options
		options = {
			socketio: null
			rest: {delete: true}
			db: {type: 'memory'}
			auth: (client, action) => @auth client, action
		}

		# For some reason, exceptions thrown in setUp() are ignored.
		# At least this way we'll get a stack trace.
		try
			@model = server.createModel options
			@server = server options, @model
			@server.listen =>
				@port = @server.address().port
				callback()
		catch e
			console.log e.stack
			throw e

	tearDown: (callback) ->
		@server.on 'close', callback
		@server.close()

	'return 404 when on GET on a nonexistant document': (test) ->
		fetch 'GET', @port, "/doc/#{@name}", null, (res, data) ->
			test.strictEqual(res.statusCode, 404)
			test.done()
	
	'GET a document returns the document snapshot': (test) ->
		@model.create @name, 'simple', =>
			@model.applyOp @name, {v:0, op:{position: 0, text: 'Hi'}}, =>
				fetch 'GET', @port, "/doc/#{@name}", null, (res, data, headers) ->
					test.strictEqual res.statusCode, 200
					test.strictEqual headers['x-ot-version'], '1'
					test.strictEqual headers['x-ot-type'], 'simple'
					test.deepEqual data, {str:'Hi'}
					test.done()
	
	'GET a plaintext document returns it as a string': (test) ->
		@model.create @name, 'text', =>
			@model.applyOp @name, {v:0, op:[{i:'hi', p:0}]}, =>
				fetch 'GET', @port, "/doc/#{@name}", null, (res, data, headers) ->
					test.strictEqual res.statusCode, 200
					test.strictEqual headers['x-ot-version'], '1'
					test.strictEqual headers['x-ot-type'], 'text'
					test.strictEqual headers['content-type'], 'text/plain'
					test.deepEqual data, 'hi'
					test.done()

	'PUT a document creates it': (test) ->
		fetch 'PUT', @port, "/doc/#{@name}", {type:'simple'}, (res, data) =>
			test.strictEqual res.statusCode, 200

			@model.getSnapshot @name, (doc) ->
				test.deepEqual doc, {v:0, type:types.simple, snapshot:{str:''}, meta:{}}
				test.done()

	'POST a document in the DB returns 200 OK': (test) ->
		@model.create @name, 'simple', =>
			fetch 'POST', @port, "/doc/#{@name}?v=0", {position: 0, text: 'Hi'}, (res, data) =>
				test.strictEqual res.statusCode, 200
				test.deepEqual data, {v:0}

				@model.getSnapshot @name, (doc) ->
					test.deepEqual doc, {v:1, type:types.simple, snapshot:{str:'Hi'}, meta:{}}
					test.done()
	
	'POST a document setting the version in an HTTP header works': (test) ->
		@model.create @name, 'simple', =>
			fetch 'POST', @port, "/doc/#{@name}", {position: 0, text: 'Hi'}, {'X-OT-Version': 0}, (res, data) =>
				test.strictEqual res.statusCode, 200
				test.deepEqual data, {v:0}

				@model.getSnapshot @name, (doc) ->
					test.deepEqual doc, {v:1, type:types.simple, snapshot:{str:'Hi'}, meta:{}}
					test.done()
	
	'POST a document with no version returns 400': (test) ->
		fetch 'POST', @port, "/doc/#{@name}", {type:'simple'}, (res, data) ->
			test.strictEqual res.statusCode, 400
			test.done()

	'POST a document with invalid JSON returns 400': (test) ->
		fetch 'POST', @port, "/doc/#{@name}?v=0", 'invalid>{json', (res, data) ->
			test.strictEqual res.statusCode, 400
			test.done()
	
	'DELETE deletes a document': (test) ->
		@model.create @name, 'simple', =>
			fetch 'DELETE', @port, "/doc/#{@name}", null, (res, data) =>
				test.strictEqual res.statusCode, 200

				@model.getSnapshot @name, (doc) ->
					test.strictEqual doc, null
					test.done()
	
	'DELETE returns a 404 message if you delete something that doesn\'t exist': (test) ->
		fetch 'DELETE', @port, "/doc/#{@name}", null, (res, data) ->
			test.strictEqual res.statusCode, 404
			test.done()

	'Cannot do anything if the server doesnt allow client connections': (test) ->
		@auth = (client, action) ->
			test.strictEqual action.type, 'connect'
			test.ok client.remoteAddress in ['localhost', '127.0.0.1'] # Is there a nicer way to do this?
			test.strictEqual typeof client.id, 'string'
			test.ok client.id.length > 5
			test.ok client.connectTime

			test.strictEqual typeof client.headers, 'object'

			# This is added above
			test.strictEqual client.headers['x-testing'], 'booyah'

			action.reject()

		passPart = makePassPart test, 7
		checkResponse = (res, data) ->
			test.strictEqual(res.statusCode, 403)
			test.deepEqual data, 'Forbidden'
			passPart()

		# Non existant document
		doc1 = newDocName()

		# Get
		fetch 'GET', @port, "/doc/#{doc1}", null, checkResponse

		# Create
		fetch 'PUT', @port, "/doc/#{doc1}", {type:'simple'}, checkResponse

		# Submit an op to a nonexistant doc
		fetch 'POST', @port, "/doc/#{doc1}?v=0", {position: 0, text: 'Hi'}, checkResponse

		# Existing document
		doc2 = newDocName()
		@model.create doc2, 'simple', =>
			@model.applyOp doc2, {v:0, op:{position: 0, text: 'Hi'}}, =>
				fetch 'GET', @port, "/doc/#{doc2}", null, checkResponse
		
				# Create an existing document
				fetch 'PUT', @port, "/doc/#{doc2}", {type:'simple'}, checkResponse

				# Submit an op to an existing document
				fetch 'POST', @port, "/doc/#{doc2}?v=0", {position: 0, text: 'Hi'}, checkResponse

				# Delete a document
				fetch 'DELETE', @port, "/doc/#{doc2}", null, checkResponse

	'Cant GET if read is rejected': (test) ->
		@auth = (client, action) -> if action.type == 'read' then action.reject() else action.accept()

		@model.create @name, 'simple', =>
			@model.applyOp @name, {v:0, op:{position: 0, text: 'Hi'}}, =>
				fetch 'GET', @port, "/doc/#{@name}", null, (res, data) ->
					test.strictEqual(res.statusCode, 403)
					test.deepEqual data, 'Forbidden'
					test.done()

	'Cant PUT if create is rejected': (test) ->
		@auth = (client, action) -> if action.type == 'create' then action.reject() else action.accept()

		fetch 'PUT', @port, "/doc/#{@name}", {type:'simple'}, (res, data) =>
			test.strictEqual res.statusCode, 403
			test.deepEqual data, 'Forbidden'

			@model.getSnapshot @name, (doc) ->
				test.deepEqual doc, null
				test.done()

	'Cant POST if submit op is rejected': (test) ->
		@auth = (client, action) -> if action.type == 'update' then action.reject() else action.accept()

		@model.create @name, 'simple', =>
			fetch 'POST', @port, "/doc/#{@name}?v=0", {position: 0, text: 'Hi'}, (res, data) =>
				test.strictEqual res.statusCode, 403
				test.deepEqual data, 'Forbidden'

				# & Check the document is unchanged
				@model.getSnapshot @name, (doc) ->
					test.deepEqual doc, {v:0, type:types.simple, snapshot:{str:''}, meta:{}}
					test.done()

	'A Forbidden DELETE on a nonexistant document returns 403': (test) ->
		@auth = (client, action) -> if action.type == 'delete' then action.reject() else action.accept()

		fetch 'DELETE', @port, "/doc/#{@name}", null, (res, data) ->
			test.strictEqual res.statusCode, 403
			test.deepEqual data, 'Forbidden'
			test.done()

	'Cant DELETE if delete is rejected': (test) ->
		@auth = (client, action) -> if action.type == 'delete' then action.reject() else action.accept()

		@model.create @name, 'simple', =>
			fetch 'DELETE', @port, "/doc/#{@name}", null, (res, data) =>
				test.strictEqual res.statusCode, 403
				test.deepEqual data, 'Forbidden'

				@model.getSnapshot @name, (doc) ->
					test.ok doc
					test.done()
	
