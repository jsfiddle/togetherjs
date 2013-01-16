Connection = require('../src/client').Connection

# This will add generateRandomOp to the type
require '../test/types/text'
types = require '../src/types'
randomWord = require '../test/types/randomWord'

targetSize = 1000

flagfall = 1000
mark = do ->
	sinceRecord = 0
	lastTime = Date.now()
	->
		sinceRecord++
		if sinceRecord > flagfall
			sinceRecord -= flagfall
			now = Date.now()
			elapsed = now - lastTime
			console.log "#{flagfall} ops in #{elapsed} ms - #{1000 * flagfall / elapsed} ops per second"
			lastTime = now

generator = (doc) ->
	# Most edits are simply users typing or deleting text.
	pos = Math.floor(Math.random() * (doc.length + 1))

	# Large edits are like copy+pastes and stuff like that.
	size = if Math.random() < 0.03 then 'large' else 'small'

	if size == 'small'
		# Randomly insert or delete a character

		# Its illegal to delete at the end of insert at the start. No-ops are very rare in practice.
		action = if pos == doc.length
			'insert'
		else if pos == 0
			'delete'
		else
			# I want to bias it toward inserts, because documents tend to grow more than shrink.
			# However, we want the document to hover around targetSize.
			bias = if doc.length > targetSize then 0.3 else 0.7
			if Math.random() < bias then 'insert' else 'delete'
		
		if action == 'insert'
			# Insert a random character.
			chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \n"
			c = chars[Math.floor(Math.random() * chars.length)]
			[pos, {i:c}, doc.length - pos]
		else
			char = doc[pos]
			[pos, {d:char}, doc.length - pos - 1]
	else
		# Do a chunky delete / insert.
		op = [pos]
		end = doc.length - pos

		if Math.random() < 0.45 && pos < doc.length
			text = doc[pos..(pos + Math.random() * 8)]
			op.push {d:text}
			end -= text.length

		op.push {i:randomWord() + ' '} if Math.random() < 0.9 || op.length == 1
		op.push end

		op

generate = ->
	c = new Connection('localhost', 8000)
	c.open 'spam4', 'text-composable', (doc) ->
		apply = ->
			#			console.log "v: #{doc.version} length #{doc.snapshot.length}"
			op = generator doc.snapshot
			doc.submitOp op, ->
				mark()
				apply()

		apply()

generate() for [1..10]
