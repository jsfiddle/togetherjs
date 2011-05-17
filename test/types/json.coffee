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

{randomInt, randomReal} = require('../helpers')

randomKey = (obj) ->
	if Array.isArray(obj)
		if obj.length == 0
			undefined
		else
			randomInt obj.length
	else
		count = 0

		for key of obj
			result = key if randomReal() < 1/++count
		result

# Generate a random new key for a value in obj.
# obj must be an Object.
randomNewKey = (obj) ->
	# There's no do-while loop in coffeescript.
	key = randomWord()
	key = randomWord() while obj[key] != undefined
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

	while randomReal() > 0.85 and typeof data == 'object'
		key = randomKey data
		break unless key?

		path.push key
		data = data[key]
	
	path

type.generateRandomOp = (data) ->
	pct = 0.95

	container = data: clone(data)

	op = while randomReal() < pct
		pct *= 0.6

		# Pick a random object in the document operate on.
		path = randomPath(container['data'])

		# parent = the container for the operand. parent[key] contains the operand.
		parent = container
		key = 'data'
		for p in path
			parent = parent[key]
			key = p
		operand = parent[key]

		if randomReal() < 0.2 and parent != container and Array.isArray(parent)
			# List move
			newIndex = randomInt parent.length

			# Remove the element from its current position in the list
			parent.splice key, 1
			# Insert it in the new position.
			parent.splice newIndex, 0, operand

			{p:path, lm:newIndex}

		else if randomReal() < 0.3 or operand == null
			# Replace

			newValue = randomThing()
			parent[key] = newValue

			if Array.isArray(parent)
				{p:path, ld:operand, li:clone(newValue)}
			else
				{p:path, od:operand, oi:clone(newValue)}

		else if typeof operand == 'string'
			# String. This code is adapted from the text op generator.

			if randomReal() > 0.5 or operand.length == 0
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

			if randomReal() > 0.5 or operand.length == 0
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

			if randomReal() > 0.5 or not k?
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

	'compose od,oi --> od+oi': (test) ->
		test.deepEqual [{p:['foo'], od:1, oi:2}], type.compose [{p:['foo'],od:1}],[{p:['foo'],oi:2}]
		test.deepEqual [{p:['foo'], od:1},{p:['bar'], oi:2}], type.compose [{p:['foo'],od:1}],[{p:['bar'],oi:2}]
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

	'make sure append doesn\'t overwrite values when it merges na': (test) ->
		serverHas = 21
		clientHas = 3

		serverOp = [{"p":[],"od":0,"oi":15},{"p":[],"na":4},{"p":[],"na":1},{"p":[],"na":1}]
		clientOp = [{"p":[],"na":4},{"p":[],"na":-1}]
		[server_, client_] = require('../helpers').transformX type, serverOp, clientOp

		s_c = type.apply serverHas, client_
		c_s = type.apply clientHas, server_
		test.deepEqual s_c, c_s
		test.done()
		

