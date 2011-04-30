# A REST-ful frontend to the OT server.
#
# See the docs for details and examples about how the protocol works.

http = require 'http'
sys = require 'sys'
util = require 'util'
url = require 'url'

connect = require 'connect'

send404 = (res, message = '404: Your document could not be found.\n') ->
	res.writeHead 404, {'Content-Type': 'text/plain'}
	res.end message

send400 = (res, message) ->
	res.writeHead 400, {'Content-Type': 'text/plain'}
	res.end message

send200 = (res, message = 'OK') ->
	res.writeHead 200, {'Content-Type': 'text/plain'}
	res.end message

sendJSON = (res, obj) ->
	res.writeHead 200, {'Content-Type': 'application/json'}
	res.end JSON.stringify(obj) + '\n'

# Callback is only called if the object was indeed JSON
expectJSONObject = (req, res, callback) ->
	pump req, (data) ->
		try
			obj = JSON.parse data
		catch error
			send400 res, 'Supplied JSON invalid'
			return

		callback(obj)


pump = (req, callback) ->
	data = ''
	req.on 'data', (chunk) -> data += chunk
	req.on 'end', () -> callback(data)

router = (app, model, options) ->
	app.get '/doc/:name', (req, res) ->
		model.getSnapshot req.params.name, (doc) ->
			if doc.snapshot?
				doc.type = doc.type.name
				sendJSON res, doc
			else
				send404 res

	app.post '/doc/:name', (req, res) ->
		query = url.parse(req.url, true).query
		version = parseInt query?.v
		unless version?
			send400 res, 'Version required - attach query parameter ?v=X on your URL'
		else
			expectJSONObject req, res, (obj) ->
				opData = {v:version, op:obj, meta:{source:req.socket.remoteAddress}}
				model.applyOp req.params.name, opData, (error, newVersion) ->
					if error?
						send400 res, error.stack
					else
						sendJSON res, {v:newVersion}

	if options.delete
		app.delete '/doc/:name', (req, res) ->
			model.delete req.params.name, (result) ->
				if result
					send200 res
				else
					# The document to be deleted doesn't exist
					send404 res, "The document to be deleted doesn't exist"

# Attach the frontend to the supplied http.Server.
#
# Options =
# 	delete: [true/false]  - Whether or not to support DELETE-ing documents. Defaults to false.
module.exports = (model, options) ->
	options ?= {}
	options.delete ?= false

	connect.router (app) -> router(app, model, options)
