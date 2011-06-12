# A synchronous processing queue. The queue calls process on the arguments,
# ensuring that process() is only executing once at a time.
#
# process(data, callback) _MUST_ eventually call its callback.

module.exports = (process) ->
	throw new Error('process is not a function') unless typeof process == 'function'
	queue = []
	busy = false
	
	flush = ->
		return if busy or queue.length == 0

		busy = true
		[data, callback] = queue.shift()
		process data, (result...) ->
			callback.apply null, result if callback
			busy = false
			flush()

	(data, callback) ->
		queue.push [data, callback]
		flush()

