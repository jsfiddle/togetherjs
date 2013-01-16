# A simple test for the example 'count' type.

randomizer = require('../helpers').randomizerTest
types = require '../../src/types'

exports.randomizer = (test) ->
  randomizer types.count
  test.done()

