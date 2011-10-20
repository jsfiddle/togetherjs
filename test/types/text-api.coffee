# Tests for the text types using the DSL interface
assert = require 'assert'
randomWord = require './randomWord'
{randomInt, randomReal} = require('../helpers')

types = require '../../src/types'
MicroEvent = require '../../src/client/microevent'

textTypes = {}
textTypes[name] = type for name, type of types when type.api?.provides?['text']

genTests = (type) ->
  # Add the randomization function
  try require "./#{type.name}"

  Doc = ->
    @snapshot = type.create()

    @submitOp = (op) ->
      @snapshot = type.apply @snapshot, op

    @_register()
    this

  Doc.prototype = type.api
  MicroEvent.mixin Doc

  'empty document has no length': (test) ->
    doc = new Doc

    test.strictEqual doc.getText(), ''
    test.strictEqual doc.getLength(), 0
    test.done()

  sanity: (test) ->
    doc = new Doc

    doc.insert 0, 'hi'
    test.strictEqual doc.getText(), 'hi'
    test.strictEqual doc.getLength(), 2

    doc.insert 2, ' mum'
    test.strictEqual doc.getText(), 'hi mum'
    test.strictEqual doc.getLength(), 6

    doc.del 0, 3
    test.strictEqual doc.getText(), 'mum'
    test.strictEqual doc.getLength(), 3

    test.done()

  'randomize generating functions': (test) ->
    doc = new Doc

    content = ''

    for i in [1..1000]
      test.strictEqual doc.getText(), content
      test.strictEqual doc.getLength(), content.length

      if content.length == 0 || randomReal() > 0.5
        # Insert
        pos = randomInt(content.length + 1)
        str = randomWord() + ' '
        doc.insert pos, str
        content = content[...pos] + str + content[pos..]
      else
        # Delete
        pos = randomInt content.length
        length = Math.min(randomInt(4), content.length - pos)
        #console.log "pos = #{pos} len = #{length} content = '#{content}'"
        doc.del pos, length
        content = content[...pos] + content[(pos + length)..]
        #console.log "-> content = '#{content}'"

    test.done()

  'randomize emit': (test) ->
    doc = new Doc
    contents = ''

    doc.on 'insert', (pos, text) ->
      contents = contents[...pos] + text + contents[pos...]
    doc.on 'delete', (pos, text) ->
#      console.warn "delete '#{text}' at #{pos}, contents = '#{contents}'"
      assert.strictEqual contents[pos...(pos + text.length)], text
      contents = contents[...pos] + contents[(pos + text.length)...]
#      console.warn "-> contents = '#{contents}'"

    for i in [1..1000]
      [op, newDoc] = type.generateRandomOp doc.snapshot

#      console.warn op
      doc.emit 'remoteop', op, doc.snapshot
      doc.submitOp op

      assert.strictEqual doc.getText(), contents

    test.done()

exports[name] = genTests(type) for name, type of textTypes
