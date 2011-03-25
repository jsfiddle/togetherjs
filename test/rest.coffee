# Tests for the REST-ful interface

http = require 'http'
testCase = require('nodeunit').testCase

util = require 'util'

server = require '../src/server'

helpers = require './helpers'

# This test creates a server listening on a local port.
port = 8765

# Async fetch. Aggregates whole response and sends to callback.
# Callback should be function(response, data) {...}
fetch = (method, path, postData, callback) ->
	request = http.request {method:method, path:path, host: 'localhost', port:port}, (response) ->
		data = ''
		response.on 'data', (chunk) -> data += chunk
		response.on 'end', -> callback(response, data)

	if postData?
		postData = JSON.stringify(postData) if typeof(postData) == 'object'
		request.write postData

	request.end()

# Frontend tests
module.exports = testCase {
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
			@server.listen port, callback
		catch e
			console.log e.stack
			throw e

	tearDown: (callback) ->
		@server.on 'close', callback
		@server.close()

	'return 404 when on GET on a random URL': (test) ->
		fetch 'GET', "/doc/#{@name}", null, (res, data) ->
			test.strictEqual(res.statusCode, 404)
			test.done()
	
	'GET a document returns the document snapshot': (test) ->
		helpers.applyOps @model, @name, 0, [{type: 'simple'}, {position: 0, text: 'Hi'}], (error, _) =>
			fetch 'GET', "/doc/#{@name}", null, (res, data) ->
				test.strictEqual(res.statusCode, 200)
				data = JSON.parse data
				test.deepEqual data, {v:2, type:'simple', snapshot:{str:'Hi'}}
				test.done()

	'POST a document in the DB returns 200 OK': (test) ->
		fetch 'POST', "/doc/#{@name}?v=0", {type:'simple'}, (res, data) =>
			test.strictEqual res.statusCode, 200
			test.deepEqual JSON.parse(data), {v:0}

			fetch 'POST', "/doc/#{@name}?v=1", {position: 0, text: 'Hi'}, (res, data) =>
				test.strictEqual res.statusCode, 200
				test.deepEqual JSON.parse(data), {v:1}
				fetch 'GET', "/doc/#{@name}", null, (res, data) ->
					test.strictEqual res.statusCode, 200
					test.deepEqual JSON.parse(data), {v:2, type:'simple', snapshot:{str: 'Hi'}}
					test.done()

	'POST a document with no version returns 400': (test) ->
		fetch 'POST', "/doc/#{@name}", {type:'simple'}, (res, data) ->
			test.strictEqual res.statusCode, 400
			test.done()

	'POST a document with invalid JSON returns 400': (test) ->
		fetch 'POST', "/doc/#{@name}?v=0", 'invalid>{json', (res, data) ->
			test.strictEqual res.statusCode, 400
			test.done()
	
	'DELETE deletes a document': (test) ->
		@model.applyOp @name, {v:0, op:{type:'simple'}}, (error, newVersion) =>
			test.ifError(error)
			fetch 'DELETE', "/doc/#{@name}", null, (res, data) ->
				test.strictEqual res.statusCode, 200
				test.done()
	
	'DELETE returns a 404 message if you delete something that doesn\'t exist': (test) ->
		fetch 'DELETE', "/doc/#{@name}", null, (res, data) ->
			test.strictEqual res.statusCode, 404
			test.done()

	'DELETE doesnt work if you dont select it in the options': (test) ->
		s = server {db: {type: 'memory'}}, @model
		p = port + 1
		s.listen p, =>
			@model.applyOp @name, {v:0, op:{type:'simple'}}, (error, newVersion) =>
				test.ifError(error)
				request = http.request {method:'DELETE', path:"/doc/#{@name}", host: 'localhost', port:p}, (res) =>
					test.strictEqual res.statusCode, 404
					@model.getVersion @name, (v) ->
						test.strictEqual v, 1

						s.on 'close', test.done
						s.close()

				request.end()
}
