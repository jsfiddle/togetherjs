# Tests for server/model

assert = require 'assert'
testCase = require('nodeunit').testCase

types = require '../src/types'

server = require '../src/server'
helpers = require './helpers'
applyOps = helpers.applyOps
makePassPart = helpers.makePassPart

# Model tests
module.exports = testCase
  setUp: (callback) ->
    @model = server.createModel {db:{type:'memory'}}
    # When the test is run, a document exists with @name, and @unused is unused.
    @name = 'testingdoc'
    @unused = 'testingdoc2'

    @model.create @name, 'simple', (error, status) =>
      assert.equal error, null
      assert.ok status
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
    @model.create @unused, types.simple, (error, status) =>
      test.equal error, null
      test.strictEqual status, true
      @model.getSnapshot @name, (error, data) =>
        test.equal error, null
        test.deepEqual data, {v:0, type:types.simple, snapshot:{str:''}, meta:{}}
        test.done()
  
  'Creating a document a second time has no effect': (test) ->
    @model.create @name, types.text, (error, status) =>
      test.strictEqual status, false
      @model.getSnapshot @name, (error, data) =>
        test.deepEqual data, {v:0, type:types.simple, snapshot:{str:''}, meta:{}}
        test.done()
  
  'Subsequent calls to getSnapshot work': (test) ->
    # Written in response to a real bug. (!!)
    @model.create @name, types.text, (error, status) =>
      @model.getSnapshot @name, (error, data) =>
        test.deepEqual data, {v:0, type:types.simple, snapshot:{str:''}, meta:{}}
        @model.getSnapshot @name, (error, data) =>
          test.equal error, null
          test.deepEqual data, {v:0, type:types.simple, snapshot:{str:''}, meta:{}}
          test.done()
  
  'Cant create a document with a slash in the name': (test) ->
    @model.create 'foo/bar', types.text, (error, result) ->
      test.strictEqual result, false
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
    @model.delete @name, (error, deleted) =>
      test.equal error, null
      test.strictEqual deleted, true
      @model.getSnapshot @name, (error, data) ->
        test.equal error, 'Document does not exist'
        test.strictEqual data, null
        test.done()
  
  "Pass false to the callback if you delete something that doesn't exist": (test) ->
    @model.delete @unused, (error, deleted) ->
      test.strictEqual error, 'Document does not exist'
      test.strictEqual deleted, false
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
 
