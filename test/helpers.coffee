# Some utility functions.
p = -> #require('util').debug
i = -> #require('util').inspect

# Cross-transform function. Transform server by client and client by server. Returns
# [server, client].
exports.transformX = transformX = (type, server, client) ->
	[type.transform(server, client, 'server'), type.transform(client, server, 'client')]

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