# Strings should be handled internally by the text type. We'll just do some basic sanity checks here.
exports.string =
	'Apply works': (test) ->
		test.deepEqual 'abc', type.apply 'a', [{p:[1], si:'bc'}]
		test.deepEqual 'bc', type.apply 'abc', [{p:[0], sd:'a'}]
		test.deepEqual {x:'abc'}, type.apply {x:'a'}, [{p:['x', 1], si:'bc'}]

		test.done()
	
	'transform splits deletes': (test) ->
		test.deepEqual type.transform([{p:[0], sd:'ab'}], [{p:[1], si:'x'}], 'client'), [{p:[0], sd:'a'}, {p:[1], sd:'b'}]
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
		test.deepEqual [{p:[1, 201], si:'hi'}], type.transform [{p:[0, 201], si:'hi'}], [{p:[0], li:'x'}], 'server'
		test.deepEqual [{p:[0, 202], si:'hi'}], type.transform [{p:[0, 202], si:'hi'}], [{p:[1], li:'x'}], 'client'

		test.deepEqual [{p:[0, 203], si:'hi'}], type.transform [{p:[1, 203], si:'hi'}], [{p:[0], ld:'x'}], 'client'
		test.deepEqual [{p:[0, 204], si:'hi'}], type.transform [{p:[0, 204], si:'hi'}], [{p:[1], ld:'x'}], 'client'
		test.deepEqual [{p:['x',3], si: 'hi'}], type.transform [{p:['x',3], si:'hi'}], [{p:['x',0,'x'], li:0}], 'client'
		test.deepEqual [{p:['x',3,'x'], si: 'hi'}], type.transform [{p:['x',3,'x'], si:'hi'}], [{p:['x',5], li:0}], 'client'
		test.deepEqual [{p:['x',4,'x'], si: 'hi'}], type.transform [{p:['x',3,'x'], si:'hi'}], [{p:['x',0], li:0}], 'client'

		test.deepEqual [{p:[1],ld:2}], type.transform [{p:[0],ld:2}], [{p:[0],li:1}], 'client'
		test.deepEqual [{p:[1],ld:2}], type.transform [{p:[0],ld:2}], [{p:[0],li:1}], 'server'
		test.done()

	'Ops on deleted elements become noops': (test) ->
		test.deepEqual [], type.transform [{p:[1, 0], si:'hi'}], [{p:[1], ld:'x'}], 'client'
		test.deepEqual [{p:[0],li:'x'}], type.transform [{p:[0],li:'x'}], [{p:[0],ld:'y'}], 'client'
		test.deepEqual [], type.transform [{p:[0],na:-3}], [{p:[0],ld:48}], 'client'
		test.done()
	
	'Ops on replaced elements become noops': (test) ->
		test.deepEqual [], type.transform [{p:[1, 0], si:'hi'}], [{p:[1], ld:'x', li:'y'}], 'client'
		test.deepEqual [{p:[0], li:'hi'}], type.transform [{p:[0], li:'hi'}], [{p:[0], ld:'x', li:'y'}], 'client'
		test.done()

	'Deleted data is changed to reflect edits': (test) ->
		test.deepEqual [{p:[1], ld:'abc'}], type.transform [{p:[1], ld:'a'}], [{p:[1, 1], si:'bc'}], 'client'
		test.done()
	
	'Inserting then deleting an element composes into a no-op': (test) ->
		test.deepEqual [], type.compose [{p:[1], li:'abc'}], [{p:[1], ld:'abc'}]
		test.deepEqual [{p:[1],ld:null,li:'x'}], type.transform [{p:[0],ld:null,li:"x"}], [{p:[0],li:"The"}], 'server'
		test.done()

	'Composing doesn\'t change the original object': (test) ->
		a = [{p:[0],ld:'abc',li:null}]
		test.deepEqual [{p:[0],ld:'abc'}], type.compose a, [{p:[0],ld:null}]
		test.deepEqual [{p:[0],ld:'abc',li:null}], a
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
		test.deepEqual [{p:[10, 1], li:'a'}], type.transform [{p:[4, 1], li:'a'}], [{p:[4], lm:10}], 'client'
		test.deepEqual [{p:[10, 1], ld:'b', li:'a'}], type.transform [{p:[4, 1], ld:'b', li:'a'}], [{p:[4], lm:10}], 'client'

		test.deepEqual [{p:[0],li:null}], type.transform [{p:[0],li:null}], [{p:[0],lm:1}], 'client'
		# [_,_,_,_,5,6,7,_]
		# c: [_,_,_,_,5,'x',6,7,_]   p:5 li:'x'
		# s: [_,6,_,_,_,5,7,_]       p:5 lm:1
		# correct: [_,6,_,_,_,5,'x',7,_]
		test.deepEqual [{p:[6],li:'x'}], type.transform [{p:[5],li:'x'}], [{p:[5],lm:1}], 'client'
		# [_,_,_,_,5,6,7,_]
		# c: [_,_,_,_,5,6,7,_]  p:5 ld:6
		# s: [_,6,_,_,_,5,7,_]  p:5 lm:1
		# correct: [_,_,_,_,5,7,_]
		test.deepEqual [{p:[1],ld:6}], type.transform [{p:[5],ld:6}], [{p:[5],lm:1}], 'client'
		test.deepEqual [{p:[0],li:{}}], type.transform [{p:[0],li:{}}], [{p:[0],lm:0}], 'server'
		test.deepEqual [{p:[0],li:[]}], type.transform [{p:[0],li:[]}], [{p:[1],lm:0}], 'client'
		test.deepEqual [{p:[2],li:'x'}], type.transform [{p:[2],li:'x'}], [{p:[0],lm:1}], 'client'
		test.done()

	'Target index of a moved element is changed by ld/li': (test) ->
		test.deepEqual [{p:[0],lm:1}], type.transform [{p:[0], lm: 2}], [{p:[1], ld:'x'}], 'client'
		test.deepEqual [{p:[1],lm:3}], type.transform [{p:[2], lm: 4}], [{p:[1], ld:'x'}], 'client'
		test.deepEqual [{p:[0],lm:3}], type.transform [{p:[0], lm: 2}], [{p:[1], li:'x'}], 'client'
		test.deepEqual [{p:[3],lm:5}], type.transform [{p:[2], lm: 4}], [{p:[1], li:'x'}], 'client'
		test.deepEqual [{p:[1],lm:1}], type.transform [{p:[0], lm: 0}], [{p:[0], li:28}], 'client'
		test.done()

	'Tiebreak lm vs. ld/li': (test) ->
		test.deepEqual [], type.transform [{p:[0], lm: 2}], [{p:[0], ld:'x'}], 'client'
		test.deepEqual [], type.transform [{p:[0], lm: 2}], [{p:[0], ld:'x'}], 'server'
		test.deepEqual [{p:[1], lm:3}], type.transform [{p:[0], lm: 2}], [{p:[0], li:'x'}], 'client'
		test.deepEqual [{p:[1], lm:3}], type.transform [{p:[0], lm: 2}], [{p:[0], li:'x'}], 'server'
		test.done()

	'replacement vs. deletion': (test) ->
		test.deepEqual [{p:[0],li:'y'}], type.transform [{p:[0],ld:'x',li:'y'}], [{p:[0],ld:'x'}], 'server'
		test.done()

	'replacement vs. insertion': (test) ->
		test.deepEqual [{p:[1],ld:{},li:"brillig"}], type.transform [{p:[0],ld:{},li:"brillig"}], [{p:[0],li:36}], 'client'
		test.done()

	'replacement vs. replacement': (test) ->
		test.deepEqual [], type.transform [{p:[0],ld:null,li:[]}], [{p:[0],ld:null,li:0}], 'server'
		test.deepEqual [{p:[0],ld:[],li:0}], type.transform [{p:[0],ld:null,li:0}], [{p:[0],ld:null,li:[]}], 'client'
		test.done()

	'composing replace with delete of replaced element results in insert': (test) ->
		test.deepEqual [{p:[2],ld:[]}], type.compose [{p:[2],ld:[],li:null}], [{p:[2],ld:null}]
		test.done()

	'lm vs lm': (test) ->
		test.deepEqual [{p:[1],lm:0}], type.transform [{p:[0],lm:0}], [{p:[1],lm:0}], 'client'
		test.deepEqual [{p:[1],lm:1}], type.transform [{p:[0],lm:0}], [{p:[1],lm:0}], 'server'
		test.deepEqual [{p:[1],lm:0}], type.transform [{p:[0],lm:0}], [{p:[5],lm:0}], 'client'
		test.deepEqual [{p:[2],lm:0}], type.transform [{p:[2],lm:0}], [{p:[1],lm:0}], 'client'
		test.deepEqual [{p:[2],lm:1}], type.transform [{p:[2],lm:0}], [{p:[1],lm:0}], 'server'
		test.deepEqual [{p:[3],lm:0}], type.transform [{p:[2],lm:0}], [{p:[5],lm:0}], 'client'
		test.deepEqual [{p:[3],lm:1}], type.transform [{p:[2],lm:0}], [{p:[5],lm:0}], 'server'
		test.deepEqual [{p:[0],lm:5}], type.transform [{p:[2],lm:5}], [{p:[2],lm:0}], 'client'
		test.deepEqual [{p:[0],lm:5}], type.transform [{p:[2],lm:5}], [{p:[2],lm:0}], 'client'
		test.done()

	'indices change correctly around a move': (test) ->
		test.deepEqual [{p:[1,0],li:{}}], type.transform [{p:[0,0],li:{}}], [{p:[1],lm:0}], 'client'
		test.deepEqual [{p:[0],lm:0}], type.transform [{p:[1],lm:0}], [{p:[0],ld:{}}], 'client'
		test.deepEqual [{p:[0],lm:0}], type.transform [{p:[0],lm:1}], [{p:[1],ld:{}}], 'client'
		test.deepEqual [{p:[5],lm:0}], type.transform [{p:[6],lm:0}], [{p:[2],ld:{}}], 'client'
		test.deepEqual [{p:[1],lm:0}], type.transform [{p:[1],lm:0}], [{p:[2],ld:{}}], 'client'
		test.deepEqual [{p:[1],ld:{}}], type.transform [{p:[2],ld:{}}], [{p:[1],lm:2}], 'server'
		test.deepEqual [{p:[0],ld:{}}], type.transform [{p:[1],ld:{}}], [{p:[0],lm:1}], 'server'
		test.deepEqual [{p:[0],ld:1,li:2}], type.transform [{p:[1],ld:1,li:2}], [{p:[1],lm:0}], 'client'
		test.done()


