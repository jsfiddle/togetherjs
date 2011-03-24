# Tests for the client's streaming interface wrapper

testCase = require('nodeunit').testCase

server = require '../src/server'
OpStream = require('../src/client/opstream').OpStream

helpers = require './helpers'

port = 8765

# Client stream tests
module.exports = testCase {
	setUp: (callback) ->
		@name = 'testingdoc'
		options = {
			socketio: {}
			rest: null
			db: {type: 'memory'}
		}

		@model = server.createModel options
		@server = server options, @model

		@server.listen port, =>
			@ds = new OpStream 'localhost', port
			callback()

	tearDown: (callback) ->
		@ds.disconnect()

		# Its important the port has closed before the next test is run.
		@server.on 'close', callback
		@server.close()

	'follow a document': (test) ->
		@ds.follow @name, 0, (msg) =>
			test.deepEqual msg, {doc:@name, follow:true, v:0}
			test.done()
	
	'submit an op': (test) ->
		@ds.follow @name, 0, (msg) =>
			@ds.submit @name, {type:'simple'}, 0, (msg) =>
				test.deepEqual msg, {v:0, doc:@name}
				test.done()
	
	'have a docname with the op even when the server skips it': (test) ->
		@ds.submit @name, {type:'simple'}, 0, (msg) =>
			test.deepEqual msg, {v:0, doc:@name}
			@ds.submit @name, {position:0, text:'hi'}, 1, (msg) =>
				test.deepEqual msg, {v:1, doc:@name}
				test.done()

	'get an empty document returns a null snapshot': (test) ->
		@ds.get @name, (msg) =>

			test.deepEqual msg, {doc:@name, v:0, type:null, snapshot:null}
			test.done()

	'get a non-empty document gets its snapshot': (test) ->
		@ds.submit @name, {type:'simple'}, 0, =>
			@ds.get @name, (msg) =>
				test.deepEqual msg, {doc:@name, v:1, type:'simple', snapshot:{str:''}}
				test.done()

	'get a stream of ops for an follow document': (test) ->
		@ds.follow @name, 0, (msg) =>
			@model.applyOp @name, {v:0, op:{type:'simple'}}, (error, appliedVersion) ->
				test.ifError(error)
				test.strictEqual appliedVersion, 0

		@ds.on @name, 'op', (data) =>
			test.ok data.meta
			delete data.meta
			test.deepEqual data, {doc:@name, v:0, op:{type:'simple'}}
			test.done()

	'not get ops sent after the document was unfollowed': (test) ->
		@ds.follow @name, 0, (msg) =>
			@ds.unfollow @name, =>
				# The document should now be unfollowed.
				@model.applyOp @name, {v:0, op:{type:'simple'}}, (error, appliedVersion) =>
					# We shouldn't get that op...
					@ds.follow helpers.newDocName(), 0, (msg) ->
						test.done()

		@ds.on @name, 'op', (data) ->
			throw new Error "Received op for unfollowed document: #{i data}"
	
	'submit a set type op on a doc that already has a type returns the right error code': (test) ->
		@ds.submit @name, {type:'simple'}, 0, =>
			@ds.submit @name, {type:'text'}, 0, (msg) =>
				test.deepEqual msg, {doc:@name, v:null, error:'Type already set'}
				test.done()

	'submit sets a type op with a foreign type': (test) ->
		@ds.submit @name, {type:'oogedy boogedy'}, 0, (msg) ->
			# There should be a way to detect this.
			test.strictEqual msg.v, null
			test.done()
}

