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
		assert.strictEqual s, doc.result
	
	testApply client
	testApply server

	# If all the ops are composed together, then applied, we should get the same result.
	if type.compose?
		compose = (doc) ->
			if doc.ops.length > 0
				doc.composed = helpers.composeList type, doc.ops
				# .... And this should match the expected document.
				assert.strictEqual doc.result, type.apply initialDoc, doc.composed

		compose client
		compose server

		# Check the diamond property holds
		if client.composed? && server.composed?
#			p "original: #{i initialDoc}"
#			p "server: #{i server.result}"
#			p "client: #{i client.result}"
			[server_, client_] = helpers.transformX type, server.composed, client.composed
#			p "composed client: #{i client_}"
#			p "composed server: #{i server_}"

			s_c = type.apply server.result, client_
			c_s = type.apply client.result, server_

			# Interestingly, these will not be the same as s_c and c_s above.
			# Eg, when:
			#	server.ops = [ [ { d: 'x' } ], [ { i: 'c' } ] ]
			#	client.ops = [ 1, { i: 'b' } ]
			assert.strictEqual s_c, c_s
	
	# Now we'll check the n^2 transform method.
	if client.ops.length > 0 && server.ops.length > 0
#		p "s #{i server.result} c #{i client.result} XF #{i server.ops} x #{i client.ops}"
		[s_, c_] = helpers.transformLists type, server.ops, client.ops
#		p "applying #{i c_} to #{i server.result}"
		s_c = c_.reduce ((doc, op) -> type.apply(doc, op)), server.result
		c_s = s_.reduce ((doc, op) -> type.apply(doc, op)), client.result

		assert.strictEqual s_c, c_s
	
	client.result

# Run some iterations of the random op tester. Requires a random op generator for the type.
exports.test = (type, iterations = 300) ->
	assert.ok type.generateRandomOp
	assert.ok type.transform

	p "   Running #{iterations} of randomized tests for type #{type.name}..."
	doc = type.initialVersion()
	for n in [0..iterations]
#		p n if n % 200 == 0
		doc = testRandomOp(type, doc)
