queue = require '../src/server/syncqueue'

module.exports =
  'Queue calls its process function': (test) ->
    f = queue (data, callback) ->
      test.strictEqual data, 123
      callback(321)

    f 123, (result) ->
      test.strictEqual result, 321
      test.done()

  'Queue works when no callback is passed': (test) ->
    called = 0
    f = queue (data, callback) ->
      test.strictEqual data, 123
      called++
      callback()

    f 123
    
    process.nextTick ->
      test.strictEqual called, 1
      test.done()
  
  'Queue does not call process again while process already running': (test) ->
    busy = false
    f = queue (data, callback) ->
      test.strictEqual busy, false
      busy = true
      process.nextTick ->
        busy = false
        callback()

    f()
    f 123, -> test.done()

  'Queue has busy = false before anything has happened': (test) ->
    f = queue (data, callback) ->
    test.strictEqual f.busy, false
    test.done()

  'Queue has busy = true while its working before anything has happened': (test) ->
    f = queue (data, callback) ->
      process.nextTick ->
        callback()

    f()
    test.strictEqual f.busy, true
    test.done()

  'Queue has busy = false when its done': (test) ->
    f = queue (data, callback) ->
      callback()

    f 123, ->
      test.strictEqual f.busy, false
      test.done()
