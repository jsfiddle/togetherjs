# Integration tests.
#
# These tests open a couple clients which spam the server with ops as
# fast as they can.

testCase = require('nodeunit').testCase

assert = require 'assert'

server = require '../src/server'
types = require '../src/types'

client = require '../src/client'

# Open the same document from 2 connections.
# So intense.
doubleOpen = (c1, c2, docName, type, callback) ->
	doc1 = doc2 = undefined

	c1.open docName, type, (d, error) ->
		doc1 = d
		assert.ok doc1
		callback doc1, doc2 if doc1 && doc2

	c2.open docName, type, (d, error) ->
		doc2 = d
		assert.ok doc2
		callback doc1, doc2 if doc1 && doc2

module.exports = testCase
	setUp: (callback) ->
		# This is needed for types.text.generateRandomOp
		require './types/text'

		@name = 'testingdoc'
		@server = server {db: {type: 'memory'}}
		@server.listen =>
			port = @server.address().port

			@c1 = new client.Connection "http://localhost:#{port}/sjs"
			@c1.on 'connect', =>
				@c2 = new client.Connection "http://localhost:#{port}/sjs"
				@c2.on 'connect', =>
					callback()

	tearDown: (callback) ->
		@c1.disconnect()
		@c2.disconnect()

		@server.on 'close', callback
		@server.close()

	'ops submitted on one document get sent to another': (test) ->
		doubleOpen @c1, @c2, @name, 'text', (doc1, doc2) ->
			[submittedOp, result] = doc1.type.generateRandomOp doc1.snapshot
			doc1.submitOp submittedOp

			doc2.on 'remoteop', (op) =>
				test.deepEqual op, submittedOp
				test.strictEqual doc2.snapshot, result
				test.strictEqual doc2.version, 1
				test.done()

	'JSON documents work': (test) ->
		doubleOpen @c1, @c2, 'jsondocument', 'json', (doc1, doc2) ->
			test.strictEqual doc1.snapshot, null
			test.strictEqual doc1.version, 0
			test.strictEqual doc2.snapshot, null
			test.strictEqual doc2.version, 0
			test.ok doc1.created != doc2.created

			doc1.submitOp [{p:[], od:null, oi:{}}]

			doc2.on 'remoteop', (op) ->
				test.deepEqual doc2.snapshot, {}
				test.done()

	'randomized op spam test': (test) ->
		doubleOpen @c1, @c2, @name, 'text', (doc1, doc2) =>
			opsRemaining = 500

			inflight = 0
			checkSync = null
			maxV = 0

			testSome = =>
				ops = Math.min(Math.floor(Math.random() * 10) + 1, opsRemaining)
				inflight = ops
				opsRemaining -= ops
				
				for k in [0...ops]
					doc = if Math.random() > 0.4 then doc1 else doc2
					[op, expected] = doc1.type.generateRandomOp doc.snapshot

					checkSync = =>
						if inflight == 0 && doc1.version == doc2.version == maxV
							# The docs should be in sync.

							# Assert is used here so the test fails immediately if something
							# goes wrong.
							assert.strictEqual doc1.snapshot, doc2.snapshot

							if opsRemaining > 0
								testSome()
							else
								test.done()

					doc.submitOp op, ->
						maxV = Math.max(maxV, doc.version)
						inflight--
						checkSync()

			doc1.on 'remoteop', (op) =>
				maxV = Math.max(maxV, doc1.version)
				checkSync()
			doc2.on 'remoteop', (op) =>
				maxV = Math.max(maxV, doc2.version)
				checkSync()

			testSome()

	# TODO: Add a randomized tester which also randomly denies ops.

