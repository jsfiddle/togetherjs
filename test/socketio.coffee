# Tests for the server's socketio interface

testCase = require('nodeunit').testCase
assert = require 'assert'
clientio = require('../thirdparty/Socket.io-node-client/lib/io-client').io

server = require '../src/server'

helpers = require './helpers'
newDocName = helpers.newDocName
applyOps = helpers.applyOps
makePassPart = helpers.makePassPart

# Expected data is an array of objects.
expectData = (socket, expectedData, callback) ->
	listener = (data) ->
		#p "expectData recieved #{i data}"
		expected = expectedData.shift()
		if expected.meta == 'anyObject'
			assert.strictEqual typeof data.meta, 'object'
			delete data.meta
			delete expected.meta
		assert.deepEqual expected, data

		if expectedData.length == 0
			socket.removeListener 'message', listener
			callback()
	
	socket.on 'message', listener

module.exports = testCase {
	setUp: (callback) ->
		options = {
			socketio: {}
			rest: null
			db: {type: 'memory'}
		}

		try
			@model = server.createModel options
			@server = server options, @model

			@server.listen =>
				@name = 'testingdoc'

				# Make a new socket.io socket connected to the server's stream interface
				@socket = new clientio.Socket 'localhost', {port: @server.address().port, resource: 'socket.io'}
				@socket.connect()
				@socket.on 'connect', callback
		catch e
			console.log e.stack
			throw e
	
	tearDown: (callback) ->
		@socket.disconnect()

		# Its important the port has closed before the next test is run.
		@server.on 'close', callback
		@server.close()

	'follow a document': (test) ->
		@socket.send {doc:@name, v:0, follow:true}
		expectData @socket, [{doc:@name, v:0, follow:true}], ->
			test.done()

	'follow a document with no version specified': (test) ->
		@socket.send {doc:@name, follow:true}
		@socket.on 'message', (data) =>
			test.deepEqual data, {doc:@name, v:0, follow:true}
			test.done()

	'follow a document at a previous version and get ops since': (test) ->
		@model.applyOp @name, {v:0, op:{type:'simple'}}, (error, newVersion) =>
			test.ifError(error)

			expectData @socket, [{doc:@name, v:0, follow:true}, {v:0, op:{type:'simple'}, meta:'anyObject'}], ->
				test.done()

			@socket.send {doc:@name, v:0, follow:true}

	'receive ops through an follow @socket': (test) ->
		@socket.send {doc:@name, v:0, follow:true}
		expectData @socket, [{doc:@name, v:0, follow:true}], =>
			applyOps @model, @name, 0, [{type:'simple'}], (error, _) =>
				test.ifError(error)

			expectData @socket, [{v:0, op:{type:'simple'}, meta:'anyObject'}], ->
				test.done()

	'send an op': (test) ->
		@model.listen @name, ((v) -> test.strictEqual v, 0), (opData) =>
			test.strictEqual opData.v, 0
			test.deepEqual opData.op, {type:'simple'}
			test.done()

		@socket.send {doc:@name, v:0, op:{type:'simple'}}

	'send an op with metadata': (test) ->
		@model.listen @name, ((v) -> test.strictEqual v, 0), (opData) =>
			test.strictEqual opData.v, 0
			test.strictEqual opData.meta.x, 5
			test.deepEqual opData.op, {type:'simple'}
			test.done()

		@socket.send {doc:@name, v:0, op:{type:'simple'}, meta:{x:5}}

	'receive confirmation when an op is sent': (test) ->
		expectData @socket, [{doc:@name, v:0}], () =>
			test.done()

		@socket.send {doc:@name, v:0, op:{type:'simple'}}

	'not be sent your own ops back': (test) ->
		@socket.on 'message', (data) ->
			test.notDeepEqual data.op, {type:'simple'} if data.op?

		expectData @socket, [{doc:@name, v:0, follow:true}, {v:0}], =>
			# Gonna do this a dodgy way. Because I don't want to wait an undefined amount of time
			# to make sure the op doesn't come, I'll trigger another op and make sure it recieves that.
			# The second op should come after the first.
			expectData @socket, [{v:1, op:{position:0, text:'hi'}, meta:'anyObject'}], ->
				test.done()

			applyOps @model, @name, 1, [{position:0, text:'hi'}], (error, _) -> test.ifError(error)

		@socket.send {doc:@name, v:0, follow:true}
		@socket.send {doc:@name, v:0, op:{type:'simple'}}

	'get a document snapshot': (test) ->
		applyOps @model, @name, 0, [{type: 'simple'}, {position: 0, text: 'internet'}], (error, _) =>
			test.ifError(error)

			@socket.send {doc:@name, snapshot:null}
			@socket.on 'message', (data) =>
				test.deepEqual data, {doc:@name, snapshot:{str:'internet'}, v:2, type:'simple'}
				test.done()

	'get a null snapshot when getting a nonexistent document': (test) ->
		@socket.send {doc:@name, snapshot:null}
		@socket.on 'message', (data) =>
			test.deepEqual data, {doc:@name, snapshot:null, type:null, v:0}
			test.done()
	
	'be able to close a document': (test) ->
		name1 = newDocName()
		name2 = newDocName()

		@socket.send {doc:name1, follow:true}
		@socket.send {follow:false}
		@socket.send {doc:name2, follow:true}

		expectData @socket, [{doc:name1, follow:true, v:0}, {follow:false}, {doc:name2, follow:true, v:0}], =>
			# name1 should be closed, and name2 should be follow.
			# We should only get the op for name2.
			@model.applyOp name1, {v:0, op:{type:'simple'}}, (error, appliedVersion) ->
				test.ifError(error)
			@model.applyOp name2, {v:0, op:{type:'text'}}, (error, appliedVersion) ->
				test.ifError(error)

			expectData @socket, [{v:0, op:{type:'text'}, meta:'anyObject'}], ->
				test.done()
	
	'doc names are sent in ops when necessary': (test) ->
		name1 = newDocName()
		name2 = newDocName()

		@socket.send {doc:name1, follow:true}
		@socket.send {doc:name2, follow:true}

		passPart = makePassPart test, 3

		expectData @socket, [{doc:name1, follow:true, v:0}, {doc:name2, follow:true, v:0}], =>
			@model.applyOp name1, {v:0, op:{type:'simple'}}, (error, _) =>
				test.ifError(error)
				@model.applyOp name2, {v:0, op:{type:'simple'}}, (error, _) =>
					test.ifError(error)
					@model.applyOp name1, {v:1, op:{position:0, text:'a'}}, (error, _) =>
						test.ifError(error)

			# All the ops that come through the socket should have the doc name set.
			@socket.on 'message', (data) =>
				test.strictEqual data.doc?, true
				passPart()

	'dont repeat document names': (test) ->
		passPart = makePassPart test, 3
		@socket.send {doc:@name, follow:true}
		expectData @socket, [{doc:@name, follow:true, v:0}], =>
			@socket.on 'message', (data) =>
				test.strictEqual data.doc?, false
				passPart()

			@socket.send {doc:@name, op:{type:'simple'}, v:0}
			@socket.send {doc:@name, op:{position: 0, text:'a'}, v:1}
			@socket.send {doc:@name, op:{position: 0, text:'a'}, v:2}

	'an error message is sent through the socket if the operation is invalid': (test) ->
		@model.applyOp @name, {v:0, op:{type:'simple'}}, (error, _) =>
			@socket.send {doc:@name, v:0, op:{type:'text'}}
			expectData @socket, [{doc:@name, v:null, error:'Type already set'}], ->
				test.done()

}


