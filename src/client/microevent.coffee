# This is a simple port of microevent.js to Coffeescript. I've changed the
# function names to be consistent with node.js EventEmitter.
#
# microevent.js is copyright Jerome Etienne, and licensed under the MIT license:
# https://github.com/jeromeetienne/microevent.js

class MicroEvent
	on: (event, fct) ->
		@_events ||= {}
		@_events[event] ||= []
		@_events[event].push(fct)
		this

	removeListener: (event, fct) ->
		@_events ||= {}
		idx = @_events[event]?.indexOf fct
		@_events[event].splice(idx, 1) if idx? and idx >= 0
		this

	emit: (event, args...) ->
		return this unless @_events?[event]
		fn.apply this, args for fn in @_events[event]
		this

# mixin will delegate all MicroEvent.js function in the destination object
MicroEvent.mixin = (obj) ->
	proto = obj.prototype || obj

	# Damn closure compiler :/
	proto.on = proto['on'] = MicroEvent.prototype.on
	proto.removeListener = proto['removeListener'] = MicroEvent.prototype.removeListener
	proto.emit = MicroEvent.prototype.emit
	obj

module.exports = MicroEvent if module?.exports

