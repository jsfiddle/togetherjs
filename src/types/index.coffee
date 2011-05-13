
register = (file) ->
	type = require file
	exports[type.name] = type

# Import all the built-in types.
register './text'
register './json'
register './simple'
register './text-composable'
register './count'
