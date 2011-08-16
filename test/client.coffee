# Tests for the client frontend.

testCase = require('nodeunit').testCase

server = require '../src/server'
types = require '../src/types'

nativeclient = require '../src/client'
webclient = require './helpers/webclient'

makePassPart = require('./helpers').makePassPart

genTests = (client) ->
	testCase
		setUp: (callback) ->
			@name = 'testingdoc'

			@auth = {}
			options =
				socketio: {}
				rest: null
				db: {type: 'memory'}
				auth: @auth

			@model = server.createModel options
			@server = server options, @model
			
			@server.listen =>
				@port = @server.address().port
				@c = new client.Connection 'localhost', @port
				callback()
		
		tearDown: (callback) ->
			@c.disconnect()

			@server.on 'close', callback
			@server.close()

		'open using the bare API': (test) ->
			client.open @name, 'text', {host:'localhost', port:@port}, (doc, error) =>
				test.ok doc
				test.ifError error

				test.strictEqual doc.name, @name
				test.strictEqual doc.type.name, types.text.name
				test.strictEqual doc.version, 0

				doc.close()
				test.done()

		'open multiple documents using the bare API on the same connection': (test) ->
			client.open @name, 'text', {host:'localhost', port:@port}, (doc1, error) =>
				test.ok doc1
				test.ifError error

				client.open @name + 2, 'text', {host:'localhost', port:@port}, (doc2, error) ->
					test.ok doc2
					test.ifError error

					doc2.submitOp {i:'hi'}, ->
						test.strictEqual doc2.snapshot, 'hi'
						doc1.submitOp {i:'booyah'}, ->
							test.strictEqual doc1.snapshot, 'booyah'
							doc2.close ->
								doc1.submitOp {i:'more text '}, ->
									test.strictEqual doc1.snapshot, 'more text booyah'
									
									doc1.close()
									doc2.close()
									test.done()

		'create connection': (test) ->
			test.ok @c
			test.done()

		'create a new document': (test) ->
			@c.open @name, 'text', (doc, error) =>
				test.ok doc
				test.ifError error

				test.strictEqual doc.name, @name
				test.strictEqual doc.type.name, types.text.name
				test.strictEqual doc.version, 0
				test.done()

		'open a document that is already open': (test) ->
			@c.open @name, 'text', (doc1, error) =>
				test.ifError error
				test.ok doc1
				test.strictEqual doc1.name, @name
				@c.open @name, 'text', (doc2, error) =>
					test.strictEqual doc1, doc2
					test.done()
		
		'open a document that already exists': (test) ->
			@model.create @name, 'text', =>
				@c.open @name, 'text', (doc, error) =>
					test.ifError error
					test.ok doc

					test.strictEqual doc.type.name, 'text'
					test.strictEqual doc.version, 0
					test.done()

		'open a document with a different type': (test) ->
			@model.create @name, 'simple', =>
				@c.open @name, 'text', (doc, error) =>
					test.ok error
					test.strictEqual doc, null
					test.done()
		
		'submit an op to a document': (test) ->
			@c.open @name, 'text', (doc, error) =>
				test.ifError error
				test.strictEqual doc.name, @name

				doc.submitOp [{i:'hi', p:0}], =>
					test.deepEqual doc.snapshot, 'hi'
					test.strictEqual doc.version, 1
					test.done()

				# The document snapshot should be updated immediately.
				test.strictEqual doc.snapshot, 'hi'
				# ... but the version tracks the server version, so thats still 0.
				test.strictEqual doc.version, 0
		
		'infer the version when submitting an op': (test) ->
			@c.open @name, 'text', (doc, error) =>
				test.ifError error
				test.strictEqual doc.name, @name

				doc.submitOp [{i:'hi', p:0}], =>
					test.deepEqual doc.snapshot, 'hi'
					test.strictEqual doc.version, 1
					test.done()
		
		'compose multiple ops together when they are submitted together': (test) ->
			@c.open @name, 'text', (doc, error) =>
				test.ifError error
				test.strictEqual doc.name, @name

				doc.submitOp [{i:'hi', p:0}], ->
					test.strictEqual doc.version, 1

				doc.submitOp [{i:'hi', p:0}], ->
					test.strictEqual doc.version, 1
					test.expect 4
					test.done()

		'compose multiple ops together when they are submitted while an op is in flight': (test) ->
			@c.open @name, 'text', (doc, error) =>
				test.ifError error
				test.strictEqual doc.name, @name

				doc.submitOp [{i:'hi', p:0}], ->
					test.strictEqual doc.version, 1

				setTimeout(->
					doc.submitOp [{i:'hi', p:2}], ->
						test.strictEqual doc.version, 2
					doc.submitOp [{i:'hi', p:4}], ->
						test.strictEqual doc.version, 2
						test.expect 5
						test.done()
				, 1)
		
		'Receive submitted ops': (test) ->
			@c.open @name, 'text', (doc, error) =>
				test.ifError error
				test.strictEqual doc.name, @name

				doc.on 'remoteop', (op) ->
					test.deepEqual op, [{i:'hi', p:0}]

					test.expect 4
					test.done()

				@model.applyOp @name, {v:0, op:[{i:'hi', p:0}]}, (error, appliedVersion) ->
					test.ifError error

		'get a nonexistent document passes null to the callback': (test) ->
			@c.openExisting @name, (doc) ->
				test.strictEqual doc, null
				test.done()
		
		'get an existing document returns the document': (test) ->
			@model.create @name, 'text', =>
				@c.openExisting @name, (doc) =>
					test.ok doc

					test.strictEqual doc.name, @name
					test.strictEqual doc.type.name, 'text'
					test.strictEqual doc.version, 0
					test.done()
		
		'client transforms remote ops before applying them': (test) ->
			# There's a bit of magic in the timing of this test. It would probably be more consistent
			# if this test were implemented using a stubbed out backend.

			clientOp = [{i:'client', p:0}]
			serverOp = [{i:'server', p:0}]
			serverTransformed = types.text.transform(serverOp, clientOp, 'right')
			
			finalDoc = types.text.create() # v1
			finalDoc = types.text.apply(finalDoc, clientOp) # v2
			finalDoc = types.text.apply(finalDoc, serverTransformed) #v3

			@c.open @name, 'text', (doc, error) =>
				opsRemaining = 2

				onOpApplied = ->
					opsRemaining--
					unless opsRemaining
						test.strictEqual doc.version, 2
						test.strictEqual doc.snapshot, finalDoc
						test.done()

				doc.submitOp clientOp, onOpApplied
				doc.on 'remoteop', (op) ->
					test.deepEqual op, serverTransformed
					onOpApplied()

				@model.applyOp @name, {v:0, op:serverOp}, (error, v) ->
					test.ifError error

		'doc fires both remoteop and change messages when remote ops are received': (test) ->
			passPart = makePassPart test, 2
			@c.open @name, 'text', (doc, error) =>
				sentOp = [{i:'asdf', p:0}]
				doc.on 'change', (op) ->
					test.deepEqual op, sentOp
					passPart()
				doc.on 'remoteop', (op) ->
					test.deepEqual op, sentOp
					passPart()

				@model.applyOp @name, {v:0, op:sentOp}, (error, v) ->
					test.ifError error
		
		'doc only fires change ops from locally sent ops': (test) ->
			passPart = makePassPart test, 2
			@c.open @name, 'text', (doc, error) ->
				sentOp = [{i:'asdf', p:0}]
				doc.on 'change', (op) ->
					test.deepEqual op, sentOp
					passPart()
				doc.on 'remoteop', (op) ->
					throw new Error 'Should not have received remoteOp event'

				doc.submitOp sentOp, (error, v) ->
					passPart()
		
		'doc does not receive ops after close called': (test) ->
			@c.open @name, 'text', (doc, error) =>
				doc.on 'change', (op) ->
					throw new Error 'Should not have received op when the doc was unfollowed'
		
				doc.close =>
					@model.applyOp @name, {v:0, op:[{i:'asdf', p:0}]}, (error, v) =>
						test.done()

		'created locally is set on new docs': (test) ->
			@c.open @name, 'text', (doc, error) =>
				test.strictEqual doc.created, true
				test.done()

		'created locally is not set on old docs': (test) ->
			@model.create @name, 'text', =>
				@c.open @name, 'text', (doc, error) =>
					test.strictEqual doc.created, false
					test.done()

		"can't open a document if canRead rejects you": (test) ->
			@auth.canRead = (client, docName, result) -> result.reject()

			client.open @name, 'text', {host:'localhost', port:@port}, (doc, error) =>
				test.strictEqual doc, null
				test.strictEqual error, 'Forbidden'

				@model.getVersion @name, (v) ->
					# The document shouldn't exist.
					test.strictEqual v, null
					test.done()

		'Text API is advertised': (test) ->
			client.open @name, 'text', {host:'localhost', port:@port}, (doc, error) =>
				test.strictEqual doc.provides?.text, true
				doc.close()
				test.done()
		
		'Text API can be used to insert into the document': (test) ->
			client.open @name, 'text', {host:'localhost', port:@port}, (doc, error) =>
				doc.insert 'hi', 0, =>
					test.strictEqual doc.getText(), 'hi'

					@model.getSnapshot @name, (data) ->
						test.strictEqual data.snapshot, 'hi'
						doc.close()
						test.done()
		
		'Text documents emit high level editing events': (test) ->
			client.open @name, 'text', {host:'localhost', port:@port}, (doc, error) =>
				doc.on 'insert', (text, pos) ->
					test.strictEqual text, 'hi'
					test.strictEqual pos, 0
					doc.close()
					test.done()

				@model.applyOp @name, {op:[{i:'hi', p:0}], v:0, meta:{}}

		'Works with an externally referenced type (like JSON)': (test) ->
			client.open @name, 'json', {host:'localhost', port:@port}, (doc, error) =>
				test.ifError error
				test.strictEqual doc.snapshot, null
				doc.submitOp [{p:[], od:null, oi:[1,2,3]}], ->
					test.deepEqual doc.snapshot, [1,2,3]
					doc.close()
					test.done()

	# This isn't working yet. I might have to rethink it.
	#	'opening a document with a null name will open a new document with a random document name': (test) ->
	#		client.open null, 'text', {host:'localhost', port:@port}, (doc, error) ->
	#			console.log doc.name
	#
	#			test.strictEqual doc.snapshot, ''
	#			test.strictEqual doc.type.name, 'text'
	#			test.strictEqual doc.created, true
	#			test.done()

exports.native = genTests nativeclient
exports.webclient = genTests webclient
