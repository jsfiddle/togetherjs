# This tests src/server/doccache.coffee
#
# This test uses a mock database rather than using database code directly.

{testCase} = require 'nodeunit'
{makePassPart} = require './helpers'

Manager = require '../src/server/db/manager'
types = require '../src/types'

newDocName = do ->
  num = 0
  -> "doc#{num++}"

newDbId = do -> num = 0; -> "db#{num++}"

genTests = (async) -> testCase
  setUp: (callback) ->
    #getOps: (docName, start, end, callback)
    #create: (docName, data, callback)
    #delete: (docName, dbMeta, callback)
    #writeOp: (docName, opData, callback)
    #writeSnapshot: (docName, docData, dbMeta, callback)
    #getSnapshot: (docName, callback)
    #getVersion: (docName, callback)
    #close: ()

    @name = newDocName()

    @db = {}
    functions = ['getOps', 'create', 'delete', 'writeOp', 'writeSnapshot', 'getSnapshot', 'getVersion', 'close']

    id = newDbId()
    for functionName in functions
      @db[functionName] = do (functionName) -> -> throw new Error "Unexpected call to #{functionName} in #{id}"

    # So tests can override the database object completely (eg, set it null to simulate an in-memory
    # database)
    @setDb = (db) =>
      @db = db
      @man = new Manager db, reapTime: 10, numCachedOps: 2, opsBeforeCommit: 2

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

    #console.warn "db id #{id}"

    callback()

  tearDown: (callback) ->
    if @db
      # During cleanup, the database calls writeSnapshot on all still-open documents.
      @db.close = ->
      @db.writeSnapshot = (docName, docData, dbMeta, callback) -> callback()

    @man.close callback
  
  'create creates in the DB': (test) ->
    @db.create = (docName, data, callback) =>
      test.strictEqual docName, @name
      test.deepEqual data, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}
      callback null, {'metablag': true} # <-- dbMeta

    @man.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) ->
      test.equal error, null
      test.expect 3
      test.done()

  'Errors in create are passed to the caller': (test) ->
    @db.create = (docName, data, callback) =>
      callback 'invalid tubes!'

    @man.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) ->
      test.strictEqual error, 'invalid tubes!'
      test.done()

  'If the database is null, create still works': (test) ->
    @setDb null

    @man.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) ->
      test.equal error, null
      test.done()

  'create caches the document data': (test) ->
    @db.create = (docName, data, callback) => callback()

    @man.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.getSnapshot @name, (error, data) =>
        test.deepEqual data, {snapshot:{str:'hi'}, type:types.simple, meta:{}, v:0}

        @man.getVersion @name, (error, version) ->
          test.strictEqual version, 0
          test.done()

  'create caches the document data even if the db is null': (test) ->
    @setDb null

    @man.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.getSnapshot @name, (error, data) ->
        test.deepEqual data, {snapshot:{str:'hi'}, type:types.simple, meta:{}, v:0}
        test.done()
  
  "if there is an error in db.create, the document isn't cached": (test) ->
    @db.create = (docName, data, callback) =>
      callback 'invalid tubes!'
    @db.getSnapshot = (docName, callback) =>
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @man.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, =>
      @man.getSnapshot @name, (error, data) ->
        test.equal error, null
        test.deepEqual data, {snapshot:{str:'hi'}, type:types.simple, meta:{}, v:0}
        test.done()

  "if create is passed a type literal, the database is given the type name": (test) ->
    @db.create = (docName, data, callback) =>
      test.deepEqual data, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}
      callback()

    @man.create @name, {snapshot:{str:'hi'}, type:types.simple, meta:{}, v:0}, (error) ->
      test.expect 1
      test.done()

  "If create is given a type name that doesn't exist, it sends an error": (test) ->
    @man.create @name, {snapshot:{str:'hi'}, type:'does not exist', meta:{}, v:0}, (error) ->
      test.strictEqual error, 'Type not found'
      test.done()

  "getSnapshot() data is passed from the database": (test) ->
    @db.getSnapshot = (docName, callback) ->
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @man.getSnapshot @name, (error, data) ->
      test.equal error, null
      test.deepEqual data, {snapshot:{str:'hi'}, type:types.simple, meta:{}, v:0}
      test.done()

  "getSnapshot() propogates errors from the database": (test) ->
    @db.getSnapshot = (docName, callback) ->
      callback 'invalid tubes!'

    @man.getSnapshot @name, (error, data) ->
      test.strictEqual error, 'invalid tubes!'
      test.equal data, null
      test.done()

  "If getSnapshot() returns a type name that doesn't exist, we return an error": (test) ->
    @db.getSnapshot = (docName, callback) ->
      callback null, {snapshot:{str:'hi'}, type:'does not exist', meta:{}, v:0}
    
    @man.getSnapshot @name, (error, data) ->
      test.strictEqual error, 'Type not found'
      test.done()
  
  "If there is an error with getSnapshot(), the document isn't cached": (test) ->
    @db.getSnapshot = (docName, callback) =>
      # Called twice = victory.
      @db.getSnapshot = -> test.done()

      # But the first time, we send an error.
      callback 'invalid tubes!'

    @man.getSnapshot @name, =>
      @man.getSnapshot @name, ->

  "getSnapshot() data is cached": (test) ->
    @db.getSnapshot = (docName, callback) =>
      # Called twice = super bad.
      @db.getSnapshot = -> throw new Error 'getSnapshot data should have been cached'

      # but the first time, send the data
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}

    @db.getOps = (docName, start, end, callback) =>
      @db.getOps = -> throw new Error 'getSnapshot data should have been cached'
      callback null, []

    @man.getSnapshot @name, =>
      @man.getSnapshot @name, ->
        test.done()

  "if the db is null and there's no cached data, getSnapshot() raises an error": (test) ->
    @setDb null

    @man.getSnapshot @name, (error, data) ->
      test.strictEqual error, 'Document does not exist'
      test.equal data, null
      test.done()

  'Multiple simultaneous calls to getSnapshot and getVersion only result in one getSnapshot call on the database': (test) ->
    @db.getSnapshot = (docName, callback) =>
      @db.getSnapshot = -> throw new Error 'getSnapshot should only be called once'
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:100}

    @db.getOps = (docName, start, end, callback) =>
      @db.getOps = -> throw new Error 'getOps should only be called once'
      callback null, []

    passPart = makePassPart test, 10
    check = (expectedData) -> (error, data) ->
      test.deepEqual data, expectedData
      passPart()

    # This code can use the nice syntax once coffeescript >1.1.2 lands.
    @man.getSnapshot @name, check({snapshot:{str:'hi'}, type:types.simple, meta:{}, v:100}) for __ignored in [1..5]
    @man.getVersion @name, check(100) for __ignored in [1..5]

  'if create is passed a type literal and theres no database, getSnapshot still returns type literals': (test) ->
    @setDb null

    @man.create @name, {snapshot:{str:'hi'}, type:types.simple, meta:{}, v:0}, (error) =>
      @man.getSnapshot @name, (error, data) ->
        test.deepEqual data, {snapshot:{str:'hi'}, type:types.simple, meta:{}, v:0}
        test.done()

  'getSnapshot catches up the document with all recent ops': (test) ->
    # The database might contain an old snapshot. Calling getSnapshot() on the man calls getOps()
    # in the database and does catchup before returning.
    @db.getSnapshot = (docName, callback) =>
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:1}

    @db.getOps = (docName, start, end, callback) =>
      test.strictEqual docName, @name
      test.strictEqual start, 1
      test.strictEqual end, null
      callback null, [{op:{position:2, text:' there'}, meta:{}}, {op:{position:8, text:' mum'}, meta:{}}]

    @man.getSnapshot @name, (error, data) ->
      test.equal error, null
      test.deepEqual data, {snapshot:{str:'hi there mum'}, type:types.simple, meta:{}, v:3}
      test.done()

  'getVersion passes errors from db.getSnapshot': (test) ->
    @db.getSnapshot = (docName, callback) -> callback 'Invalid weboplex'

    @man.getVersion @name, (error, version) ->
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

    @man.getVersion @name, (error, version) ->
      test.equal error, null
      test.deepEqual version, 3
      test.done()

  "db.delete is called on delete": (test) ->
    @db.delete = (docName, dbMeta, callback) =>
      test.strictEqual docName, @name
      test.equal dbMeta, null
      callback()

    @man.delete @name, (error) ->
      test.equal error, null
      test.done()

  "delete errors are propogated": (test) ->
    @db.delete = (docName, dbMeta, callback) ->
      callback "invalid tubes!"

    @man.delete @name, (error) ->
      test.strictEqual error, "invalid tubes!"
      test.done()
  
  'Deleting a nonexistant document with no database raises an error': (test) ->
    @setDb null

    @man.delete @name, (error) ->
      test.strictEqual error, 'Document does not exist'
      test.done()

  "delete removes any cached data": (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.delete = (docName, dbMeta, callback) -> callback()

    called = false
    @db.getSnapshot = (docName, callback) =>
      called = true
      callback 'Document does not exist'

    @man.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.delete @name, (error) =>
        @man.getSnapshot @name, ->
          test.strictEqual called, true
          test.done()

  "delete removes any cached data if db is null": (test) ->
    @setDb null

    @man.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.delete @name, (error) =>
        test.equal error, null
        @man.getSnapshot @name, (error, data) ->
          test.strictEqual error, 'Document does not exist'
          test.equal data, null
          test.done()

  "dbMeta is passed from create() to delete": (test) ->
    @db.create = (docName, data, callback) ->
      callback null, {db:'meta'}

    @db.delete = (docName, dbMeta, callback) ->
      test.deepEqual dbMeta, {db:'meta'}
      callback()

    @man.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.delete @name, (error) =>
        test.done()
  
  'append calls writeOp': (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.writeOp = (docName, opData, callback) =>
      test.strictEqual docName, @name
      test.deepEqual opData, {v:0, op:[123], meta:{}}
      callback()

    @man.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:1}, (error) =>
        test.equal error, null
        test.expect 3
        test.done()
  
  'append propogates errors from writeOp': (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.writeOp = (docName, opData, callback) -> callback 'intersplat'

    @man.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:1}, (error) ->
        test.strictEqual error, 'intersplat'
        test.done()
  
  'append on uncached data works': (test) ->
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.getSnapshot = (docName, callback) ->
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @man.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'bar'}, type:'simple', meta:{}, v:1}, (error) =>
      test.done()
  
  "Despite appending with a string type, getSnapshot makes the type an object": (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.writeSnapshot = (docName, data, dbMeta, callback) -> callback()

    @man.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:1}, (error) =>
        @man.getSnapshot @name, (error, data) ->
          test.deepEqual data, {snapshot:{str:'hi'}, type:types.simple, meta:{}, v:1}
          test.done()

  "writeSnapshot is called after the specified number of ops are appended": (test) ->
    # In this case, 2!
    @db.create = (docName, data, callback) -> callback()
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.writeSnapshot = (docName, data, dbMeta, callback) =>
      test.strictEqual docName, @name
      test.deepEqual data, {snapshot:{str:'data3'}, type:'simple', meta:{}, v:2}
      test.equal dbMeta, null
      callback()
      test.done()

    @man.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        @man.append @name, {v:1, op:[123], meta:{}}, {snapshot:{str:'data3'}, type:'simple', meta:{}, v:2}, (error) =>
          # This callback is called *before* writeSnapshot, so test.done() has to go in the callback above.
          test.equal error, null
          test.expect 4

  "writeSnapshot is not called again for a little while afterwards": (test) ->
    # Basically, this test makes sure the committed version field is updated.
    # In this case, 2!
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

    op = (v) -> {v, op:[123], meta:{}}
    doc = (v) -> {v, snapshot:{str:"doc#{v}"}, type:'simple', meta:{}}

    @man.create @name, doc(0), (error) =>
      @man.append @name, op(0), doc(1), (error) =>
        @man.append @name, op(1), doc(2), (error) =>
          process.nextTick => @man.append @name, op(2), doc(3), (error) =>
            process.nextTick => @man.append @name, op(3), doc(4), (error) =>
              process.nextTick => @man.append @name, op(4), doc(5), (error) =>
                test.done()

  "writeSnapshot isn't called just because the version number is high": (test) ->
    # I'll give the document a really high version number
    @db.getSnapshot = (docName, callback) ->
      called = true
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:100}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @db.writeOp = (docName, opData, callback) -> callback()

    @man.append @name, {v:100, op:[123], meta:{}}, {snapshot:{str:'blah'}, type:'simple', meta:{}, v:101}, (error) =>
      test.equal error, null
      test.done()

  "dbMeta is passed from create() to writeSnapshot": (test) ->
    # I could do this in the test above, but I'd like to make sure both code paths work.
    @db.create = (docName, data, callback) -> callback null, {db:'meta'}
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.writeSnapshot = (docName, data, dbMeta, callback) =>
      test.deepEqual dbMeta, {db:'meta'}
      test.done()

    @man.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        @man.append @name, {v:1, op:[123], meta:{}}, {snapshot:{str:'data3'}, type:'simple', meta:{}, v:2}, (error) =>

  "With no database, writing a few ops doesn't make the man freik out or anything": (test) ->
    @setDb null

    @man.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        test.equal error, null
        @man.append @name, {v:1, op:[123], meta:{}}, {snapshot:{str:'data3'}, type:'simple', meta:{}, v:2}, (error) =>
          test.equal error, null
          @man.append @name, {v:2, op:[123], meta:{}}, {snapshot:{str:'data4'}, type:'simple', meta:{}, v:3}, (error) =>
            test.equal error, null
            test.done()

  'With no listeners, documents are reaped': (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.getOps = (docName, start, end, callback) -> callback null, []
    # writeSnapshot is called when the document is reaped.
    @db.writeSnapshot = (docName, data, dbMeta, callback) -> callback()

    called = false
    @db.getSnapshot = (docName, callback) ->
      called = true
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}

    @man.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      setTimeout =>
          @man.getSnapshot @name, (error, data) ->
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
      test.deepEqual data, {snapshot:{str:'blah'}, type:'simple', meta:{}, v:101}
      test.deepEqual dbMeta, {db:'meta'}
      callback()

    @man.append @name, {v:100, op:[123], meta:{}}, {snapshot:{str:'blah'}, type:'simple', meta:{}, v:101}, (error) =>
      setTimeout =>
          # At this point, writeSnapshot should have been called.
          test.expect 3
          test.done()
        , 15

  'With listening clients, documents are not reaped': (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.getSnapshot = (docName, callback) -> throw new Error 'The object should still be cached'

    @man.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.docOpened @name, {id: 'abc123'}
      setTimeout =>
          @man.getSnapshot @name, (error, data) ->
            test.deepEqual data, {snapshot:{str:'hi'}, type:types.simple, meta:{}, v:0}
            test.done()
        , 15

  'When a client connects then disconnects, documents are reaped again': (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.getOps = (docName, start, end, callback) -> callback null, []

    called = false
    @db.getSnapshot = (docName, callback) ->
      called = true
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}

    @man.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      client = {id: 'abc123'}
      @man.docOpened @name, client, (error) =>
        test.equal error, null
        @man.docClosed @name, client

        setTimeout =>
            @man.getSnapshot @name, (error, data) ->
              test.deepEqual data, {snapshot:{str:'hi'}, type:types.simple, meta:{}, v:0}
              test.strictEqual called, true
              test.done()
          , 15

  'When there is no database, documents are not reaped': (test) ->
    @setDb null

    @man.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      setTimeout =>
          @man.getSnapshot @name, (error, data) ->
            test.deepEqual data, {snapshot:{str:'hi'}, type:types.simple, meta:{}, v:0}
            test.done()
        , 15

  'Submitted ops are cached': (test) ->
    passPart = makePassPart test, 6

    @db.create = (docName, data, callback) -> callback()
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.writeSnapshot = (docName, data, dbMeta, callback) -> callback()

    @man.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        @man.append @name, {v:1, op:[123], meta:{}}, {snapshot:{str:'data3'}, type:'simple', meta:{}, v:2}, (error) =>
          # Ok, now if I call getOps I should get back cached data.
          #
          # getOps is not inclusive.
          @man.getOps @name, 0, 2, (error, ops) =>
            test.equal error, null
            test.deepEqual ops, [{v:0, op:[123], meta:{}}, {v:1, op:[123], meta:{}}]
            passPart()

          @man.getOps @name, 1, 2, (error, ops) =>
            test.equal error, null
            test.deepEqual ops, [{v:1, op:[123], meta:{}}]
            passPart()

          @man.getOps @name, 0, 1, (error, ops) =>
            test.equal error, null
            test.deepEqual ops, [{v:0, op:[123], meta:{}}]
            passPart()

          @man.getOps @name, 0, 0, (error, ops) =>
            test.equal error, null
            test.deepEqual ops, []
            passPart()

          @man.getOps @name, 1, 1, (error, ops) =>
            test.equal error, null
            test.deepEqual ops, []
            passPart()

          @man.getOps @name, 2, 2, (error, ops) =>
            test.equal error, null
            test.deepEqual ops, []
            passPart()

  "Ops stop being cached once we have too many of them": (test) ->
    # In the db options, I'm setting the man limit to 2.
    @db.create = (docName, data, callback) -> callback()
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.writeSnapshot = (docName, data, dbMeta, callback) -> callback()
    @db.getOps = (docName, start, end, callback) =>
      test.strictEqual start, 0
      test.strictEqual end, 0
      test.strictEqual docName, @name
      callback null, [{op:[123], meta:{}}]

    @man.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        @man.append @name, {v:1, op:[123], meta:{}}, {snapshot:{str:'data3'}, type:'simple', meta:{}, v:2}, (error) =>
          @man.append @name, {v:2, op:[123], meta:{}}, {snapshot:{str:'data4'}, type:'simple', meta:{}, v:3}, (error) =>
            # Now the first op shouldn't be cached.
            @man.getOps @name, 0, 0, (error, ops) ->
              test.equal error, null
              test.deepEqual ops, [{v:0, op:[123], meta:{}}]
              test.expect 5
              test.done()

  "Calling getOps() directly when there's no cached data calls the database": (test) ->
    @db.getOps = (docName, start, end, callback) =>
      test.strictEqual start, 100
      test.strictEqual end, 102
      test.strictEqual docName, @name
      callback null, [{op:[100], meta:{}}, {op:[101], meta:{}}, {op:[102], meta:{}}]

    @man.getOps @name, 100, 102, (error, ops) ->
      test.equal error, null
      test.deepEqual ops, [{v:100, op:[100], meta:{}}, {v:101, op:[101], meta:{}}, {v:102, op:[102], meta:{}}]
      test.done()

  'getOps passes errors to the callback': (test) ->
    @db.getOps = (docName, start, end, callback) -> callback 'blargh death'

    @man.getOps @name, 100, 102, (error, ops) ->
      test.strictEqual error, 'blargh death'
      test.equal ops, null
      test.done()
  
  "getOps() with no db and no cached data returns an error": (test) ->
    @setDb null

    @man.getOps @name, 100, 102, (error, ops) ->
      # Other valid behaviour: returning no ops.
      test.strictEqual error, 'Document does not exist'
      test.done()

  "getOps() with no db and cached data can return the cached data": (test) ->
    passPart = makePassPart test, 4

    @setDb null

    @man.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        @man.append @name, {v:1, op:[123], meta:{}}, {snapshot:{str:'data3'}, type:'simple', meta:{}, v:2}, (error) =>
          @man.append @name, {v:2, op:[123], meta:{}}, {snapshot:{str:'data4'}, type:'simple', meta:{}, v:3}, (error) =>
            @man.getOps @name, 0, 3, (error, data) =>
              test.equal error, null
              test.deepEqual data, [{v:0, op:[123], meta:{}}, {v:1, op:[123], meta:{}}, {v:2, op:[123], meta:{}}]
              passPart()

            @man.getOps @name, 0, 2, (error, data) =>
              test.equal error, null
              test.deepEqual data, [{v:0, op:[123], meta:{}}, {v:1, op:[123], meta:{}}]
              passPart()

            @man.getOps @name, 1, 3, (error, data) =>
              test.equal error, null
              test.deepEqual data, [{v:1, op:[123], meta:{}}, {v:2, op:[123], meta:{}}]
              passPart()

            @man.getOps @name, 2, 3, (error, data) ->
              test.equal error, null
              test.deepEqual data, [{v:2, op:[123], meta:{}}]
              passPart()

  "getOps sends an error if the document doesn't exist with no db": (test) ->
    @setDb null

    @man.getOps @name, 0, null, (error, data) ->
      test.strictEqual error, 'Document does not exist'
      test.equal data, null
      test.done()

  'flush with no documents open does nothing': (test) ->
    @man.flush ->
      test.done()
  
  "flush doesn't need a callback": (test) ->
    @man.flush()
    test.done()

  'flush with a document thats just been created (and hence is in the DB) does nothing': (test) ->
    @db.create = (docName, data, callback) -> callback()

    @man.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.flush ->
        test.done()

  "flush with a document that hasn't been edited does nothing": (test) ->
    @db.getSnapshot = (docName, callback) ->
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @man.getSnapshot @name, (error, data) =>
      @man.flush ->
        test.done()

  "flush calls getSnapshot on open documents": (test) ->
    @db.create = (docName, data, callback) -> callback null, {db:'meta'}
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.getOps = (docName, start, end, callback) -> callback null, []

    snapshotWritten = false
    @db.writeSnapshot = (docName, data, dbMeta, callback) =>
      test.strictEqual docName, @name
      test.deepEqual data, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}
      test.deepEqual dbMeta, {db:'meta'}
      snapshotWritten = true
      callback()

    @man.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        @man.flush ->
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

      @man.flush ->
        test.done()

    @man.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        @man.append @name, {v:1, op:[123], meta:{}}, {snapshot:{str:'data3'}, type:'simple', meta:{}, v:2}, (error) =>
          # This callback is called *before* writeSnapshot, so test.done() has to go in the callback above.
          test.equal error, null

  "flush with no database does nothing": (test) ->
    @setDb null

    @man.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @man.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        @man.flush ->
          test.done()

exports['sync'] = genTests false
exports['async'] = genTests true
