# These methods let you build a transform function from a transformComponent function
# for OT types like text and JSON in which operations are lists of components
# and transforming them requires N^2 work.

# Add transform and transformX functions for an OT type which has transformComponent defined.
# transformComponent(destination array, component, other component, type - 'server' or 'client')
bootstrapTransform = (type, transformComponent, checkValidOp, append) ->
	transformComponentX = (server, client, destServer, destClient) ->
		transformComponent destServer, server, client, 'server'
		transformComponent destClient, client, server, 'client'

	# Transforms serverOp by clientOp. Returns [serverOp', clientOp']
	type.transformX = type['transformX'] = transformX = (serverOp, clientOp) ->
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
	type.transform = type['transform'] = (op, otherOp, type) ->
		throw new Error "type must be 'server' or 'client'" unless type == 'server' or type == 'client'

		return op if otherOp.length == 0

		# TODO: Benchmark with and without this line. I _think_ it'll make a big difference...?
		return transformComponent [], op[0], otherOp[0], type if op.length == 1 and otherOp.length == 1

		if type == 'server'
			[server, _] = transformX op, otherOp
			server
		else
			[_, client] = transformX otherOp, op
			client

unless WEB?
	exports.bootstrapTransform = bootstrapTransform

