# This file wraps the closure compiled webclient script for testing.
#
# Run `cake webclient` to build the web client.

fs = require 'fs'

window = {}
window.io = require('../../thirdparty/Socket.io-node-client/lib/io-client').io

for filename in ['share', 'json']
	script = fs.readFileSync("#{__dirname}/../../webclient/#{filename}.js", 'utf8')
	eval script

module.exports = window.sharejs
