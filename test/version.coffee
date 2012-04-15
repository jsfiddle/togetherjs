node = require '../src'
web = require './helpers/webclient'

fs = require 'fs'

p = require '../package.json'

module.exports =
  'node version': (test) ->
    test.ok node.version
    test.strictEqual node.version, p.version
    test.done()

  'web version': (test) ->
    test.strictEqual web.version, p.version
    test.done()
