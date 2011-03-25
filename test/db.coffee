# Tests for the databases

testCase = require('nodeunit').testCase

createDb = require '../src/server/db'
helpers = require './helpers'
makePassPart = helpers.makePassPart
types = require '../src/types'

newDocName = do ->
	num = 0
	-> "doc#{num++}"

test = (opts) -> testCase {
	setUp: (callback) ->
		@name = newDocName()
		@db = createDb opts
		callback()

	tearDown: (callback) ->
		@db.delete @name
		@db.close()
		callback()

	'getOps returns [] for a new document, with any arguments': (test) ->
		passPart = makePassPart test, 7
		check = (ops) ->
			test.deepEqual ops, []
			passPart()

		@db.getOps @name, 0, 0, check
		@db.getOps @name, 0, 1, check
		@db.getOps @name, 0, 10, check
		@db.getOps @name, 0, null, check
		@db.getOps @name, 10, 10, check
		@db.getOps @name, 10, 11, check
		@db.getOps @name, 10, null, check

	'getOps returns ops': (test) ->
		passPart = makePassPart test, 5

		@db.append @name, {op:{type:'text'}, v:0, meta:{}}, {snapshot:'', type:'text'}, =>
			@db.getOps @name, 0, 0, (ops) ->
				test.deepEqual ops, []
				passPart()
			@db.getOps @name, 0, 1, (ops) ->
				test.deepEqual ops, [{op:{type:'text'}, meta:{}, v:0}]
				passPart()
			@db.getOps @name, 0, null, (ops) ->
				test.deepEqual ops, [{op:{type:'text'}, meta:{}, v:0}]
				passPart()
			@db.getOps @name, 1, 1, (ops) ->
				test.deepEqual ops, []
				passPart()
			@db.getOps @name, 1, null, (ops) ->
				test.deepEqual ops, []
				passPart()

	'getSnapshot returns nothing for a nonexistant doc': (test) ->
		@db.getSnapshot @name, (data) ->
			test.deepEqual data, {v:0, type:null, snapshot:null}
			test.done()
	
	'getVersion returns 0 for a nonexistant doc': (test) ->
		@db.getVersion @name, (v) ->
			test.deepEqual v, 0
			test.done()

	'append appends to the DB': (test) ->
		passPart = makePassPart test, 3

		@db.append @name,
			{op:{type:'text'}, v:0, meta:{}},
			{snapshot:'', type:'text'}, =>
				@db.getOps @name, 0, 1, (ops) ->
					test.deepEqual ops, [{op:{type:'text'}, meta:{}, v:0}]
					passPart()
				@db.getSnapshot @name, (data) ->
					test.deepEqual data, {v:1, snapshot:'', type:'text'}
					passPart()
				@db.getVersion @name, (v) ->
					test.strictEqual v, 1
					passPart()
	
	'snapshot is updated when a second op is applied': (test) ->
		passPart = makePassPart test, 2

		@db.append @name,
			{op:{type:'text'}, v:0, meta:{}},
			{snapshot:'', type:'text'}, =>
				@db.append @name,
					{op:[{i:'hi', p:0}], v:1, meta:{}},
					{snapshot:'hi', type:'text'}, =>
						@db.getSnapshot @name, (data) ->
							test.deepEqual data, {v:2, snapshot:'hi', type:'text'}
							passPart()
						@db.getVersion @name, (v) ->
							test.strictEqual v, 2
							passPart()

	'delete a non-existant document passes false to its callback': (test) ->
		@db.delete @name, (success) ->
			test.strictEqual success, false
			test.done()

	'delete deletes a document': (test) ->
		passPart = makePassPart test, 4

		@db.append @name,
			{op:{type:'text'}, v:0, meta:{}},
			{snapshot:'', type:'text'}, =>
				@db.delete @name, (success) =>
					test.strictEqual success, true
					@db.getVersion @name, (v) ->
						test.strictEqual v, 0
						passPart()
					@db.getSnapshot @name, (data) ->
						test.deepEqual data, {v:0, snapshot:null, type:null}
						passPart()
					@db.getOps @name, 0, null, (ops) ->
						test.deepEqual ops, []
						passPart()
					@db.delete @name, (success) =>
						test.strictEqual success, false
						passPart()
	
	'delete with no callback doesnt crash': (test) ->
		@db.delete @name
		@db.append @name,
			{op:{type:'text'}, v:0, meta:{}},
			{snapshot:'', type:'text'}, =>
				@db.delete @name
				test.done()
}

exports.memory = test {type: 'memory', 'testing': true}
exports.redis = test {type: 'redis', 'testing': true}

