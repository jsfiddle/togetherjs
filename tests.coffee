# This runs all the tests.
#
# run with:
# % nodeunit tests.coffee

modules = [
  'testhelpers'

  'version'

  'types/count'
  'types/text'
  'types/text-composable'
  'types/text-tp2'
  'types/text-api'
  'types/json'
  'types/json-api'

  'db'
  'model'
  'useragent'
  'events'
  'rest'
#  'socketio'
  'browserchannel'

  'microevent'

  'client'

  # These tests are currently flakey.
#  'integration'
]

exports[module] = require "./test/#{module}" for module in modules

# This is a little hack to get around the lack of cleanup done by socket.io. It should terminate
# the node.js process 2 seconds after all the tests are complete.
exports.cleanup = (test) ->
  test.done()
  setTimeout (-> process.exit(0)), 2000

