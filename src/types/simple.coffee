# op = {position:#, text:"asdf"}
# snapshot = {str:string}
# transform = ...

exports.apply = (snapshot, op) ->
	throw new Error 'Invalid position' unless 0 <= op.position <= snapshot.str.length

	str = snapshot.str
	str = str.slice(0, op.position) + op.text + str.slice(op.position)
	snapshot.str = str
	snapshot

# transform op1 by op2. Return transformed version of op1.
exports.transform = (op1, op2) ->
	pos = op1.position
	pos += op2.text.length if op2.position < pos

	return {position:pos, text:op1.text}

exports.create = -> {str:""}

exports.name = 'simple'
