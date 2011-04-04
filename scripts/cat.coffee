# A simple script to fetch a document from the server.

Connection = require('../src/client').Connection

getSocket = (hostname, port, docName) ->
	c = new Connection(hostname, port)
	c.get docName, (doc) ->
		console.log (if typeof doc.snapshot == 'string'
			doc.snapshot
		else
			JSON.stringify doc.snapshot)
		
		c.disconnect()


http = require 'http'

getREST = (hostname, port, docName) ->
	http.get {host: hostname, port: port, path: "/doc/#{docName}"}, (res) ->
		message = []
		res.on 'data', (data) -> message.push data
		res.on 'end', ->
			message = message.join ''
			doc = JSON.parse message
			if typeof doc.snapshot == 'string'
				console.log doc.snapshot
			else
				console.log JSON.stringify(doc.snapshot)


if process.argv.length < 3
	console.error "Usage: coffee cat.coffee DOCNAME"
else
	getREST 'localhost', 8000, process.argv[2]
