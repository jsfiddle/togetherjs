assert = require 'assert'
util = require 'util'
p = require('sys').puts
i = util.inspect

testRandomOp = (type) ->
	generateRandomDoc = type.generateRandomDoc ? type.initialVersion
	doc0 = generateRandomDoc()
	op0 = if doc0 then [{i:doc0}] else []

	[op1, doc1] = type.generateRandomOp doc0
	[op2, doc2] = type.generateRandomOp doc0

	doc1Actual = type.apply doc0, op1
	assert.strictEqual doc1Actual, doc1

	doc2Actual = type.apply doc0, op2
	assert.strictEqual doc2Actual, doc2

	op1_ = type.transform op1, op2, 'client'
	op2_ = type.transform op2, op1, 'server'

	# doc3 and doc3_ should be doc0 with both op1 and op2 applied.
	doc12 = type.apply doc1, op2_
	doc21 = type.apply doc2, op1_
	assert.strictEqual doc12, doc21

	op12 = type.compose op1, op2_
	op21 = type.compose op2, op1_

#	p 'x'
#	p "#{util.inspect(op1)}  #{util.inspect(op2_)}"
#	p "#{util.inspect(op2)}  #{util.inspect(op1_)}"
#	assert.deepEqual c1, c2

	doc012 = type.apply doc0, op12
	assert.strictEqual doc012, doc12

	doc021 = type.apply doc0, op21
	assert.strictEqual doc021, doc12

#	p "#{util.inspect(startingStrOp)} #{util.inspect(c1)}"
	op012 = type.compose op0, op12
	op021 = type.compose op0, op21

	# The ops should contain just a single insert component with all the document's text
	expected = if doc012 then [{i:doc012}] else []
	assert.deepEqual expected, op012
	assert.deepEqual expected, op021

	doc012_ = type.apply type.initialVersion(), op012
	assert.deepEqual doc012, doc012_
	doc021_ = type.apply type.initialVersion(), op021
	assert.deepEqual doc012, doc021_

	[op3, doc3] = type.generateRandomOp doc1
#	p "Generate #{util.inspect op3}  '#{doc1}' -> '#{doc3}'"

#	p "Apply #{util.inspect doc1}  #{util.inspect op3}"
	doc13 = type.apply doc1, op3
	assert.strictEqual doc13, doc3
	
#	p "Compose #{util.inspect op1} + #{util.inspect op3}"
	op13 = type.compose op1, op3
	doc013 = type.apply doc0, op13
	assert.strictEqual doc013, doc3

	op2__ = type.transform op2_, op3, 'server'
	op3_ = type.transform op3, op2_, 'client'

#	p "\ndoc0: #{i doc0}\ndoc1: #{i doc1}\ndoc2: #{i doc2}\ndoc3: #{i doc3}\nop1:  #{i op1}\nop2:  #{i op2}\nop3:  #{i op3}\nop2_: #{i op2_}\nop2__: #{i op2__}"
	doc132 = type.apply doc13, op2__
	doc123 = type.apply doc12, op3_
	assert.strictEqual doc132, doc123


# Run some iterations of the random op tester. Requires a random op generator for the type.
exports.test = (type, iterations = 1000) ->
	assert.ok type.generateRandomOp
	assert.ok type.transform
	assert.ok type.compose, "Running random op tester for types without compose is not yet implemented"

	p "   Running #{iterations} of randomized tests for type #{type.name}..."
	for n in [0..iterations]
#		p n if n % 200 == 0
		testRandomOp(type)
