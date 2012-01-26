# Tests for the user agent. The user agent is responsible for maintaining
# the client-specific metadata and calling out to the auth function.
#
# Docs:
# https://github.com/josephg/ShareJS/wiki/Document-Metadata
# https://github.com/josephg/ShareJS/wiki/User-access-control
#
# The auth function should look like this:
#    auth = (agent, action) ->
#      if action == 'connect'
#        agent.sessionMetadata.username = 'nornagon'
#        action.accept()

testCase = require('nodeunit').testCase
assert = require 'assert'

makeAgent = require '../src/server/useragent'
types = require '../src/types'
{makePassPart} = require './helpers'

genTests = (async) -> testCase
  setUp: (callback) ->
    options =
      auth: (agent, action) =>
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
          process.nextTick => auth agent, action
        else
          @auth agent, action

    @auth = (agent, action) -> action.accept()

    @name = 'testingdoc'

    # Not exposed: flush and applyMetaOp.
    functions = ['create', 'delete', 'getOps', 'getSnapshot', 'getVersion', 'applyOp', 'listen', 'removeListener']
    @model = {}
    for functionName in functions
      @model[functionName] = do (functionName) -> -> throw new Error "Unexpected call to #{functionName}"

    @agentConnect = makeAgent @model, options

    @connectionData =
      headers: {'x-junk': 'rawr'}
      remoteAddress: '127.0.0.1'

    # We'll create a simple helper agent to save trouble in a lot of the tests.
    @connect = (callback) =>
      oldAuth = @auth
      @auth = (agent, action) -> action.accept()
      @agentConnect @connectionData, (error, @agent) =>
        @auth = oldAuth
        assert.fail error if error
        callback()

    callback()

  'A user agent is created when auth accepts agentConnect': (test) ->
    agent = null

    @auth = (c, action) =>
      test.strictEqual action.type, 'connect'
      test.strictEqual action.name, 'connect'

      agent = c
      test.strictEqual typeof agent.sessionId, 'string'
      test.ok agent.sessionId.length > 8
      now = Date.now()
      test.ok now - 1000 < agent.connectTime.getTime() <= now
      test.strictEqual agent.remoteAddress, '127.0.0.1'
      test.deepEqual agent.headers, {'x-junk': 'rawr'}

      action.accept()
    
    @agentConnect @connectionData, (error, c) ->
      test.fail error if error
      test.strictEqual agent, c
      test.ok agent.sessionId
      test.done()

  'agentConnect returns an error if a client isnt allowed to connect': (test) ->
    @auth = (c, action) -> action.reject()

    @agentConnect @connectionData, (error, agent) ->
      test.strictEqual error, 'forbidden'
      test.fail agent if agent
      test.done()
  
  'agent.sessionIds are unique': (test) ->
    @auth = (c, action) -> action.accept()

    ids = {}
    passPart = makePassPart test, 1000

    for __ignored in [1..1000] # Cant use for [1..1000] - https://github.com/jashkenas/coffee-script/issues/1714
      @agentConnect @connectionData, (error, agent) ->
        throw new Error "repeat ID detected (#{agent.sessionId})" if ids[agent.sessionId]
        ids[agent.sessionId] = true
        passPart()

  # *** getSnapshot

  'getSnapshot works if auth accepts': (test) -> @connect =>
    @auth = (agent, action) =>
      test.ok agent.sessionId
      test.strictEqual action.docName, @name
      test.strictEqual action.type, 'read'
      test.strictEqual action.name, 'get snapshot'
      action.accept()

    @model.getSnapshot = (docName, callback) =>
      test.strictEqual docName, @name
      callback null, {v:0, snapshot:{str:''}, meta:{}, type:types.simple}

    # The object was created in setUp, above.
    @agent.getSnapshot @name, (error, data) ->
      test.deepEqual data, {v:0, snapshot:{str:''}, meta:{}, type:types.simple}
      test.fail error if error

      test.expect 6
      test.done()
  
  'getSnapshot disallowed if auth rejects': (test) -> @connect =>
    @auth = (agent, action) -> action.reject()

    @agent.getSnapshot @name, (error, data) =>
      test.strictEqual error, 'forbidden'
      test.fail data if data
      test.done()

  # *** getOps
 
  'getOps works if auth accepts': (test) -> @connect =>
    @auth = (agent, action) =>
      test.ok agent.sessionId
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

    @agent.getOps @name, 0, 1, (error, data) ->
      test.fail error if error
      test.strictEqual data.length, 1
      test.deepEqual data, [{v:0, op:{position:0, text:'hi'}, meta:{}}]

      test.expect 11
      test.done()
  
  'getOps returns forbidden': (test) -> @connect =>
    @auth = (agent, action) -> action.reject()

    @agent.getOps @name, 0, 1, (error, data) ->
      test.strictEqual error, 'forbidden'
      test.fail data if data
      test.done()

  'getOps returns errors from the model': (test) -> @connect =>
    @auth = (agent, action) -> action.accept()

    @model.getOps = (docName, start, end, callback) => callback 'Oogedy boogedy'

    @agent.getOps @name, 0, 1, (error, data) ->
      test.strictEqual error, 'Oogedy boogedy'
      test.equal data, null
      test.done()
  
  # *** Create

  'create allowed if canCreate() accept': (test) -> @connect =>
    @auth = (agent, action) =>
      test.ok agent.sessionId

      test.strictEqual action.docName, @name
      test.strictEqual action.docType.name, 'simple'
      test.ok action.meta

      test.strictEqual action.type, 'create'
      test.strictEqual action.name, 'create'
  
      action.accept()

    @model.create = (docName, type, meta, callback) =>
      test.strictEqual docName, @name
      test.strictEqual type, types.simple
      callback()

    @agent.create @name, 'simple', {}, (error) =>
      test.equal error, null
      test.expect 9
      test.done()

  'create sets meta.creator:agent.name if the agent has .name set': (test) -> @connect =>
    # Technically, this should probably be set during the initial connect, but it doesn't matter.
    @agent.name = 'laura'

    @model.create = (docName, type, meta, callback) =>
      test.strictEqual meta.creator, 'laura'
      callback()

    @agent.create @name, 'simple', {}, (error) =>
      test.equal error, null
      test.expect 2
      test.done()

  'create does not set meta.creator if the agent does not have .name set': (test) -> @connect =>
    @model.create = (docName, type, meta, callback) =>
      test.strictEqual meta.creator, undefined
      callback()

    @agent.create @name, 'simple', {}, (error) => test.done()

  'create sets meta.ctime and mtime': (test) -> @connect =>
    @model.create = (docName, type, meta, callback) =>
      test.ok (Date.now() - meta.ctime) < 20
      test.ok (Date.now() - meta.mtime) < 20
      callback()

    @agent.create @name, 'simple', {}, (error) => test.done()

  "A client can't override ctime, mtime and creator": (test) -> @connect =>
    @model.create = (docName, type, meta, callback) =>
      test.ok (Date.now() - meta.ctime) < 20
      test.ok (Date.now() - meta.mtime) < 20
      test.strictEqual meta.creator, undefined
      callback()

    @agent.create @name, 'simple', {creator:'fred', ctime:10, mtime:20}, (error) => test.done()
  
  'create not allowed if canCreate() rejects': (test) -> @connect =>
    @auth = (agent, action) -> action.reject()

    @agent.create @name, 'simple', {}, (error, result) =>
      test.strictEqual error, 'forbidden'
      test.done()
  
  'create returns errors from the model': (test) -> @connect =>
    @auth = (agent, action) -> action.accept()

    @model.create = (docName, type, meta, callback) -> callback 'Omg!'
    
    @agent.create @name, 'simple', {}, (error) ->
      test.strictEqual error, 'Omg!'
      test.done()

  # *** Submit ops

  'submitOp works': (test) -> @connect =>
    sessionId = null

    @auth = (agent, action) =>
      test.ok agent.sessionId
      sessionId = agent.sessionId

      test.strictEqual action.docName, @name
      test.strictEqual action.v, 100
      test.deepEqual action.op, {position:0, text:'hi'}
      test.ok action.meta

      test.strictEqual action.type, 'update'
      test.strictEqual action.name, 'submit op'

      action.accept()

    @model.applyOp = (docName, opData, callback) =>
      test.strictEqual docName, @name
      test.strictEqual opData.meta.source, sessionId
      delete opData.meta
      test.deepEqual opData, {v:100, op:{position:0, text:'hi'}}
      callback null, 100

    @agent.submitOp @name, {v:100, op:{position:0, text:'hi'}}, (error, result) =>
      test.equal error, null
      test.strictEqual result, 100
      test.expect 12
      test.done()
  
  'submitOp doesnt work if rejected': (test) -> @connect =>
    @auth = (agent, action) -> action.reject()

    @agent.submitOp @name, {v:100, op:{position:0, text:'hi'}}, (error, result) =>
      test.equal result, null
      test.strictEqual error, 'forbidden'
      test.done()
  
  'submitOp returns errors from the model': (test) -> @connect =>
    # Its important that information about documents doesn't leak unintentionally.
    @auth = (agent, action) -> action.accept()

    @model.applyOp = (docName, opData, callback) => callback 'Game over'

    @agent.submitOp @name, {v:100, op:{position:0, text:'hi'}}, (error, result) =>
      test.equal result, null
      test.strictEqual error, 'Game over'
      test.done()

  # *** Listen
  
  'Listen works': (test) -> @connect =>
    @auth = (agent, action) =>
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

    @agent.listen @name, null, listener, (error, result) =>
      test.equal error, null
      test.strictEqual result, 100
      test.expect 8
      test.done()

  'Listen denied if auth open returns false': (test) -> @connect =>
    @auth = (agent, action) -> action.reject()

    @agent.listen @name, null, (->), (error, result) =>
      test.strictEqual error, 'forbidden'
      test.equal result, null
      test.done()

  'Listen at version works': (test) -> @connect =>
    # Listening at a specified version should result in 2 auth() calls.
    @auth = (agent, action) =>
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

    @agent.listen @name, 100, listener, (error, result) =>
      test.equal error, null
      test.strictEqual result, 100
      test.expect 11
      test.done()

  'Open at version denied if opens are rejected': (test) -> @connect =>
    @auth = (agent, action) =>
      if action.name == 'open' then action.reject() else action.accept()

    @agent.listen @name, 100, (->), (error, result) =>
      test.strictEqual error, 'forbidden'
      test.equal result, null
      test.done()

  'Open at version denied if get ops are rejected': (test) -> @connect =>
    @auth = (agent, action) =>
      if action.name == 'get ops' then action.reject() else action.accept()

    @agent.listen @name, 100, (->), (error, result) =>
      test.strictEqual error, 'forbidden'
      test.equal result, null
      test.done()

  'Adding multiple listeners to a document produces an error': (test) -> @connect =>
    @auth = (agent, action) -> action.accept()
    @model.listen = (docName, version, listener, callback) -> callback null, version

    @agent.listen @name, 100, (->), (error, result) =>
      @model.listen = (docName, version, listener, callback) -> throw new Error 'listen called a second time'
      @agent.listen @name, 100, (->), (error, result) =>
        test.strictEqual error, 'Document is already open'
        test.equal result, null
        test.done()

  'removeListener calls removeListener on the model': (test) -> @connect =>
    @auth = (agent, action) -> action.accept()

    listener = ->

    @model.listen = (docName, version, listener, callback) -> callback null, version
    @model.removeListener = (docName, _listener) =>
      test.strictEqual docName, @name
      test.strictEqual listener, _listener

    @agent.listen @name, 100, listener, (error, result) =>
      @agent.removeListener @name
      test.expect 2
      test.done()


  # *** Delete

  'delete works if allowed': (test) -> @connect =>
    @auth = (agent, action) =>
      test.strictEqual action.docName, @name

      test.strictEqual action.type, 'delete'
      test.strictEqual action.name, 'delete'
      action.accept()

    @model.delete = (docName, callback) =>
      test.strictEqual docName, @name
      callback()

    @agent.delete @name, (error) =>
      test.equal error, null
      test.expect 5
      test.done()
  
  'delete fails if canDelete does not allow it': (test) -> @connect =>
    @auth = (agent, action) -> action.reject()

    @agent.delete @name, (error) =>
      test.strictEqual error, 'forbidden'
      test.done()

  'delete passes errors from the model': (test) -> @connect =>
    @auth = (agent, action) -> action.accept()

    @model.delete = (docName, callback) -> callback 'Needs more tusks!'

    @agent.delete @name, (error) ->
      test.strictEqual error, 'Needs more tusks!'
      test.done()

  # *** Misc
  'An auth function calling accept/reject multiple times throws an exception': (test) -> @connect =>
    @auth = (agent, action) ->
      action.accept()
      test.throws -> action.accept()

    @model.getSnapshot = (docName, callback) -> callback null, {}

    @agent.getSnapshot @name, ->

    @auth = (agent, action) ->
      action.accept()
      test.throws -> action.reject()

    @agent.getSnapshot @name, ->

    @auth = (agent, action) ->
      action.reject()
      test.throws -> action.accept()

    @agent.getSnapshot @name, ->

    @auth = (agent, action) ->
      action.reject()
      test.throws -> action.reject()

    @agent.getSnapshot @name, ->

    @auth = (agent, action) ->
      action.reject()
      process.nextTick ->
        test.throws -> action.reject()

    @agent.getSnapshot @name, ->

    test.done()

exports.sync = genTests false
exports.async = genTests true
