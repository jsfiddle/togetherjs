model = require './model'

EventEmitter = require('events').EventEmitter

p = -> #require('util').debug
i = -> #require('util').inspect

module.exports = (model) ->
	# Map from docName to EventEmitter
	emitters = {}

	emitterForDoc = (docName, create = no) ->
		if create
			emitters[docName] ||= new EventEmitter
		else
			emitters[docName]

	{
		# Hook for model code. This is called every time an op is committed to the document.
		onApplyOp: (docName, opData) ->
			p "onApplyOp #{docName} #{i opData} - #{emitterForDoc(docName)?.listeners('op')}"
			emitterForDoc(docName)?.emit('op', opData)

		# Registers a listener for ops on a particular document.
		# callback(startingVersion) is called when the listener is first applied. All ops
		# from then on are sent to the user.
		# Listeners are of the form listener(op, appliedAt)
		listen: (docName, listener, callback) ->
			model.getVersion docName, (version) ->
				if version != null
					# Only attach the listener if the document exists (ie, if version != null)
					emitterForDoc(docName, yes).on 'op', listener
					callback version if callback
				else
					callback null, 'Document does not exist'

		# Remove a listener from a particular document.
		removeListener: (docName, listener) ->
			emitterForDoc(docName)?.removeListener('op', listener)
			p 'Listeners: ' + (i emitterForDoc(docName)?.listeners('op'))

		removeAllListeners: (docName) ->
			emitterForDoc(docName)?.removeAllListeners 'op'

		# Listen to all ops from the specified version. The version cannot be in the
		# future.
		# The callback is called once the listener is attached. removeListener() will be
		# ineffective before then.
		# Callback(version) if the listener is attached
		# Callback(null) if the document doesn't exist
		listenFromVersion: (docName, version, listener, callback) ->
			model.getVersion docName, (docVersion) ->
				if docVersion == null
					# The document doesn't exist.
					callback null, 'Document does not exist' if callback
					return

				version = docVersion if version > docVersion

				# The listener isn't attached until we have the historical ops from the database.
				model.getOps docName, version, null, (data) ->
					emitter = emitterForDoc(docName, yes)
					emitter.on 'op', listener
					callback version if callback
					p 'Listener added -> ' + (i emitterForDoc(docName)?.listeners('op'))

					for op_data in data
						listener op_data

						# The listener may well remove itself during the catchup phase. If this happens, break early.
						# This is done in a quite inefficient way. (O(n) where n = #listeners on doc)
						break unless listener in emitter.listeners('op')
	}

