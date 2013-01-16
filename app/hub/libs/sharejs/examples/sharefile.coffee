# This script watches for changes in a document and constantly resaves a file
# with the document's contents.

#client = require('share').client
client = require('../src').client
fs = require('fs')

argv = require('optimist')
	.usage('Usage: $0 -d docname [--url URL] [-f filename]')
	.default('d', 'hello')
	.default('url', 'http://localhost:8000/channel')
	.argv

filename = argv.f || argv.d

console.log "Opening '#{argv.d}' at #{argv.url}. Saving to '#{filename}'"

timeout = null
doc = null

# Writes the snapshot data to the file not more than once per second.
write = ->
	if (timeout == null)
		timeout = setTimeout ->
        console.log "Saved version " + doc.version
        fs.writeFile filename, doc.snapshot
        timeout = null
      , 1000

client.open argv.d, 'text', argv.url, (d, error) ->
	doc = d
	console.log('Document ' + argv.d + ' open at version ' + doc.version)

	write()
	doc.on 'change', (op) ->
		write()
