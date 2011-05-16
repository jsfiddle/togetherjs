# Some utility functions.
p = -> #require('util').debug
i = -> #require('util').inspect

# Cross-transform function. Transform server by client and client by server. Returns
# [server, client].
exports.transformX = transformX = (type, server, client) ->
	[type.transform(server, client, 'server'), type.transform(client, server, 'client')]


# Generate a random int 0 <= k < n
# This should probably be moved into a utility function.
#randomInt = (n) -> Math.floor(Math.random() * n)
r = 1234534
exports.randomInt = randomInt = (n) -> Math.abs((r = (r << 2) ^ (r << 1) - r + 1) % n)
exports.randomReal = () ->
	n = randomInt(2147483648)
	return randomInt(n)/n


# Transform a list of server ops by a list of client ops.
# Returns [serverOps', clientOps'].
# This is O(serverOps.length * clientOps.length)
exports.transformLists = (type, serverOps, clientOps) ->
	#p "Transforming #{i serverOps} with #{i clientOps}"
	serverOps = for s in serverOps
		clientOps = for c in clientOps
			#p "X #{i s} by #{i c}"
			[s, c_] = transformX type, s, c
			c_
		s
	
	[serverOps, clientOps]

# Compose a list of ops together
exports.composeList = (type, ops) ->
	result = null
	for op in ops
		if result == null
			result = op
		else
			result = type.compose result, op
	result

# Returns a function that calls test.done() after it has been called n times
exports.makePassPart = (test, n) ->
	remaining = n
	->
		remaining--
		if remaining == 0
			test.done()
		else if remaining < 0
			throw new Error "passPart() called more than #{n} times"

# Callback will be called after all the ops have been applied, with the
# resultant snapshot. Callback format is callback(error, snapshot)
#
# It might be worth moving this to model so others can use this method.
exports.applyOps = applyOps = (model, docName, startVersion, ops, callback) =>
	op = ops.shift()
	model.applyOp docName, {v:startVersion, op:op}, (error, appliedVersion) =>
		if error
			callback(error, null)
		else
			if ops.length == 0
				model.getSnapshot docName, (snapshot) ->
					callback(null, snapshot)
			else
				applyOps model, docName, startVersion + 1, ops, callback

# Generate a new, locally unique document name.
exports.newDocName = do ->
	index = 1
	() -> 'testing_doc_' + index++

