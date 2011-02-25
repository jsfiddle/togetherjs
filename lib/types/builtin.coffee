types = exports ? {}

registerType = (type) ->
	types[type.name] = type

# If we're using node.js, import all the types immediately.
if exports?
	exports.registerType = registerType

	# Types
	registerType require('./simple')
	registerType require('./text')
else
	window.ot ||= {}
	window.ot.types = types
	window.ot.registerType = registerType

