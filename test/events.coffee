# Tests for server/model

testCase = require('nodeunit').testCase

server = require '../src/server'

helpers = require './helpers'
applyOps = helpers.applyOps

# Event tests
module.exports = testCase {
	setUp: (callback) ->
		@model = server.createModel {db:{type:'memory'}}
		@name = 'testingdoc'

		callback()

	'emit events when ops are applied': (test) ->
		expectedVersions = [0...2]
		@model.listen @name, ((v) -> test.strictEqual v, 0), (op_data) ->
			test.strictEqual op_data.v, expectedVersions.shift()
			test.done() if expectedVersions.length == 0

		applyOps @model, @name, 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi'}
			], (error, _) -> test.ifError(error)
	
	'emit transformed events when old ops are applied': (test) ->
		expectedVersions = [0...3]
		@model.listen @name, ((v) -> test.strictEqual v, 0), (op_data) ->
			test.strictEqual op_data.v, expectedVersions.shift()
			test.done() if expectedVersions.length == 0

		applyOps @model, @name, 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi'}
			], (error, _) =>
				test.ifError(error)
				@model.applyOp @name, {v:1, op:{position: 0, text: 'hi2'}}, (error, v) ->
					test.ifError(error)
					test.strictEqual v, 2
	
	'emit events when ops are applied to an existing document': (test) ->
		applyOps @model, @name, 0, [{type: 'simple'}, {position: 0, text: 'Hi'}], (error, _) =>
			test.ifError(error)

			expectedVersions = [2...4]
			@model.listen @name, ((v) -> test.strictEqual v, 2), (op_data) ->
				test.strictEqual op_data.v, expectedVersions.shift()
				test.done() if expectedVersions.length == 0

			applyOps @model, @name, 2, [
					{position: 0, text: 'Hi'}
					{position: 0, text: 'Hi'}
				], (error, _) -> test.ifError(error)

	'emit events with listenFromVersion from before the first version': (test) ->
		expectedVersions = [0...2]
		@model.listenFromVersion @name, 0, (op_data) ->
			test.strictEqual op_data.v, expectedVersions.shift()
			test.done() if expectedVersions.length == 0

		applyOps @model, @name, 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi'}
			], (error, _) -> test.ifError(error)

	'emit events with listenFromVersion from the first version after its been sent': (test) ->
		applyOps @model, @name, 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi'}
			], (error, _) -> test.ifError(error)

		expectedVersions = [0...2]
		@model.listenFromVersion @name, 0, (op_data) ->
			test.strictEqual op_data.v, expectedVersions.shift()
			test.done() if expectedVersions.length == 0
	
	'emit events with listenFromVersion from the current version': (test) ->
		applyOps @model, @name, 0, [{type: 'simple'}, {position: 0, text: 'Hi'}], (error, _) =>
			test.ifError(error)

			expectedVersions = [2...4]
			@model.listenFromVersion @name, 2, (op_data) ->
				test.strictEqual op_data.v, expectedVersions.shift()
				test.done() if expectedVersions.length == 0

			applyOps @model, @name, 2, [
					{position: 0, text: 'Hi'}
					{position: 0, text: 'Hi'}
				], (error, _) -> test.ifError(error)

	'stop emitting events after removeListener is called': (test) ->
		listener = (op_data) =>
			test.strictEqual op_data.v, 0, 'Listener was not removed correctly'
			@model.removeListener @name, listener

		@model.listen @name, ((v) -> test.strictEqual v, 0), listener

		applyOps @model, @name, 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi'}
			], (error, _) ->
				test.ifError(error)
				test.done()

	'stop emitting events after removeListener is called when using listenFromVersion': (test) ->
		listener = (op_data) =>
			test.strictEqual op_data.v, 0, 'Listener was not removed correctly'
			@model.removeListener @name, listener

		applyOps @model, @name, 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi'}
			], (error, _) =>
				test.ifError(error)
				@model.listenFromVersion @name, 0, listener
				test.done()
}


