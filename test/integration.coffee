# Integration tests.
#
# These tests open a couple clients which spam the server with ops as
# fast as they can.

testCase = require('nodeunit').testCase

assert = require 'assert'

server = require '../src/server'
types = require '../src/types'

client = require '../src/client'

module.exports = testCase {
	setUp: (callback) ->
		# This is needed for types.text.generateRandomOp
		require './types/text'

		@name = 'testingdoc'
		@server = server {db: {type: 'memory'}}
		@server.listen =>
			port = @server.address().port

			@c1 = new client.Connection 'localhost', port
			@c2 = new client.Connection 'localhost', port

			@c1.open @name, 'text', (@doc1, error) =>
				assert.ok @doc1
				callback() if @doc1 && @doc2

			@c2.open @name, 'text', (@doc2, error) =>
				assert.ok @doc2
				callback() if @doc1 && @doc2

	tearDown: (callback) ->
		@c1.disconnect()
		@c2.disconnect()

		@server.on 'close', callback
		@server.close()

	'ops submitted on one document get sent to another': (test) ->
		[submittedOp, result] = @doc1.type.generateRandomOp @doc1.snapshot
		@doc1.submitOp submittedOp

		@doc2.on 'remoteop', (op) =>
			test.deepEqual op, submittedOp
			test.strictEqual @doc2.snapshot, result
			test.strictEqual @doc2.version, 2
			test.done()

	'randomized op spam test': (test) ->
		opsRemaining = 500

		inflight = 0
		checkSync = null
		maxV = 0

		testSome = =>
			ops = Math.min(Math.floor(Math.random() * 10) + 1, opsRemaining)
			inflight = ops
			opsRemaining -= ops
			
			for k in [0...ops]
				doc = if Math.random() > 0.4 then @doc1 else @doc2
				[op, expected] = @doc1.type.generateRandomOp doc.snapshot

				checkSync = =>
					if inflight == 0 && @doc1.version == @doc2.version == maxV
						# The docs should be in sync.

						# Assert is used here so the test fails immediately if something
						# goes wrong.
						assert.strictEqual @doc1.snapshot, @doc2.snapshot

						if opsRemaining > 0
							testSome()
						else
							test.done()

				doc.submitOp op, ->
					maxV = Math.max(maxV, doc.version)
					inflight--
					checkSync()

		@doc1.on 'remoteop', (op) =>
			maxV = Math.max(maxV, @doc1.version)
			checkSync()
		@doc2.on 'remoteop', (op) =>
			maxV = Math.max(maxV, @doc2.version)
			checkSync()

		testSome()
}
