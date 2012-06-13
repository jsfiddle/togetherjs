# Tests for the client frontend.

testCase = require('nodeunit').testCase

server = require '../src/server'
types = require '../src/types'

nativeclient = require '../src/client'
webclient = require './helpers/webclient'

{makePassPart, expectCalls} = require('./helpers')

genTests = (client) -> testCase
  setUp: (callback) ->
    @name = 'testingdoc'

    @auth = (client, action) -> action.accept()

    options =
      socketio: null
      rest: null
      browserChannel: {base: '/sjs'}
      db: {type: 'none'}
      auth: (client, action) => @auth client, action

    @model = server.createModel options
    @server = server options, @model
    
    @server.listen =>
      @port = @server.address().port
      @c = new client.Connection "http://localhost:#{@port}/sjs"
      @c.on 'ok', callback
  
  tearDown: (callback) ->
    @c.disconnect()

    @server.on 'close', callback
    @server.close()
  
  'open using the bare API': (test) ->
    client.open @name, 'text', "http://localhost:#{@port}/sjs", (error, doc) =>
      test.ok doc
      test.ifError error

      test.strictEqual doc.snapshot, ''
      test.strictEqual doc.name, @name
      test.strictEqual doc.type.name, types.text.name
      test.strictEqual doc.version, 0

      doc.close()
      test.done()

  'open multiple documents using the bare API on the same connection': (test) ->
    client.open @name, 'text', "http://localhost:#{@port}/sjs", (error, doc1) =>
      test.ok doc1
      test.ifError error

      client.open @name + 2, 'text', "http://localhost:#{@port}/sjs", (error, doc2) ->
        test.ok doc2
        test.ifError error

        doc2.submitOp {i:'hi'}, ->
          test.strictEqual doc2.snapshot, 'hi'
          doc1.submitOp {i:'booyah'}, ->
            test.strictEqual doc1.snapshot, 'booyah'
            doc2.close ->
              doc1.submitOp {i:'more text '}, ->
                test.strictEqual doc1.snapshot, 'more text booyah'
                
                doc1.close()
                doc2.close()
                test.done()

  'create connection': (test) ->
    test.ok @c
    test.done()

  'create a new document': (test) ->
    @c.open @name, 'text', (error, doc) =>
      test.ok doc
      test.ifError error

      test.strictEqual doc.name, @name
      test.strictEqual doc.type.name, types.text.name
      test.strictEqual doc.version, 0
      test.done()

  'open a document that is already open': (test) ->
    @c.open @name, 'text', (error, doc1) =>
      test.ifError error
      test.ok doc1
      test.strictEqual doc1.name, @name
      @c.open @name, 'text', (error, doc2) =>
        test.strictEqual doc1, doc2
        test.done()
  
  'open a document that already exists': (test) ->
    @model.create @name, 'text', =>
      @c.open @name, 'text', (error, doc) =>
        test.ifError error
        test.ok doc

        test.strictEqual doc.type.name, 'text'
        test.strictEqual doc.version, 0
        test.done()

  'open a document with a different type': (test) ->
    @model.create @name, 'simple', =>
      @c.open @name, 'text', (error, doc) =>
        test.ok error
        test.equal doc, null
        test.done()
  
  'submit an op to a document': (test) ->
    @c.open @name, 'text', (error, doc) =>
      test.ifError error
      test.strictEqual doc.name, @name

      doc.submitOp [{i:'hi', p:0}], =>
        test.deepEqual doc.snapshot, 'hi'
        test.strictEqual doc.version, 1
        test.done()

      # The document snapshot should be updated immediately.
      test.strictEqual doc.snapshot, 'hi'
      # ... but the version tracks the server version, so thats still 0.
      test.strictEqual doc.version, 0

  'submit an op to a document using the API works': (test) ->
    @c.open @name, 'text', (error, doc) =>
      doc.insert 0, 'hi', =>
        test.strictEqual doc.snapshot, 'hi'
        test.strictEqual doc.getText(), 'hi'
        @model.getSnapshot @name, (error, {snapshot}) ->
          test.strictEqual snapshot, 'hi'
          test.done()
  
  'submitting an op while another op is inflight works': (test) ->
    @c.open @name, 'text', (error, doc) =>
      test.ifError error

      doc.submitOp [{i:'hi', p:0}], ->
        test.strictEqual doc.version, 1
      doc.flush()

      doc.submitOp [{i:'hi', p:2}], ->
        test.strictEqual doc.version, 2
        test.done()

  'compose multiple ops together when they are submitted together': (test) ->
    @c.open @name, 'text', (error, doc) =>
      test.ifError error
      test.strictEqual doc.name, @name

      doc.submitOp [{i:'hi', p:0}], ->
        test.strictEqual doc.version, 1

      doc.submitOp [{i:'hi', p:0}], ->
        test.strictEqual doc.version, 1
        test.expect 4
        test.done()

  'compose multiple ops together when they are submitted while an op is in flight': (test) ->
    @c.open @name, 'text', (error, doc) =>
      test.ifError error

      doc.submitOp [{i:'hi', p:0}], ->
        test.strictEqual doc.version, 1
      doc.flush()

      doc.submitOp [{i:'hi', p:2}], ->
        test.strictEqual doc.version, 2
      doc.submitOp [{i:'hi', p:4}], ->
        test.strictEqual doc.version, 2
        test.expect 4
        test.done()
  
  'Receive submitted ops': (test) ->
    @c.open @name, 'text', (error, doc) =>
      test.ifError error
      test.strictEqual doc.name, @name

      doc.on 'remoteop', (op) ->
        test.deepEqual op, [{i:'hi', p:0}]

        test.expect 3
        test.done()

      @model.applyOp @name, {v:0, op:[{i:'hi', p:0}]}, (error, version) ->
        test.fail error if error

  'get a nonexistent document passes null to the callback': (test) ->
    @c.openExisting @name, (error, doc) ->
      test.strictEqual error, 'Document does not exist'
      test.equal doc, null
      test.done()
  
  'get an existing document returns the document': (test) ->
    @model.create @name, 'text', =>
      @c.openExisting @name, (error, doc) =>
        test.equal error, null
        test.ok doc

        test.strictEqual doc.name, @name
        test.strictEqual doc.type.name, 'text'
        test.strictEqual doc.version, 0
        test.done()
  
  'client transforms remote ops before applying them': (test) ->
    # There's a bit of magic in the timing of this test. It would probably be more consistent
    # if this test were implemented using a stubbed out backend.

    clientOp = [{i:'client', p:0}]
    serverOp = [{i:'server', p:0}]
    serverTransformed = types.text.transform(serverOp, clientOp, 'right')
    
    finalDoc = types.text.create() # v1
    finalDoc = types.text.apply(finalDoc, clientOp) # v2
    finalDoc = types.text.apply(finalDoc, serverTransformed) #v3

    @c.open @name, 'text', (error, doc) =>
      opsRemaining = 2

      onOpApplied = ->
        opsRemaining--
        unless opsRemaining
          test.strictEqual doc.version, 2
          test.strictEqual doc.snapshot, finalDoc
          test.done()

      doc.submitOp clientOp, onOpApplied
      doc.on 'remoteop', (op) ->
        test.deepEqual op, serverTransformed
        onOpApplied()

      @model.applyOp @name, {v:0, op:serverOp}, (error) ->
        test.fail error if error

  'doc fires both remoteop and change messages when remote ops are received': (test) ->
    passPart = makePassPart test, 2
    @c.open @name, 'text', (error, doc) =>
      sentOp = [{i:'asdf', p:0}]
      doc.on 'change', (op) ->
        test.deepEqual op, sentOp
        passPart()
      doc.on 'remoteop', (op) ->
        test.deepEqual op, sentOp
        passPart()

      @model.applyOp @name, {v:0, op:sentOp}, (error) ->
        test.fail error if error
  
  'doc only fires change ops from locally sent ops': (test) ->
    passPart = makePassPart test, 2
    @c.open @name, 'text', (error, doc) ->
      sentOp = [{i:'asdf', p:0}]
      doc.on 'change', (op) ->
        test.deepEqual op, sentOp
        passPart()
      doc.on 'remoteop', (op) ->
        throw new Error 'Should not have received remoteOp event'

      doc.submitOp sentOp, (error, v) ->
        passPart()
  
  'doc fires acknowledge event when it recieves acknowledgement from server': (test) ->
    passPart = makePassPart test, 1
    @c.open @name, 'text', (error, doc) =>
      test.fail error if error
      sentOp = [{i:'asdf', p:0}]
      doc.on 'acknowledge', (op) ->
        test.deepEqual op, sentOp
        passPart()

      doc.submitOp sentOp

  'doc does not receive ops after close called': (test) ->
    @c.open @name, 'text', (error, doc) =>
      doc.on 'change', (op) ->
        throw new Error 'Should not have received op when the doc was unfollowed'
  
      doc.close =>
        @model.applyOp @name, {v:0, op:[{i:'asdf', p:0}]}, =>
          test.done()

  'created locally is set on new docs': (test) ->
    @c.open @name, 'text', (error, doc) =>
      test.strictEqual doc.created, true
      test.done()

  'created locally is not set on old docs': (test) ->
    @model.create @name, 'text', =>
      @c.open @name, 'text', (error, doc) =>
        test.strictEqual doc.created, false
        test.done()

  'new Connection emits errors if auth rejects you': (test) ->
    @auth = (client, action) -> action.reject()

    c = new client.Connection "http://localhost:#{@port}/sjs"
    c.on 'connect', ->
      test.fail 'connection shouldnt have connected'
    c.on 'connect failed', (error) ->
      test.strictEqual error, 'forbidden'
      test.done()
  
  '(new Connection).open() fails if auth rejects the connection': (test) ->
    @auth = (client, action) -> action.reject()

    passPart = makePassPart test, 2
    c = new client.Connection "http://localhost:#{@port}/sjs"

    # Immediately opening a document should fail when the connection fails
    c.open @name, 'text', (error, doc) =>
      test.fail doc if doc
      test.strictEqual error, 'forbidden'
      passPart()

    c.on 'connect failed', =>
      # The connection is now in an invalid state. Lets try and open a document...
      c.open @name, 'text', (error, doc) =>
        test.fail doc if doc
        test.strictEqual error, 'connection closed'
        passPart()

  '(new Connection).open() fails if auth disallows reads': (test) ->
    @auth = (client, action) ->
      if action.type == 'read' then action.reject() else action.accept()

    c = new client.Connection "http://localhost:#{@port}/sjs"
    c.open @name, 'text', (error, doc) =>
      test.fail doc if doc
      test.strictEqual error, 'forbidden'
      c.disconnect()
      test.done()

  'client.open fails if auth rejects the connection': (test) ->
    @auth = (client, action) -> action.reject()

    client.open @name, 'text', "http://localhost:#{@port}/sjs", (error, doc) =>
      test.fail doc if doc
      test.strictEqual error, 'forbidden'
      test.done()

  'client.open fails if auth disallows reads': (test) ->
    @auth = (client, action) ->
      if action.type == 'read' then action.reject() else action.accept()

    client.open @name, 'text', "http://localhost:#{@port}/sjs", (error, doc) =>
      test.fail doc if doc
      test.strictEqual error, 'forbidden'
      test.done()

  "Can't submit an op if auth rejects you": (test) ->
    @auth = (client, action) ->
      if action.name == 'submit op' then action.reject() else action.accept()

    @c.open @name, 'text', (error, doc) =>
      doc.insert 0, 'hi', (error, op) =>
        test.strictEqual error, 'forbidden'
        test.strictEqual doc.getText(), ''
        # Also need to test that ops sent afterwards get sent correctly.
        # because that behaviour IS CURRENTLY BROKEN

        @model.getSnapshot @name, (error, {snapshot}) ->
          test.strictEqual snapshot, ''
          test.done()

  'If an operation is rejected, the undo is applied as if auth did it': (test) ->
    @auth = (client, action) ->
      if action.name == 'submit op' then action.reject() else action.accept()

    @c.open @name, 'text', (error, doc) =>
      doc.on 'delete', (pos, text) ->
        test.strictEqual text, 'hi'
        test.strictEqual pos, 0
        test.done()

      doc.insert 0, 'hi'

  'If auth rejects your op, other transforms work correctly': (test) ->
    # This should probably have a randomized tester as well.
    @auth = (client, action) ->
      if action.name == 'submit op' and action.op[0].d == 'cC'
        action.reject()
      else
        action.accept()

    @c.open @name, 'text', (error, doc) =>
      doc.insert 0, 'abcCBA', =>
        e = expectCalls 3, =>
          # The b's are successfully deleted, the ds are added by the server and the
          # op to delete the cs is denied.
          @model.getSnapshot @name, (error, {snapshot}) ->
            test.deepEqual snapshot, 'acdDCA'
            test.done()

        doc.del 2, 2, (error, op) => # Delete the 'cC', so the document becomes 'abBA'
          # This op is denied by the auth code
          test.strictEqual error, 'forbidden'
          e()

        test.strictEqual doc.getText(), 'abBA'
        doc.flush()

        # Simultaneously, we'll apply another op locally:
        doc.del 1, 2, -> # Delete the 'bB'
          e()
        test.strictEqual doc.getText(), 'aA'

        # ... and yet another op on the server. (Remember, the server hasn't seen either op yet.)
        @model.applyOp @name, {op:[{i:'dD', p:3}], v:1, meta:{}}, =>
          @model.getSnapshot @name, e

  'Text API is advertised': (test) ->
    @c.open @name, 'text', (error, doc) ->
      test.strictEqual doc.provides?.text, true
      doc.close()
      test.done()
  
  'Text API can be used to insert into the document': (test) ->
    @c.open @name, 'text', (error, doc) =>
      doc.insert 0, 'hi', =>
        test.strictEqual doc.getText(), 'hi'

        @model.getSnapshot @name, (error, data) ->
          test.strictEqual data.snapshot, 'hi'
          doc.close()
          test.done()
  
  'Text documents emit high level editing events': (test) ->
    @c.open @name, 'text', (error, doc) =>
      doc.on 'insert', (pos, text) ->
        test.strictEqual text, 'hi'
        test.strictEqual pos, 0
        doc.close()
        test.done()

      @model.applyOp @name, {op:[{i:'hi', p:0}], v:0, meta:{}}

  'Works with an externally referenced type (like JSON)': (test) ->
    @c.open @name, 'json', (error, doc) ->
      test.ifError error
      test.strictEqual doc.snapshot, null
      doc.submitOp [{p:[], od:null, oi:[1,2,3]}], ->
        test.deepEqual doc.snapshot, [1,2,3]
        doc.close()
        test.done()

  '.open() throws an exception if the type is missing': (test) ->
    test.throws ->
      @c.open @name, 'does not exist', ->
    test.done()

  'Submitting an op and closing straight after works': (test) ->
    # This catches a real bug.
    client.open @name, 'text', "http://localhost:#{@port}/sjs", (error, doc) =>
      doc.insert 0, 'hi'
      doc.close ->
        test.done()

   # ** This is missing tests for submitOp receiving an error through its callback

# This isn't working yet. I might have to rethink it.
#  'opening a document with a null name will open a new document with a random document name': (test) ->
#    client.open null, 'text', {host:'localhost', port:@port}, (error, doc) ->
#      console.log doc.name
#
#      test.strictEqual doc.snapshot, ''
#      test.strictEqual doc.type.name, 'text'
#      test.strictEqual doc.created, true
#      test.done()

exports.native = genTests nativeclient
exports.webclient = genTests webclient
