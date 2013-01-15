# Tests for the non-composable op type.

randomWord = require './randomWord'
nativeType = require '../../src/types/text'

genTests = (type) ->
  type.generateRandomOp = (docStr) ->
    pct = 0.9

    op = []

    while Math.random() < pct
  #    p "docStr = #{i docStr}"
      pct /= 2
      
      if Math.random() > 0.5
        # Append an insert
        pos = Math.floor(Math.random() * (docStr.length + 1))
        str = randomWord() + ' '
        nativeType._append op, {i:str, p:pos}
        docStr = docStr[...pos] + str + docStr[pos..]
      else
        # Append a delete
        pos = Math.floor(Math.random() * docStr.length)
        length = Math.min(Math.floor(Math.random() * 4), docStr.length - pos)
        nativeType._append op, {d:docStr[pos...(pos + length)], p:pos}
        docStr = docStr[...pos] + docStr[(pos + length)..]
    
  #  p "generated op #{i op} -> #{i docStr}"
    [op, docStr]


  compress:
    'sanity checks': (test) ->
      test.deepEqual [], type.compress []
      test.deepEqual [{i:'blah', p:3}], type.compress [{i:'blah', p:3}]
      test.deepEqual [{d:'blah', p:3}], type.compress [{d:'blah', p:3}]
      test.deepEqual [{d:'blah', p:3}, {i:'blah', p:10}], type.compress [{d:'blah', p:3}, {i:'blah', p:10}]
      test.done()

    'compress inserts': (test) ->
      test.deepEqual [{i:'xyzabc', p:10}], type.compress [{i:'abc', p:10}, {i:'xyz', p:10}]
      test.deepEqual [{i:'axyzbc', p:10}], type.compress [{i:'abc', p:10}, {i:'xyz', p:11}]
      test.deepEqual [{i:'abcxyz', p:10}], type.compress [{i:'abc', p:10}, {i:'xyz', p:13}]
      test.done()
    
    'dont compress separate inserts': (test) ->
      t = (op) ->
        test.deepEqual op, type.compress op

      t [{i:'abc', p:10}, {i:'xyz', p:9}]
      t [{i:'abc', p:10}, {i:'xyz', p:14}]
      test.done()
    
    'compress deletes': (test) ->
      test.deepEqual [{d:'xyabc', p:8}], type.compress [{d:'abc', p:10}, {d:'xy', p:8}]
      test.deepEqual [{d:'xabcy', p:9}], type.compress [{d:'abc', p:10}, {d:'xy', p:9}]
      test.deepEqual [{d:'abcxy', p:10}], type.compress [{d:'abc', p:10}, {d:'xy', p:10}]
      test.done()

    'dont compress separate deletes': (test) ->
      t = (op) ->
        test.deepEqual op, type.compress op

      t [{d:'abc', p:10}, {d:'xyz', p:6}]
      t [{d:'abc', p:10}, {d:'xyz', p:11}]
      test.done()

  compose:
    # Compose is actually pretty easy
    'sanity checks': (test) ->
      test.deepEqual type.compose([], []), []
      test.deepEqual type.compose([{i:'x', p:0}], []), [{i:'x', p:0}]
      test.deepEqual type.compose([], [{i:'x', p:0}]), [{i:'x', p:0}]
      test.deepEqual type.compose([{i:'y', p:100}], [{i:'x', p:0}]), [{i:'y', p:100}, {i:'x', p:0}]

      test.done()

  transform:
    'sanity checks': (test) ->
      test.deepEqual [], type.transform [], [], 'left'
      test.deepEqual [], type.transform [], [], 'right'

      test.deepEqual [{i:'y', p:100}, {i:'x', p:0}], type.transform [{i:'y', p:100}, {i:'x', p:0}], [], 'left'
      test.deepEqual [], type.transform [], [{i:'y', p:100}, {i:'x', p:0}], 'right'
      test.done()

    'insert': (test) ->
      test.deepEqual [[{i:'x', p:10}], [{i:'a', p:1}]], type.transformX [{i:'x', p:9}], [{i:'a', p:1}]
      test.deepEqual [[{i:'x', p:10}], [{i:'a', p:11}]], type.transformX [{i:'x', p:10}], [{i:'a', p:10}]

      test.deepEqual [[{i:'x', p:10}], [{d:'a', p:9}]], type.transformX [{i:'x', p:11}], [{d:'a', p:9}]
      test.deepEqual [[{i:'x', p:10}], [{d:'a', p:10}]], type.transformX [{i:'x', p:11}], [{d:'a', p:10}]
      test.deepEqual [[{i:'x', p:11}], [{d:'a', p:12}]], type.transformX [{i:'x', p:11}], [{d:'a', p:11}]

      test.deepEqual [{i:'x', p:10}], type.transform [{i:'x', p:10}], [{d:'a', p:11}], 'left'
      test.deepEqual [{i:'x', p:10}], type.transform [{i:'x', p:10}], [{d:'a', p:10}], 'left'
      test.deepEqual [{i:'x', p:10}], type.transform [{i:'x', p:10}], [{d:'a', p:10}], 'right'

      test.done()

    'delete': (test) ->
      test.deepEqual [[{d:'abc', p:8}], [{d:'xy', p:4}]], type.transformX [{d:'abc', p:10}], [{d:'xy', p:4}]
      test.deepEqual [[{d:'ac', p:10}], []], type.transformX [{d:'abc', p:10}], [{d:'b', p:11}]
      test.deepEqual [[], [{d:'ac', p:10}]], type.transformX [{d:'b', p:11}], [{d:'abc', p:10}]
      test.deepEqual [[{d:'a', p:10}], []], type.transformX [{d:'abc', p:10}], [{d:'bc', p:11}]
      test.deepEqual [[{d:'c', p:10}], []], type.transformX [{d:'abc', p:10}], [{d:'ab', p:10}]
      test.deepEqual [[{d:'a', p:10}], [{d:'d', p:10}]], type.transformX [{d:'abc', p:10}], [{d:'bcd', p:11}]
      test.deepEqual [[{d:'d', p:10}], [{d:'a', p:10}]], type.transformX [{d:'bcd', p:11}], [{d:'abc', p:10}]
      test.deepEqual [[{d:'abc', p:10}], [{d:'xy', p:10}]], type.transformX [{d:'abc', p:10}], [{d:'xy', p:13}]
      test.done()

  transformCursor:
    'sanity': (test) ->
      test.strictEqual 0, type.transformCursor 0, [], 'right'
      test.strictEqual 0, type.transformCursor 0, [], 'left'
      test.strictEqual 100, type.transformCursor 100, []

      test.done()

    'vs insert': (test) ->
      test.strictEqual 0, type.transformCursor 0, [{i:'asdf', p:100}], 'right'
      test.strictEqual 0, type.transformCursor 0, [{i:'asdf', p:100}], 'left'

      test.strictEqual 204, type.transformCursor 200, [{i:'asdf', p:100}], 'right'
      test.strictEqual 204, type.transformCursor 200, [{i:'asdf', p:100}], 'left'

      test.strictEqual 104, type.transformCursor 100, [{i:'asdf', p:100}], 'right'
      test.strictEqual 100, type.transformCursor 100, [{i:'asdf', p:100}], 'left'
      
      test.done()

    'vs delete': (test) ->
      test.strictEqual 0, type.transformCursor 0, [{d:'asdf', p:100}], 'right'
      test.strictEqual 0, type.transformCursor 0, [{d:'asdf', p:100}], 'left'
      test.strictEqual 0, type.transformCursor 0, [{d:'asdf', p:100}]

      test.strictEqual 196, type.transformCursor 200, [{d:'asdf', p:100}]

      test.strictEqual 100, type.transformCursor 100, [{d:'asdf', p:100}]
      test.strictEqual 100, type.transformCursor 102, [{d:'asdf', p:100}]
      test.strictEqual 100, type.transformCursor 104, [{d:'asdf', p:100}]
      test.strictEqual 101, type.transformCursor 105, [{d:'asdf', p:100}]

      test.done()

  normalize:
    'sanity': (test) ->
      testUnchanged = (op) -> test.deepEqual op, type.normalize op
      testUnchanged []
      testUnchanged [{i:'asdf', p:100}]
      testUnchanged [{i:'asdf', p:100}, {d:'fdsa', p:123}]

      test.done()
    
    'add missing p:0': (test) ->
      test.deepEqual [{i:'abc', p:0}], type.normalize [{i:'abc'}]
      test.deepEqual [{d:'abc', p:0}], type.normalize [{d:'abc'}]
      test.deepEqual [{i:'abc', p:0}, {d:'abc', p:0}], type.normalize [{i:'abc'}, {d:'abc'}]

      test.done()
    
    'Convert op to an array': (test) ->
      test.deepEqual [{i:'abc', p:0}], type.normalize {i:'abc', p:0}
      test.deepEqual [{d:'abc', p:0}], type.normalize {d:'abc', p:0}

      test.done()
    
    'really simple op': (test) ->
      test.deepEqual [{i:'abc', p:0}], type.normalize {i:'abc'}

      test.done()


  randomizer: (test) ->
    require('../helpers').randomizerTest type
    test.done()

exports.node = genTests nativeType
exports.webclient = genTests(require('../helpers/webclient').types.text)
