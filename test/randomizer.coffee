assert = require 'assert'
helpers = require './helpers'
util = require 'util'
p = util.debug
i = util.inspect

# Returns [serverDoc, clientDoc]
testRandomOp = (type, initialDoc = type.initialVersion()) ->
	makeDoc = -> {
			ops: []
			result: initialDoc
		}
	server = makeDoc()
	client = makeDoc()

	for [0..(Math.random() * 2 + 1)]
		doc = if Math.random() < 0.5 then client else server
		[op, doc.result] = type.generateRandomOp doc.result
		doc.ops.push(op)

	# First, test type.apply.
	testApply = (doc) ->
		s = initialDoc
		s = type.apply s, op for op in doc.ops
		assert.deepEqual s, doc.result
	
	testApply client
	testApply server

	if type.invert?
		# Invert all the ops and apply them to result. Should end up with initialDoc.
		testInvert = (doc, ops) ->
			snapshot = doc.result

			# Sadly, coffeescript doesn't seem to support iterating backwards through an array.
			# reverse() reverses an array in-place so it needs to be cloned first.
			ops = ops.slice().reverse()
			for op in ops
				op_ = type.invert op
				snapshot = type.apply snapshot, op_

			assert.deepEqual snapshot, initialDoc
	
	testInvert? client, client.ops
	testInvert? server, server.ops

	# If all the ops are composed together, then applied, we should get the same result.
	if type.compose?
		compose = (doc) ->
			if doc.ops.length > 0
				doc.composed = helpers.composeList type, doc.ops
				# .... And this should match the expected document.
				assert.deepEqual doc.result, type.apply initialDoc, doc.composed

		compose client
		compose server

		testInvert? client, [client.composed] if client.composed?
		testInvert? server, [server.composed] if server.composed?
	
		# Check the diamond property holds
		if client.composed? && server.composed?
			[server_, client_] = helpers.transformX type, server.composed, client.composed

			s_c = type.apply server.result, client_
			c_s = type.apply client.result, server_

			# Interestingly, these will not be the same as s_c and c_s above.
			# Eg, when:
			#	server.ops = [ [ { d: 'x' } ], [ { i: 'c' } ] ]
			#	client.ops = [ 1, { i: 'b' } ]
			assert.deepEqual s_c, c_s

	# Now we'll check the n^2 transform method.
	if client.ops.length > 0 && server.ops.length > 0
#		p "s #{i server.result} c #{i client.result} XF #{i server.ops} x #{i client.ops}"
		[s_, c_] = helpers.transformLists type, server.ops, client.ops
#		p "applying #{i c_} to #{i server.result}"
		s_c = c_.reduce type.apply, server.result
		c_s = s_.reduce type.apply, client.result

		assert.deepEqual s_c, c_s

		# ... And we'll do a round-trip using invert().
		if type.invert?
			c_inv = c_.slice().reverse().map type.invert
			server_result_ = c_inv.reduce type.apply, s_c
			assert.deepEqual server.result, server_result_
			orig_ = server.ops.slice().reverse().map(type.invert).reduce(type.apply, server_result_)
			assert.deepEqual orig_, initialDoc
	
	client.result

# Run some iterations of the random op tester. Requires a random op generator for the type.
exports.test = (type, iterations = 300) ->
	assert.ok type.generateRandomOp
	assert.ok type.transform

	p "   Running #{iterations} of randomized tests for type #{type.name}..."

	warnUnless = (fn) -> p "NOTE: Not running #{fn} tests because #{type.name} does not have #{fn}() defined" unless type[fn]?
	warnUnless 'invert'
	warnUnless 'compose'

	doc = type.initialVersion()
	for n in [0..iterations]
#		p n if n % 200 == 0
		doc = testRandomOp(type, doc)
