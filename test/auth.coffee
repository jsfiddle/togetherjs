# Tests for the authentication & authorization code
#
# Auth code hasn't been finished yet. This test isn't run by the standard test
# runner.

testCase = require('nodeunit').testCase
server = require '../src/server'


module.exports = testCase
	setUp: (callback) ->
		# Magic message for connecting a client.
		@auth = (client, data) ->

		# CRUD.
		@canCreate = (client, docName, type, meta, result) -> result.accept()
		@canRead = (client, docName, result) -> result.accept()
		@canSubmitOp = (client, docName, opData, result) -> result.accept()
		@canDelete = (client, docName, result) -> result.accept()

		options = {
			db: {type: 'memory'}
			auth: {
				auth: (auth) => @auth auth
				canRead: @canRead
				canDelete: (client, docName, result) => @canDelete client, docName, result
				canSubmitOp: (client, docName, opData, result) => @canSubmitOp docName, client, opData, result
			}
		}

		@name = 'testingdoc'
		@unused = 'testingdoc2'

		@model = server.createModel options
		@client = {}
		@model.create @name, 'simple', callback
	
	'getSnapshot allowed if canRead() accepts': (test) ->
		@canRead = (client, docName, result) -> result.accept()

		@model.clientGetSnapshot @client, @name, (data, error) =>
			test.deepEqual data, {v:0, snapshot:{str:''}, meta:{}, type:types.simple}
			test.strictEqual error, undefined
			test.done()

	'getSnapshot disallowed if canRead() rejects': (test) ->
		@canRead = (client, docName, result) -> result.reject()

		@model.clientGetSnapshot @client, @name, (data, error) =>
			test.deepEqual data, undefined
			test.strictEqual error, 'Forbidden'
			test.done()


