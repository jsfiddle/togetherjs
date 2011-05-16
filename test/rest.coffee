# Tests for the REST-ful interface

http = require 'http'
testCase = require('nodeunit').testCase

util = require 'util'

server = require '../src/server'
types = require '../src/types'

helpers = require './helpers'

# Async fetch. Aggregates whole response and sends to callback.
# Callback should be function(response, data) {...}
fetch = (method, port, path, postData, extraHeaders, callback) ->
	if typeof extraHeaders == 'function'
		callback = extraHeaders
		extraHeaders = null

	headers = extraHeaders || {}

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

		# Create a new server which just exposes the REST interface with default options
		options = {
			socketio: null
			rest: {delete: true}
			db: {type: 'memory'}
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
			fetch 'DELETE', @port, "/doc/#{@name}", null, (res, data) ->
				test.strictEqual res.statusCode, 200
				test.done()
	
	'DELETE returns a 404 message if you delete something that doesn\'t exist': (test) ->
		fetch 'DELETE', @port, "/doc/#{@name}", null, (res, data) ->
			test.strictEqual res.statusCode, 404
			test.done()

	'DELETE doesnt work if you dont select it in the options': (test) ->
		s = server {db: {type: 'memory'}}, @model
		s.listen =>
			p = s.address().port
			@model.create @name, 'simple', =>
				request = http.request {method:'DELETE', path:"/doc/#{@name}", host: 'localhost', port:p}, (res) =>
					test.strictEqual res.statusCode, 404
					@model.getVersion @name, (v) ->
						test.strictEqual v, 0

						s.on 'close', test.done
						s.close()

				request.end()

