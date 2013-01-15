# This file wraps the closure compiled webclient script for testing.
#
# Run `cake webclient` to build the web client.

# From time to time, its worth making sure the uncompressed code also works.
# I can't be bothered making it run all the tests on uncompressed code every time though -
# its too slow.
TEST_UNCOMPRESSED = false

fs = require 'fs'

window = {}
window.io = require 'socket.io-client'
window.BCSocket = require('browserchannel').BCSocket

for script in ['share', 'json']
  script = "#{script}.uncompressed" if TEST_UNCOMPRESSED
  code = fs.readFileSync("#{__dirname}/../../webclient/#{script}.js", 'utf8')

  # We also need to make sure the uncompressed version of the script knows its in a browser.
  # This is handled by window.WEB=true in web-prelude, but that obviously doesn't work here.
  code = "var WEB=true; #{code}" if TEST_UNCOMPRESSED

  console.log "Evaling #{script}"
  eval code

module.exports = window.sharejs
