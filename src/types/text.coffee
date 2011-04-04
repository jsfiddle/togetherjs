# A simple text implementation
#
# Operations are lists of components.
# Each component either inserts or deletes at a specified position in the document.
#
# Components are either:
#  {i:'str', p:100}: Insert 'str' at position 100 in the document
#  {d:'str', p:100}: Delete 'str' at position 100 in the document
#
# Components in an operation are executed sequentially, so the position of components
# assumes previous components have already executed.
#
# Eg: This op:
#   [{i:'abc', p:0}]
# is equivalent to this op:
#   [{i:'a', p:0}, {i:'b', p:1}, {i:'c', p:2}]

exports ?= {}

exports.name = 'text'

exports.initialVersion = -> ''

inject = (s1, pos, s2) -> s1[...pos] + s2 + s1[pos..]

checkValidComponent = (c) ->
	if typeof c.p != 'number'
		throw new Error 'component missing position field'

	i_type = typeof c.i
	d_type = typeof c.d
	throw new Error 'component needs an i or d field' unless (i_type == 'string') ^ (d_type == 'string')

	throw new Error 'position cannot be negative' unless c.p >= 0

checkValidOp = (op) ->
	checkValidComponent(c) for c in op
	true

exports.apply = (snapshot, op) ->
	checkValidOp op
	for component in op
		if component.i?
			snapshot = inject snapshot, component.p, component.i
		else
			deleted = snapshot[component.p...(component.p + component.d.length)]
			throw new Error "Delete component '#{component.d}' does not match deleted text '#{deleted}'" unless component.d == deleted
			snapshot = snapshot[...component.p] + snapshot[(component.p + component.d.length)..]
	
	snapshot


# Exported for use by the random op generator.
#
# For simplicity, this version of append does not compress adjacent inserts and deletes of
# the same text. It would be nice to change that at some stage.
exports._append = append = (newOp, c) ->
	return if c.i == '' or c.d == ''
	if newOp.length == 0
		newOp.push c
	else
		last = newOp[newOp.length - 1]

		# Compose the insert into the previous insert if possible
		if last.i? && c.i? and last.p <= c.p <= (last.p + last.i.length)
			newOp[newOp.length - 1] = {i:inject(last.i, c.p - last.p, c.i), p:last.p}
		else if last.d? && c.d? and c.p <= last.p <= (c.p + c.d.length)
			newOp[newOp.length - 1] = {d:inject(c.d, last.p - c.p, last.d), p:c.p}
		else
			newOp.push c

exports.compose = compose = (op1, op2) ->
	checkValidOp op1
	checkValidOp op2

	newOp = op1.slice()
	append newOp, c for c in op2

	checkValidOp newOp
	newOp

# Attempt to compress the op components together 'as much as possible'.
# This implementation preserves order and preserves create/delete pairs.
exports.compress = compress = (op) -> compose [], op

exports.normalize = compress

# This helper method transforms a position by an op component.
#
# If c is an insert, insertAfter specifies whether the transform
# is pushed after the insert (true) or before it (false).
#
# insertAfter is optional for deletes.
transformPosition = (pos, c, insertAfter) ->
	if c.i?
		if c.p < pos || (c.p == pos && insertAfter)
			pos + c.i.length
		else
			pos
	else
		# I think this could also be written as: Math.min(c.p, Math.min(c.p - otherC.p, otherC.d.length))
		# but I think its harder to read that way, and it compiles using ternary operators anyway
		# so its no slower written like this.
		if pos <= c.p
			pos
		else if pos <= c.p + c.d.length
			c.p
		else
			pos - c.d.length

# Helper method to transform a cursor position as a result of an op.
#
# Like transformPosition above, if c is an insert, insertAfter specifies whether the cursor position
# is pushed after an insert (true) or before it (false).
exports.transformCursor = (position, op, insertAfter) ->
	position = transformPosition position, c, insertAfter for c in op
	position

# Transform an op component by another op component. Asymmetric.
# The result will be appended to destination.
transformComponent = (dest, c, otherC, type) ->
	checkValidOp [c]
	checkValidOp [otherC]

	if c.i?
		append dest, {i:c.i, p:transformPosition(c.p, otherC, type == 'server')}

	else # Delete
		if otherC.i? # delete vs insert
			s = c.d
			if c.p < otherC.p
				append dest, {d:s[...otherC.p - c.p], p:c.p}
				s = s[(otherC.p - c.p)..]
			if s != ''
				append dest, {d:s, p:c.p + otherC.i.length}

		else # Delete vs delete
			if c.p >= otherC.p + otherC.d.length
				append dest, {d:c.d, p:c.p - otherC.d.length}
			else if c.p + c.d.length <= otherC.p
				append dest, c
			else
				# They overlap somewhere.
				newC = {d:'', p:c.p}
				if c.p < otherC.p
					newC.d = c.d[...(otherC.p - c.p)]
				if c.p + c.d.length > otherC.p + otherC.d.length
					newC.d += c.d[(otherC.p + otherC.d.length - c.p)..]

				# This is entirely optional - just for a check that the deleted
				# text in the two ops matches
				intersectStart = Math.max c.p, otherC.p
				intersectEnd = Math.min c.p + c.d.length, otherC.p + otherC.d.length
				cIntersect = c.d[intersectStart - c.p...intersectEnd - c.p]
				otherIntersect = otherC.d[intersectStart - otherC.p...intersectEnd - otherC.p]
				throw new Error 'Delete ops delete different text in the same region of the document' unless cIntersect == otherIntersect

				if newC.d != ''
					# This could be rewritten similarly to insert v delete, above.
					newC.p = transformPosition newC.p, otherC
					append dest, newC

transformComponentX = (server, client, destServer, destClient) ->
	transformComponent destServer, server, client, 'server'
	transformComponent destClient, client, server, 'client'

# Transforms serverOp by clientOp. Returns [serverOp', clientOp']
exports.transformX = transformX = (serverOp, clientOp) ->
	checkValidOp serverOp
	checkValidOp clientOp

	newClientOp = []

	for clientComponent in clientOp
		# Generate newServerOp by composing serverOp by clientComponent
		newServerOp = []

		k = 0
		while k < serverOp.length
			nextC = []
			transformComponentX serverOp[k], clientComponent, newServerOp, nextC
			k++

			if nextC.length == 1
				clientComponent = nextC[0]
			else if nextC.length == 0
				append newServerOp, s for s in serverOp[k..]
				clientComponent = null
				break
			else
				# Recurse.
				[s_, c_] = transformX serverOp[k..], nextC
				append newServerOp, s for s in s_
				append newClientOp, c for c in c_
				clientComponent = null
				break
	
		append newClientOp, clientComponent if clientComponent?
		serverOp = newServerOp
	
	[serverOp, newClientOp]

# Transforms op with specified type ('server' or 'client') by otherOp.
exports.transform = (op, otherOp, type) ->
	throw new Error "type must be 'server' or 'client'" unless type == 'server' or type == 'client'

	if type == 'server'
		[server, _] = transformX op, otherOp
		server
	else
		[_, client] = transformX otherOp, op
		client

invertComponent = (c) ->
	if c.i?
		{d:c.i, p:c.p}
	else
		{i:c.d, p:c.p}

# No need to use append for invert, because the components won't be able to
# cancel with one another.
exports.invert = (op) -> (invertComponent c for c in op.slice().reverse())

if window?
	window.sharejs ||= {}
	window.sharejs.types ||= {}
	window.sharejs.types.text = exports

