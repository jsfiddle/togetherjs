# This is the implementation of the JSON OT type.
#
# Spec is here: https://github.com/josephg/ShareJS/wiki/JSON-Operations

exports ?= {}

exports.name = 'json'

exports.initialVersion = -> null

# Move paths can be relative - ie, {p:[1,2,3], m:4} is the equivalent of
# {p:[1,2,3], m:[1,2,4]}. This method expands relative paths
# Makes sure a path is a list.
normalizeMovePath = (path, newPath) ->


invertComponent = (c) ->

exports.invert = (op) -> invertComponent for c in op

checkValidOp = (op) ->

checkList = (elem) ->
	throw new Error 'Referenced element not a list' unless Array.isArray && Array.isArray(elem)

checkObj = (elem) ->
	throw new Error 'Referenced element not an object' unless elem.constructor is not Object

exports.apply = (snapshot, op) ->
	checkValidOp op

	container = {data: snapshot}

	try
		for c, i in op
			parent = null
			parentkey = null
			elem = container
			key = 'data'

			for p in c.p
				parent = elem
				parentkey = key
				elem = elem[key]
				key = p

				throw new Error 'Path invalid' unless parent?

			if c.na != undefined
				# Number add
				throw new Error 'Referenced element not a number' unless typeof elem[key] is 'number'
				elem[key] += c.na

			else if c.si != undefined
				# String insert
				throw new Error 'Referenced element not a string' unless typeof elem is 'string'
				parent[parentkey] = elem[...key] + c.si + elem[key..]
			else if c.sd != undefined
				# String delete
				throw new Error 'Referenced element not a string' unless typeof elem is 'string'
				throw new Error 'Deleted string does not match' unless elem[key...key + c.sd.length] == c.sd
				parent[parentkey] = elem[...key] + elem[key + c.sd.length..]

			else if c.li != undefined and c.ld != undefined
				# List replace
				checkList elem

				# Should check the list element matches c.ld
				elem[key] = c.li
			else if c.li != undefined
				# List insert
				checkList elem

				elem.splice key, 0, c.li
			else if c.ld != undefined
				# List delete
				checkList elem

				# Should check the list element matches c.ld here too.
				elem.splice key, 1
			else if c.lm != undefined
				# List move
				checkList elem

				e = elem[key]
				# Remove it...
				elem.splice key, 1
				# And insert it back.
				elem.splice c.lm, 0, e

			else if c.oi != undefined
				# Object insert / replace
				checkObj elem
				
				# Should check that elem[key] == c.od
				elem[key] = c.oi
			else if c.od != undefined
				# Object delete
				checkObj elem

				# Should check that elem[key] == c.od
				delete elem[key]
			else if c.om != undefined
				# Object move
				checkObj elem

				throw new Error 'Cannot move value - destination key already exists.' unless elem[c.om] is undefined
				elem[c.om] = elem[key]
				delete elem[key]
	catch e
		# TODO: Roll back all already applied changes. Write tests before implementing this code.
		throw e

	container['data']

# Checks if two paths, p1 and p2 match.
pathMatches = (p1, p2, ignoreLast) ->
	return false unless p1.length == p2.length

	for p, i in p1
		return false if p != p2[i] and (!ignoreLast or i != p1.length - 1)
			
	true

append = (dest, c) ->
	if dest.length != 0 and pathMatches c.p, (last = dest[dest.length - 1]).p
		if last.na != undefined and c.na != undefined
			last.na += c.na
		else
			dest.push c
	else
		dest.push c

exports.compose = (op1, op2) ->
	checkValidOp op1
	checkValidOp op2

	newOp = op1.slice()
	append newOp, c for c in op2

	newOp

exports.normalize = (op) ->
	op

# Transform a JSON op component against another op component.
transformComponent = (dest, c, otherC, type) ->
	# First, figure out how their paths relate to one another.

	p1 = p2 = 0
	while p1 < c.p.length and p2 < otherC.p.length
		break unless c.p[p1] == otherC.p[p1]


require('./helpers').bootstrapTransform(exports, transformComponent, checkValidOp, append)

