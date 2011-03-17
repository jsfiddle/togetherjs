# Ops are lists of components
# Each component is {i:'blah', p:4} or {d:'blah', p:4}

exports.name = 'text2'

util = require 'util'
p = util.debug
i = util.inspect

inject = (s1, pos, s2) -> s1[...pos] + s2 + s1[pos..]

exports.initialVersion = -> ''

checkValidComponent = (c) ->
	if typeof c.p != 'number'
		throw new Error 'component missing position field'

	i_type = typeof c.i
	d_type = typeof c.d
	throw new Error 'component needs an i or d field' unless (i_type == 'string') ^ (d_type == 'string')

	throw new Error 'position must be positive' unless c.p >= 0
	
	true

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

# Exported for use by the random op generator
exports._makeAppend = makeAppend = (newOp) -> (c) ->
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
	append = makeAppend newOp
	append c for c in op2

	checkValidOp newOp
	newOp

# Attempt to compress the op components together 'as much as possible'.
# This implementation preserves order and preserves create/delete pairs.
exports.compress = compress = (op) -> compose [], op

exports.normalize = compress

# Transform an op component by another op component. Asymmetric.
# The result will be sent to the provided append function.
transformComponent = (append, c, otherC, type) ->
	checkValidOp [c]
	checkValidOp [otherC]

	# This could also be written as: Math.min(c.p, Math.min(c.p - otherC.p, otherC.d.length))
	# but I think its harder to read that way, and it compiles using ternary operators anyway
	# so there's not much saving.
	transposePositionByDelete = ->
		if c.p <= otherC.p
			c.p
		else if c.p <= otherC.p + otherC.d.length
			otherC.p
		else
			c.p - otherC.d.length

	if c.i?
		if otherC.i? # insert vs insert
			if otherC.p < c.p || (otherC.p == c.p && type == 'server')
				append {i:c.i, p:c.p + otherC.i.length}
			else
				append c

		else # insert v delete
			append {i:c.i, p:transposePositionByDelete()}

	else # Delete
		if otherC.i? # delete vs insert
			s = c.d
			if c.p < otherC.p
				append {d:s[...otherC.p - c.p], p:c.p}
				s = s[(otherC.p - c.p)..]
			if s != ''
				append {d:s, p:c.p + otherC.i.length}

		else # Delete vs delete
			if c.p >= otherC.p + otherC.d.length
				append {d:c.d, p:c.p - otherC.d.length}
			else if c.p + c.d.length <= otherC.p
				append c
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
					newC.p = transposePositionByDelete()
					append newC
		
transformComponentX = (server, client, appendServer, appendClient) ->
	transformComponent appendServer, server, client, 'server'
	transformComponent appendClient, client, server, 'client'

exports.transformX = transformX = (serverOp, clientOp) ->
	checkValidOp serverOp
	checkValidOp clientOp

	newClientOp = []
	appendClient = makeAppend newClientOp

#	p "transformSymm #{i serverOp} #{i clientOp}"

	for clientComponent in clientOp
		# Generate newServerOp by composing serverOp by clientComponent
		newServerOp = []
		appendNextServer = makeAppend newServerOp

		k = 0
		while k < serverOp.length
			nextC = []
			appendNextClient = makeAppend nextC
			transformComponentX serverOp[k], clientComponent, appendNextServer, appendNextClient
			k++

			if nextC.length == 1
				clientComponent = nextC[0]
			else if nextC.length == 0
				appendNextServer s for s in serverOp[k..]
				clientComponent = null
				break
			else
				# Recurse.
				[s_, c_] = transformX serverOp[k..], nextC
				appendNextServer s for s in s_
				appendClient c for c in c_
				clientComponent = null
				break
	
		appendClient clientComponent if clientComponent?
		serverOp = newServerOp
	
#	p "transformSymm -> #{i serverOp} #{i newClientOp}"
	
	checkValidOp serverOp
	checkValidOp clientOp
	[serverOp, newClientOp]

exports.transform = (op, otherOp, type) ->
	throw new Error "type must be 'server' or 'client'" unless type == 'server' or type == 'client'

	if type == 'server'
		[server, _] = transformX op, otherOp
		server
	else
		[_, client] = transformX otherOp, op
		client

