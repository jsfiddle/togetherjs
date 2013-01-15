node = require '../src'
web = require './helpers/webclient'

fs = require 'fs'

# For some reason requiring a json file breaks travisCI.
p = JSON.parse fs.readFileSync("#{__dirname}/../package.json")

module.exports =
  'node version': (test) ->
    test.ok node.version
    test.strictEqual node.version, p.version
    test.done()

  'web version': (test) ->
    test.strictEqual web.version, p.version
    test.done()
