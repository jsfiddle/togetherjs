fs = require 'fs'
util = require 'util'
assert = require 'assert'

randomWord = require './randomWord'
text = require('../../src/types').text
p = util.debug
i = util.inspect

testTransforms = ->
	testData = fs.readFileSync(__dirname + '/text-transform-tests.json').toString().split('\n')

	while testData.length >= 4
		op = JSON.parse(testData.shift())
		otherOp = JSON.parse(testData.shift())
		type = testData.shift()
		expected = JSON.parse(testData.shift())

#		p "Transform #{util.inspect op} by #{util.inspect otherOp} should be #{util.inspect expected}"

		result = text.transform op, otherOp, type

#		p "result: #{util.inspect result}"

		assert.deepEqual result, expected


testCompose = () ->
	testData = fs.readFileSync(__dirname + '/text-transform-tests.json').toString().split('\n')

	while testData.length >= 4
		testData.shift()
		op1 = JSON.parse(testData.shift())
		testData.shift()
		op2 = JSON.parse(testData.shift())

#		p "Compose #{util.inspect op1} + #{util.inspect op2}"

		result = text.compose(op1, op2)

#		p util.inspect(result)

testNormalize = () ->
	assert.deepEqual [], text.normalize([0])
	assert.deepEqual [], text.normalize([{i:''}])
	assert.deepEqual [], text.normalize([{d:''}])

	assert.deepEqual [2], text.normalize([1,1])
	assert.deepEqual [2], text.normalize([2,0])
	assert.deepEqual [{i:'a'}], text.normalize([{i:'a'}, 0])
	assert.deepEqual [{i:'ab'}], text.normalize([{i:'a'}, {i:'b'}])
	assert.deepEqual [{i:'ab'}], text.normalize([{i:'ab'}, {i:''}])
	assert.deepEqual [{i:'ab'}], text.normalize([0, {i:'a'}, 0, {i:'b'}, 0])
	assert.deepEqual [{i:'a'}, 1, {i:'b'}], text.normalize([{i:'a'}, 1, {i:'b'}])

makeAppend = (op) -> (component) ->
	return if (component.i? and component.i.length == 0) or (component.d? and component.d.length == 0)

	if op.length == 0
		op.push component
	else if typeof(component) == 'number' && typeof(op[op.length - 1]) == 'number'
		op[op.length - 1] += component
	else if component.i? && op[op.length - 1].i?
		op[op.length - 1].i += component.i
	else if component.d? && op[op.length - 1].d?
		op[op.length - 1].d += component.d
	else
		op.push component

# Generate a random int 0 <= k < n
randomInt = (n) -> Math.floor(Math.random() * n)

# Uncomment to get a consistent random sequence each run.
#r = 12345
#randomInt = (n) -> Math.abs((r = (r << 2) ^ (r << 1) - r + 1) % n)

text.generateRandomOp = (docStr) ->
	initial = docStr

	op = []
	expectedDoc = ''

	append = makeAppend op
	
	addSkip = () ->
		length = randomInt(Math.min(docStr.length, 3)) + 1

		append length
		expectedDoc += docStr[0...length]
		docStr = docStr[length..]
	
	addInsert = () ->
		# Insert a random word from the list
		word = randomWord() + ' '

		append {i:word}
		expectedDoc += word

	addDelete = () ->
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

#	p "#{initial} -> #{expectedDoc}"
#	p "'#{initial}' -> '#{expectedDoc}' after applying #{util.inspect op}"
	[op, expectedDoc]

text.generateRandomDoc = randomWord

text.test = () ->
	testTransforms()
	testCompose()
	testNormalize()


