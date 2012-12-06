# Tests for event framework

testCase = require('nodeunit').testCase

MicroEvent = require '../src/client/microevent'
makePassPart = require('./helpers').makePassPart

tests =
  'emit an event with no listeners does nothing': (test) ->
    @e.emit 'a'
    @e.emit 'a', 1, 2, 3
    @e.emit 'b', 1, 2, 3
    test.done()
  
  'emitting an event fires the event listener': (test) ->
    @e.on 'foo', -> test.done()
    @e.emit 'foo'
  
  'removing an event listener makes the event listener not fire': (test) ->
    fn = -> throw new Error 'event listener fired'
    @e.on 'foo', fn
    @e.removeListener 'foo', fn
    @e.emit 'foo'
    test.done()

  'event listeners receive arguments passed to emit': (test) ->
    @e.on 'foo', (a, b, c) ->
      test.strictEqual a, 1
      test.strictEqual b, 2
      test.strictEqual c, 3
      test.done()
    @e.emit 'foo', 1, 2, 3
  
  'multiple event listeners are fired': (test) ->
    passPart = makePassPart test, 2
    @e.on 'foo', passPart
    @e.on 'foo', passPart
    @e.emit 'foo'

  'functions can be chained': (test) ->
    err = -> throw new Error 'removed event listener fired'
    passPart = makePassPart test, 3

    @e.on('foo', passPart).
      on('foo', passPart).
      on('bar', passPart).
      on('zat', err).
      emit('foo').
      removeListener('zat', err).
      emit('zat').
      emit('bar')
  
  'removing a missing event listener does nothing': (test) ->
    @e.removeListener 'foo', ->
    @e.emit 'foo' # Does nothing.

    @e.on 'foo', -> test.done()
    @e.removeListener 'foo', ->
    @e.emit 'foo'

  'removing an event listener while handling an event works (before)': (test) ->
    fn2 = -> throw new Error 'should not be fired'
    @e.on 'foo', => @e.removeListener 'foo', fn2
    @e.on 'foo', fn2

    @e.emit 'foo'
    test.done()

  'removing an event listener while handling an event works (after)': (test) ->
    passPart = makePassPart test, 3
    fn = -> passPart()
    @e.on 'foo', fn
    @e.on 'foo', =>
      @e.removeListener 'foo', fn
      passPart()
    @e.on 'foo', passPart
    @e.emit 'foo'
  
  'you can remove an event and add it back again and it fires': (test) ->
    fn = -> test.done()
    @e.on 'foo', fn
    @e.removeListener 'foo', fn
    @e.on 'foo', fn
    @e.emit 'foo'
  
  'a listener added to two events, then removed from one, still gets called': (test) ->
    fn = -> test.done()
    @e.on 'foo', fn
    @e.on 'bar', fn
    @e.removeListener 'foo', fn
    @e.emit 'bar'


# The tests above are run both with a new MicroEvent and with an object with
# microevent mixed in.

raw =
  setUp: (callback) ->
    @e = new MicroEvent
    callback()

mixinObj =
  setUp: (callback) ->
    @e = {}
    MicroEvent.mixin @e
    callback()

mixinClass =
  setUp: (callback) ->
    class Foo
      bar: ->

    MicroEvent.mixin Foo
    @e = new Foo
    callback()

for name, test of tests
  raw[name] = test
  mixinObj[name] = test
  mixinClass[name] = test

exports.raw = testCase raw
exports.mixinObj = testCase mixinObj
exports.mixinClass = testCase mixinClass
