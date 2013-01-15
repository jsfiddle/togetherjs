assert = require 'assert'
json = require '../../src/types/json'
require '../../src/types/json-api'
MicroEvent = require '../../src/client/microevent'

Doc = (data) ->
  @snapshot = data ? json.create()
  @type = json
  @submitOp = (op) ->
    @snapshot = json.apply @snapshot, op
    @emit 'change', op
  @_register()
Doc.prototype = json.api
MicroEvent.mixin Doc

module.exports =
  sanity: (test) ->
    doc = new Doc 'hi'
    assert.equal doc.get(), 'hi'
    doc = new Doc {hello:'world'}
    assert.equal doc.getAt(['hello']), 'world'
    test.done()

  'getAt': (test) ->
    doc = new Doc {hi:[1,2,3]}
    assert.equal doc.getAt(['hi', 2]), 3
    test.done()
  'sub-doc get': (test) ->
    doc = new Doc {hi:[1,2,3]}
    hi = doc.at 'hi'
    assert.deepEqual hi.get(), [1,2,3]
    assert.equal hi.at(2).get(), 3
    test.done()

  'object set': (test) ->
    doc = new Doc
    doc.at().set {hello:'world'}
    assert.deepEqual doc.get(), {hello:'world'}
    doc.at('hello').set 'blah'
    assert.deepEqual doc.get(), {hello:'blah'}
    test.done()
  'list set': (test) ->
    doc = new Doc [1,2,3]
    doc.at(1).set 5
    assert.deepEqual doc.get(), [1,5,3]
    test.done()

  'remove': (test) ->
    doc = new Doc {hi:[1,2,3]}
    hi = doc.at('hi')
    hi.at(0).remove()
    assert.deepEqual doc.get(), {hi:[2,3]}
    hi.remove()
    assert.deepEqual doc.get(), {}
    test.done()

  'insert text': (test) ->
    doc = new Doc {text:"Hello there!"}
    doc.at('text').insert 11, ', ShareJS'
    assert.deepEqual doc.get(), {text:'Hello there, ShareJS!'}
    test.done()
  'delete text': (test) ->
    doc = new Doc {text:"Sup, share?"}
    doc.at('text').del(3, 7)
    assert.deepEqual doc.get(), {text:'Sup?'}
    test.done()

  'list insert': (test) ->
    doc = new Doc {nums:[1,2]}
    doc.at('nums').insert 0, 4
    assert.deepEqual doc.get(), {nums:[4,1,2]}
    test.done()
  'list push': (test) ->
    doc = new Doc {nums:[1,2]}
    doc.at('nums').push 3
    assert.deepEqual doc.get(), {nums:[1,2,3]}
    test.done()

  'list move': (test) ->
    doc = new Doc {list:[1,2,3,4]}
    list = doc.at('list')
    list.move(0,3)
    assert.deepEqual doc.get(), {list:[2,3,4,1]}
    test.done()

  'number add': (test) ->
    doc = new Doc [1]
    doc.at(0).add(4)
    assert.deepEqual doc.get(), [5]
    test.done()

  'basic listeners': (test) ->
    doc = new Doc {list:[1]}
    doc.at('list').on 'insert', (pos, num) ->
      assert.equal num, 4
      assert.equal pos, 0
      test.done()
    doc.emit 'remoteop', [{p:['list',0],li:4}], doc.get()
  'object replace listener': (test) ->
    doc = new Doc {foo:'bar'}
    doc.at().on 'replace', (pos, before, after) ->
      assert.equal before, 'bar'
      assert.equal after, 'baz'
      assert.equal pos, 'foo'
      test.done()
    doc.emit 'remoteop', [{p:['foo'],od:'bar',oi:'baz'}]
  'list replace listener': (test) ->
    doc = new Doc ['bar']
    doc.at().on 'replace', (pos, before, after) ->
      assert.equal before, 'bar'
      assert.equal after, 'baz'
      assert.equal pos, 0
      test.done()
    doc.emit 'remoteop', [{p:[0],ld:'bar',li:'baz'}]

  'listener moves on li': (test) ->
    doc = new Doc ['bar']
    doc.at(0).on 'insert', (i, s) ->
      assert.equal s, 'foo'
      assert.equal i, 0
      test.done()
    doc.at().insert 0, 'asdf'
    doc.emit 'remoteop', [{p:[1,0], si:'foo'}]

  'listener moves on ld': (test) ->
    doc = new Doc ['asdf','bar']
    doc.at(1).on 'insert', (i, s) ->
      assert.equal s, 'foo'
      assert.equal i, 0
      test.done()
    doc.at(0).remove()
    doc.emit 'remoteop', [{p:[0,0], si:'foo'}]

  'listener moves on lm': (test) ->
    doc = new Doc ['asdf','bar']
    doc.at(1).on 'insert', (i, s) ->
      assert.equal s, 'foo'
      assert.equal i, 0
      test.done()
    doc.at().move(0,1)
    doc.emit 'remoteop', [{p:[0,0], si:'foo'}]

  'listener drops on ld': (test) ->
    doc = new Doc [1]
    doc.at(0).on 'add', (x) ->
      assert.ok false
    doc.at(0).set 3
    doc.emit 'remoteop', [{p:[0], na:1}]
    test.done()
  'listener drops on od': (test) ->
    doc = new Doc {foo:'bar'}
    doc.at('foo').on 'text-insert', (text, pos) ->
      assert.ok false
    doc.at('foo').set('baz')
    doc.emit 'remoteop', [{p:['foo',0], si:'asdf'}]
    test.done()

  'child op one level': (test) ->
    doc = new Doc {foo:'bar'}
    doc.at().on 'child op', (p, op) ->
      assert.deepEqual p, ['foo',0]
      assert.equal op.si, 'baz'
      test.done()
    doc.emit 'remoteop', [{p:['foo',0], si:'baz'}]

  'child op two levels': (test) ->
    doc = new Doc {foo:['bar']}
    doc.at().on 'child op', (p, op) ->
      assert.deepEqual p, ['foo',0,3]
      assert.deepEqual op.si, 'baz'
      test.done()
    doc.emit 'remoteop', [{p:['foo',0,3],si:'baz'}]

  'child op path snipping': (test) ->
    doc = new Doc {foo:['bar']}
    doc.at('foo').on 'child op', (p, op) ->
      assert.deepEqual p, [0,3]
      assert.deepEqual op.si, 'baz'
      test.done()
    doc.emit 'remoteop', [{p:['foo',0,3],si:'baz'}]

  'common operation paths intersection': (test) ->
    # as discussed: https://github.com/josephg/ShareJS/issues/48
    doc = new Doc name: "name", components: []
    doc.at("name").on "insert", (p, op) ->
    doc.at("components").on "child op", (p, op) -> test.done()
    doc.emit 'remoteop', [{p:['name', 4], si:'X'}]

  'child op not sent when op outside node': (test) ->
    doc = new Doc {foo:['bar']}
    doc.at('foo').on 'child op', ->
      assert.ok false
    doc.at('baz').set('hi')
    test.done()
