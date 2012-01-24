# Tests for the authentication & authorization code
#
# Docs:
# https://github.com/josephg/ShareJS/wiki/User-access-control
#
# Auth code is still quite new and will likely change. 
#
# The API should look like this:
#    auth = (client, action) ->
#      if action == 'connect'
#        client.sessionMetadata.username = 'nornagon'
#        action.accept()

testCase = require('nodeunit').testCase
assert = require 'assert'

makeConnect = require '../src/server/auth'
types = require '../src/types'
{makePassPart} = require './helpers'

genTests = (async) -> testCase
  setUp: (callback) ->
    options =
      auth: (client, action) =>
        assert.fail 'Action missing type', action unless action.type?
        assert.fail 'type invalid', action unless action.type in ['connect', 'create', 'read', 'update', 'delete']
        assert.fail 'name invalid', action unless typeof action.name is 'string'
        assert.fail 'accept() missing or invalid', action unless typeof action.accept is 'function'
        assert.fail 'reject() missing or invalid', action unless typeof action.reject is 'function'

        assert.fail 'docName missing' if action.name != 'connect' and typeof action.docName != 'string'
        # If I were super paranoid, I'd switch based on the action name and make sure that all the fields are correct
        # as per the docs. But the tests below should cover it.

        if async
          auth = @auth
          process.nextTick => auth client, action
        else
          @auth client, action

    @auth = (client, action) ->
      throw new Error "Unexpected call to @auth(#{action.name})"

    @name = 'testingdoc'

    # Not exposed: flush and applyMetaOp.
    functions = ['create', 'delete', 'getOps', 'getSnapshot', 'getVersion', 'applyOp', 'listen', 'removeListener']
    @model = {}
    for functionName in functions
      @model[functionName] = do (functionName) -> -> throw new Error "Unexpected call to #{functionName}"

    @clientConnect = makeConnect @model, options

    @connectionData =
      headers: {'x-junk': 'rawr'}
      remoteAddress: '127.0.0.1'

    # We'll create a simple helper client to save trouble in a lot of the tests.
    @connect = (callback) =>
      oldAuth = @auth
      @auth = (client, action) -> action.accept()
      @clientConnect @connectionData, (error, @client) =>
        @auth = oldAuth
        assert.fail error if error
        callback()

    callback()

  'A client is created when auth accepts clientConnect': (test) ->
    client = null

    @auth = (c, action) =>
      test.strictEqual action.type, 'connect'
      test.strictEqual action.name, 'connect'

      client = c
      test.strictEqual typeof client.id, 'string'
      test.ok client.id.length > 8
      now = Date.now()
      test.ok now - 1000 < client.connectTime.getTime() <= now
      test.strictEqual client.remoteAddress, '127.0.0.1'
      test.deepEqual client.headers, {'x-junk': 'rawr'}

      action.accept()
    
    @clientConnect @connectionData, (error, c) ->
      test.fail error if error
      test.strictEqual client, c
      test.ok client.id
      test.done()

  'clientConnect returns an error if a client isnt allowed to connect': (test) ->
    @auth = (c, action) -> action.reject()

    @clientConnect @connectionData, (error, client) ->
      test.strictEqual error, 'forbidden'
      test.fail client if client
      test.done()
  
  'client ids are unique': (test) ->
    @auth = (c, action) -> action.accept()

    ids = {}
    passPart = makePassPart test, 1000

    for __ignored in [1..1000] # Cant use for [1..1000] - https://github.com/jashkenas/coffee-script/issues/1714
      @clientConnect @connectionData, (error, client) ->
        throw new Error "repeat ID detected (#{client.id})" if ids[client.id]
        ids[client.id] = true
        passPart()

  # *** getSnapshot

  'getSnapshot works if auth accepts': (test) -> @connect =>
    @auth = (client, action) =>
      test.ok client.id
      test.strictEqual action.docName, @name
      test.strictEqual action.type, 'read'
      test.strictEqual action.name, 'get snapshot'
      action.accept()

    @model.getSnapshot = (docName, callback) =>
      test.strictEqual docName, @name
      callback null, {v:0, snapshot:{str:''}, meta:{}, type:types.simple}

    # The object was created in setUp, above.
    @client.getSnapshot @name, (error, data) ->
      test.deepEqual data, {v:0, snapshot:{str:''}, meta:{}, type:types.simple}
      test.fail error if error

      test.expect 6
      test.done()
  
  'getSnapshot disallowed if auth rejects': (test) -> @connect =>
    @auth = (client, action) -> action.reject()

    @client.getSnapshot @name, (error, data) =>
      test.strictEqual error, 'forbidden'
      test.fail data if data
      test.done()

  # *** getOps
 
  'getOps works if auth accepts': (test) -> @connect =>
    @auth = (client, action) =>
      test.ok client.id
      test.strictEqual action.docName, @name
      test.strictEqual action.type, 'read'
      test.strictEqual action.name, 'get ops'
      test.strictEqual action.start, 0
      test.strictEqual action.end, 1
      action.accept()

    @model.getOps = (docName, start, end, callback) =>
      test.strictEqual @name, docName
      test.strictEqual start, 0
      test.strictEqual end, 1
      callback null, [{v:0, op:{position:0, text:'hi'}, meta:{}}]

    @client.getOps @name, 0, 1, (error, data) ->
      test.fail error if error
      test.strictEqual data.length, 1
      test.deepEqual data, [{v:0, op:{position:0, text:'hi'}, meta:{}}]

      test.expect 11
      test.done()
  
  'getOps returns forbidden': (test) -> @connect =>
    @auth = (client, action) -> action.reject()

    @client.getOps @name, 0, 1, (error, data) ->
      test.strictEqual error, 'forbidden'
      test.fail data if data
      test.done()

  'getOps returns errors from the model': (test) -> @connect =>
    @auth = (client, action) -> action.accept()

    @model.getOps = (docName, start, end, callback) => callback 'Oogedy boogedy'

    @client.getOps @name, 0, 1, (error, data) ->
      test.strictEqual error, 'Oogedy boogedy'
      test.equal data, null
      test.done()
  
  # *** Create

  'create allowed if canCreate() accept': (test) -> @connect =>
    @auth = (client, action) =>
      test.ok client.id

      test.strictEqual action.docName, @name
      test.strictEqual action.docType.name, 'simple'
      test.ok action.meta

      test.strictEqual action.type, 'create'
      test.strictEqual action.name, 'create'
  
      action.accept()

    @model.create = (docName, type, meta, callback) =>
      test.strictEqual docName, @name
      test.strictEqual type, types.simple
      test.deepEqual meta, {}
      callback()

    @client.create @name, 'simple', {}, (error) =>
      test.equal error, null
      test.expect 10
      test.done()
  
  'create not allowed if canCreate() rejects': (test) -> @connect =>
    @auth = (client, action) -> action.reject()

    @client.create @name, 'simple', {}, (error, result) =>
      test.strictEqual error, 'forbidden'
      test.done()
  
  'create returns errors from the model': (test) -> @connect =>
    @auth = (client, action) -> action.accept()

    @model.create = (docName, type, meta, callback) -> callback 'Omg!'
    
    @client.create @name, 'simple', {}, (error) ->
      test.strictEqual error, 'Omg!'
      test.done()

  # *** Submit ops

  'submitOp works': (test) -> @connect =>
    clientId = null

    @auth = (client, action) =>
      test.ok client.id
      clientId = client.id

      test.strictEqual action.docName, @name
      test.strictEqual action.v, 100
      test.deepEqual action.op, {position:0, text:'hi'}
      test.ok action.meta

      test.strictEqual action.type, 'update'
      test.strictEqual action.name, 'submit op'

      action.accept()

    @model.applyOp = (docName, opData, callback) =>
      test.strictEqual docName, @name
      test.strictEqual opData.meta.source, clientId
      delete opData.meta
      test.deepEqual opData, {v:100, op:{position:0, text:'hi'}}
      callback null, 100

    @client.submitOp @name, {v:100, op:{position:0, text:'hi'}}, (error, result) =>
      test.equal error, null
      test.strictEqual result, 100
      test.expect 12
      test.done()
  
  'submitOp doesnt work if rejected': (test) -> @connect =>
    @auth = (client, action) -> action.reject()

    @client.submitOp @name, {v:100, op:{position:0, text:'hi'}}, (error, result) =>
      test.equal result, null
      test.strictEqual error, 'forbidden'
      test.done()
  
  'submitOp returns errors from the model': (test) -> @connect =>
    # Its important that information about documents doesn't leak unintentionally.
    @auth = (client, action) -> action.accept()

    @model.applyOp = (docName, opData, callback) => callback 'Game over'

    @client.submitOp @name, {v:100, op:{position:0, text:'hi'}}, (error, result) =>
      test.equal result, null
      test.strictEqual error, 'Game over'
      test.done()

  # *** Listen
  
  'Listen works': (test) -> @connect =>
    @auth = (client, action) =>
      test.strictEqual action.docName, @name

      test.strictEqual action.type, 'read'
      test.strictEqual action.name, 'open'

      action.accept()

    listener = ->
    
    @model.listen = (docName, version, _listener, callback) =>
      test.strictEqual docName, @name
      test.strictEqual _listener, listener
      test.strictEqual version, null
      callback null, 100

    @client.listen @name, null, listener, (error, result) =>
      test.equal error, null
      test.strictEqual result, 100
      test.expect 8
      test.done()

  'Listen denied if auth open returns false': (test) -> @connect =>
    @auth = (client, action) -> action.reject()

    @client.listen @name, null, (->), (error, result) =>
      test.strictEqual error, 'forbidden'
      test.equal result, null
      test.done()

  'Listen at version works': (test) -> @connect =>
    # Listening at a specified version should result in 2 auth() calls.
    @auth = (client, action) =>
      test.strictEqual action.docName, @name

      test.strictEqual action.type, 'read'
      test.ok action.name == 'open' or action.name == 'get ops'

      action.accept()

    listener = ->

    @model.listen = (docName, version, _listener, callback) =>
      test.strictEqual docName, @name
      test.strictEqual _listener, listener
      test.strictEqual version, 100
      callback null, 100

    @client.listen @name, 100, listener, (error, result) =>
      test.equal error, null
      test.strictEqual result, 100
      test.expect 11
      test.done()

  'Open at version denied if opens are rejected': (test) -> @connect =>
    @auth = (client, action) =>
      if action.name == 'open' then action.reject() else action.accept()

    @client.listen @name, 100, (->), (error, result) =>
      test.strictEqual error, 'forbidden'
      test.equal result, null
      test.done()

  'Open at version denied if get ops are rejected': (test) -> @connect =>
    @auth = (client, action) =>
      if action.name == 'get ops' then action.reject() else action.accept()

    @client.listen @name, 100, (->), (error, result) =>
      test.strictEqual error, 'forbidden'
      test.equal result, null
      test.done()

  'Adding multiple listeners to a document produces an error': (test) -> @connect =>
    @auth = (client, action) -> action.accept()
    @model.listen = (docName, version, listener, callback) -> callback null, version

    @client.listen @name, 100, (->), (error, result) =>
      @model.listen = (docName, version, listener, callback) -> throw new Error 'listen called a second time'
      @client.listen @name, 100, (->), (error, result) =>
        test.strictEqual error, 'Document is already open'
        test.equal result, null
        test.done()

  'removeListener calls removeListener on the model': (test) -> @connect =>
    @auth = (client, action) -> action.accept()

    listener = ->

    @model.listen = (docName, version, listener, callback) -> callback null, version
    @model.removeListener = (docName, _listener) =>
      test.strictEqual docName, @name
      test.strictEqual listener, _listener

    @client.listen @name, 100, listener, (error, result) =>
      @client.removeListener @name
      test.expect 2
      test.done()


  # *** Delete

  'delete works if allowed': (test) -> @connect =>
    @auth = (client, action) =>
      test.strictEqual action.docName, @name

      test.strictEqual action.type, 'delete'
      test.strictEqual action.name, 'delete'
      action.accept()

    @model.delete = (docName, callback) =>
      test.strictEqual docName, @name
      callback()

    @client.delete @name, (error) =>
      test.equal error, null
      test.expect 5
      test.done()
  
  'delete fails if canDelete does not allow it': (test) -> @connect =>
    @auth = (client, action) -> action.reject()

    @client.delete @name, (error) =>
      test.strictEqual error, 'forbidden'
      test.done()

  'delete passes errors from the model': (test) -> @connect =>
    @auth = (client, action) -> action.accept()

    @model.delete = (docName, callback) -> callback 'Needs more tusks!'

    @client.delete @name, (error) ->
      test.strictEqual error, 'Needs more tusks!'
      test.done()

  # *** Misc
  'An auth function calling accept/reject multiple times throws an exception': (test) -> @connect =>
    @auth = (client, action) ->
      action.accept()
      test.throws -> action.accept()

    @model.getSnapshot = (docName, callback) -> callback null, {}

    @client.getSnapshot @name, ->

    @auth = (client, action) ->
      action.accept()
      test.throws -> action.reject()

    @client.getSnapshot @name, ->

    @auth = (client, action) ->
      action.reject()
      test.throws -> action.accept()

    @client.getSnapshot @name, ->

    @auth = (client, action) ->
      action.reject()
      test.throws -> action.reject()

    @client.getSnapshot @name, ->

    @auth = (client, action) ->
      action.reject()
      process.nextTick ->
        test.throws -> action.reject()

    @client.getSnapshot @name, ->

    test.done()

exports.sync = genTests false
exports.async = genTests true
