# Text document API for text

if WEB?
	type = exports.types['text-composable']
else
	type = require './text-composable'

type.api =
	provides: {'text':true}

	# The number of characters in the string
	'getLength': -> @snapshot.length

	# Get the text contents of a document
	'getText': -> @snapshot

	'insert': (text, pos, callback) ->
		pos = 0 unless pos?
		op = type.normalize [pos, 'i':text, (@snapshot.length - pos)]
		
		@submitOp op, callback
		op
	
	'del': (length, pos, callback) ->
		op = type.normalize [pos, 'd':@snapshot[pos...(pos + length)], (@snapshot.length - pos - length)]

		@submitOp op, callback
		op

	_register: ->
		@on 'remoteop', (op) ->
			pos = 0
			for component in op
				if typeof component is 'number'
					pos += component
				else if component.i != undefined
					@emit 'insert', component.i, pos
					pos += component.i.length
				else
					# delete
					@emit 'delete', component.d, pos
					# We don't increment pos, because the position
					# specified is after the delete has happened.

