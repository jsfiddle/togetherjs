# Nodeunit tests for composable text.

fs = require 'fs'
util = require 'util'

randomWord = require './randomWord'
text = require '../../src/types/text-tp2'
{randomInt, randomReal, seed, randomizerTest} = require '../helpers'

p = util.debug
i = util.inspect

exports['transform sanity'] = (test) ->
	tc = (op1, op2, expected, delta) ->
		if delta?
			test.deepEqual (text.transform op1, op2, delta), expected
			test.deepEqual (text.prune expected, op2, delta), op1
		else
			test.deepEqual (text.transform op1, op2, 'left'), expected
			test.deepEqual (text.prune expected, op2, 'left'), op1

			test.deepEqual (text.transform op1, op2, 'right'), expected
			test.deepEqual (text.prune expected, op2, 'right'), op1
	
	tc [], [], []
	tc [10], [10], [10]
	tc [{i:'hi'}], [], [{i:'hi'}]
	tc [{i:5}], [], [{i:5}]
	tc [{d:5}], [5], [{d:5}]

	tc [10], [10, {i:'hi'}], [12]
	tc [{i:'aaa'}, 10], [{i:'bbb'}, 10], [{i:'aaa'}, 13], 'left'
	tc [{i:'aaa'}, 10], [{i:'bbb'}, 10], [3, {i:'aaa'}, 10], 'right'
	tc [10, {i:5}], [{i:'hi'}, 10], [12, {i:5}]
	tc [{d:5}], [{i:'hi'}, 5], [2, {d:5}]

	tc [10], [{d:10}], [10]
	tc [{i:'hi'}, 10], [{d:10}], [{i:'hi'}, 10]
	tc [10, {i:5}], [{d:10}], [10, {i:5}]
	tc [{d:5}], [{d:5}], [{d:5}]
	
	tc [{i:'mimsy'}], [{i: 10}], [{i:'mimsy'}, 10], 'left'

	test.done()

exports.testNormalize = (test) ->
	tn = (input, expected) ->
		test.deepEqual text.normalize(input), expected
	
	tn [0], []
	tn [{i:''}], []
	tn [{d:0}], []
	tn [{i:0}], []

	tn [1, 1], [2]
	tn [2, 0], [2]

	tn [{i:4}, {i:5}], [{i:9}]
	tn [{d:4}, {d:5}], [{d:9}]
	tn [{i:4}, {d:5}], [{i:4}, {d:5}]

	tn [{i:'a'}, 0], [{i:'a'}]
	tn [{i:'a'}, {i:'b'}], [{i:'ab'}]
	tn [0, {i:'a'}, 0, {i:'b'}, 0], [{i:'ab'}]

	tn [{i:'ab'}, {i:''}], [{i:'ab'}]
	tn [{i:'ab'}, {d:0}], [{i:'ab'}]
	tn [{i:'ab'}, {i:0}], [{i:'ab'}]

	tn [{i:'a'}, 1, {i:'b'}], [{i:'a'}, 1, {i:'b'}]

	test.done()

exports.testApply = (test) ->
	ta = (doc, op, expected) ->
		newDoc = text.apply doc, op
		test.deepEqual newDoc, expected

	ta [''], [{i: 5}], [5]
	ta ['abc', 1, 'defghij'], [{d:5}, 6], [5, 'efghij']

	test.done()

exports.testCompose = (test) ->
	tc = (op1, op2, expected) ->
		c = text.compose op1, op2
		test.deepEqual c, expected

	tc [{i:'abcde'}], [3, {d:1}, 1], [{i:'abc'}, {i:1}, {i:'e'}]

	test.done()
	
text.generateRandomOp = (doc) ->
	position = {index:0, offset:0}
	remainder = totalLength = doc.reduce ((x, y) -> x + (y.length || y)), 0

	newDoc = []

	op = []

	{_appendPart:appendPart, _takePart:takePart, _append:append} = text

	addSkip = ->
		length = Math.min(remainder, randomInt(totalLength / 2) + 1)
		remainder -= length

		append op, length
		while length > 0
			part = takePart doc, position, length
			appendPart newDoc, part
			length -= part.length || part

	addInsert = ->
		# Insert a random word from the list
		content = if randomInt(2) then randomWord() + ' ' else randomInt(5) + 1
		append op, {i:content}
		appendPart newDoc, content

	addDelete = ->
		length = Math.min(remainder, randomInt(totalLength / 2) + 1)
		remainder -= length

		appendPart newDoc, length
		append op, {d:length}

		while length > 0
			part = takePart doc, position, length
			length -= part.length || part

	while remainder > 0
		# If the document is long, we'll bias it toward deletes
		switch randomInt 3
			when 0 then addSkip()
			when 1 then addInsert()
			when 2 then addDelete()

	# The code above will never insert at the end of the document. Thats important...
	addInsert() if randomInt(3) == 0

#	p "#{initial} -> #{expectedDoc}"
#	p "#{i doc} -> #{i newDoc} after applying #{i op}"

	
#	console.log "complexity: #{doc.length}"

	[op, newDoc]

text.generateRandomDoc = ->
	stringNext = randomInt(2) == 0
	for [0...randomInt(10)]
		stringNext = !stringNext
		if stringNext
			randomWord() + ' '
		else
			randomInt(5) + 1

exports.randomizer = (test) ->
	randomizerTest text
	test.done()

