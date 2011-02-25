db = require './db'

EventEmitter = require('events').EventEmitter

p = require('util').debug

# Map from docName to EventEmitter
emitters = {}

emitterForDoc = (docName, create = no) ->
	if create
		emitters[docName] ||= new EventEmitter
	else
		emitters[docName]

db.onApplyDelta (docName, delta) ->
	emitterForDoc(docName)?.emit('delta', delta)

# Registers a listener for ops on a particular document.
# callback(startingVersion) is called when the listener is first applied. All ops
# from then on are sent to the user.
# Listeners are of the form listener(op, appliedAt)
exports.listen = (docName, fromVersionCallback, listener) ->
	db.getVersion docName, (version) ->
		emitterForDoc(docName, yes).on 'delta', listener
		fromVersionCallback(version)

# Remove a listener from a particular document.
exports.removeListener = (docName, listener) ->
	emitterForDoc(docName)?.removeListener('delta', listener)

# Listen to all ops from the specified version. The version cannot be in the
# future.
exports.listenFromVersion = (docName, version, listener) ->
	db.getOps docName, version, null, (ops) ->
		# Don't start listening until we have the ops from the server.
		emitter = emitterForDoc(docName, yes)
		emitter.on 'delta', listener

		for op in ops
			listener {op:op, version:version}

			# The listener may well remove itself during the catchup phase. If this happens, break early.
			# This is done in a quite inefficient way. (O(n) where n = #listeners on doc)
			break unless listener in emitter.listeners('delta')
			version += 1


