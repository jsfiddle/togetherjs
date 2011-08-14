node = require '../src'
web = require './helpers/webclient'

fs = require 'fs'

package = JSON.parse fs.readFileSync("#{__dirname}/../package.json")

module.exports =
	'node version': (test) ->
		test.ok node.version
		test.strictEqual node.version, package.version
		test.done()

	'web version': (test) ->
		test.strictEqual web.version, package.version
		test.done()
