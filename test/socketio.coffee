# Tests for the server's socketio interface

testCase = require('nodeunit').testCase
assert = require 'assert'
clientio = require('../thirdparty/Socket.io-node-client/lib/io-client').io

server = require '../src/server'
types = require '../src/types'

helpers = require './helpers'
newDocName = helpers.newDocName
applyOps = helpers.applyOps
makePassPart = helpers.makePassPart

ANYOBJECT = new Object

# Helper method to check that subsequent data received by the callback is a particular
# set of values.
expectData = (socket, expectedData, callback) ->
	expectedData = [expectedData] unless Array.isArray expectedData

	listener = (data) ->
		#p "expectData recieved #{i data}"
		expected = expectedData.shift()
		if expected.meta == ANYOBJECT
			assert.strictEqual typeof data.meta, 'object'
			delete data.meta
			delete expected.meta
		assert.deepEqual expected, data

		if expectedData.length == 0
			socket.removeListener 'message', listener
			callback()
	
	socket.on 'message', listener

module.exports = testCase
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

				@expect = (data, callback) =>
					expectData @socket, data, callback
		catch e
			console.log e.stack
			throw e
	
	tearDown: (callback) ->
		@socket.disconnect()

		# Its important the port has closed before the next test is run.
		@server.on 'close', callback
		@server.close()

	'open an existing document with no version specified opens the document': (test) ->
		@model.create @name, 'simple', =>
			@socket.send {doc:@name, open:true}
			@expect {doc:@name, v:0, open:true}, =>
				@model.applyOp @name, {op:{position:0, text:'hi'}, v:0}, =>
					@expect {v:0, op:{position:0, text:'hi'}, meta:ANYOBJECT}, ->
						test.done()
	
	'open an existing document with version specified opens the document': (test) ->
		@model.create @name, 'simple', =>
			@socket.send {doc:@name, open:true, v:0}
			@expect {doc:@name, v:0, open:true}, =>
				@model.applyOp @name, {op:{position:0, text:'hi'}, v:0}, =>
					@expect {v:0, op:{position:0, text:'hi'}, meta:ANYOBJECT}, ->
						test.done()
	
	'open a nonexistant document with create:true creates the document': (test) ->
		@socket.send {doc:@name, open:true, create:true, type:'simple'}
		@expect {doc:@name, open:true, create:true, v:0}, =>
			@model.getSnapshot @name, (docData) ->
				test.deepEqual docData, {snapshot:{str:''}, v:0, type:types.simple, meta:{}}
				test.done()

	'open a nonexistant document without create fails': (test) ->
		@socket.send {doc:@name, open:true}
		@expect {doc:@name, open:false, error:'Document does not exist'}, =>
			test.done()

	'open a nonexistant document at a particular version without create fails': (test) ->
		@socket.send {doc:@name, open:true, v:0}
		@expect {doc:@name, open:false, error:'Document does not exist'}, =>
			test.done()
	
	'open a nonexistant document with snapshot:null fails normally': (test) ->
		@socket.send {doc:@name, open:true, snapshot:null}
		@expect {doc:@name, open:false, snapshot:null, error:'Document does not exist'}, =>
			test.done()

	'get a snapshot of a nonexistant document fails normally': (test) ->
		@socket.send {doc:@name, snapshot:null}
		@expect {doc:@name, snapshot:null, error:'Document does not exist'}, =>
			test.done()
	
	'open a nonexistant document with create:true and snapshot:null does not return the snapshot': (test) ->
		# The snapshot can be inferred.
		@socket.send {doc:@name, open:true, create:true, type:'text', snapshot:null}
		@expect {doc:@name, open:true, create:true, v:0}, =>
			test.done()

	'open a document with a different type fails': (test) ->
		@model.create @name, 'simple', =>
			@socket.send {doc:@name, open:true, type:'text'}
			@expect {doc:@name, open:false, error:'Type mismatch'}, =>
				test.done()
	
	'open an existing document with create:true opens the current document': (test) ->
		@model.create @name, 'simple', =>
			@model.applyOp @name, {op:{position:0, text:'hi'}, v:0}, =>
				@socket.send {doc:@name, open:true, create:true, type:'simple', snapshot:null}
				# The type isn't sent if it can be inferred.
				@expect {doc:@name, create:false, open:true, v:1, snapshot:{str:'hi'}}, ->
					test.done()

	'open a document at a previous version and get ops since': (test) ->
		@model.create @name, 'simple', =>
			@model.applyOp @name, {op:{position:0, text:'hi'}, v:0}, =>
				@socket.send {doc:@name, v:0, open:true, type:'simple'}

				@expect [{doc:@name, v:0, open:true}, {v:0, op:{position:0, text:'hi'}, meta:ANYOBJECT}], ->
					test.done()

	'create a document without opening it': (test) ->
		@socket.send {doc:@name, create:true, type:'simple'}
		@expect {doc:@name, create:true}, =>
			@model.getSnapshot @name, (docData) ->
				test.deepEqual docData, {snapshot:{str:''}, v:0, type:types.simple, meta:{}}
				test.done()
	
	'create a document that already exists returns create:false': (test) ->
		@model.create @name, 'simple', =>
			@socket.send {doc:@name, create:true, type:'simple'}
			@expect {doc:@name, create:false}, =>
				test.done()

	'create a document with snapshot:null returns create:true and no snapshot': (test) ->
		@socket.send {doc:@name, create:true, type:'simple', snapshot:null}
		@expect {doc:@name, create:true}, =>
			test.done()

	'receive ops through an open document': (test) ->
		@socket.send {doc:@name, v:0, open:true, create:true, type:'simple'}
		@expect {doc:@name, v:0, open:true, create:true}, =>
			@model.applyOp @name, {op:{position:0, text:'hi'}, v:0}

			@expect {v:0, op:{position:0, text:'hi'}, meta:ANYOBJECT}, ->
				test.done()

	'send an op': (test) ->
		@model.create @name, 'simple', =>
			listener = (opData) ->
				test.strictEqual opData.v, 0
				test.deepEqual opData.op, {position:0, text:'hi'}
				test.done()
			@model.listen @name, listener, (v) -> test.strictEqual v, 0

			@socket.send {doc:@name, v:0, op:{position:0, text:'hi'}}

	'send an op with metadata': (test) ->
		@model.create @name, 'simple', =>
			listener = (opData) ->
				test.strictEqual opData.v, 0
				test.strictEqual opData.meta.x, 5
				test.deepEqual opData.op, {position:0, text:'hi'}
				test.done()
			@model.listen @name, listener, (v) -> test.strictEqual v, 0

			@socket.send {doc:@name, v:0, op:{position:0, text:'hi'}, meta:{x:5}}

	'receive confirmation when an op is sent': (test) ->
		@model.create @name, 'simple', =>
			@socket.send {doc:@name, v:0, op:{position:0, text:'hi'}, meta:{x:5}}

			@expect {doc:@name, v:0}, ->
				test.done()

	'not be sent your own ops back': (test) ->
		@socket.on 'message', (data) ->
			test.notDeepEqual data.op, {position:0, text:'hi'} if data.op?

		@socket.send {doc:@name, open:true, create:true, type:'simple'}
		@socket.send {doc:@name, v:0, op:{position:0, text:'hi'}}

		@expect [{doc:@name, v:0, open:true, create:true}, {v:0}], =>
			# Gonna do this a dodgy way. Because I don't want to wait an undefined amount of time
			# to make sure the op doesn't come, I'll trigger another op and make sure it recieves that.
			# The second op should come after the first.
			@expect {v:1, op:{position:0, text:'yo '}, meta:ANYOBJECT}, ->
				test.done()

			@model.applyOp @name, {v:1, op:{position:0, text:'yo '}}

	'get a document snapshot': (test) ->
		@model.create @name, 'simple', =>
			@model.applyOp @name, {v:0, op:{position:0, text:'internet'}}, (error, _) =>
				test.ifError(error)

				@socket.send {doc:@name, snapshot:null}
				@expect {doc:@name, snapshot:{str:'internet'}, v:1, type:'simple'}, ->
					test.done()

	'be able to close a document': (test) ->
		name1 = newDocName()
		name2 = newDocName()

		@socket.send {doc:name1, open:true, create:true, type:'simple'}
		@socket.send {open:false}
		@socket.send {doc:name2, open:true, create:true, type:'text'}

		@expect [{doc:name1, open:true, create:true, v:0}, {open:false}, {doc:name2, open:true, create:true, v:0}], =>
			# name1 should be closed, and name2 should be open.
			# We should only get the op for name2.
			@model.applyOp name1, {v:0, op:{position:0, text:'Blargh!'}}, (error, appliedVersion) ->
				test.ifError(error)
			@model.applyOp name2, {v:0, op:[{i:'hi', p:0}]}, (error, appliedVersion) ->
				test.ifError(error)

			@expect {v:0, op:[{i:'hi', p:0}], meta:ANYOBJECT}, ->
				test.done()
	
	'doc names are sent in ops when necessary': (test) ->
		name1 = newDocName()
		name2 = newDocName()

		@socket.send {doc:name1, open:true, create:true, type:'simple'}
		@socket.send {doc:name2, open:true, create:true, type:'simple'}

		passPart = makePassPart test, 3

		@expect [{doc:name1, open:true, create:true, v:0}, {doc:name2, open:true, create:true, v:0}], =>
			@model.applyOp name1, {v:0, op:{position:0, text:'a'}}, (_, error) =>
				test.ifError(error)
				@model.applyOp name2, {v:0, op:{position:0, text:'b'}}, (_, error) =>
					test.ifError(error)
					@model.applyOp name1, {v:1, op:{position:0, text:'c'}}, (_, error) =>
						test.ifError(error)

			# All the ops that come through the socket should have the doc name set.
			@socket.on 'message', (data) =>
				test.strictEqual data.doc?, true
				passPart()

	'dont repeat document names': (test) ->
		passPart = makePassPart test, 3
		@socket.send {doc:@name, open:true, create:true, type:'simple'}
		@expect {doc:@name, open:true, create:true, v:0}, =>
			@socket.on 'message', (data) =>
				# This time, none of the ops should have the document name set.
				test.strictEqual data.doc?, false
				passPart()

			@socket.send {doc:@name, op:{position: 0, text:'a'}, v:0}
			@socket.send {doc:@name, op:{position: 0, text:'b'}, v:1}
			@socket.send {doc:@name, op:{position: 0, text:'c'}, v:2}

	'an error message is sent through the socket if the operation is invalid': (test) ->
		@model.create @name, 'simple', =>
			@socket.send {doc:@name, v:0, op:{position:-100, text:'asdf'}}
			@expect {doc:@name, v:null, error:'Invalid position'}, ->
				test.done()

	'creating a document with a null doc name creates a new doc': (test) ->
		@socket.send {doc:null, create:true, type:'simple'}
		@socket.on 'message', (data) =>
			test.strictEqual data.create, true
			test.equal typeof data.doc, 'string'
			test.ok data.doc.length > 8

			@model.getSnapshot data.doc, (docData) ->
				test.deepEqual docData, {snapshot:{str:''}, v:0, type:types.simple, meta:{}}
				test.done()

