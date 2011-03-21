# Tests for server/model

testCase = require('nodeunit').testCase

types = require '../src/types'

server = require '../src/server'
helpers = require './helpers'
applyOps = helpers.applyOps
makePassPart = helpers.makePassPart

# Model tests
module.exports = testCase {
	setUp: (callback) ->
		@model = server.createModel {db:{type:'memory'}}
		@name = 'testingdoc'

		callback()

	'Return null when asked for the snapshot of a new object': (test) ->
		@model.getSnapshot @name, (data) ->
			test.deepEqual data, {v:0, type:null, snapshot:null}
			test.done()

	'Apply a set type op correctly sets the type and version': (test) ->
		@model.applyOp @name, {v:0, op:{type:'simple'}}, (error, appliedVersion) ->
			test.ifError(error)
			test.strictEqual appliedVersion, 0
			test.done()
	
	'Return a fresh snapshot after submitting ops': (test) ->
		@model.applyOp @name, {v:0, op:{type:'simple'}}, (error, appliedVersion) =>
			test.ifError(error)
			test.strictEqual appliedVersion, 0
			@model.getSnapshot @name, (data) =>
				test.deepEqual data, {v:1, type:types.simple, snapshot:{str:''}}

				@model.applyOp @name, {v:1, op:{position: 0, text:'hi'}}, (error, appliedVersion) =>
					test.ifError(error)
					test.strictEqual appliedVersion, 1
					@model.getSnapshot @name, (data) ->
						test.deepEqual data, {v:2, type:types.simple, snapshot:{str:'hi'}}
						test.done()

	'Apply op to future version fails': (test) ->
		@model.applyOp @name, {v:1, op:{}}, (err, result) ->
			test.ok err
			test.done()
	
	'Apply ops at the most recent version': (test) ->
		applyOps @model, @name, 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi '}
				{position: 3, text: 'mum'}
				{position: 3, text: 'to you '}
			], (error, data) ->
				test.strictEqual error, null
				test.strictEqual data.v, 4
				test.deepEqual data.snapshot.str, 'Hi to you mum'
				test.done()
				
	'Apply ops at an old version': (test) ->
		applyOps @model, @name, 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi '}
				{position: 3, text: 'mum'}
			], (error, data) =>
				test.strictEqual error, null
				test.strictEqual data.v, 3
				test.deepEqual data.snapshot.str, 'Hi mum'

				applyOps @model, @name, 2, [
					{position: 2, text: ' to you'}
				], (error, data) ->
					test.strictEqual error, null
					test.strictEqual data.v, 4
					test.deepEqual data.snapshot.str, 'Hi to you mum'
					test.done()
	

	'delete a document when delete is called': (test) ->
		@model.applyOp @name, {v:0, op:{type:'simple'}}, (error, appliedVersion) =>
			test.ifError(error)
			@model.delete @name, (deleted) ->
				test.strictEqual deleted, true
				test.done()
	
	'Pass false to the callback if you delete something that doesn\'t exist': (test) ->
		@model.delete @name, (deleted) ->
			test.strictEqual deleted, false
			test.done()
	
	'getOps returns ops in the document': (test) ->
		submittedOps = [{type: 'simple'}, {position: 0, text: 'Hi'}]
		passPart = makePassPart test, 6

		getOps = (data) -> data.map ((d) -> d.op)

		applyOps @model, @name, 0, submittedOps.slice(), (error, _) =>
			@model.getOps @name, 0, 1, (data) ->
				test.deepEqual getOps(data), [submittedOps[0]]
				passPart()
			@model.getOps @name, 0, 2, (data) ->
				test.deepEqual getOps(data), submittedOps
				passPart()
			@model.getOps @name, 1, 2, (data) ->
				test.deepEqual getOps(data), [submittedOps[1]]
				passPart()
			@model.getOps @name, 2, 3, (data) ->
				test.deepEqual data, []
				passPart()

			# These should be trimmed to just return the version specified
			@model.getOps @name, 0, 1000, (data) ->
				test.deepEqual getOps(data), submittedOps
				passPart()
			@model.getOps @name, 1, 1000, (data) ->
				test.deepEqual getOps(data), [submittedOps[1]]
				passPart()

	'getOps on an empty document returns []': (test) ->
		passPart = makePassPart test, 2
		@model.getOps @name, 0, 0, (data) ->
			test.deepEqual data, []
			passPart()

		@model.getOps @name, 0, null, (data) ->
			test.deepEqual data, []
			passPart()
 
	'getOps with a null count returns all the ops': (test) ->
		submittedOps = [{type: 'simple'}, {position: 0, text: 'Hi'}]
		applyOps @model, @name, 0, submittedOps.slice(), (error, _) =>
			@model.getOps @name, 0, null, (data) ->
				test.deepEqual data.map((d) -> d.op), submittedOps
				test.done()
	
	'ops submitted have a metadata object added': (test) ->
		t1 = Date.now()
		@model.applyOp @name, {v:0, op:{type:'simple'}}, (error, appliedVersion) =>
			@model.getOps @name, 0, 1, (data) ->
				d = data[0]
				test.deepEqual d.op, {type:'simple'}
				test.strictEqual typeof d.meta, 'object'
				test.ok Date.now() >= d.meta.ts >= t1
				test.done()
	
	'metadata is stored': (test) ->
		@model.applyOp @name, {v:0, op:{type:'simple'}, meta:{blah:'blat'}}, (error, appliedVersion) =>
			@model.getOps @name, 0, 1, (data) ->
				d = data[0]
				test.deepEqual d.op, {type:'simple'}
				test.strictEqual typeof d.meta, 'object'
				test.strictEqual d.meta.blah, 'blat'
				test.done()

	'getVersion on a non-existant doc returns 0': (test) ->
		@model.getVersion @name, (v) ->
			test.strictEqual v, 0
			test.done()

	'getVersion on a doc returns its version': (test) ->
		@model.applyOp @name, {v:0, op:{type:'simple'}}, (error, appliedVersion) =>
			test.ifError(error)
			@model.getVersion @name, (v) ->
				test.strictEqual v, 1
				test.done()
}

