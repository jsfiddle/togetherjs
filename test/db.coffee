# Tests for the databases. This code is tested with all the database implementations.

testCase = require('nodeunit').testCase

createDb = require '../src/server/db'
helpers = require './helpers'
makePassPart = helpers.makePassPart
types = require '../src/types'

newDocName = do ->
  num = 0
  -> "doc#{num++}"

test = (opts) -> testCase
  setUp: (callback) ->
    @name = newDocName()
    @db = createDb opts
    callback()

  tearDown: (callback) ->
    @db.delete @name
    @db.close()
    callback()

  'create evaluates true when a document is called, false when it already exists': (test) ->
    data = {snapshot:null, type:'simple', meta:{}, v:0}
    @db.create @name, data, (error, result) =>
      test.equal error, null
      test.strictEqual result, true
      @db.create @name, data, (error, result) ->
        test.strictEqual error, 'Document already exists'
        test.strictEqual result, false
        test.done()

  'getSnapshot returns null for a nonexistant doc': (test) ->
    @db.getSnapshot @name, (error, data) ->
      test.deepEqual error, 'Document does not exist'
      test.equal data, null
      test.done()
  
  'getSnapshot has the type, version and snapshot set when a doc is created': (test) ->
    data = {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}
    @db.create @name, data, (error, result) =>
      test.equal error, null
      @db.getSnapshot @name, (error, dataout) ->
        test.equal error, null
        test.deepEqual data, dataout
        test.done()
  
  'getVersion sends an error for a nonexistant doc': (test) ->
    @db.getVersion @name, (error, v) ->
      test.strictEqual error, 'Document does not exist'
      test.equal v, null
      test.done()
  
  "getVersion returns a document's version": (test) ->
    data = {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}
    @db.create @name, data, (error, result) =>
      test.equal error, null
      @db.getVersion @name, (error, v) =>
        test.equal error, null
        test.deepEqual v, 0
        @db.append @name, {op:{}, v:0}, {snapshot:{str:'yo'}, v:1, meta:{}, type:'simple'}, =>
          @db.getVersion @name, (error, v) ->
            test.equal error, null
            test.deepEqual v, 1
            test.done()

  'append appends to the DB': (test) ->
    passPart = makePassPart test, 3

    @db.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, =>
      @db.append @name,
        {op:{position:0, str:'hi'}, v:0, meta:{}},
        {snapshot:'hi', type:'text', v:1, meta:{}}, =>
          @db.getOps @name, 0, 1, (error, ops) ->
            test.deepEqual ops, [{op:{position:0, str:'hi'}, meta:{}, v:0}]
            passPart()
          @db.getSnapshot @name, (error, data) ->
            test.deepEqual data, {v:1, snapshot:'hi', type:'text', meta:{}}
            passPart()
          @db.getVersion @name, (error, v) ->
            test.equal error, null
            test.strictEqual v, 1
            passPart()
  
  'snapshot is updated when a second op is applied': (test) ->
    passPart = makePassPart test, 2

    @db.create @name, {snapshot:'', type:'text', meta:{}, v:0}, =>
      @db.append @name,
        {op:[{p:0, i:'hi'}], v:0, meta:{}},
        {snapshot:'hi', type:'text', v:1, meta:{}}, =>
          @db.append @name,
            {op:[{i:'yo ', p:0}], v:1, meta:{}},
            {snapshot:'yo hi', type:'text', v:2, meta:{}}, =>
              @db.getSnapshot @name, (error, data) ->
                test.deepEqual data, {v:2, snapshot:'yo hi', type:'text', meta:{}}
                passPart()
              @db.getVersion @name, (error, v) ->
                test.strictEqual v, 2
                passPart()

  'delete a non-existant document passes false to its callback': (test) ->
    @db.delete @name, (error, success) ->
      test.strictEqual success, false
      test.strictEqual error, 'Document does not exist'
      test.done()

  'delete deletes a document': (test) ->
    passPart = makePassPart test, 4

    @db.create @name, {snapshot:'', v:0, type:'text', meta:{}}, =>
      @db.append @name,
        {op:[{i:'hi', p:0}], v:0, meta:{}},
        {snapshot:'hi', type:'text', v:1}, =>
          @db.delete @name, (error, success) =>
            test.strictEqual success, true
            test.equal error, undefined
            @db.getVersion @name, (error, v) ->
              test.strictEqual error, 'Document does not exist'
              test.equal v, null
              passPart()
            @db.getSnapshot @name, (error, data) ->
              test.strictEqual error, 'Document does not exist'
              test.equal data, null
              passPart()
            @db.getOps @name, 0, null, (error, ops) ->
              test.deepEqual ops, []
              passPart()
            @db.delete @name, (error, success) =>
              test.strictEqual error, 'Document does not exist'
              test.strictEqual success, false
              passPart()
  
  'delete with no callback doesnt crash': (test) ->
    @db.delete @name
    @db.create @name, {snapshot:'', v:0, type:'text', meta:{}}, =>
      @db.delete @name
      test.done()

  'getOps returns [] for a nonexistant document, with any arguments': (test) ->
    passPart = makePassPart test, 7
    check = (error, ops) ->
      test.deepEqual ops, []
      passPart()

    @db.getOps @name, 0, 0, check
    @db.getOps @name, 0, 1, check
    @db.getOps @name, 0, 10, check
    @db.getOps @name, 0, null, check
    @db.getOps @name, 10, 10, check
    @db.getOps @name, 10, 11, check
    @db.getOps @name, 10, null, check

  'getOps returns [] for a new document, with any arguments': (test) ->
    passPart = makePassPart test, 7
    check = (error, ops) ->
      test.deepEqual ops, []
      passPart()

    @db.create @name, {snapshot:null, type:'simple', meta:{}, v:0}, (error, status) =>
      test.strictEqual status, true
      @db.getOps @name, 0, 0, check
      @db.getOps @name, 0, 1, check
      @db.getOps @name, 0, 10, check
      @db.getOps @name, 0, null, check
      @db.getOps @name, 10, 10, check
      @db.getOps @name, 10, 11, check
      @db.getOps @name, 10, null, check

  'getOps returns ops': (test) ->
    passPart = makePassPart test, 5

    @db.create @name, {snapshot:null, type:'text', meta:{}, v:0}, (error, status) =>
      @db.append @name, {op:[{p:0,i:'hi'}], v:0, meta:{}}, {snapshot:'hi', type:'text', v:1}, =>
        @db.getOps @name, 0, 0, (error, ops) ->
          test.deepEqual ops, []
          passPart()
        @db.getOps @name, 0, 1, (error, ops) ->
          test.deepEqual ops, [{op:[{p:0,i:'hi'}], meta:{}, v:0}]
          passPart()
        @db.getOps @name, 0, null, (error, ops) ->
          test.deepEqual ops, [{op:[{p:0,i:'hi'}], meta:{}, v:0}]
          passPart()
        @db.getOps @name, 1, 1, (error, ops) ->
          test.deepEqual ops, []
          passPart()
        @db.getOps @name, 1, null, (error, ops) ->
          test.deepEqual ops, []
          passPart()

exports.memory = test {type: 'memory', 'testing': true}

options = require '../bin/options'
exports.couchdb = test {type: 'couchdb', 'testing': true} if options.db.type == 'couchdb'

try
  require 'redis'
  exports.redis = test {type: 'redis', 'testing': true}