exports.object =
	'Apply sanity checks': (test) ->
		test.deepEqual {x:'a', y:'b'}, type.apply {x:'a'}, [{p:['y'], oi:'b'}]
		test.deepEqual {}, type.apply {x:'a'}, [{p:['x'], od:'a'}]
		test.deepEqual {x:'b'}, type.apply {x:'a'}, [{p:['x'], od:'a', oi:'b'}]
		test.done()
	
	'Ops on deleted elements become noops': (test) ->
		test.deepEqual [], type.transform [{p:[1, 0], si:'hi'}], [{p:[1], od:'x'}], 'client'
		test.deepEqual [], type.transform [{p:[9],si:"bite "}], [{p:[],od:"agimble s",oi:null}], 'server'
		test.done()
	
	'Ops on replaced elements become noops': (test) ->
		test.deepEqual [], type.transform [{p:[1, 0], si:'hi'}], [{p:[1], od:'x', oi:'y'}], 'client'
		test.done()

	'Deleted data is changed to reflect edits': (test) ->
		test.deepEqual [{p:[1], od:'abc'}], type.transform [{p:[1], od:'a'}], [{p:[1, 1], si:'bc'}], 'client'
		test.deepEqual [{p:[],od:25,oi:[]}], type.transform [{p:[],od:22,oi:[]}], [{p:[],na:3}], 'client'
		test.deepEqual [{p:[],od:{toves:""},oi:4}], type.transform [{p:[],od:{toves:0},oi:4}], [{p:["toves"],od:0,oi:""}], 'client'
		test.deepEqual [{p:[],od:"thou an",oi:[]}], type.transform [{p:[],od:"thou and ",oi:[]}], [{p:[7],sd:"d "}], 'client'
		test.deepEqual [], type.transform([{p:["bird"],na:2}], [{p:[],od:{bird:38},oi:20}], 'server')
		test.deepEqual [{p:[],od:{bird:40},oi:20}], type.transform([{p:[],od:{bird:38},oi:20}], [{p:["bird"],na:2}], 'client')
		test.deepEqual [{p:['He'],od:[]}], type.transform [{p:["He"],od:[]}], [{p:["The"],na:-3}], 'server'
		test.deepEqual [], type.transform [{p:["He"],oi:{}}], [{p:[],od:{},oi:"the"}], 'client'
		test.done()
	
	'If two inserts are simultaneous, the clients insert will win': (test) ->
		test.deepEqual [{p:[1], oi:'a', od:'b'}], type.transform [{p:[1], oi:'a'}], [{p:[1], oi:'b'}], 'client'
		test.deepEqual [], type.transform [{p:[1], oi:'b'}], [{p:[1], oi:'a'}], 'server'
		test.done()

	'parallel ops on different keys miss each other': (test) ->
		test.deepEqual [{p:['a'], oi: 'x'}], type.transform [{p:['a'], oi:'x'}], [{p:['b'], oi:'z'}], 'client'
		test.deepEqual [{p:['a'], oi: 'x'}], type.transform [{p:['a'], oi:'x'}], [{p:['b'], od:'z'}], 'client'
		test.deepEqual [{p:["in","he"],oi:{}}], type.transform [{p:["in","he"],oi:{}}], [{p:["and"],od:{}}], 'server'
		test.deepEqual [{p:['x',0],si:"his "}], type.transform [{p:['x',0],si:"his "}], [{p:['y'],od:0,oi:1}], 'server'
		test.done()

	'replacement vs. deletion': (test) ->
		test.deepEqual [{p:[],oi:{}}], type.transform [{p:[],od:[''],oi:{}}], [{p:[],od:['']}], 'server'
		test.done()

	'replacement vs. replacement': (test) ->
		test.deepEqual [],                     type.transform [{p:[],od:['']},{p:[],oi:{}}], [{p:[],od:['']},{p:[],oi:null}], 'server'
		test.deepEqual [{p:[],od:null,oi:{}}], type.transform [{p:[],od:['']},{p:[],oi:{}}], [{p:[],od:['']},{p:[],oi:null}], 'client'
		test.deepEqual [],                     type.transform [{p:[],od:[''],oi:{}}], [{p:[],od:[''],oi:null}], 'server'
		test.deepEqual [{p:[],od:null,oi:{}}], type.transform [{p:[],od:[''],oi:{}}], [{p:[],od:[''],oi:null}], 'client'
	
		# test diamond property
		serverOps = [ {"p":[],"od":null,"oi":{}} ]
		clientOps = [ {"p":[],"od":null,"oi":""} ]
		serverHas = type.apply(null, serverOps)
		clientHas = type.apply(null, clientOps)
			
		[server_, client_] = require('../helpers').transformX type, serverOps, clientOps
		test.deepEqual clientHas, type.apply serverHas, client_
		test.deepEqual clientHas, type.apply clientHas, server_

		test.done()
	
	'An attempt to re-delete a key becomes a no-op': (test) ->
		test.deepEqual [], type.transform [{p:['k'], od:'x'}], [{p:['k'], od:'x'}], 'client'
		test.deepEqual [], type.transform [{p:['k'], od:'x'}], [{p:['k'], od:'x'}], 'server'
		test.done()

exports.randomizer = (test) ->
	require('../helpers').randomizerTest type
	test.done()
