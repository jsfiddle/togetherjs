# Tests for server/model

assert = require 'assert'
testCase = require('nodeunit').testCase

types = require '../src/types'

server = require '../src/server'
helpers = require './helpers'
applyOps = helpers.applyOps
makePassPart = helpers.makePassPart

# Model tests
module.exports = testCase
	setUp: (callback) ->
		@model = server.createModel {db:{type:'memory'}}
		# When the test is run, a document exists with @name, and @unused is unused.
		@name = 'testingdoc'
		@unused = 'testingdoc2'

		@model.create @name, 'simple', (status) =>
			assert.ok status
			callback()

	'Return null when asked for the snapshot of a new object': (test) ->
		@model.getSnapshot @unused, (data, error) ->
			test.strictEqual data, null
			test.strictEqual error, 'Document does not exist'
			test.done()

	'Calling create sets the type and version': (test) ->
		# create() has been called in setUp already.
		@model.getSnapshot @name, (data, error) =>
			test.strictEqual error, undefined
			test.deepEqual data, {v:0, type:types.simple, snapshot:{str:''}, meta:{}}
			test.done()
	
	'Calling create works with a type literal instead of a string': (test) ->
		@model.create @unused, types.simple, (status) =>
			test.strictEqual status, true
			@model.getSnapshot @name, (data) =>
				test.deepEqual data, {v:0, type:types.simple, snapshot:{str:''}, meta:{}}
				test.done()
	
	'Creating a document a second time has no effect': (test) ->
		@model.create @name, types.text, (status) =>
			test.strictEqual status, false
			@model.getSnapshot @name, (data) =>
				test.deepEqual data, {v:0, type:types.simple, snapshot:{str:''}, meta:{}}
				test.done()
	
	'Subsequent calls to getSnapshot work': (test) ->
		# Written in response to a bug. Odd, isn't it?
		@model.create @name, types.text, (status) =>
			@model.getSnapshot @name, (data) =>
				test.deepEqual data, {v:0, type:types.simple, snapshot:{str:''}, meta:{}}
				@model.getSnapshot @name, (data) =>
					test.deepEqual data, {v:0, type:types.simple, snapshot:{str:''}, meta:{}}
					test.done()
	
	'Cant create a document with a slash in the name': (test) ->
		@model.create 'foo/bar', types.text, (result, error) ->
			test.strictEqual result, false
			test.strictEqual error, 'Invalid document name'
			test.done()

	'Return a fresh snapshot after submitting ops': (test) ->
		@model.applyOp @name, {v:0, op:{position: 0, text:'hi'}}, (appliedVersion, error) =>
			test.ifError(error)
			test.strictEqual appliedVersion, 0
			@model.getSnapshot @name, (data) ->
				test.deepEqual data, {v:1, type:types.simple, snapshot:{str:'hi'}, meta:{}}
				test.done()

	'Apply op to future version fails': (test) ->
		@model.create @name, types.simple, =>
			@model.applyOp @name, {v:1, op:{position: 0, text: 'hi'}}, (result, err) ->
				test.ok err
				test.strictEqual err, 'Op at future version'
				test.done()
	
	'Apply ops at the most recent version': (test) ->
		applyOps @model, @name, 0, [
				{position: 0, text: 'Hi '}
				{position: 3, text: 'mum'}
				{position: 3, text: 'to you '}
			], (error, data) ->
				test.strictEqual error, null
				test.deepEqual data, {v:3, type:types.simple, snapshot:{str:'Hi to you mum'}, meta:{}}
				test.done()
				
	'Apply ops at an old version': (test) ->
		applyOps @model, @name, 0, [
				{position: 0, text: 'Hi '}
				{position: 3, text: 'mum'}
			], (error, data) =>
				test.strictEqual error, null
				test.strictEqual data.v, 2
				test.deepEqual data.snapshot.str, 'Hi mum'

				applyOps @model, @name, 1, [
					{position: 2, text: ' to you'}
				], (error, data) ->
					test.strictEqual error, null
					test.strictEqual data.v, 3
					test.deepEqual data.snapshot.str, 'Hi to you mum'
					test.done()

	'delete a document when delete is called': (test) ->
		@model.delete @name, (deleted) =>
			test.strictEqual deleted, true
			@model.getSnapshot @name, (data) ->
				test.strictEqual data, null
				test.done()
	
	"Pass false to the callback if you delete something that doesn't exist": (test) ->
		@model.delete @unused, (deleted) ->
			test.strictEqual deleted, false
			test.done()
	
	'getOps returns ops in the document': (test) ->
		submittedOps = [{position: 0, text: 'Hi'}, {position: 2, text: ' mum'}]
		passPart = makePassPart test, 6

		getOps = (data) -> data.map ((d) -> d.op)

		applyOps @model, @name, 0, submittedOps.slice(), (error, _) =>
			@model.getOps @name, 0, 1, (data, error) ->
				test.deepEqual getOps(data), [submittedOps[0]]
				test.strictEqual error, undefined
				passPart()
			@model.getOps @name, 0, 2, (data, error) ->
				test.deepEqual getOps(data), submittedOps
				test.strictEqual error, undefined
				passPart()
			@model.getOps @name, 1, 2, (data, error) ->
				test.deepEqual getOps(data), [submittedOps[1]]
				test.strictEqual error, undefined
				passPart()
			@model.getOps @name, 2, 3, (data, error) ->
				test.deepEqual data, []
				test.strictEqual error, undefined
				passPart()

			# These should be trimmed to just return the version specified
			@model.getOps @name, 0, 1000, (data, error) ->
				test.deepEqual getOps(data), submittedOps
				test.strictEqual error, undefined
				passPart()
			@model.getOps @name, 1, 1000, (data, error) ->
				test.deepEqual getOps(data), [submittedOps[1]]
				test.strictEqual error, undefined
				passPart()

	'getOps on an empty document returns null, errormsg', (test) ->
		passPart = makePassPart test, 2
		@model.getOps @name, 0, 0, (data, error) ->
			test.deepEqual data, null
			test.strictEqual error, 'Document does not exist'
			passPart()

		@model.getOps @name, 0, null, (data, error) ->
			test.deepEqual data, null
			test.strictEqual error, 'Document does not exist'
			passPart()
 
	'getOps with a null count returns all the ops': (test) ->
		submittedOps = [{position: 0, text: 'Hi'}, {position: 2, text: ' mum'}]
		applyOps @model, @name, 0, submittedOps.slice(), (error, _) =>
			@model.getOps @name, 0, null, (data, error) ->
				test.deepEqual data.map((d) -> d.op), submittedOps
				test.strictEqual error, undefined
				test.done()
	
	'ops submitted have a metadata object added': (test) ->
		t1 = Date.now()
		@model.applyOp @name, {op:{position: 0, text: 'hi'}, v:0}, (appliedVersion, error) =>
			test.ifError error
			@model.getOps @name, 0, 1, (data) ->
				test.deepEqual data.length, 1
				d = data[0]
				test.deepEqual d.op, {position: 0, text: 'hi'}
				test.strictEqual typeof d.meta, 'object'
				test.ok Date.now() >= d.meta.ts >= t1
				test.done()
	
	'metadata is stored': (test) ->
		@model.applyOp @name, {v:0, op:{position: 0, text: 'hi'}, meta:{blah:'blat'}}, (appliedVersion, error) =>
			@model.getOps @name, 0, 1, (data) ->
				d = data[0]
				test.deepEqual d.op, {position: 0, text: 'hi'}
				test.strictEqual typeof d.meta, 'object'
				test.strictEqual d.meta.blah, 'blat'
				test.done()

	'getVersion on a non-existant doc returns null': (test) ->
		@model.getVersion @unused, (v) ->
			test.strictEqual v, null
			test.done()

	'getVersion on a doc returns its version': (test) ->
		@model.getVersion @name, (v) =>
			test.strictEqual v, 0
			@model.applyOp @name, {v:0, op:{position: 0, text: 'hi'}}, (appliedVersion, error) =>
				test.ifError(error)
				@model.getVersion @name, (v) ->
					test.strictEqual v, 1
					test.done()
	
	'random doc name creates some doc names': (test) ->
		name = (@model.randomDocName() for [1..50])

		for n, i in name
			test.ok n.length > 5
			# Check that names aren't repeated
			test.strictEqual (name.lastIndexOf n), i
		
		test.done()

