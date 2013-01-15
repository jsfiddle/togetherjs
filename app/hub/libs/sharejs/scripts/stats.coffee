redis = require 'redis'
text = require '../src/types/text'

client = redis.createClient()

debug = require('util').debug

# Returns how many components of the op aren't skips
opComplexity = (op) ->
	op.filter((c) -> typeof c != 'number').length


# Compose adjacent ops together into groups the size of window.
composeAdjacent = (data, window) ->
	composedOps = []
	op = null

	console.log "\nSimulating lag of #{window}ms..."

	for opData in data
#		console.log opData
		if op == null or opData.meta.ts > (op.meta.ts + window)
#			console.log op
			composedOps.push op if op?
			op = {op:opData.op, meta:{ts:opData.meta.ts}}
			time = opData.meta.ts
		else
			op.op = text.compose op.op, opData.op
	
	composedOps.push(op) if op?

	console.log "#{data.length} ops composed into #{composedOps.length} ops (avg #{data.length / composedOps.length} ops/#{window}ms)"

	composedOps

printStats = (data) ->
	deletes = 0
	inserts = 0
	singleCharIns = 0
	singleCharDel = 0
	simpleOps = 0
	totalComplexity = 0
	total = 0

	simpleComposed = 0

	lastOp = null

	for opData in data
		op = opData.op

		complexity = opComplexity(op)
		simpleOps++ if complexity <= 1
		totalComplexity += complexity

		if lastOp?
			composed = text.compose lastOp, op
			# Basically, we want to figure out if there's no gap between the text.
			simpleComposed++ if opComplexity(composed) <= 1

#		pos = if op[0] == 'number' then op[0] else 0
		for c in op
			if c.d?
				deletes++
				singleCharDel++ if c.d.length == 1

			if c.i?
				inserts++
				singleCharIns++ if c.i.length == 1

		lastOp = op
		total++

	console.log()
	console.log "#{total} ops, with #{totalComplexity} inserts or deletes"
	console.log "#{100 * inserts/total}% inserts"
	console.log " of which #{100 * singleCharIns/inserts}% were only a single character"
	console.log "#{100 * deletes/total}% deletes"
	console.log " of which #{100 * singleCharDel/deletes}% were only a single character"
	console.log "#{totalComplexity/total} avg complexity per op"

	simpleOpsPct = 100 * simpleOps/total
	console.log "#{simpleOpsPct}% simpleOps, #{100 - simpleOpsPct}% complex ops"
	console.log "#{100 * simpleComposed/(total - 1)}% op pairs are simple"



client.lrange 'OTDB:ops:hello', 1, 12639, (err, values) ->
	throw err if err?

	data = values.map (v) -> JSON.parse(v)

	printStats(data)

	console.log "\n\nComposed:\n"
#	console.log c for c in composed
	printStats composeAdjacent(data, window) for window in [500, 1000, 2000, 5000]

	process.exit(0)

