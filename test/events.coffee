# Tests for server/model

testCase = require('nodeunit').testCase
assert = require 'assert'

server = require '../src/server'

helpers = require './helpers'
applyOps = helpers.applyOps

# Event tests
module.exports = testCase
	setUp: (callback) ->
		@model = server.createModel {db:{type:'memory'}}
		@name = 'testingdoc'
		@unused = 'nonexistantdoc'

		@model.create @name, 'simple', (status) ->
			assert.ok status
			callback()

	'listen on a nonexistant doc returns null and ignore the document': (test) ->
		@model.listen @unused, (-> throw new Error 'should not receive any ops'), (v, error) =>
			test.strictEqual v, null
			test.strictEqual error, 'Document does not exist'

			@model.create @unused, 'simple', =>
				@model.applyOp @unused, {v:0, op:{position:0, text:'hi'}}, ->
					test.done()
	
	'listen from version on a nonexistant doc returns null and ignores the doc': (test) ->
		@model.listenFromVersion @unused, 0, (-> throw new Error 'should not receive any ops'), (v, error) =>
			test.strictEqual v, null
			test.strictEqual error, 'Document does not exist'

			@model.create @unused, 'simple', =>
				@model.applyOp @unused, {v:0, op:{position:0, text:'hi'}}, ->
					test.done()

	'emit events when ops are applied': (test) ->
		expectedVersions = [0...2]
		listener = (op_data) ->
			test.strictEqual op_data.v, expectedVersions.shift()
			test.done() if expectedVersions.length == 0

		@model.listen @name, listener, (v, error) ->
			test.strictEqual v, 0
			test.strictEqual error, undefined

		applyOps @model, @name, 0, [
				{position:0, text:'A'},
				{position:0, text:'Hi'}
			], (error, _) -> test.ifError(error)
	
	'emit transformed events when old ops are applied': (test) ->
		expectedVersions = [0...3]
		listener = (op_data) ->
			test.strictEqual op_data.v, expectedVersions.shift()
			test.done() if expectedVersions.length == 0

		@model.listen @name, listener, (v, error) ->
			test.strictEqual v, 0
			test.strictEqual error, undefined

		applyOps @model, @name, 0, [
				{position:0, text:'A'},
				{position:0, text:'Hi'}
			], (error, _) =>
				test.ifError(error)
				@model.applyOp @name, {v:1, op:{position:0, text:'hi2'}}, (v, error) ->
					test.strictEqual undefined, error
					test.strictEqual v, 2
	
	'emit events when ops are applied to an existing document': (test) ->
		applyOps @model, @name, 0, [{position:0, text:'A'}, {position:0, text:'Hi'}], (error, _) =>
			test.ifError(error)

			expectedVersions = [2...4]
			listener = (op_data) ->
				test.strictEqual op_data.v, expectedVersions.shift()
				test.done() if expectedVersions.length == 0
			@model.listen @name, listener, (v) -> test.strictEqual v, 2

			applyOps @model, @name, 2, [
					{position:0, text:'Hi'}
					{position:0, text:'Hi'}
				], (error, _) -> test.ifError(error)

	'emit events with listenFromVersion from before the first version': (test) ->
		expectedVersions = [0...2]
		listener = (op_data) ->
			test.strictEqual op_data.v, expectedVersions.shift()
			test.done() if expectedVersions.length == 0

		@model.listenFromVersion @name, 0, listener, (v) -> test.strictEqual v, 0

		applyOps @model, @name, 0, [
				{position:0, text:'A'},
				{position:0, text:'Hi'}
			], (error, _) -> test.ifError(error)

	'emit events with listenFromVersion from the first version after its been sent': (test) ->
		applyOps @model, @name, 0, [
				{position:0, text:'A'},
				{position:0, text:'Hi'}
			], (error, _) -> test.ifError(error)

		expectedVersions = [0...2]
		@model.listenFromVersion @name, 0, (op_data) ->
			test.strictEqual op_data.v, expectedVersions.shift()
			test.done() if expectedVersions.length == 0
	
	'emit events with listenFromVersion from the current version': (test) ->
		applyOps @model, @name, 0, [{position:0, text:'A'}, {position:0, text:'Hi'}], (error, _) =>
			test.ifError(error)

			expectedVersions = [2...4]
			@model.listenFromVersion @name, 2, (op_data) ->
				test.strictEqual op_data.v, expectedVersions.shift()
				test.done() if expectedVersions.length == 0

			applyOps @model, @name, 2, [
					{position:0, text:'Hi'}
					{position:0, text:'Hi'}
				], (error, _) -> test.ifError(error)
	
	'If you listenFromVersion and submit ops in the callback, the listener gets called in the right order': (test) ->
		# Test written in response to a bug found in the wild
		seenv0 = false
		listener = (data) ->
			unless seenv0
				test.deepEqual data.op, {position:0, text:'hi'}
				test.strictEqual data.v, 0
				seenv0 = true
			else
				test.deepEqual data.op, {position:2, text:' there'}
				test.strictEqual data.v, 1
				test.done()

		@model.applyOp @name, {v:0, op:{position:0, text:'hi'}}, =>
			process.nextTick => # I have no idea why I need this process.nextTick, but I do...
				@model.listenFromVersion @name, 0, listener, (result, error) =>
					test.fail error if error
					@model.applyOp @name, {v:1, op:{position:2, text:' there'}}

	'stop emitting events after removeListener is called': (test) ->
		listener = (op_data) =>
			test.strictEqual op_data.v, 0, 'Listener was not removed correctly'
			@model.removeListener @name, listener

		@model.listen @name, listener, ((v) -> test.strictEqual v, 0)

		applyOps @model, @name, 0, [
				{position:0, text:'A'},
				{position:0, text:'Hi'}
			], (error, _) ->
				test.ifError(error)
				test.done()

	'stop emitting events after removeListener is called when using listenFromVersion': (test) ->
		listener = (op_data) =>
			test.strictEqual op_data.v, 0, 'Listener was not removed correctly'
			@model.removeListener @name, listener

		applyOps @model, @name, 0, [
				{position:0, text:'A'},
				{position:0, text:'Hi'}
			], (error, _) =>
				test.ifError(error)
				@model.listenFromVersion @name, 0, listener
				test.done()

