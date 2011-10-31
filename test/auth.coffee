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

server = require '../src/server'
types = require '../src/types'
{makePassPart} = require './helpers'

genTests = (async) -> testCase
  setUp: (callback) ->
    options =
      db: {type: 'none'}
      auth: (client, action) =>
        assert.strictEqual client, @client, 'client missing or invalid' unless action.name == 'connect'
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
      throw new Error "Unexpected call to @can(#{action})"

    @name = 'testingdoc'
    @unused = 'testingdoc2'

    @model = server.createModel options
    @connectionData =
      headers: {'x-junk': 'rawr'}
      remoteAddress: '127.0.0.1'

    @client =
      id:'abcde12345'
      openDocs:{}

    @model.create @name, 'simple', -> callback()

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
    
    @model.clientConnect @connectionData, (error, c) ->
      test.fail error if error
      test.strictEqual client, c
      test.ok client.id
      test.done()

  'clientConnect returns an error if a client isnt allowed to connect': (test) ->
    @auth = (c, action) -> action.reject()

    @model.clientConnect @connectionData, (error, client) ->
      test.strictEqual error, 'forbidden'
      test.fail client if client
      test.done()
  
  'client ids are unique': (test) ->
    @auth = (c, action) -> action.accept()

    ids = {}
    passPart = makePassPart test, 1000

    for __ignored in [1..1000] # Cant use for [1..1000] - https://github.com/jashkenas/coffee-script/issues/1714
      @model.clientConnect @connectionData, (error, client) ->
        throw new Error "repeat ID detected (#{client.id})" if ids[client.id]
        ids[client.id] = true
        passPart()

  'getSnapshot works if auth accepts': (test) ->
    @auth = (client, action) =>
      test.ok client.id
      test.strictEqual action.docName, @name
      test.strictEqual action.type, 'read'
      test.strictEqual action.name, 'get snapshot'
      action.accept()

    # The object was created in setUp, above.
    @model.clientGetSnapshot @client, @name, (error, data) ->
      test.deepEqual data, {v:0, snapshot:{str:''}, meta:{}, type:types.simple}
      test.fail error if error

      test.expect 5
      test.done()
  
  'getSnapshot disallowed if auth rejects': (test) ->
    @auth = (client, action) -> action.reject()

    @model.clientGetSnapshot @client, @name, (error, data) =>
      test.strictEqual error, 'forbidden'
      test.fail data if data
      test.done()

  'getOps works if auth accepts': (test) ->
    @auth = (client, action) =>
      test.ok client.id
      test.strictEqual action.docName, @name
      test.strictEqual action.type, 'read'
      test.strictEqual action.name, 'get ops'
      test.strictEqual action.start, 0
      test.strictEqual action.end, 1
      action.accept()

    @model.applyOp @name, {v:0, op:{position:0, text:'hi'}}, =>
      @model.clientGetOps @client, @name, 0, 1, (error, data) ->
        test.strictEqual data.length, 1
        test.deepEqual data[0].op, {position:0, text:'hi'}
        test.fail error if error

        test.expect 8
        test.done()
  
  'getOps returns forbidden': (test) ->
    @auth = (client, action) -> action.reject()

    @model.applyOp @name, {v:0, op:{position:0, text:'hi'}}, =>
      @model.clientGetOps @client, @name, 0, 1, (error, data) ->
        test.strictEqual error, 'forbidden'
        test.fail data if data
        test.done()

  'getOps returns Document does not exist for documents that dont exist if its allowed': (test) ->
    @auth = (client, action) -> action.accept()

    @model.clientGetOps @client, @unused, 0, 1, (error, data) ->
      test.fail data if data
      test.strictEqual error, 'Document does not exist'
      test.done()
  
  "getOps returns forbidden for documents that don't exist if it can't read": (test) ->
    @auth = (client, action) -> action.reject()

    @model.clientGetOps @client, @unused, 0, 1, (error, data) ->
      test.fail data if data
      test.strictEqual error, 'forbidden'
      test.done()

  'create allowed if canCreate() accept': (test) ->
    @auth = (client, action) =>
      test.ok client.id

      test.strictEqual action.docName, @unused
      test.strictEqual action.docType.name, 'simple'
      test.ok action.meta

      test.strictEqual action.type, 'create'
      test.strictEqual action.name, 'create'
  
      action.accept()

    @model.clientCreate @client, @unused, 'simple', {}, (error) =>
      test.fail error if error

      @model.getVersion @unused, (error, v) ->
        test.fail error if error
        test.strictEqual v, 0

        test.expect 7
        test.done()
  
  'create not allowed if canCreate() rejects': (test) ->
    @auth = (client, action) -> action.reject()

    @model.clientCreate @client, @unused, 'simple', {}, (error, result) =>
      test.strictEqual error, 'forbidden'

      @model.getVersion @unused, (error, v) ->
        test.strictEqual 'Document does not exist', error
        test.fail result if result
        test.done()
  
  'create returns false if the document already exists, and youre allowed to know': (test) ->
    @auth = (client, action) -> action.accept()
    
    @model.clientCreate @client, @name, 'simple', {}, (error) ->
      test.strictEqual error, 'Document already exists'
      test.done()

  'applyOps works': (test) ->
    @auth = (client, action) =>
      test.ok client.id

      test.strictEqual action.docName, @name
      test.strictEqual action.v, 0
      test.deepEqual action.op, {position:0, text:'hi'}
      test.ok action.meta

      test.strictEqual action.type, 'update'
      test.strictEqual action.name, 'submit op'

      action.accept()

    @model.clientSubmitOp @client, @name, {v:0, op:{position:0, text:'hi'}}, (error, result) =>
      test.fail error if error
      test.strictEqual result, 0

      @model.getVersion @name, (error, v) ->
        test.strictEqual v, 1
        test.expect 9
        test.done()
  
  'applyOps doesnt work if rejected': (test) ->
    @auth = (client, action) -> action.reject()

    @model.clientSubmitOp @client, @name, {v:0, op:{position:0, text:'hi'}}, (error, result) =>
      test.fail result if result
      test.strictEqual error, 'forbidden'

      @model.getVersion @name, (error, v) ->
        test.strictEqual v, 0
        test.done()
  
  'applyOps on a nonexistant document returns forbidden': (test) ->
    # Its important that information about documents doesn't leak unintentionally.
    @auth = (client, action) -> action.reject()

    @model.clientSubmitOp @client, @unused, {v:0, op:{position:0, text:'hi'}}, (error, result) =>
      test.fail result if result
      test.strictEqual error, 'forbidden'
      test.done()
  
  'Open works': (test) ->
    @auth = (client, action) =>
      test.strictEqual action.docName, @name

      test.strictEqual action.type, 'read'
      test.strictEqual action.name, 'open'

      action.accept()

    listener = (data) ->
      test.deepEqual data.op, {position:0, text:'hi'}
      test.strictEqual data.v, 0
      test.done()

    @model.clientOpen @client, @name, null, listener, (error, result) =>
      test.fail error if error
      @model.applyOp @name, {v:0, op:{position:0, text:'hi'}}, ->

  'Open denied if auth open returns false': (test) ->
    @auth = (client, action) -> action.reject()

    listener = (data) -> test.fail 'listener should not be called'

    @model.clientOpen @client, @name, null, listener, (error, result) =>
      test.fail result if result
      test.strictEqual error, 'forbidden'

      @model.applyOp @name, {v:0, op:{position:0, text:'hi'}}, ->
        test.done()

  'Open at version works': (test) ->
    @auth = (client, action) =>
      test.strictEqual action.docName, @name

      test.strictEqual action.type, 'read'
      test.ok action.name == 'open' or action.name == 'get ops'

      action.accept()

    # First, we should see v0
    seenv0 = false
    listener = (data) ->
      unless seenv0
        assert.deepEqual data.op, {position:0, text:'hi'}
        assert.strictEqual data.v, 0
        seenv0 = true
      else
        assert.deepEqual data.op, {position:2, text:' there'}
        assert.strictEqual data.v, 1
        test.done()

    @model.applyOp @name, {v:0, op:{position:0, text:'hi'}}, =>
      @model.clientOpen @client, @name, 0, listener, (error, result) =>
        test.fail error if error
        @model.applyOp @name, {v:1, op:{position:2, text:' there'}}

  'Open at version denied if auth rejects': (test) ->
    @auth = (client, action) =>
      if action.name == 'open' then action.reject() else action.accept()

    listener = (data) ->
      test.fail 'should not be called.'

    @model.applyOp @name, {v:0, op:{position:0, text:'hi'}}, =>
      # Both of these should fail.
      @model.clientOpen @client, @name, 0, listener, (error, result) =>
        test.strictEqual error, 'forbidden'
        test.fail result if result?
        @model.clientOpen @client, @name, 1, listener, (error, result) =>
          test.strictEqual error, 'forbidden'
          test.fail result if result?
          @model.applyOp @name, {v:1, op:{position:2, text:' there'}}, ->
            process.nextTick -> test.done()

  'Open at version denied if get ops rejects': (test) ->
    @auth = (client, action) =>
      if action.name == 'get ops' then action.reject() else action.accept()

    listener = (data) ->
      test.fail 'should not be called.'

    @model.applyOp @name, {v:0, op:{position:0, text:'hi'}}, =>
      # Both of these should fail.
      @model.clientOpen @client, @name, 0, listener, (error, result) =>
        test.strictEqual error, 'forbidden'
        test.fail result if result?
        # I'm only checking that open fails when you try and listen from an old version.
        # There's no particular reason for it to fail if you try and listen from the current version
        # and you don't allow get ops.
        @model.applyOp @name, {v:1, op:{position:2, text:' there'}}, ->
          process.nextTick -> test.done()

  'delete works if allowed': (test) ->
    @auth = (client, action) =>
      test.strictEqual action.docName, @name

      test.strictEqual action.type, 'delete'
      test.strictEqual action.name, 'delete'
      action.accept()

    @model.clientDelete @client, @name, (error) =>
      test.fail error if error

      @model.getVersion @name, (error, v) ->
        # The document should not exist anymore.
        test.strictEqual error, 'Document does not exist'
        test.expect 4
        test.done()
  
  'delete fails if canDelete does not allow it': (test) ->
    @auth = (client, action) -> action.reject()

    @model.clientDelete @client, @name, (error) =>
      test.strictEqual error, 'forbidden'

      @model.getVersion @name, (error, v) ->
        test.strictEqual v, 0
        test.done()
  
  'delete returns forbidden on a nonexistant document': (test) ->
    @auth = (client, action) -> action.reject()

    @model.clientDelete @client, @unused, (error) ->
      test.strictEqual error, 'forbidden'
      test.done()

  'An auth function calling accept/reject multiple times throws an exception': (test) ->
    @auth = (client, action) ->
      action.accept()
      test.throws -> action.accept()

    @model.clientGetSnapshot @client, @unused, ->

    @auth = (client, action) ->
      action.accept()
      test.throws -> action.reject()

    @model.clientGetSnapshot @client, @unused, ->

    @auth = (client, action) ->
      action.reject()
      test.throws -> action.accept()

    @model.clientGetSnapshot @client, @unused, ->

    @auth = (client, action) ->
      action.reject()
      test.throws -> action.reject()

    @model.clientGetSnapshot @client, @unused, ->

    @auth = (client, action) ->
      action.reject()
      process.nextTick ->
        test.throws -> action.reject()

    @model.clientGetSnapshot @client, @unused, ->

    test.done()

exports.sync = genTests false
exports.async = genTests true
