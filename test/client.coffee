# Tests for the client frontend.

testCase = require('nodeunit').testCase

server = require '../src/server'
types = require '../src/types'

client = require '../src/client'

port = 8765

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
			@c = new client.Connection 'localhost', port
			callback()
	
	tearDown: (callback) ->
		@c.disconnect()

		@server.on 'close', callback
		@server.close()

	'create connection': (test) ->
		test.ok @c
		test.done()
	
	'create a new document': (test) ->
		@c.getOrCreate @name, 'text', (doc, error) =>
			test.ok doc
			test.ifError error

			test.strictEqual doc.name, @name
			test.strictEqual doc.type, types.text
			test.strictEqual doc.version, 1
			test.done()

	'open a document that is already open': (test) ->
		@c.getOrCreate @name, 'text', (doc1, error) =>
			test.ifError error
			test.ok doc1
			test.strictEqual doc1.name, @name
			@c.getOrCreate @name, 'text', (doc2, error) =>
				test.strictEqual doc1, doc2
				test.done()
	
	'open a document that already exists': (test) ->
		@model.applyOp @name, {v:0, op:{type:'text'}}, (error, appliedVersion) =>
			test.ifError(error)

			@c.getOrCreate @name, 'text', (doc, error) =>
				test.ifError error
				test.ok doc

				test.strictEqual doc.type.name, 'text'
				test.strictEqual doc.version, 1
				test.done()

	'open a document with a different type': (test) ->
		@model.applyOp @name, {v:0, op:{type:'simple'}}, (error, appliedVersion) =>
			test.ifError(error)

			@c.getOrCreate @name, 'text', (doc, error) =>
				test.ok error
				test.strictEqual doc, null
				test.done()
	
	'submit an op to a document': (test) ->
		@c.getOrCreate @name, 'text', (doc, error) =>
			test.ifError error
			test.strictEqual doc.name, @name

			doc.submitOp [{i:'hi', p:0}], =>
				test.deepEqual doc.snapshot, 'hi'
				test.strictEqual doc.version, 2
				test.done()

			# The document should be updated immediately.
			test.strictEqual doc.snapshot, 'hi'
			test.strictEqual doc.version, 1
	
	'infer the version when submitting an op': (test) ->
		@c.getOrCreate @name, 'text', (doc, error) =>
			test.ifError error
			test.strictEqual doc.name, @name

			doc.submitOp [{i:'hi', p:0}], =>
				test.deepEqual doc.snapshot, 'hi'
				test.strictEqual doc.version, 2
				test.done()
	
	'compose multiple ops together when they are submitted together': (test) ->
		@c.getOrCreate @name, 'text', (doc, error) =>
			test.ifError error
			test.strictEqual doc.name, @name

			doc.submitOp [{i:'hi', p:0}], ->
				test.strictEqual doc.version, 2

			doc.submitOp [{i:'hi', p:0}], ->
				test.strictEqual doc.version, 2
				test.expect 4
				test.done()

	'compose multiple ops together when they are submitted while an op is in flight': (test) ->
		@c.getOrCreate @name, 'text', (doc, error) =>
			test.ifError error
			test.strictEqual doc.name, @name

			doc.submitOp [{i:'hi', p:0}], ->
				test.strictEqual doc.version, 2

			setTimeout(->
				doc.submitOp [{i:'hi', p:2}], ->
					test.strictEqual doc.version, 3
				doc.submitOp [{i:'hi', p:4}], ->
					test.strictEqual doc.version, 3
					test.expect 5
					test.done()
			, 1)
	
	'Receive submitted ops': (test) ->
		@c.getOrCreate @name, 'text', (doc, error) =>
			test.ifError error
			test.strictEqual doc.name, @name

			doc.onChanged (op) ->
				test.deepEqual op, [{i:'hi', p:0}]

				test.expect 4
				test.done()

			@model.applyOp @name, {v:1, op:[{i:'hi', p:0}]}, (error, appliedVersion) ->
				test.ifError error

	'get a nonexistent document passes null to the callback': (test) ->
		@c.get @name, (doc) ->
			test.strictEqual doc, null
			test.done()
	
	'get an existing document returns the document': (test) ->
		@model.applyOp @name, {v:0, op:{type:'text'}}, (error, appliedVersion) =>
			test.ifError(error)

			@c.get @name, (doc) =>
				test.ok doc

				test.strictEqual doc.name, @name
				test.strictEqual doc.type.name, 'text'
				test.strictEqual doc.version, 1
				test.done()
	
	'client transforms remote ops before applying them': (test) ->
		# There's a bit of magic in the timing of this test. It would probably be more consistent
		# if this test were implemented using a stubbed out backend.

		clientOp = [{i:'client', p:0}]
		serverOp = [{i:'server', p:0}]
		serverTransformed = types.text.transform(serverOp, clientOp, 'server')
		
		finalDoc = types.text.initialVersion() # v1
		finalDoc = types.text.apply(finalDoc, clientOp) # v2
		finalDoc = types.text.apply(finalDoc, serverTransformed) #v3

		@c.getOrCreate @name, 'text', (doc, error) =>
			opsRemaining = 2

			onOpApplied = ->
				opsRemaining--
				unless opsRemaining
					test.strictEqual doc.version, 3
					test.strictEqual doc.snapshot, finalDoc
					test.done()

			doc.submitOp clientOp, onOpApplied
			doc.onChanged (op) ->
				test.deepEqual op, serverTransformed
				onOpApplied()

			@model.applyOp @name, {v:1, op:serverOp}, (error, v) ->
				test.ifError error
}


