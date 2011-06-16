# This file wraps the closure compiled webclient script for testing.
#
# Run `cake webclient` to build the web client.

fs = require 'fs'

script = fs.readFileSync(__dirname + '/../../webclient/share.js', 'utf8')

window = {}
window.io = require('../../thirdparty/Socket.io-node-client/lib/io-client').io

eval script

module.exports = window.sharejs
