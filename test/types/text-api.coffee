# Tests for the text types using the DSL interface
assert = require 'assert'
randomWord = require './randomWord'
{randomInt, randomReal} = require('../helpers')

types = require '../../src/types'

textTypes = {}
textTypes[name] = type for name, type of types when type.Document?.implements['text']

genTests = (type) ->
	class Doc extends type.Document
		constructor: ->
			@snapshot = type.initialVersion()
		
		submitOp: (op) ->
			@snapshot = type.apply @snapshot, op

	'empty document has no length': (test) ->
		doc = new Doc

		test.strictEqual doc.getText(), ''
		test.strictEqual doc.getLength(), 0
		test.done()

	randomizer: (test) ->
		doc = new Doc

		content = ''

		for i in [1..1000]
			test.strictEqual doc.getText(), content
			test.strictEqual doc.getLength(), content.length

			if content.length == 0 || randomReal() > 0.5
				# Insert
				pos = randomInt(content.length + 1)
				str = randomWord() + ' '
				doc.insert str, pos
				content = content[...pos] + str + content[pos..]
			else
				# Delete
				pos = randomInt content.length
				length = Math.min(randomInt(4), content.length - pos)
				#console.log "pos = #{pos} len = #{length} content = '#{content}'"
				doc.del length, pos
				content = content[...pos] + content[(pos + length)..]
				#console.log "-> content = '#{content}'"
	
		test.done()

exports[name] = genTests(type) for name, type of textTypes
