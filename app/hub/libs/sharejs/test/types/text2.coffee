# Nodeunit tests for the ShareDB compatible text type

fs = require 'fs'
util = require 'util'

randomWord = require './randomWord'
text = require '../../src/types/text2'
{randomInt} = require '../helpers'

readOp = (file) ->
  op = for c in JSON.parse file.shift()
    if typeof c is 'number'
      c
    else if c.i?
      c.i
    else
      {d:c.d.length}

  text.normalize op

exports.testTransforms = (test) ->
  testData = fs.readFileSync(__dirname + '/text-transform-tests.json').toString().split('\n')

  while testData.length >= 4
    op = readOp testData
    otherOp = readOp testData
    type = testData.shift()
    expected = readOp testData

    result = text.transform op, otherOp, type

    test.deepEqual result, expected

  test.done()

exports.testCompose = (test) ->
  testData = fs.readFileSync(__dirname + '/text-transform-tests.json').toString().split('\n')

  while testData.length >= 4
    testData.shift()
    op1 = readOp testData
    testData.shift()
    op2 = readOp testData

    result = text.compose(op1, op2)
    # nothing interesting is done with result... This test just makes sure compose runs
    # without crashing.

  test.done()

exports.testNormalize = (test) ->
  test.deepEqual [], text.normalize [0]
  test.deepEqual [], text.normalize ['']
  test.deepEqual [], text.normalize [{d:0}]

  test.deepEqual [], text.normalize [1,1]
  test.deepEqual [], text.normalize [2,0]
  test.deepEqual ['a'], text.normalize ['a', 100]
  test.deepEqual ['ab'], text.normalize ['a', 'b']
  test.deepEqual ['ab'], text.normalize ['ab', '']
  test.deepEqual ['ab'], text.normalize [0, 'a', 0, 'b', 0]
  test.deepEqual ['a', 1, 'b'], text.normalize ['a', 1, 'b']

  test.done()

text.generateRandomOp = (docStr) ->
  initial = docStr

  op = []
  expectedDoc = ''

  consume = (len) ->
    expectedDoc += docStr[...len]
    docStr = docStr[len..]

  addInsert = ->
    # Insert a random word from the list somewhere in the document
    skip = randomInt Math.min docStr.length, 5
    word = randomWord() + ' '

    op.push skip
    consume skip

    op.push word
    expectedDoc += word

  addDelete = ->
    skip = randomInt Math.min docStr.length, 5

    op.push skip
    consume skip

    length = randomInt Math.min docStr.length, 4
    op.push {d:length}
    docStr = docStr[length..]

  while docStr.length > 0
    # If the document is long, we'll bias it toward deletes
    chance = if initial.length > 100 then 3 else 2
    switch randomInt(chance)
      when 0 then addInsert()
      when 1, 2 then addDelete()
    
    if randomInt(7) is 0
      break

  # The code above will never insert at the end of the document. Its important to do that
  # sometimes.
  addInsert() if randomInt(10) == 0

  expectedDoc += docStr
  [text.normalize(op), expectedDoc]

text.generateRandomDoc = randomWord

exports.randomizer = (test) ->
  require('../helpers').randomizerTest text
  test.done()

