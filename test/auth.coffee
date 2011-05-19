# Tests for the authentication & authorization code
#
# Auth code hasn't been finished yet. This test isn't run by the standard test
# runner.

testCase = require('nodeunit').testCase
server = require '../src/server'
types = require '../src/types'

module.exports = testCase
	setUp: (callback) ->
		options =
			db: {type: 'memory'}
			auth:
				# Magic message for connecting a client.
				auth: (client, data) => @auth client, data

				# CRUD.
				canCreate: (client, docName, type, meta, result) => @canCreate client, docName, type, meta, result
				canRead: (client, docName, result) => @canRead client, docName, result
				canSubmitOp: (client, docName, opData, result) => @canSubmitOp client, docName, opData, result
				canDelete: (client, docName, result) => @canDelete client, docName, result

		@name = 'testingdoc'
		@unused = 'testingdoc2'

		@model = server.createModel options
		@client = {}
		@model.create @name, 'simple', -> callback()
	
	'getSnapshot allowed if canRead() accepts': (test) ->
		@canRead = (client, docName, result) =>
			test.strictEqual client, @client
			test.strictEqual docName, @name
			result.accept()

		@model.clientGetSnapshot @client, @name, (data, error) ->
			test.deepEqual data, {v:0, snapshot:{str:''}, meta:{}, type:types.simple}
			test.strictEqual error, undefined

			test.expect 4
			test.done()
	
	'getSnapshot disallowed if canRead() rejects': (test) ->
		@canRead = (client, docName, result) -> result.reject()

		@model.clientGetSnapshot @client, @name, (data, error) =>
			test.strictEqual error, 'Forbidden'
			test.deepEqual data, undefined
			test.done()

	'getOps works if canRead() accepts': (test) ->
		@canRead = (client, docName, result) =>
			test.strictEqual client, @client
			test.strictEqual docName, @name
			result.accept()

		@model.applyOp @name, {v:0, op:{position:0, text:'hi'}}, =>
			@model.clientGetOps @client, @name, 0, 1, (data, error) ->
				test.strictEqual data.length, 1
				test.deepEqual data[0].op, {position:0, text:'hi'}
				test.strictEqual error, undefined

				test.expect 5
				test.done()
	
	'getOps returns forbidden if canRead() rejects': (test) ->
		@canRead = (client, docName, result) -> result.reject()

		@model.applyOp @name, {v:0, op:{position:0, text:'hi'}}, =>
			@model.clientGetOps @client, @name, 0, 1, (data, error) ->
				test.strictEqual error, 'Forbidden'
				test.strictEqual data, null
				test.done()

	'getOps returns Document does not exist for documents that dont exist if its allowed': (test) ->
		@canRead = (client, docName, result) -> result.accept()

		@model.clientGetOps @client, @unused, 0, 1, (data, error) ->
			test.strictEqual data, null
			test.strictEqual error, 'Document does not exist'
			test.done()
	
	"getOps returns forbidden for documents that don't exist if it can't read": (test) ->
		@canRead = (client, docName, result) -> result.reject()

		@model.clientGetOps @client, @unused, 0, 1, (data, error) ->
			test.strictEqual data, null
			test.strictEqual error, 'Forbidden'
			test.done()

	'create allowed if canCreate() accept': (test) ->
		@canCreate = (client, docName, type, meta, result) =>
			test.strictEqual client, @client
			test.strictEqual docName, @unused
			test.strictEqual type.name, 'simple'
			test.ok meta
			result.accept()

		@model.clientCreate @client, @unused, 'simple', {}, (result, error) ->
			test.strictEqual result, true
			test.strictEqual error, undefined

			test.expect 6
			test.done()
	
	'create not allowed if canCreate() rejects': (test) ->
		@canCreate = (client, docName, type, meta, result) =>
			result.reject()

		@model.clientCreate @client, @unused, 'simple', {}, (result, error) ->
			test.strictEqual error, 'Forbidden'
			test.strictEqual result, false
			test.done()
	
	'applyOps allowed if canSubmitOps allows': (test) ->
		@canSubmitOp = (client, docName, opData, result) =>
			test.strictEqual client, @client
			test.strictEqual docName, @name
			test.deepEqual opData, {v:0, op:{position:0, text:'hi'}}
			result.accept()

		@model.clientSubmitOp @client, @name, {v:0, op:{position:0, text:'hi'}}, (result, error) =>
			test.strictEqual result, 0
			test.strictEqual error, undefined

			@model.getVersion @name, (v) ->
				test.strictEqual v, 1
				test.expect 6
				test.done()
	
	'applyOps disallowed if canSubmitOps rejects': (test) ->
		@canSubmitOp = (client, docName, opData, result) -> result.reject()

		@model.clientSubmitOp @client, @name, {v:0, op:{position:0, text:'hi'}}, (result, error) =>
			test.strictEqual result, null
			test.strictEqual error, 'Forbidden'

			@model.getVersion @name, (v) ->
				test.strictEqual v, 0
				test.done()
	
	'applyOps on a nonexistant document returns Forbidden if canSubmitOp rejects': (test) ->
		# Its important that information about documents doesn't leak unintentionally.
		@canSubmitOp = (client, docName, opData, result) -> result.reject()

		@model.clientSubmitOp @client, @unused, {v:0, op:{position:0, text:'hi'}}, (result, error) =>
			test.strictEqual result, null
			test.strictEqual error, 'Forbidden'
			test.done()

	'delete works if canDelete allows it': (test) ->
		@canDelete = (client, docName, result) =>
			test.strictEqual client, @client
			test.strictEqual docName, @name
			result.accept()

		@model.clientDelete @client, @name, (result, error) =>
			test.strictEqual result, true
			test.strictEqual error, undefined

			@model.getVersion @name, (v) ->
				# The document should not exist anymore.
				test.strictEqual v, null
				test.expect 5
				test.done()
	
	'delete fails if canDelete does not allow it': (test) ->
		@canDelete = (client, docName, result) -> result.reject()

		@model.clientDelete @client, @name, (result, error) =>
			test.strictEqual result, false
			test.strictEqual error, 'Forbidden'

			@model.getVersion @name, (v) ->
				test.strictEqual v, 0
				test.done()
	
	'delete returns forbidden on a nonexistant document': (test) ->
		@canDelete = (client, docName, result) -> result.reject()

		@model.clientDelete @client, @unused, (result, error) ->
			test.strictEqual result, false
			test.strictEqual error, 'Forbidden'
			test.done()

