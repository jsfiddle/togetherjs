# Tests for the databases. This code is tested with all the database implementations.

{testCase} = require 'nodeunit'

createDb = require '../src/server/db'
{makePassPart} = require './helpers'
types = require '../src/types'

newDocName = do ->
  num = 0
  -> "__testing_doc#{num++}"

test = (Db, options) -> testCase
  setUp: (callback) ->
    @name = newDocName()
    @db = new Db options
    @db.delete @name, null, =>
      callback()

  tearDown: (callback) ->
    @db.delete @name, null, =>
      @db.close()
      callback()

  'create doesnt send an error when a document is created': (test) ->
    @db.create @name, {snapshot:null, type:'simple', meta:{}, v:0}, (error) ->
      test.equal error, null
      test.done()

  'create sends an error if the document already exists': (test) ->
    data = {snapshot:null, type:'simple', meta:{}, v:0}
    @db.create @name, data, (error) =>
      @db.create @name, data, (error) ->
        test.strictEqual error, 'Document already exists'
        test.done()

  'Calling create multiple times only results in one successful create': (test) ->
    # So.. It looks like there's a bug in couchdb where before this document is deleted
    # from a previous test run, if you run the tests again you can make create() work twice.
    #
    # In that case, the second create() succeeds.
    #
    # There's not much I can do about it except hope that people give the database a few seconds
    # after calling delete before recreating the document (and have only one person create a document
    # at a time).
    @name += '_' + Math.floor(Math.random() * 10000)
    passPart = makePassPart test, 20

    created = false
    callback = (error) ->
      if error
        test.strictEqual error, 'Document already exists'
      else
        if created
          throw new Error 'Document successfully created multiple times!'
        else
          created = true

      passPart()

    @db.create @name, {snapshot:null, type:'simple', meta:{i}, v:0}, callback for i in [1..20]

  'getSnapshot sends an error for a nonexistant doc': (test) ->
    @db.getSnapshot @name, (error, data) ->
      test.deepEqual error, 'Document does not exist'
      test.equal data, null
      test.done()
  
  'getSnapshot has the type, version and snapshot set when a doc is created': (test) ->
    @db.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      test.equal error, null
      @db.getSnapshot @name, (error, data) ->
        test.equal error, null
        test.deepEqual {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, data
        test.done()
  
  "getSnapshot is updated after calling writeSnapshot()": (test) ->
    @db.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error, dbMeta) =>
      test.equal error, null
      @db.writeSnapshot @name, {snapshot:{str:'yo'}, v:1, meta:{}, type:'simple'}, null, (error) =>
        test.equal error, null
        @db.getSnapshot @name, (error, data, dbMeta) ->
          test.equal error, null
          test.deepEqual data, {snapshot:{str:'yo'}, v:1, meta:{}, type:'simple'}
          test.done()

  "getSnapshot is updated after calling writeSnapshot() with dbMeta": (test) ->
    @db.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error, dbMeta) =>
      test.equal error, null
      @db.writeSnapshot @name, {snapshot:{str:'yo'}, v:1, meta:{}, type:'simple'}, dbMeta, (error, dbMeta) =>
        test.equal error, null
        @db.getSnapshot @name, (error, data, dbMeta) ->
          test.equal error, null
          test.deepEqual data, {snapshot:{str:'yo'}, v:1, meta:{}, type:'simple'}
          test.done()

  "getSnapshot returns dbMeta through the callback": (test) ->
    @db.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error, dbMeta) =>
      test.equal error, null
      @db.getSnapshot @name, (error, data, dbMeta) =>
        test.equal error, null
        @db.writeSnapshot @name, {snapshot:{str:'yo'}, v:1, meta:{}, type:'simple'}, dbMeta, (error, dbMeta) =>
          test.equal error, null
          @db.getSnapshot @name, (error, data, dbMeta) ->
            test.equal error, null
            test.deepEqual data, {snapshot:{str:'yo'}, v:1, meta:{}, type:'simple'}
            test.done()

  'writeOp writes ops to the DB': (test) ->
    @db.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      test.equal error, null
      @db.writeOp @name, {op:{position:0, str:'hi'}, v:0, meta:{}}, (error) =>
        test.equal error, null
        @db.getOps @name, 0, 1, (error, ops) ->
          test.equal error, null
          test.deepEqual ops, [{op:{position:0, str:'hi'}, meta:{}}]
          test.done()
  
  'snapshot is updated when a second op is applied': (test) ->
    @db.create @name, {snapshot:'', type:'text', meta:{}, v:0}, =>
      @db.writeSnapshot @name, {snapshot:'hi', type:'text', v:1, meta:{}}, null, =>
        @db.writeSnapshot @name, {snapshot:'yo hi', type:'text', v:2, meta:{}}, null, =>
          @db.getSnapshot @name, (error, data) ->
            test.deepEqual data, {v:2, snapshot:'yo hi', type:'text', meta:{}}
            test.done()

  'delete a non-existant document sends an error to its callback': (test) ->
    @db.delete @name, null, (error) ->
      test.strictEqual error, 'Document does not exist'
      test.done()

  'delete deletes a document': (test) ->
    passPart = makePassPart test, 3

    @db.create @name, {snapshot:'', v:0, type:'text', meta:{}}, =>
      @db.writeOp @name, {op:[{i:'hi', p:0}], v:0, meta:{}}, =>
        @db.writeSnapshot @name, {snapshot:'hi', type:'text', v:1, meta:{}}, null, =>
          @db.delete @name, null, (error) =>
            test.equal error, null

            @db.getSnapshot @name, (error, data) ->
              test.strictEqual error, 'Document does not exist'
              test.equal data, null
              passPart()
            @db.getOps @name, 0, null, (error, ops) ->
              test.deepEqual ops, []
              passPart()
            @db.delete @name, null, (error) =>
              test.strictEqual error, 'Document does not exist'
              passPart()
 
  'delete with dbMeta set still works': (test) ->
    passPart = makePassPart test, 3

    @db.create @name, {snapshot:'', v:0, type:'text', meta:{}}, (error, dbMeta) =>
      @db.writeOp @name, {op:[{i:'hi', p:0}], v:0, meta:{}}, =>
        @db.writeSnapshot @name, {snapshot:'hi', type:'text', v:1, meta:{}}, dbMeta, (error, dbMeta) =>
          @db.delete @name, dbMeta, (error) =>
            test.equal error, null

            @db.getSnapshot @name, (error, data) ->
              test.strictEqual error, 'Document does not exist'
              test.equal data, null
              passPart()
            @db.getOps @name, 0, null, (error, ops) ->
              test.deepEqual ops, []
              passPart()
            @db.delete @name, null, (error) =>
              test.strictEqual error, 'Document does not exist'
              passPart()
  
  'Calling delete multiple times only results in one successful delete': (test) ->
    passPart = makePassPart test, 20

    @db.create @name, {snapshot:'', v:0, type:'text', meta:{}}, =>
      deleted = false
      callback = (error) ->
        if error
          test.strictEqual 'Document does not exist', error
        else
          if deleted
            throw new Error 'Document successfully deleted multiple times!'
          else
            deleted = true

        passPart()

      # you can use the proper syntax once coffeescript >1.1.2 lands.
      @db.delete @name, null, callback for __ignored in [1..20]

  'delete with no callback doesnt crash': (test) ->
    @db.delete @name
    @db.create @name, {snapshot:'', v:0, type:'text', meta:{}}, =>
      @db.delete @name
      test.done()

  'getOps returns [] for a nonexistant document, with any arguments': (test) ->
    passPart = makePassPart test, 7
    check = (error, ops) ->
      # Either you get back [] or you get an error.
      if error != 'Document does not exist'
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

    @db.create @name, {snapshot:null, type:'simple', meta:{}, v:0}, (error) =>
      test.equal error, null
      @db.getOps @name, 0, 0, check
      @db.getOps @name, 0, 1, check
      @db.getOps @name, 0, 10, check
      @db.getOps @name, 0, null, check
      @db.getOps @name, 10, 10, check
      @db.getOps @name, 10, 11, check
      @db.getOps @name, 10, null, check

  'getOps returns ops': (test) ->
    passPart = makePassPart test, 5

    @db.create @name, {snapshot:null, type:'text', meta:{}, v:0}, (error) =>
      @db.writeOp @name, {op:[{p:0,i:'hi'}], v:0, meta:{}}, =>
        @db.getOps @name, 0, 0, (error, ops) ->
          test.deepEqual ops, []
          passPart()
        @db.getOps @name, 0, 1, (error, ops) ->
          test.deepEqual ops, [{op:[{p:0,i:'hi'}], meta:{}}]
          passPart()
        @db.getOps @name, 0, null, (error, ops) ->
          test.deepEqual ops, [{op:[{p:0,i:'hi'}], meta:{}}]
          passPart()
        @db.getOps @name, 1, 1, (error, ops) ->
          test.deepEqual ops, []
          passPart()
        @db.getOps @name, 1, null, (error, ops) ->
          test.deepEqual ops, []
          passPart()

options = require '../bin/options'
exports.couchdb = test require('../src/server/db/couchdb') if options.db.type == 'couchdb'

try
  require 'redis'
  exports.redis = test require('../src/server/db/redis')

try
if options.db.type == 'pg'
  exports.pg = test require('../src/server/db/pg'), options.db
