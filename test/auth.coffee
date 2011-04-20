# Tests for the authentication & authorization code

testCase = require('nodeunit').testCase
server = require '../src/server'


module.exports = testCase {
	setUp: (callback) ->
		@auth = (client, data) ->

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
		@model = server.createModel options
		callback()
	
	'snapshot allowed if canGetSnapshot calls accept': (test) ->
		@canGetSnapshot = (docName, client, accept, reject) -> accept()

		@model.applyOp @name, {v:0, op:{type:'text'}}, (error, v) ->
			@model.getSnapshot @name, (data) ->

		test.done()
}
