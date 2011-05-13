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

	while Math.random() > 0.85 and typeof data == 'object'
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

	[op, container.data]


# The random op tester above will test that the OT functions are admissable, but
# debugging problems it detects is a pain.
#
# These tests should pick up *most* problems with a normal JSON OT implementation.

exports.sanity =
	'name is json': (test) ->
		test.strictEqual type.name, 'json'
		test.done()

	'initialVersion() returns null': (test) ->
		test.deepEqual type.initialVersion(), null
		test.done()

exports.number =
	'Add a number': (test) ->
		test.deepEqual 3, type.apply 1, [{p:[], na:2}]
		test.deepEqual [3], type.apply [1], [{p:[0], na:2}]
		test.done()

	'Compose two adds together with the same path compresses them': (test) ->
		test.deepEqual [{p:['a', 'b'], na:3}], type.compose [{p:['a', 'b'], na:1}], [{p:['a', 'b'], na:2}]
		test.deepEqual [{p:['a'], na:1}, {p:['b'], na:2}], type.compose [{p:['a'], na:1}], [{p:['b'], na:2}]
		test.done()

# Strings should be handled internally by the text type. We'll just do some basic sanity checks here.
exports.string =
	'Apply works': (test) ->
		test.deepEqual 'abc', type.apply 'a', [{p:[1], si:'bc'}]
		test.deepEqual 'bc', type.apply 'abc', [{p:[0], sd:'a'}]
		test.deepEqual {x:'abc'}, type.apply {x:'a'}, [{p:['x', 1], si:'bc'}]

		test.done()
	
	'transform splits deletes': (test) ->
		test.deepEqual type.transform([{p:[0], sd:'ab'}], [{p:[1], si:'x'}], 'client'), [{p:[0], sd:'a'}, {p:[2], sd:'b'}]
		test.done()
	
	'deletes cancel each other out': (test) ->
		test.deepEqual type.transform([{p:['k', 5], sd:'a'}], [{p:['k', 5], sd:'a'}], 'client'), []
		test.done()

exports.list =
	'Apply inserts': (test) ->
		test.deepEqual ['a', 'b', 'c'], type.apply ['b', 'c'], [{p:[0], li:'a'}]
		test.deepEqual ['a', 'b', 'c'], type.apply ['a', 'c'], [{p:[1], li:'b'}]
		test.deepEqual ['a', 'b', 'c'], type.apply ['a', 'b'], [{p:[2], li:'c'}]
		test.done()

	'Apply deletes': (test) ->
		test.deepEqual ['b', 'c'], type.apply ['a', 'b', 'c'], [{p:[0], ld:'a'}]
		test.deepEqual ['a', 'c'], type.apply ['a', 'b', 'c'], [{p:[1], ld:'b'}]
		test.deepEqual ['a', 'b'], type.apply ['a', 'b', 'c'], [{p:[2], ld:'c'}]
		test.done()
	
	'apply replace': (test) ->
		test.deepEqual ['a', 'y', 'b'], type.apply ['a', 'x', 'b'], [{p:[1], ld:'x', li:'y'}]
		test.done()

	'apply move': (test) ->
		test.deepEqual ['a', 'b', 'c'], type.apply ['b', 'a', 'c'], [{p:[1], lm:0}]
		test.deepEqual ['a', 'b', 'c'], type.apply ['b', 'a', 'c'], [{p:[0], lm:1}]
		test.done()
	
	'Paths are bumped when list elements are inserted or removed': (test) ->
		test.deepEqual [{p:[2, 200], si:'hi'}], type.transform [{p:[1, 200], si:'hi'}], [{p:[0], li:'x'}], 'client'
		test.deepEqual [{p:[1, 200], si:'hi'}], type.transform [{p:[0, 200], si:'hi'}], [{p:[0], li:'x'}], 'client'
		test.deepEqual [{p:[0, 200], si:'hi'}], type.transform [{p:[0, 200], si:'hi'}], [{p:[1], li:'x'}], 'client'

		test.deepEqual [{p:[0, 200], si:'hi'}], type.transform [{p:[1, 200], si:'hi'}], [{p:[0], ld:'x'}], 'client'
		test.deepEqual [{p:[0, 200], si:'hi'}], type.transform [{p:[0, 200], si:'hi'}], [{p:[1], ld:'x'}], 'client'

		test.done()

	'Ops on deleted elements become noops': (test) ->
		test.deepEqual [], type.transform [{p:[1, 0], si:'hi'}], [{p:[1], ld:'x'}], 'client'
		test.done()
	
	'Ops on replaced elements become noops': (test) ->
		test.deepEqual [], type.transform [{p:[1, 0], si:'hi'}], [{p:[1], ld:'x', li:'y'}], 'client'
		test.done()

	'Deleted data is changed to reflect edits': (test) ->
		test.deepEqual [{p:[1], ld:'abc'}], type.transform [{p:[1], ld:'a'}], [{p:[1, 1], si:'bc'}], 'client'
		test.done()
	
	'Inserting then deleting an element composes into a no-op': (test) ->
		test.deepEqual [], type.compose [{p:[1], li:'abc'}], [{p:[1], ld:'abc'}]
		test.done()
	
	'If two inserts are simultaneous, the client op will end up first': (test) ->
		test.deepEqual [{p:[1], li:'a'}], type.transform [{p:[1], li:'a'}], [{p:[1], li:'b'}], 'client'
		test.deepEqual [{p:[2], li:'b'}], type.transform [{p:[1], li:'b'}], [{p:[1], li:'a'}], 'server'
		test.done()
	
	'An attempt to re-delete a list element becomes a no-op': (test) ->
		test.deepEqual [], type.transform [{p:[1], ld:'x'}], [{p:[1], ld:'x'}], 'client'
		test.deepEqual [], type.transform [{p:[1], ld:'x'}], [{p:[1], ld:'x'}], 'server'
		test.done()

	'Ops on a moved element move with the element': (test) ->
		test.deepEqual [{p:[10], ld:'x'}], type.transform [{p:[4], ld:'x'}], [{p:[4], lm:10}], 'client'
		test.deepEqual [{p:[10, 1], si:'a'}], type.transform [{p:[4, 1], si:'a'}], [{p:[4], lm:10}], 'client'
		test.done()

