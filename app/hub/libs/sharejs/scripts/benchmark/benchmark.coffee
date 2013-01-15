randomWord = require '../test/types/randomWord'
composableText = require '../lib/types/text'

util = require 'util'
p = util.debug

generator = (doc) ->
	# Most edits are simply users typing or deleting text.
	pos = Math.floor(Math.random() * (doc.length + 1))

	size = if Math.random() < 0.1 then 'large' else 'small'

	if size == 'small'
		# Randomly either delete a character

		# Its illegal to delete at the end of insert at the start. No-ops are very rare in practice.
		action = if pos == doc.length
			'insert'
		else if pos == 0
			'delete'
		else
			# Slightly bias it toward inserts. Documents tend to grow more than shrink.
			if Math.random() < 0.55 then 'insert' else 'delete'
		
		if action == 'insert'
			# Insert a random character.
			code = 97 + Math.floor(Math.random() * 26)
			
			{pos:pos, i:String.fromCharCode(code)}
		else
			char = doc[pos]

			{pos:pos, d:char}
	else
		# Do a chunky delete / insert.
		op = {pos:pos}
		op.d = doc[pos..(pos + Math.random() * 8)] if Math.random() < 0.45 && pos < doc.length
		op.i = randomWord() + ' ' if Math.random() < 0.9 || !op.d?
		delete op.i if op.i == ''

		op

generatorOpToComposable = (doc, op) ->
	cOp = []
	cOp.push(op.pos)
	cOp.push {d:op.d} if op.d?
	cOp.push {i:op.i} if op.i?
	remainder = doc.length - op.pos
	remainder -= op.d.length if op.d?
	cOp.push remainder

	composableText.normalize cOp


genOps = (doc) ->
	ops = []
	for x in [1..50000]
		op = generator doc
		cOp = generatorOpToComposable doc, op
	#	p "'#{doc}' + #{util.inspect cOp}"
		newDoc = composableText.apply doc, cOp
		#console.log "'#{doc}' -> '#{newDoc}' via #{util.inspect cOp}"
		doc = newDoc

		ops.push cOp
	
	ops

benchmark = (callback) ->
	start = Date.now()
	data = callback()
	end = Date.now()

	[end - start, data]

initial = ''
#initial = (randomWord() for x in [1..1000]).join(' ')
#p "Initial len=#{initial.length}"
ops = genOps initial
doc = null

[total, times] = benchmark ->
	doc = initial
	times = []
	for op, i in ops
		doc = composableText.apply(doc, op)
		times.push [i, Date.now(), doc.length] if i % 1000 == 0

	times.push [ops.length, Date.now(), doc.length]
	
	times

#console.log "Applied #{ops.length} ops, final doc length #{doc.length} in #{total} ms. #{total / ops.length} ms per op, #{1000 * ops.length / total} ops/sec"

console.log t.join(',') for t in times
#console.log util.inspect times
