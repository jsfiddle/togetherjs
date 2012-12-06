# Tests for server/model
#
# There used to be a lot of logic in model (which these tests verified). That logic has since
# been moved into the db manager and it has separate tests. - So, most of these tests are
# redundant and can probably be deleted.
#
# The auth stuff (which the model *does* do) has a separate test suite (/test/auth.coffee).

assert = require 'assert'
testCase = require('nodeunit').testCase

types = require '../src/types'

server = require '../src/server'
Model = require '../src/server/model'
{applyOps, makePassPart} = require './helpers'

newDocName = do -> num = 0; -> "doc#{num++}"
newTestId = do -> num = 0; -> "test #{num++}"

# Model tests
genTests = (async) -> testCase
  setUp: (callback) ->
    @name = newDocName()

    # Set up db mocks. I wonder if I should use a mocking library for this..?
    @db = {}
    functions = ['getOps', 'create', 'delete', 'writeOp', 'writeSnapshot', 'getSnapshot', 'getVersion', 'close']

    id = newTestId()
    for functionName in functions
      @db[functionName] = do (functionName) -> -> throw new Error "Unexpected call to #{functionName} in #{id}"

    # So tests can override the database object completely (eg, set it null to simulate an in-memory
    # database)
    @setDb = (db) =>
      @db = db
      @model = new Model db, reapTime: 10, numCachedOps: 2, opsBeforeCommit: 2, maximumAge: 2

    # Most of this gubbins isn't needed. I added it here to track down an exception which was being
    # thrown -between- tests during async mode.
    if async
      # ... I want to make sure the callback doesn't use @db from a future test when it gets called.
      thisdb = @db
      # The *real* database is the same as db, but asynchronously calls all its functions.
      db = {}
      for functionName in functions
        # Basically, the actual database we use is a proxy to @db which calls the real database function in
        # process.nextTick.
        db[functionName] = do (functionName) -> (args...) ->
          error = new Error
          setTimeout (->
              try
                thisdb[functionName].apply null, args
              catch e
                console.warn error.stack
                throw e
            ), 4
      @setDb db
    else
      @setDb @db

    callback()

  tearDown: (callback) ->
    if @db
      # During cleanup, the database calls writeSnapshot on all still-open documents.
      @db.close = ->
      @db.writeSnapshot = (docName, docData, dbMeta, callback) -> callback()

    @model.flush callback

  # *** Tests for create

  'create creates in the DB': (test) ->
    @db.create = (docName, data, callback) =>
      test.strictEqual docName, @name
      test.deepEqual data, {snapshot:{str:''}, type:'simple', meta:{}, v:0}
      callback null, {'metablag': true} # <-- dbMeta

    @model.create @name, 'simple', {}, (error) ->
      test.equal error, null
      test.expect 3
      test.done()

  'create without a meta argument works': (test) ->
    @db.create = (docName, data, callback) =>
      test.strictEqual docName, @name
      test.deepEqual data, {snapshot:{str:''}, type:'simple', meta:{}, v:0}
      callback()

    @model.create @name, 'simple', (error) ->
      test.equal error, null
      test.expect 3
      test.done()

  'create with a type literal works': (test) ->
    @db.create = (docName, data, callback) =>
      test.strictEqual docName, @name
      test.deepEqual data, {snapshot:{str:''}, type:'simple', meta:{}, v:0}
      callback()

    @model.create @name, types.simple, (error) ->
      test.equal error, null
      test.expect 3
      test.done()

  'Errors in create are passed to the caller': (test) ->
    @db.create = (docName, data, callback) =>
      callback 'invalid tubes!'

    @model.create @name, 'simple', {}, (error) ->
      test.strictEqual error, 'invalid tubes!'
      test.done()

  'If the database is null, create still works': (test) ->
    @setDb null

    @model.create @name, 'simple', {}, (error) ->
      test.equal error, null
      test.done()

  'create caches the document data': (test) ->
    @db.create = (docName, data, callback) => callback()

    @model.create @name, 'simple', {}, (error) =>
      @model.getSnapshot @name, (error, data) =>
        test.deepEqual data, {snapshot:{str:''}, type:types.simple, meta:{}, v:0}

        @model.getVersion @name, (error, version) ->
          test.strictEqual version, 0
          test.done()

  'create caches the document data even if the db is null': (test) ->
    @setDb null

    @model.create @name, 'simple', {}, (error) =>
      @model.getSnapshot @name, (error, data) =>
        test.deepEqual data, {snapshot:{str:''}, type:types.simple, meta:{}, v:0}
        test.done()
  
  "if there is an error in db.create, the document isn't cached": (test) ->
    @db.create = (docName, data, callback) =>
      callback 'invalid tubes!'
    @db.getSnapshot = (docName, callback) =>
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @model.create @name, 'simple', {}, (error) =>
      @model.getSnapshot @name, (error, data) ->
        test.equal error, null
        test.deepEqual data, {snapshot:{str:'hi'}, type:types.simple, meta:{}, v:0}
        test.done()

  "If create is given a type name that doesn't exist, it sends an error": (test) ->
    @model.create @name, 'does not exist', (error) ->
      test.strictEqual error, 'Type not found'
      test.done()

  "Metadata is sent to the database": (test) ->
    @db.create = (docName, data, callback) =>
      test.ok data.meta
      test.strictEqual data.meta.foo, 'bar'
      callback()

    @model.create @name, 'simple', {foo:'bar'}, (error) =>
      test.done()


  # *** Tests for getSnapshot and getVersion

  "getSnapshot() data is passed from the database": (test) ->
    @db.getSnapshot = (docName, callback) ->
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{foo:5}, v:100}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @model.getSnapshot @name, (error, data) ->
      test.equal error, null
      test.deepEqual data, {snapshot:{str:'hi'}, type:types.simple, meta:{foo:5}, v:100}
      test.done()

  "getSnapshot() propogates errors from the database": (test) ->
    @db.getSnapshot = (docName, callback) ->
      callback 'invalid tubes!'

    @model.getSnapshot @name, (error, data) ->
      test.strictEqual error, 'invalid tubes!'
      test.equal data, null
      test.done()

  "If the database returns an error, the doc isn't cached or anything weird": (test) ->
    @db.getSnapshot = (docName, callback) =>
      callback 'invalid tubes!'

    @model.getSnapshot @name, (error, data) =>
      test.strictEqual error, 'invalid tubes!'
      test.equal data, null

      # The next call should succeed.
      @db.getSnapshot = (docName, callback) =>
        callback null, {snapshot:{str:'hi'}, type:'simple', meta:{foo:5}, v:100}
      @db.getOps = (docName, start, end, callback) -> callback null, []

      @model.getSnapshot @name, (error, data) ->
        test.equal error, null
        test.deepEqual data, {snapshot:{str:'hi'}, type:types.simple, meta:{foo:5}, v:100}
        test.done()

  "If getSnapshot() returns a type name that doesn't exist, we return an error": (test) ->
    @db.getSnapshot = (docName, callback) ->
      callback null, {snapshot:{str:'hi'}, type:'does not exist', meta:{}, v:0}
    
    @model.getSnapshot @name, (error, data) ->
      test.strictEqual error, 'Type not found'
      test.done()

  "getSnapshot() data is cached": (test) ->
    @db.getSnapshot = (docName, callback) =>
      # Called twice = bad.
      @db.getSnapshot = -> throw new Error 'getSnapshot data should have been cached'

      # but the first time, send the data
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{foo:5}, v:0}

    @db.getOps = (docName, start, end, callback) =>
      @db.getOps = -> throw new Error 'getSnapshot data should have been cached'
      callback null, []

    @model.getSnapshot @name, =>
      @model.getSnapshot @name, ->
        test.done()

  "if the db is null and there's no cached data, getSnapshot() raises an error": (test) ->
    @setDb null

    @model.getSnapshot @name, (error, data) ->
      test.strictEqual error, 'Document does not exist'
      test.equal data, null
      test.done()

  'Multiple simultaneous calls to getSnapshot and getVersion only result in one getSnapshot call on the database': (test) ->
    @db.getSnapshot = (docName, callback) =>
      @db.getSnapshot = -> throw new Error 'getSnapshot should only be called once'
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{foo:5}, v:100}

    @db.getOps = (docName, start, end, callback) =>
      @db.getOps = -> throw new Error 'getOps should only be called once'
      callback null, []

    passPart = makePassPart test, 10
    check = (expectedData) -> (error, data) ->
      test.deepEqual data, expectedData
      passPart()

    # This code can use the nice syntax once coffeescript >1.1.2 lands.
    @model.getSnapshot @name, check({snapshot:{str:'hi'}, type:types.simple, meta:{foo:5}, v:100}) for __ignored in [1..5]
    @model.getVersion @name, check(100) for __ignored in [1..5]

  'if create is passed a type literal and theres no database, getSnapshot still returns type literals': (test) ->
    # Awhile ago, the type literal stuff was quite buggy.
    @setDb null

    @model.create @name, types.simple, (error) =>
      @model.getSnapshot @name, (error, data) ->
        test.deepEqual data, {snapshot:{str:''}, type:types.simple, meta:{}, v:0}
        test.done()

  'getSnapshot catches up the document with all recent ops': (test) ->
    # The database might contain an old snapshot. Calling getSnapshot() on the model calls getOps()
    # in the database and does catchup before returning.
    @db.getSnapshot = (docName, callback) =>
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{foo:5}, v:1}

    @db.getOps = (docName, start, end, callback) =>
      test.strictEqual docName, @name
      test.strictEqual start, 1
      test.strictEqual end, null
      callback null, [{op:{position:2, text:' there'}, meta:{}}, {op:{position:8, text:' mum'}, meta:{}}]

    @model.getSnapshot @name, (error, data) =>
      test.equal error, null
      test.deepEqual data, {snapshot:{str:'hi there mum'}, type:types.simple, meta:{foo:5}, v:3}
      test.done()

  'getVersion passes errors from db.getSnapshot': (test) ->
    @db.getSnapshot = (docName, callback) -> callback 'Invalid weboplex'

    @model.getVersion @name, (error, version) ->
      test.strictEqual error, 'Invalid weboplex'
      test.equal version, null
      test.done()

  'getVersion works correctly even if the db snapshot is old': (test) ->
    @db.getSnapshot = (docName, callback) =>
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:1}

    @db.getOps = (docName, start, end, callback) =>
      test.strictEqual docName, @name
      test.strictEqual start, 1
      test.strictEqual end, null
      callback null, [{op:{position:2, text:' there'}, meta:{}}, {op:{position:8, text:' mum'}, meta:{}}]

    @model.getVersion @name, (error, version) ->
      test.equal error, null
      test.deepEqual version, 3
      test.done()

  # *** Tests for delete

  "db.delete is called on delete": (test) ->
    @db.delete = (docName, dbMeta, callback) =>
      test.strictEqual docName, @name
      test.equal dbMeta, null
      callback()

    @model.delete @name, (error) ->
      test.equal error, null
      test.done()

  "delete errors are propogated": (test) ->
    @db.delete = (docName, dbMeta, callback) ->
      callback "invalid tubes!"

    @model.delete @name, (error) ->
      test.strictEqual error, "invalid tubes!"
      test.done()
  
  'Deleting a nonexistant document with no database raises an error': (test) ->
    @setDb null

    @model.delete @name, (error) ->
      test.strictEqual error, 'Document does not exist'
      test.done()

  "delete removes any cached data": (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.delete = (docName, dbMeta, callback) -> callback()

    called = false
    @db.getSnapshot = (docName, callback) =>
      called = true
      callback 'Document does not exist'

    @model.create @name, 'simple', (error) =>
      @model.delete @name, (error) =>
        @model.getSnapshot @name, ->
          test.strictEqual called, true
          test.done()

  "delete removes any cached data if db is null": (test) ->
    @setDb null

    @model.create @name, 'simple', (error) =>
      @model.delete @name, (error) =>
        test.equal error, null
        @model.getSnapshot @name, (error, data) ->
          test.strictEqual error, 'Document does not exist'
          test.equal data, null
          test.done()

  "dbMeta is passed from create() to delete": (test) ->
    @db.create = (docName, data, callback) ->
      callback null, {db:'meta'}

    @db.delete = (docName, dbMeta, callback) ->
      test.deepEqual dbMeta, {db:'meta'}
      callback()

    @model.create @name, 'simple', (error) =>
      @model.delete @name, (error) =>
        test.done()
  
  # *** Tests for applyOp

  'applyOp updates the document snapshot': (test) ->
    @db.writeOp = (docName, opData, callback) -> callback()

    @db.getSnapshot = (docName, callback) -> callback null, {snapshot:{str:'hello'}, type:'simple', meta:{}, v:100}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @model.applyOp @name, {v:100, op:{position:5, text:' world'}, meta:{}}, (error, v) =>
      test.equal error, null
      test.strictEqual v, 100
      @model.getSnapshot @name, (error, data) ->
        test.deepEqual data, {snapshot:{str:'hello world'}, type:types.simple, meta:{}, v:101}
        test.done()

  'applyOp ignores irrelevant dupIfSource:[...] arguments in op data': (test) ->
    @db.writeOp = (docName, opData, callback) -> callback()

    @db.getSnapshot = (docName, callback) -> callback null, {snapshot:{str:'hello'}, type:'simple', meta:{}, v:100}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @model.applyOp @name, {v:100, op:{position:5, text:' world'}, meta:{}, dupIfSource:['ignore']}, (error, v) =>
      test.equal error, null
      test.strictEqual v, 100
      test.done()
  
  'applyOp rejects ops with a missing version': (test) ->
    @db.getSnapshot = (docName, callback) -> callback null, {snapshot:{str:'hello'}, type:'simple', meta:{}, v:100}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @model.applyOp @name, {op:{position:5, text:' world'}, meta:{}}, (error, v) =>
      test.strictEqual error, 'Version missing'
      test.equal v, null
      test.done()

  'applyOp returns an error if the version number is too high': (test) ->
    @db.getSnapshot = (docName, callback) -> callback null, {snapshot:{str:'hello'}, type:'simple', meta:{}, v:100}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @model.applyOp @name, {v:101, op:{position:5, text:' world'}, meta:{}}, (error, v) =>
      test.strictEqual error, 'Op at future version'
      test.equal v, null
      test.done()

  "applyOp rejects ops if they're too old": (test) ->
    @db.getSnapshot = (docName, callback) -> callback null, {snapshot:{str:'hello'}, type:'simple', meta:{}, v:100}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    # The maximum age is overridden above to 2.
    @model.applyOp @name, {v:97, op:{position:5, text:' world'}, meta:{}}, (error, v) =>
      test.strictEqual error, 'Op too old'
      test.equal v, null
      test.done()

  'applyOp rejects duplicate ops using dupIfSource:[...]': (test) ->
    @db.getSnapshot = (docName, callback) -> callback null, {snapshot:{str:'hello'}, type:'simple', meta:{}, v:100}
    @db.getOps = (docName, start, end, callback) ->
      callback null, [{op:{position:2, text:' there'}, meta:{source:'user1'}}]

    @model.applyOp @name, {v:100, op:{position:5, text:' world'}, meta:{}, dupIfSource:['ignored', 'user1']}, (error, v) =>
      test.strictEqual error, 'Op already submitted'
      test.equal v, null
      test.done()

  'applyOp calls writeOp': (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.writeOp = (docName, opData, callback) =>
      test.strictEqual docName, @name
      delete opData.meta.ts
      test.deepEqual opData, {v:0, op:{position:0, text:'hi'}, meta:{}}
      callback()

    @model.create @name, 'simple', (error) =>
      @model.applyOp @name, {v:0, op:{position:0, text:'hi'}, meta:{}}, (error, v) =>
        test.equal error, null
        test.strictEqual v, 0
        test.expect 4
        test.done()

  "applyOp propogates errors from getSnapshot": (test) ->
    @db.getSnapshot = (docName, callback) -> callback 'Internal database error'

    @model.applyOp @name, {v:0, op:{foo:'bar'}}, (error, v) =>
      test.strictEqual error, 'Internal database error'
      test.equal v, null
      test.done()

  "applyOp sends document does not exist when the document isnt cached and theres no db": (test) ->
    @setDb null

    @model.applyOp @name, {v:0, op:{foo:'bar'}}, (error, v) =>
      test.strictEqual error, 'Document does not exist'
      test.equal v, null
      test.done()
  
  "applyOp propogates errors and aborts if the op is invalid": (test) ->
    @db.create = (docName, data, callback) -> callback()
    # db.writeOp shouldn't be called.

    @model.create @name, 'simple', (error) =>
      @model.applyOp @name, {v:0, op:{position:-100}, meta:{}}, (error, v) =>
        test.strictEqual error, 'Invalid position'
        test.equal v, null
        @model.getSnapshot @name, (error, data) ->
          test.deepEqual data, {snapshot:{str:''}, type:types.simple, meta:{}, v:0}
          test.done()

  "applyOp propogates errors from writeOp and doesn't cache": (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.writeOp = (docName, opData, callback) -> callback 'intersplat'

    @model.create @name, 'simple', (error) =>
      @model.applyOp @name, {v:0, op:{position:0, text:'hi'}, meta:{}}, (error, v) =>
        test.strictEqual error, 'intersplat'
        test.equal v, null

        # The cached snapshot shouldn't have been modified
        @model.getSnapshot @name, (error, data) ->
          test.deepEqual data, {snapshot:{str:''}, type:types.simple, meta:{}, v:0}
          test.done()

  "writeSnapshot is called after the specified number of ops are appended": (test) ->
    # In this case, 2!
    @db.create = (docName, data, callback) -> callback()
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.writeSnapshot = (docName, data, dbMeta, callback) =>
      test.strictEqual docName, @name
      test.deepEqual data, {snapshot:{str:'ab'}, type:'simple', meta:{}, v:2}
      test.equal dbMeta, null
      callback()
      test.done()

    @model.create @name, 'simple', (error) =>
      @model.applyOp @name, {v:0, op:{position:0, text:'a'}, meta:{}}, (error, v) =>
        @model.applyOp @name, {v:1, op:{position:1, text:'b'}, meta:{}}, (error, v) =>
          # This callback is called *before* writeSnapshot, so test.done() has to go in the callback above.
          test.equal error, null
          test.expect 4

  "writeSnapshot is not called again for a little while afterwards": (test) ->
    # Basically, this test makes sure the internal committed version field is updated.
    @db.create = (docName, data, callback) -> callback()
    @db.writeOp = (docName, opData, callback) -> callback()

    # writeSnapshot should be called exactly twice, once at version 2 then at version 4.
    @db.writeSnapshot = (docName, data, dbMeta, callback) =>
      test.strictEqual data.v, 2
      @db.writeSnapshot = (docName, data, dbMeta, callback) =>
        test.strictEqual data.v, 4
        @db.writeSnapshot = (docName, data, dbMeta, callback) => throw new Error 'writeSnapshot called too many times'
        callback()

      callback()

    op = (v) -> {v, op:{position:v, text:"#{v}"}, meta:{}}

    @model.create @name, 'simple', (error) =>
      @model.applyOp @name, op(0), (error) =>
        @model.applyOp @name, op(1), (error) =>
          process.nextTick => @model.applyOp @name, op(2), (error) =>
            process.nextTick => @model.applyOp @name, op(3), (error) =>
              process.nextTick => @model.applyOp @name, op(4), (error) =>
                test.done()

  "writeSnapshot isn't called just because the version number is high": (test) ->
    # This test was written in response to an actual bug

    # writeSnapshot should not be called by this test, because obviously the document has been
    # saved at version 100.
 
    @db.getSnapshot = (docName, callback) ->
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:100}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @db.writeOp = (docName, opData, callback) -> callback()

    @model.applyOp @name, {v:100, op:{position:0, text:'a'}, meta:{}}, (error) =>
      test.equal error, null
      test.done()

  "dbMeta is passed from create() to writeSnapshot": (test) ->
    # I could do this in the test above, but I'd like to make sure both code paths work.
    @db.create = (docName, data, callback) -> callback null, {db:'meta'}
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.writeSnapshot = (docName, data, dbMeta, callback) =>
      test.deepEqual dbMeta, {db:'meta'}
      test.done()

    @model.create @name, 'simple', (error) =>
      @model.applyOp @name, {v:0, op:{position:0, text:'a'}, meta:{}}, (error, v) =>
        @model.applyOp @name, {v:1, op:{position:1, text:'b'}, meta:{}}, (error, v) =>

  "With no database, writing a few ops doesn't make the model freik out or anything": (test) ->
    @setDb null

    op = (v) -> {v, op:{position:v, text:"#{v}"}, meta:{}}

    @model.create @name, 'simple', (error) =>
      test.equal error, null
      @model.applyOp @name, op(0), (error, v) =>
        test.equal error, null
        test.strictEqual v, 0
        @model.applyOp @name, op(1), (error, v) =>
          test.equal error, null
          test.strictEqual v, 1
          process.nextTick => @model.applyOp @name, op(2), (error, v) =>
            test.equal error, null
            test.strictEqual v, 2
            process.nextTick => @model.applyOp @name, op(3), (error, v) =>
              test.equal error, null
              test.strictEqual v, 3
              process.nextTick => @model.applyOp @name, op(4), (error, v) =>
                test.equal error, null
                test.strictEqual v, 4
                test.done()

  # *** Tests for meta ops
  ###
  'New documents have a creation time set': (test) ->

  'The last modified time is updated when ops are applied to a document': (test) ->

  'Creation time and last modified time are saved in the database': (test) ->

  'New clients are added to the document metadata': (test) ->

  'When a client disconnects, their session is removed from the document metadata': (test) ->




  'A meta op set is applied': (test) ->
    @model.create @name, 'simple', (error) =>


  'Applying a metadata op to a nonexistant document has no effect': (test) ->


  'A metadata op applied to an old version is transformed': (test) ->

  'A metadata op applied to a future version is rejected': (test) ->
  ###

  # *** Tests for getOps

  "Calling getOps() directly when there's no cached data calls the database": (test) ->
    @db.getOps = (docName, start, end, callback) =>
      test.strictEqual start, 100
      test.strictEqual end, 102
      test.strictEqual docName, @name
      # These aren't valid ops, but it really doesn't matter.
      # Note that v isn't defined in the data returned from the database. The model re-adds versions from
      # context.
      callback null, [{op:[100], meta:{}}, {op:[101], meta:{}}, {op:[102], meta:{}}]

    @model.getOps @name, 100, 102, (error, ops) ->
      test.equal error, null
      test.deepEqual ops, [{v:100, op:[100], meta:{}}, {v:101, op:[101], meta:{}}, {v:102, op:[102], meta:{}}]
      test.done()

  'getOps passes errors to the callback': (test) ->
    @db.getOps = (docName, start, end, callback) -> callback 'blargh death'

    @model.getOps @name, 100, 102, (error, ops) ->
      test.strictEqual error, 'blargh death'
      test.equal ops, null
      test.done()
  
  "getOps() with no db and no cached data returns an error": (test) ->
    @setDb null

    @model.getOps @name, 100, 102, (error, ops) ->
      test.strictEqual error, 'Document does not exist'
      test.done()

  "getOps() with no db and cached data can return the cached data": (test) ->
    passPart = makePassPart test, 4
    op = (v) -> {v, op:{position:v, text:"#{v}"}, meta:{}}

    @setDb null

    @model.create @name, 'simple', (error) =>
      @model.applyOp @name, op(0), (error) =>
        @model.applyOp @name, op(1), (error) =>
          @model.applyOp @name, op(2), (error) =>
            @model.getOps @name, 0, 3, (error, data) =>
              test.equal error, null
              delete o.meta.ts for o in data
              test.deepEqual data, [(op 0), (op 1), (op 2)]
              passPart()

            @model.getOps @name, 0, 2, (error, data) =>
              test.equal error, null
              delete o.meta.ts for o in data
              test.deepEqual data, [(op 0), (op 1)]
              passPart()

            @model.getOps @name, 1, 3, (error, data) =>
              test.equal error, null
              delete o.meta.ts for o in data
              test.deepEqual data, [(op 1), (op 2)]
              passPart()

            @model.getOps @name, 2, 3, (error, data) ->
              test.equal error, null
              delete o.meta.ts for o in data
              test.deepEqual data, [(op 2)]
              passPart()

  "getOps sends an error if the document doesn't exist with no db": (test) ->
    @setDb null

    @model.getOps @name, 0, null, (error, data) ->
      test.strictEqual error, 'Document does not exist'
      test.equal data, null
      test.done()

  # *** Test model.flush()

  'flush with no documents open does nothing': (test) ->
    @model.flush -> test.done()
  
  "flush doesn't need a callback": (test) ->
    @model.flush()
    test.done()

  'flush with a document thats just been created (and hence is in the DB) does nothing': (test) ->
    @db.create = (docName, data, callback) -> callback()

    @model.create @name, 'simple', (error) =>
      @model.flush ->
        test.done()

  "flush with a document that hasn't been edited does nothing": (test) ->
    @db.getSnapshot = (docName, callback) ->
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:100}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @model.getSnapshot @name, (error, data) =>
      @model.flush ->
        test.done()

  "flush calls writeSnapshot on open, edited documents": (test) ->
    @db.create = (docName, data, callback) -> callback null, {db:'meta'}
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.getOps = (docName, start, end, callback) -> callback null, []

    snapshotWritten = false
    @db.writeSnapshot = (docName, data, dbMeta, callback) =>
      test.strictEqual docName, @name
      test.deepEqual data, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:1}
      test.deepEqual dbMeta, {db:'meta'}
      snapshotWritten = true
      callback()

    @model.create @name, 'simple', (error) =>
      @model.applyOp @name, {v:0, op:{position:0, text:'hi'}, meta:{}}, (error) =>
        @model.flush ->
          test.strictEqual snapshotWritten, true
          test.done()

  "flushing a document which has already been flushed does nothing": (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.writeSnapshot = (docName, data, dbMeta, callback) =>
      # First time ok, second time not ok.
      @db.writeSnapshot = (docName, data, dbMeta, callback) ->
        throw new Error "Snapshot already saved"
      
      callback()

    @model.create @name, 'simple', (error) =>
      @model.applyOp @name, {v:0, op:{position:0, text:'hi'}, meta:{}}, (error) =>
        @model.applyOp @name, {v:1, op:{position:2, text:' there'}, meta:{}}, (error) =>
          # This callback is called *before* writeSnapshot, so test.done() has to go in the callback above.
          test.equal error, null

          @model.flush =>
            @model.flush ->
              test.done()

  "flush with no database does nothing": (test) ->
    @setDb null

    @model.create @name, 'simple', (error) =>
      @model.applyOp @name, {v:0, op:{position:0, text:'hi'}, meta:{}}, (error) =>
        @model.flush ->
          test.done()


  # *** Tests that the caching works correctly

  'With no listeners, documents are reaped': (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.getOps = (docName, start, end, callback) -> callback null, []

    called = false
    @db.getSnapshot = (docName, callback) ->
      called = true
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}

    @model.create @name, 'simple', {}, (error) =>
      setTimeout =>
          @model.getSnapshot @name, (error, data) ->
            test.deepEqual data, {snapshot:{str:'hi'}, type:types.simple, meta:{}, v:0}
            test.strictEqual called, true
            test.done()
        , 15

  'A snapshot is flushed to the database when the document is reaped': (test) ->
    @db.getSnapshot = (docName, callback) ->
      called = true
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:100}, {db:'meta'}
    @db.getOps = (docName, start, end, callback) -> callback null, []
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.writeSnapshot = (docName, data, dbMeta, callback) =>
      test.strictEqual docName, @name
      test.deepEqual data, {snapshot:{str:'xhi'}, type:'simple', meta:{}, v:101}
      test.deepEqual dbMeta, {db:'meta'}
      callback()

    @model.applyOp @name, {v:100, op:{position:0, text:'x'}, meta:{}}, (error) =>
      setTimeout =>
          # At this point, writeSnapshot should have been called.
          test.expect 3
          test.done()
        , 15

  'When listeners are attached, documents are not reaped': (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.getSnapshot = (docName, callback) -> throw new Error 'The object should still be cached'

    @model.create @name, 'simple', {}, (error) =>
      @model.listen @name, (->), (error, v) =>
        test.equal error, null
        test.strictEqual v, 0

        setTimeout =>
            @model.getSnapshot @name, (error, data) ->
              test.deepEqual data, {snapshot:{str:''}, type:types.simple, meta:{}, v:0}
              test.done()
          , 15

  'When a listener connects then disconnects, documents are reaped again': (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.getOps = (docName, start, end, callback) -> callback null, []

    called = false
    @db.getSnapshot = (docName, callback) ->
      called = true
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:100}

    @model.create @name, 'simple', (error) =>
      listener = ->
      @model.listen @name, listener, (error) =>
        test.equal error, null
        @model.removeListener @name, listener

        setTimeout =>
            @model.getSnapshot @name, (error, data) ->
              test.deepEqual data, {snapshot:{str:'hi'}, type:types.simple, meta:{}, v:100}
              test.strictEqual called, true
              test.done()
          , 15

  'When there is no database, documents are not reaped': (test) ->
    @setDb null

    @model.create @name, 'simple', (error) =>
      setTimeout =>
          @model.getSnapshot @name, (error, data) ->
            test.deepEqual data, {snapshot:{str:''}, type:types.simple, meta:{}, v:0}
            test.done()
        , 15

  'Submitted ops are cached': (test) ->
    passPart = makePassPart test, 6

    @db.create = (docName, data, callback) -> callback()
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.writeSnapshot = (docName, data, dbMeta, callback) -> callback()
    # db.getOps should not be called.

    @model.create @name, 'simple', (error) =>
      @model.applyOp @name, {v:0, op:{position:0, text:'a'}, meta:{}}, (error) =>
        @model.applyOp @name, {v:1, op:{position:1, text:'b'}, meta:{}}, (error) =>
          # Ok, now if I call getOps I should get back cached data.
          #
          # getOps is not inclusive.
          @model.getOps @name, 0, 2, (error, ops) =>
            test.equal error, null
            delete o.meta.ts for o in ops
            test.deepEqual ops, [{v:0, op:{position:0, text:'a'}, meta:{}}, {v:1, op:{position:1, text:'b'}, meta:{}}]
            passPart()

          @model.getOps @name, 1, 2, (error, ops) =>
            test.equal error, null
            delete o.meta.ts for o in ops
            test.deepEqual ops, [{v:1, op:{position:1, text:'b'}, meta:{}}]
            passPart()

          @model.getOps @name, 0, 1, (error, ops) =>
            test.equal error, null
            delete o.meta.ts for o in ops
            test.deepEqual ops, [{v:0, op:{position:0, text:'a'}, meta:{}}]
            passPart()

          @model.getOps @name, 0, 0, (error, ops) =>
            test.equal error, null
            test.deepEqual ops, []
            passPart()

          @model.getOps @name, 1, 1, (error, ops) =>
            test.equal error, null
            test.deepEqual ops, []
            passPart()

          @model.getOps @name, 2, 2, (error, ops) =>
            test.equal error, null
            test.deepEqual ops, []
            passPart()

  "Ops stop being cached once we have too many of them": (test) ->
    op = (v) -> {v, op:{position:v, text:"#{v}"}, meta:{}}

    # In the options, I'm setting the opsBeforeCommit limit to 2.
    @db.create = (docName, data, callback) -> callback()
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.writeSnapshot = (docName, data, dbMeta, callback) -> callback()
    @db.getOps = (docName, start, end, callback) =>
      test.strictEqual start, 0
      test.strictEqual end, 1
      test.strictEqual docName, @name
      callback null, [op 0]

    @model.create @name, 'simple', (error) =>
      @model.applyOp @name, op(0), (error) =>
        @model.applyOp @name, op(1), (error) =>
          @model.applyOp @name, op(2), (error) =>
            # Now the first op shouldn't be cached.
            @model.getOps @name, 0, 1, (error, ops) ->
              test.equal error, null

              expected = op 0
              expected.v = 0
              test.deepEqual ops, [expected]

              test.expect 5
              test.done()

exports['sync'] = genTests false
exports['async'] = genTests true

# These tests check that regular operations actually perform the right thing, from an outsiders'
# point of view. There is some overlap with these tests and the tests above.
exports['integration'] = testCase
  setUp: (callback) ->
    @model = server.createModel {db:{type:'none'}}
    # When the test is run, a document exists with @name, and @unused is unused.
    @name = newDocName()
    @unused = "#{@name}-unused"

    @model.create @name, 'simple', (error) ->
      assert.equal error, null
      callback()

  'Return null when asked for the snapshot of a new object': (test) ->
    @model.getSnapshot @unused, (error, data) ->
      test.equal data, null
      test.strictEqual error, 'Document does not exist'
      test.done()

  'Calling create sets the type and version': (test) ->
    # create() has been called in setUp already.
    @model.getSnapshot @name, (error, data) =>
      test.equal error, null
      test.deepEqual data, {v:0, type:types.simple, snapshot:{str:''}, meta:{}}
      test.done()
  
  'Calling create works with a type literal instead of a string': (test) ->
    @model.create @unused, types.simple, (error) =>
      test.equal error, null
      @model.getSnapshot @name, (error, data) =>
        test.equal error, null
        test.deepEqual data, {v:0, type:types.simple, snapshot:{str:''}, meta:{}}
        test.done()
  
  'Creating a document a second time has no effect': (test) ->
    @model.create @name, types.text, (error) =>
      test.strictEqual error, 'Document already exists'
      @model.getSnapshot @name, (error, data) =>
        test.deepEqual data, {v:0, type:types.simple, snapshot:{str:''}, meta:{}}
        test.done()
  
  'Subsequent calls to getSnapshot work': (test) ->
    # Written in response to a real bug. (!!)
    @model.create @name, types.text, (error) =>
      @model.getSnapshot @name, (error, data) =>
        test.deepEqual data, {v:0, type:types.simple, snapshot:{str:''}, meta:{}}
        @model.getSnapshot @name, (error, data) =>
          test.equal error, null
          test.deepEqual data, {v:0, type:types.simple, snapshot:{str:''}, meta:{}}
          test.done()
  
  "Can't create a document with a slash in the name": (test) ->
    @model.create 'foo/bar', types.text, (error) ->
      test.strictEqual error, 'Invalid document name'
      test.done()

  'Return a fresh snapshot after submitting ops': (test) ->
    @model.applyOp @name, {v:0, op:{position: 0, text:'hi'}}, (error, appliedVersion) =>
      test.equal error, null
      test.strictEqual appliedVersion, 0
      @model.getSnapshot @name, (error, data) ->
        test.deepEqual data, {v:1, type:types.simple, snapshot:{str:'hi'}, meta:{}}
        test.done()

  'Apply op to future version fails': (test) ->
    @model.create @name, types.simple, =>
      @model.applyOp @name, {v:1, op:{position: 0, text: 'hi'}}, (error, result) ->
        test.strictEqual error, 'Op at future version'
        test.done()
  
  'Apply ops at the most recent version': (test) ->
    applyOps @model, @name, 0, [
        {position: 0, text: 'Hi '}
        {position: 3, text: 'mum'}
        {position: 3, text: 'to you '}
      ], (error, data) ->
        test.strictEqual error, null
        test.deepEqual data, {v:3, type:types.simple, snapshot:{str:'Hi to you mum'}, meta:{}}
        test.done()
        
  'Apply ops at an old version': (test) ->
    applyOps @model, @name, 0, [
        {position: 0, text: 'Hi '}
        {position: 3, text: 'mum'}
      ], (error, data) =>
        test.strictEqual error, null
        test.strictEqual data.v, 2
        test.deepEqual data.snapshot.str, 'Hi mum'

        applyOps @model, @name, 1, [
          {position: 2, text: ' to you'}
        ], (error, data) ->
          test.strictEqual error, null
          test.strictEqual data.v, 3
          test.deepEqual data.snapshot.str, 'Hi to you mum'
          test.done()

  'delete a document when delete is called': (test) ->
    @model.delete @name, (error) =>
      test.equal error, null
      @model.getSnapshot @name, (error, data) ->
        test.strictEqual error, 'Document does not exist'
        test.equal data, null
        test.done()
  
  "Pass false to the callback if you delete something that doesn't exist": (test) ->
    @model.delete @unused, (error) ->
      test.strictEqual error, 'Document does not exist'
      test.done()
  
  'getOps returns ops in the document': (test) ->
    submittedOps = [{position: 0, text: 'Hi'}, {position: 2, text: ' mum'}]
    passPart = makePassPart test, 6

    getOps = (data) -> data.map ((d) -> d.op)

    applyOps @model, @name, 0, submittedOps.slice(), (error, _) =>
      @model.getOps @name, 0, 1, (error, data) ->
        test.deepEqual getOps(data), [submittedOps[0]]
        test.equal error, null
        passPart()
      @model.getOps @name, 0, 2, (error, data) ->
        test.deepEqual getOps(data), submittedOps
        test.equal error, null
        passPart()
      @model.getOps @name, 1, 2, (error, data) ->
        test.deepEqual getOps(data), [submittedOps[1]]
        test.equal error, null
        passPart()
      @model.getOps @name, 2, 3, (error, data) ->
        test.deepEqual data, []
        test.equal error, null
        passPart()

      # These should be trimmed to just return the version specified
      @model.getOps @name, 0, 1000, (error, data) ->
        test.deepEqual getOps(data), submittedOps
        test.equal error, null
        passPart()
      @model.getOps @name, 1, 1000, (error, data) ->
        test.deepEqual getOps(data), [submittedOps[1]]
        test.equal error, null
        passPart()

  'getOps on an empty document returns an empty list': (test) ->
    passPart = makePassPart test, 2
    @model.getOps @name, 0, 0, (error, data) ->
      test.deepEqual data, []
      passPart()

    @model.getOps @name, 0, null, (error, data) ->
      test.deepEqual data, []
      passPart()
 
  'getOps with a null count returns all the ops': (test) ->
    submittedOps = [{position: 0, text: 'Hi'}, {position: 2, text: ' mum'}]
    applyOps @model, @name, 0, submittedOps.slice(), (error, _) =>
      @model.getOps @name, 0, null, (error, data) ->
        test.equal error, null
        test.deepEqual data.map((d) -> d.op), submittedOps
        test.done()
  
  'ops submitted have a metadata object added': (test) ->
    t1 = Date.now()
    @model.applyOp @name, {op:{position: 0, text: 'hi'}, v:0}, (error, version) =>
      test.ifError error
      @model.getOps @name, 0, 1, (error, data) ->
        test.deepEqual data.length, 1
        d = data[0]
        test.deepEqual d.op, {position: 0, text: 'hi'}
        test.strictEqual typeof d.meta, 'object'
        test.ok Date.now() >= d.meta.ts >= t1
        test.done()
  
  'metadata is stored': (test) ->
    @model.applyOp @name, {v:0, op:{position: 0, text: 'hi'}, meta:{blah:'blat'}}, (error, version) =>
      @model.getOps @name, 0, 1, (error, data) ->
        d = data[0]
        test.deepEqual d.op, {position: 0, text: 'hi'}
        test.strictEqual typeof d.meta, 'object'
        test.strictEqual d.meta.blah, 'blat'
        test.done()

  'getVersion on a non-existant doc returns null': (test) ->
    @model.getVersion @unused, (error, v) ->
      test.strictEqual error, 'Document does not exist'
      test.equal v, null
      test.done()

  'getVersion on a doc returns its version': (test) ->
    @model.getVersion @name, (error, v) =>
      test.equal error, null
      test.strictEqual v, 0
      @model.applyOp @name, {v:0, op:{position: 0, text: 'hi'}}, (error, appliedVersion) =>
        test.ifError(error)
        @model.getVersion @name, (error, v) ->
          test.equal error, null
          test.strictEqual v, 1
          test.done()

