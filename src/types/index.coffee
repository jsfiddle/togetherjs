# Just import all the built-in types.

register = (file) ->
	type = require file
	exports[type.name] = type

register './text'
register './simple'
register './text-composable'
register './count'
