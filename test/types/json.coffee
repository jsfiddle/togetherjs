# Tests for JSON OT type. (src/types/json.coffee)
#
# Spec: https://github.com/josephg/ShareJS/wiki/JSON-Operations

type = require '../../src/types/json'

randomWord = require './randomWord'

util = require 'util'
p = util.debug
i = util.inspect

# This is an awful function to clone a document snapshot for use by the random
# op generator. .. Since we don't want to corrupt the original object with
# the changes the op generator will make.
clone = (o) -> JSON.parse(JSON.stringify(o))

# Generate a random int 0 <= k < n
# This should probably be moved into a utility function.
randomInt = (n) -> Math.floor(Math.random() * n)

randomKey = (obj) ->
	if Array.isArray(obj)
		if obj.length == 0
			undefined
		else
			randomInt data.length
	else
		count = 0

		for key of obj
			result = key if Math.random() < 1/++count
		result

# Generate a random new key for a value in obj.
# obj must be an Object.
randomNewKey = (obj) ->
	# There's no do-while loop in coffeescript.
	key = randomWord()
	key = randomWord() while obj[key]?
	key

# Generate a random object
randomThing = ->
	switch randomInt 8
		when 0 then null
		when 1 then ''
		when 2 then randomWord()
		when 3 then {}
		when 4
			obj = {}
			obj[randomNewKey(obj)] = randomThing() for [1..randomInt(4)]
			obj
		when 5 then []
		when 6 then [randomThing()]
		when 7 then randomInt(50)

# Pick a random path to something in the object.
randomPath = (data) ->
	path = []

	while Math.random() > 0.7 and typeof data == 'object'
		key = randomKey data
		break unless key?

		path.push key
		data = data[key]
	
	path

type.generateRandomOp = (data) ->
	pct = 0.95

	container = data: clone(data)

	op = while Math.random() < pct
		pct *= 0.6

		# Pick a random object in the document operate on.
		path = randomPath()

		# parent = the container for the operand. parent[key] contains the operand.
		parent = container
		key = 'data'
		for p in path
			parent = parent[key]
			key = p
		operand = parent[key]

		if Math.random() < 0.2 and parent != container
			# Move

			if Array.isArray(parent)
				newIndex = randomInt parent.length

				# Remove the element from its current position in the list
				parent.splice key, 1
				# Insert it in the new position.
				parent.splice newIndex, 0, operand

				{p:path, lm:newIndex}
			else
				newKey = randomNewKey parent

				delete parent[key]
				parent[newKey] = operand

				{p:path, om:newKey}

		else if Math.random() < 0.3 or operand == null
			# Replace

			newValue = randomThing()
			parent[key] = newValue

			if Array.isArray(parent)
				{p:path, ld:operand, li:clone(newValue)}
			else
				{p:path, od:operand, oi:clone(newValue)}

		else if typeof operand == 'string'
			# String. This code is adapted from the text op generator.

			if Math.random() > 0.5 or operand.length == 0
				# Insert
				pos = randomInt(operand.length + 1)
				str = randomWord() + ' '

				path.push pos
				parent[key] = operand[...pos] + str + operand[pos..]
				{p:path, si:str}
			else
				# Delete
				pos = randomInt(operand.length)
				length = Math.min(randomInt(4), operand.length - pos)
				str = operand[pos...(pos + length)]

				path.push pos
				parent[key] = operand[...pos] + operand[pos + length..]
				{p:path, sd:str}

		else if typeof operand == 'number'
			# Number
			inc = randomInt(10) - 3
			parent[key] += inc
			{p:path, na:inc}

		else if Array.isArray(operand)
			# Array. Replace is covered above, so we'll just randomly insert or delete.
			# This code looks remarkably similar to string insert, above.

			if Math.random() > 0.5 or operand.length == 0
				# Insert
				pos = randomInt(operand.length + 1)
				obj = randomThing()

				path.push pos
				operand.splice pos, 0, obj
				{p:path, li:clone(obj)}
			else
				# Delete
				pos = randomInt operand.length
				obj = operand[pos]

				path.push pos
				operand.splice pos, 1
				{p:path, ld:clone(obj)}
		else
			# Object

			k = randomKey(operand)

			if Math.random() > 0.5 or not elem?
				# Insert
				k = randomNewKey(operand)
				obj = randomThing()

				path.push k
				operand[k] = obj
				{p:path, oi:clone(obj)}
			else
				obj = operand[k]

				path.push k
				delete operand[k]
				{p:path, od:clone(obj)}

#	p "generated op #{i op} -> #{i docStr}"
	[op, container.data]


d = null
for [1..10]
	console.log d
	[op, d] = type.generateRandomOp(d)
	console.log op

exports.sanity =
	'name is json': (test) ->
		test.strictEqual type.name, 'json'
		test.done()

	'initialVersion() returns null': (test) ->
		test.deepEqual type.initialVersion(), {}
		test.done()



exports.randomizer = (test) ->
	require('../helpers').randomizerTest type
	test.done()
