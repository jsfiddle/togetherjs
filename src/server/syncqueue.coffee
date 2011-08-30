# A synchronous processing queue. The queue calls process on the arguments,
# ensuring that process() is only executing once at a time.
#
# process(data, callback) _MUST_ eventually call its callback.
#
# Example:
#
# queue = require 'syncqueue'
#
# fn = queue (data, callback) ->
#     asyncthing data, ->
#         callback(321)
#
# fn(1)
# fn(2)
# fn(3, (result) -> console.log(result))
#
#   ^--- async thing will only be running once at any time.

module.exports = (process) ->
	throw new Error('process is not a function') unless typeof process == 'function'
	queue = []
	busy = false
	
	flush = ->
		return if busy or queue.length == 0

		busy = true
		[data, callback] = queue.shift()
		process data, (result...) -> # TODO: Make this not use varargs - varargs are really slow.
			callback.apply null, result if callback
			busy = false
			flush()

	(data, callback) ->
		queue.push [data, callback]
		flush()

