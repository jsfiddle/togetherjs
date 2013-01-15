# Nodeunit tests for composable text.

fs = require 'fs'
util = require 'util'

randomWord = require './randomWord'
text = require '../../src/types/text-composable'
p = util.debug
i = util.inspect

exports.testTransforms = (test) ->
  testData = fs.readFileSync(__dirname + '/text-transform-tests.json').toString().split('\n')

  while testData.length >= 4
    op = JSON.parse(testData.shift())
    otherOp = JSON.parse(testData.shift())
    type = testData.shift()
    expected = JSON.parse(testData.shift())

    result = text.transform op, otherOp, type

    test.deepEqual result, expected

  test.done()

exports.testCompose = (test) ->
  testData = fs.readFileSync(__dirname + '/text-transform-tests.json').toString().split('\n')

  while testData.length >= 4
    testData.shift()
    op1 = JSON.parse(testData.shift())
    testData.shift()
    op2 = JSON.parse(testData.shift())

    result = text.compose(op1, op2)
    # nothing interesting is done with result... This test just makes sure compose runs
    # without crashing.

  test.done()

exports.testNormalize = (test) ->
  test.deepEqual [], text.normalize([0])
  test.deepEqual [], text.normalize([{i:''}])
  test.deepEqual [], text.normalize([{d:''}])

  test.deepEqual [2], text.normalize([1,1])
  test.deepEqual [2], text.normalize([2,0])
  test.deepEqual [{i:'a'}], text.normalize([{i:'a'}, 0])
  test.deepEqual [{i:'ab'}], text.normalize([{i:'a'}, {i:'b'}])
  test.deepEqual [{i:'ab'}], text.normalize([{i:'ab'}, {i:''}])
  test.deepEqual [{i:'ab'}], text.normalize([0, {i:'a'}, 0, {i:'b'}, 0])
  test.deepEqual [{i:'a'}, 1, {i:'b'}], text.normalize([{i:'a'}, 1, {i:'b'}])

  test.done()

# Generate a random int 0 <= k < n
randomInt = (n) -> Math.floor(Math.random() * n)

# Uncomment to get a consistent random sequence each run.
#r = 12345
#randomInt = (n) -> Math.abs((r = (r << 2) ^ (r << 1) - r + 1) % n)

text.generateRandomOp = (docStr) ->
  initial = docStr

  op = []
  expectedDoc = ''

  append = text._makeAppend op
  
  addSkip = ->
    length = randomInt(Math.min(docStr.length, 3)) + 1

    append length
    expectedDoc += docStr[0...length]
    docStr = docStr[length..]
  
  addInsert = ->
    # Insert a random word from the list
    word = randomWord() + ' '

    append {i:word}
    expectedDoc += word

  addDelete = ->
    length = randomInt(Math.min(docStr.length, 7)) + 1
    deletedStr = docStr[0...length]

    append {d:deletedStr}
    docStr = docStr[length..]

  while docStr.length > 0
    # If the document is long, we'll bias it toward deletes
    chance = if initial.length > 100 then 4 else 3
    switch randomInt(chance)
      when 0 then addSkip()
      when 1 then addInsert()
      when 2, 3 then addDelete()

  # The code above will never insert at the end of the document. Thats important...
  addInsert() if randomInt(3) == 0

#  p "#{initial} -> #{expectedDoc}"
#  p "'#{initial}' -> '#{expectedDoc}' after applying #{util.inspect op}"
  [op, expectedDoc]

text.generateRandomDoc = randomWord

exports.randomizer = (test) ->
  require('../helpers').randomizerTest text
  test.done()

