# This runs all the tests.
#
# Requires nodeunit.

reporter = require('nodeunit').reporters.default
# Using glob for this would be better.
modules = [
	'test/testhelpers.coffee'

	'test/types/count.coffee'
	'test/types/text.coffee'
	'test/types/text-composable.coffee'

	'test/db.coffee'
	'test/model.coffee'
	'test/events.coffee'
	'test/rest.coffee'
	'test/socketio.coffee'

	'test/microevent.coffee'
	'test/client-opstream.coffee'
	'test/client.coffee'

	'test/integration.coffee'
#	'test/server.coffee'
]

reporter.run modules

