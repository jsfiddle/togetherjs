# This tests src/server/doccache.coffee
#
# This test uses a mock database rather than using database code directly.

{testCase} = require 'nodeunit'
{makePassPart} = require './helpers'

DocCache = require '../src/server/doccache'
types = require '../src/types'

newDocName = do ->
  num = 0
  -> "doc#{num++}"

module.exports = testCase
  setUp: (callback) ->
    error = (functionName) -> -> throw new Error "Unexpected call to #{functionName}"

    #getOps: (docName, start, end, callback)
    #create: (docName, data, callback)
    #delete: (docName, dbMeta, callback)
    #writeOp: (docName, opData, callback)
    #writeSnapshot: (docName, docData, dbMeta, callback)
    #getSnapshot: (docName, callback)
    #close: ()

    @name = newDocName()

    @db = {}
    functions = ['getOps', 'create', 'delete', 'writeOp', 'writeSnapshot', 'getSnapshot', 'close']
    @db[functionName] = error functionName for functionName in functions

    # So tests can override the database object completely (eg, set it null to simulate an in-memory
    # database)
    @setDb = (db) =>
      @cache = new DocCache db, reapTime: 10, numCachedOps: 2, opsBeforeCommit: 2

    @setDb @db
    callback()

  'create creates in the DB': (test) ->
    @db.create = (docName, data, callback) =>
      test.strictEqual docName, @name
      test.deepEqual data, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}
      callback null, {'metablag': true} # <-- dbMeta

    @cache.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) ->
      test.equal error, null
      test.expect 3
      test.done()

  'Errors in create are passed to the caller': (test) ->
    @db.create = (docName, data, callback) =>
      callback 'invalid tubes!'

    @cache.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) ->
      test.strictEqual error, 'invalid tubes!'
      test.done()

  'If the database is null, create still works': (test) ->
    @setDb null

    @cache.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) ->
      test.equal error, null
      test.done()

  'create caches the document data': (test) ->
    @db.create = (docName, data, callback) => callback()

    @cache.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.getSnapshot @name, (error, data) ->
        test.deepEqual data, {snapshot:{str:'hi'}, type:types['simple'], meta:{}, v:0}
        test.done()

  'create caches the document data even if the db is null': (test) ->
    @setDb null

    @cache.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.getSnapshot @name, (error, data) ->
        test.deepEqual data, {snapshot:{str:'hi'}, type:types['simple'], meta:{}, v:0}
        test.done()

  "if there is an error in db.create, the document isn't cached": (test) ->
    @db.create = (docName, data, callback) =>
      callback 'invalid tubes!'
    @db.getSnapshot = (docName, callback) =>
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @cache.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, =>
      @cache.getSnapshot @name, (error, data) ->
        test.equal error, null
        test.deepEqual data, {snapshot:{str:'hi'}, type:types['simple'], meta:{}, v:0}
        test.done()

  "if create is passed a type literal, the database is given the type name": (test) ->
    @db.create = (docName, data, callback) =>
      test.deepEqual data, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}
      callback()

    @cache.create @name, {snapshot:{str:'hi'}, type:types['simple'], meta:{}, v:0}, (error) ->
      test.expect 1
      test.done()

  "If create is given a type name that doesn't exist, it sends an error": (test) ->
    @cache.create @name, {snapshot:{str:'hi'}, type:'does not exist', meta:{}, v:0}, (error) ->
      test.strictEqual error, 'Type not found'
      test.done()

  "getSnapshot() data is passed from the database": (test) ->
    @db.getSnapshot = (docName, callback) ->
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @cache.getSnapshot @name, (error, data) ->
      test.equal error, null
      test.deepEqual data, {snapshot:{str:'hi'}, type:types['simple'], meta:{}, v:0}
      test.done()

  "getSnapshot() propogates errors from the database": (test) ->
    @db.getSnapshot = (docName, callback) ->
      callback 'invalid tubes!'

    @cache.getSnapshot @name, (error, data) ->
      test.strictEqual error, 'invalid tubes!'
      test.equal data, null
      test.done()

  "If getSnapshot() returns a type name that doesn't exist, we return an error": (test) ->
    @db.getSnapshot = (docName, callback) ->
      callback null, {snapshot:{str:'hi'}, type:'does not exist', meta:{}, v:0}
    
    @cache.getSnapshot @name, (error, data) ->
      test.strictEqual error, 'Type not found'
      test.done()

  "If there is an error with getSnapshot(), the document isn't cached": (test) ->
    @db.getSnapshot = (docName, callback) =>
      # Called twice = victory.
      @db.getSnapshot = -> test.done()

      # But the first time, we send an error.
      callback 'invalid tubes!'

    @cache.getSnapshot @name, =>
      @cache.getSnapshot @name, ->

  "getSnapshot() data is cached": (test) ->
    @db.getSnapshot = (docName, callback) =>
      # Called twice = super bad.
      @db.getSnapshot = -> throw new Error 'getSnapshot data should have been cached'

      # but the first time, send the data
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}

    @db.getOps = (docName, start, end, callback) =>
      @db.getOps = -> throw new Error 'getSnapshot data should have been cached'
      callback null, []

    @cache.getSnapshot @name, =>
      @cache.getSnapshot @name, ->
        test.done()

  "if the db is null and there's no cached data, getSnapshot() raises an error": (test) ->
    @setDb null

    @cache.getSnapshot @name, (error, data) ->
      test.strictEqual error, 'Document does not exist'
      test.equal data, null
      test.done()

  'if create is passed a type literal and theres no database, getSnapshot still returns type literals': (test) ->
    @setDb null

    @cache.create @name, {snapshot:{str:'hi'}, type:types['simple'], meta:{}, v:0}, (error) =>
      @cache.getSnapshot @name, (error, data) ->
        test.deepEqual data, {snapshot:{str:'hi'}, type:types['simple'], meta:{}, v:0}
        test.done()

  'getSnapshot catches up the document with all recent ops': (test) ->
    # The database might contain an old snapshot. Calling getSnapshot() on the cache calls getOps()
    # in the database and does catchup before returning.
    @db.getSnapshot = (docName, callback) =>
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:1}

    @db.getOps = (docName, start, end, callback) =>
      test.strictEqual docName, @name
      test.strictEqual start, 1
      test.strictEqual end, null
      callback null, [{op:{position:2, text:' there'}, meta:{}}, {op:{position:8, text:' mum'}, meta:{}}]

    @cache.getSnapshot @name, (error, data) ->
      test.equal error, null
      test.deepEqual data, {snapshot:{str:'hi there mum'}, type:types['simple'], meta:{}, v:3}
      test.done()

  "db.delete is called on delete": (test) ->
    @db.delete = (docName, dbMeta, callback) =>
      test.strictEqual docName, @name
      test.equal dbMeta, null
      callback()

    @cache.delete @name, (error) ->
      test.equal error, null
      test.done()

  "delete errors are propogated": (test) ->
    @db.delete = (docName, dbMeta, callback) ->
      callback "invalid tubes!"

    @cache.delete @name, (error) ->
      test.strictEqual error, "invalid tubes!"
      test.done()

  'Deleting a nonexistant document with no database raises an error': (test) ->
    @setDb null

    @cache.delete @name, (error) ->
      test.strictEqual error, 'Document does not exist'
      test.done()

  "delete removes any cached data": (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.delete = (docName, dbMeta, callback) -> callback()
    @db.getSnapshot = -> test.done()

    @cache.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.delete @name, (error) =>
        @cache.getSnapshot @name, ->

  "delete removes any cached data if db is null": (test) ->
    @setDb null

    @cache.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.delete @name, (error) =>
        test.equal error, null
        @cache.getSnapshot @name, (error, data) ->
          test.strictEqual error, 'Document does not exist'
          test.equal data, null
          test.done()

  "dbMeta is passed from create() to delete": (test) ->
    @db.create = (docName, data, callback) ->
      callback null, {db:'meta'}

    @db.delete = (docName, dbMeta, callback) ->
      test.deepEqual dbMeta, {db:'meta'}
      callback()

    @cache.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.delete @name, (error) =>
        test.done()

  'append calls writeOp': (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.writeOp = (docName, opData, callback) =>
      test.strictEqual docName, @name
      test.deepEqual opData, {v:0, op:[123], meta:{}}
      callback()

    @cache.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:1}, (error) =>
        test.equal error, null
        test.expect 3
        test.done()

  'append propogates errors from writeOp': (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.writeOp = (docName, opData, callback) -> callback 'intersplat'

    @cache.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:1}, (error) ->
        test.strictEqual error, 'intersplat'
        test.done()

  'append on uncached data works': (test) ->
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.getSnapshot = (docName, callback) ->
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @cache.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'bar'}, type:'simple', meta:{}, v:1}, (error) =>
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

    @cache.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        @cache.append @name, {v:1, op:[123], meta:{}}, {snapshot:{str:'data3'}, type:'simple', meta:{}, v:2}, (error) =>
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

    @cache.create @name, doc(0), (error) =>
      @cache.append @name, op(0), doc(1), (error) =>
        @cache.append @name, op(1), doc(2), (error) =>
          process.nextTick => @cache.append @name, op(2), doc(3), (error) =>
            process.nextTick => @cache.append @name, op(3), doc(4), (error) =>
              process.nextTick => @cache.append @name, op(4), doc(5), (error) =>
                test.done()

  "dbMeta is passed from create() to writeSnapshot": (test) ->
    # I could do this in the test above, but I'd like to make sure both code paths work.
    @db.create = (docName, data, callback) -> callback null, {db:'meta'}
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.writeSnapshot = (docName, data, dbMeta, callback) =>
      test.deepEqual dbMeta, {db:'meta'}
      test.done()

    @cache.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        @cache.append @name, {v:1, op:[123], meta:{}}, {snapshot:{str:'data3'}, type:'simple', meta:{}, v:2}, (error) =>

  "With no database, writing a few ops doesn't make the cache freik out or anything": (test) ->
    @setDb null

    @cache.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        test.equal error, null
        @cache.append @name, {v:1, op:[123], meta:{}}, {snapshot:{str:'data3'}, type:'simple', meta:{}, v:2}, (error) =>
          test.equal error, null
          @cache.append @name, {v:2, op:[123], meta:{}}, {snapshot:{str:'data4'}, type:'simple', meta:{}, v:3}, (error) =>
            test.equal error, null
            test.done()

  'With no listeners, documents are reaped': (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.getOps = (docName, start, end, callback) -> callback null, []

    called = false
    @db.getSnapshot = (docName, callback) ->
      called = true
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}

    @cache.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      setTimeout =>
          @cache.getSnapshot @name, (error, data) ->
            test.deepEqual data, {snapshot:{str:'hi'}, type:types['simple'], meta:{}, v:0}
            test.strictEqual called, true
            test.done()
        , 15

  'With listening clients, documents are not reaped': (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.getSnapshot = (docName, callback) -> throw new Error 'The object should still be cached'

    @cache.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.docOpened @name, {id: 'abc123'}
      setTimeout =>
          @cache.getSnapshot @name, (error, data) ->
            test.deepEqual data, {snapshot:{str:'hi'}, type:types['simple'], meta:{}, v:0}
            test.done()
        , 15

  'When a client connects then disconnects, documents are reaped again': (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.getOps = (docName, start, end, callback) -> callback null, []

    called = false
    @db.getSnapshot = (docName, callback) ->
      called = true
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}

    @cache.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      client = {id: 'abc123'}
      @cache.docOpened @name, client, (error) =>
        test.equal error, null
        @cache.docClosed @name, client

        setTimeout =>
            @cache.getSnapshot @name, (error, data) ->
              test.deepEqual data, {snapshot:{str:'hi'}, type:types['simple'], meta:{}, v:0}
              test.strictEqual called, true
              test.done()
          , 15

  'When there is no database, documents are not reaped': (test) ->
    @setDb null

    @cache.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      setTimeout =>
          @cache.getSnapshot @name, (error, data) ->
            test.deepEqual data, {snapshot:{str:'hi'}, type:types['simple'], meta:{}, v:0}
            test.done()
        , 15

  'Submitted ops are cached': (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.writeSnapshot = (docName, data, dbMeta, callback) -> callback()

    @cache.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        @cache.append @name, {v:1, op:[123], meta:{}}, {snapshot:{str:'data3'}, type:'simple', meta:{}, v:2}, (error) =>
          # Ok, now if I call getOps I should get back cached data.
          @cache.getOps @name, 0, 1, (error, ops) =>
            test.equal error, null
            test.deepEqual ops, [{v:0, op:[123], meta:{}}, {v:1, op:[123], meta:{}}]

            @cache.getOps @name, 1, 1, (error, ops) =>
              test.equal error, null
              test.deepEqual ops, [{v:1, op:[123], meta:{}}]

              @cache.getOps @name, 0, 0, (error, ops) =>
                test.equal error, null
                test.deepEqual ops, [{v:0, op:[123], meta:{}}]
                test.done()

  "Ops stop being cached once we have too many of them": (test) ->
    # In the db options, I'm setting the cache limit to 2.
    @db.create = (docName, data, callback) -> callback()
    @db.writeOp = (docName, opData, callback) -> callback()
    @db.writeSnapshot = (docName, data, dbMeta, callback) -> callback()
    @db.getOps = (docName, start, end, callback) =>
      test.strictEqual start, 0
      test.strictEqual end, 0
      test.strictEqual docName, @name
      callback null, [{op:[123], meta:{}}]

    @cache.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        @cache.append @name, {v:1, op:[123], meta:{}}, {snapshot:{str:'data3'}, type:'simple', meta:{}, v:2}, (error) =>
          @cache.append @name, {v:2, op:[123], meta:{}}, {snapshot:{str:'data4'}, type:'simple', meta:{}, v:3}, (error) =>
            # Now the first op shouldn't be cached.
            @cache.getOps @name, 0, 0, (error, ops) ->
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

    @cache.getOps @name, 100, 102, (error, ops) ->
      test.equal error, null
      test.deepEqual ops, [{v:100, op:[100], meta:{}}, {v:101, op:[101], meta:{}}, {v:102, op:[102], meta:{}}]
      test.done()

  'getOps passes errors to the callback': (test) ->
    @db.getOps = (docName, start, end, callback) -> callback 'blargh death'

    @cache.getOps @name, 100, 102, (error, ops) ->
      test.strictEqual error, 'blargh death'
      test.equal ops, null
      test.done()
  
  "getOps() with no db and no cached data returns an error": (test) ->
    @setDb null

    @cache.getOps @name, 100, 102, (error, ops) ->
      # Other valid behaviour: returning no ops.
      test.strictEqual error, 'Document does not exist'
      test.done()

  "getOps() with no db and cached data can return the cached data": (test) ->
    @setDb null

    @cache.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        @cache.append @name, {v:1, op:[123], meta:{}}, {snapshot:{str:'data3'}, type:'simple', meta:{}, v:2}, (error) =>
          @cache.append @name, {v:2, op:[123], meta:{}}, {snapshot:{str:'data4'}, type:'simple', meta:{}, v:3}, (error) =>
            @cache.getOps @name, 0, 2, (error, data) =>
              test.equal error, null
              test.deepEqual data, [{v:0, op:[123], meta:{}}, {v:1, op:[123], meta:{}}, {v:2, op:[123], meta:{}}]

              @cache.getOps @name, 2, 2, (error, data) ->
                test.equal error, null
                test.deepEqual data, [{v:2, op:[123], meta:{}}]
                test.done()

  "getOps sends an error if the document doesn't exist": (test) ->
    @db.getSnapshot = (docName, callback) -> callback 'Document does not exist'
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @cache.getOps @name, 0, null, (error, data) ->
      test.strictEqual error, 'Document does not exist'
      test.equal data, null
      test.done()
  
  "getOps sends an error if the document was deleted": (test) ->
    @db.create = (docName, data, callback) -> callback()
    @db.delete = (docName, dbMeta, callback) -> callback()
    @db.getSnapshot = (docName, callback) -> callback 'Document does not exist'
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @cache.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.delete @name, (error) =>
        @cache.getOps @name, 0, null, (error, data) ->
          test.strictEqual error, 'Document does not exist'
          test.equal data, null
          test.done()

  "getOps sends an error if the document doesn't exist with no db": (test) ->
    @setDb null

    @cache.getOps @name, 0, null, (error, data) ->
      test.strictEqual error, 'Document does not exist'
      test.equal data, null
      test.done()

  'flush with no documents open does nothing': (test) ->
    @cache.flush ->
      test.done()
  
  "flush doesn't need a callback": (test) ->
    @cache.flush()
    test.done()

  'flush with a document thats just been created (and hence is in the DB) does nothing': (test) ->
    @db.create = (docName, data, callback) -> callback()

    @cache.create @name, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.flush ->
        test.done()

  "flush with a document that hasn't been edited does nothing": (test) ->
    @db.getSnapshot = (docName, callback) ->
      callback null, {snapshot:{str:'hi'}, type:'simple', meta:{}, v:0}
    @db.getOps = (docName, start, end, callback) -> callback null, []

    @cache.getSnapshot @name, (error, data) =>
      @cache.flush ->
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

    @cache.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        @cache.flush ->
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

      @cache.flush ->
        test.done()

    @cache.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        @cache.append @name, {v:1, op:[123], meta:{}}, {snapshot:{str:'data3'}, type:'simple', meta:{}, v:2}, (error) =>
          # This callback is called *before* writeSnapshot, so test.done() has to go in the callback above.
          test.equal error, null

  "flush with no database does nothing": (test) ->
    @setDb null

    @cache.create @name, {snapshot:{str:'data1'}, type:'simple', meta:{}, v:0}, (error) =>
      @cache.append @name, {v:0, op:[123], meta:{}}, {snapshot:{str:'data2'}, type:'simple', meta:{}, v:1}, (error) =>
        @cache.flush ->
          test.done()