exports.object =
	'Apply sanity checks': (test) ->
		test.deepEqual {x:'a', y:'b'}, type.apply {x:'a'}, [{p:['y'], oi:'b'}]
		test.deepEqual {}, type.apply {x:'a'}, [{p:['x'], od:'a'}]
		test.deepEqual {x:'b'}, type.apply {x:'a'}, [{p:['x'], od:'a', oi:'b'}]
		test.deepEqual {y:'a'}, type.apply {x:'a'}, [{p:['x'], om:'y'}]
		test.done()
	
	'Ops on deleted elements become noops': (test) ->
		test.deepEqual [], type.transform [{p:[1, 0], si:'hi'}], [{p:[1], od:'x'}], 'client'
		test.done()
	
	'Ops on replaced elements become noops': (test) ->
		test.deepEqual [], type.transform [{p:[1, 0], si:'hi'}], [{p:[1], od:'x', oi:'y'}], 'client'
		test.done()

	'Deleted data is changed to reflect edits': (test) ->
		test.deepEqual [{p:[1], ld:'abc'}], type.transform [{p:[1], od:'a'}], [{p:[1, 1], si:'bc'}], 'client'
		test.done()
	
	'If two inserts are simultaneous, the clients insert will win': (test) ->
		test.deepEqual [{p:[1], oi:'a', od:'b'}], type.transform [{p:[1], oi:'a'}], [{p:[1], oi:'b'}], 'client'
		test.deepEqual [], type.transform [{p:[1], oi:'b'}], [{p:[1], oi:'a'}], 'server'
		test.done()
	
	'An attempt to re-delete a key becomes a no-op': (test) ->
		test.deepEqual [], type.transform [{p:['k'], od:'x'}], [{p:['k'], od:'x'}], 'client'
		test.deepEqual [], type.transform [{p:['k'], od:'x'}], [{p:['k'], od:'x'}], 'server'
		test.done()
	
	'Ops on a moved element move with the element': (test) ->
		test.deepEqual [{p:['k2'], od:'x'}], type.transform [{p:['k1'], od:'x'}], [{p:['k1'], om:'k2'}], 'client'
		test.deepEqual [{p:['k2', 1], si:'a'}], type.transform [{p:['k1', 1], si:'a'}], [{p:['k1'], om:'k2'}], 'client'
		test.done()

exports.randomizer = (test) ->
	require('../helpers').randomizerTest type
	test.done()
