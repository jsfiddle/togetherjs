Connection = require('../src/client').Connection

# This will add generateRandomOp to the type
require '../test/types/text'
types = require '../src/types'

generate = ->
	c = new Connection('localhost', 8000)
	c.open 'sarahtest', (doc) ->
		apply = ->
			[op, _] = types.text.generateRandomOp doc.snapshot
	#		console.log doc.snapshot
	#		console.log op
			doc.submitOp op

		setInterval apply, 100

generate() for [1..10]
