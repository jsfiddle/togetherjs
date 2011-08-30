# This runs all the tests.
#
# run with:
# % nodeunit tests.coffee

modules = [
	'testhelpers'

	'version'

	'types/count'
	'types/text'
	'types/text-composable'
	'types/text-tp2'
	'types/text-api'
	'types/json'

	'db'
	'model'
	'auth'
	'events'
	'rest'
	'socketio'

	'microevent'
	'client'

	'integration'
]

exports[module] = require "./test/#{module}" for module in modules

