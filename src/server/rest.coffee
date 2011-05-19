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
			callback(obj)
		catch error
			send400 res, 'Supplied JSON invalid'
			return

pump = (req, callback) ->
	data = ''
	req.on 'data', (chunk) -> data += chunk
	req.on 'end', () -> callback(data)

router = (app, model, options) ->
	# GET returns the document snapshot. The version and type are sent as headers.
	# I'm not sure what to do with document metadata - it is inaccessable for now.
	app.get '/doc/:name', (req, res) ->
		model.getSnapshot req.params.name, (doc) ->
			if doc
				res.setHeader 'X-OT-Type', doc.type.name
				res.setHeader 'X-OT-Version', doc.v
				if typeof doc.snapshot == 'string'
					send200 res, doc.snapshot
				else
					sendJSON res, doc.snapshot
			else
				send404 res
	
	# Put is used to create a document. The contents are a JSON object with {type:TYPENAME, meta:{...}}
	app.put '/doc/:name', (req, res) ->
		expectJSONObject req, res, (obj) ->
			type = obj?.type
			meta = obj?.meta

			unless typeof type == 'string' and (meta == undefined or typeof meta == 'object')
				send400 res, 'Type invalid'
			else
				model.create req.params.name, type, meta, (result, error) ->
					if result
						send200 res
					else
						send400 res, error

	# POST submits an op to the document.
	app.post '/doc/:name', (req, res) ->
		query = url.parse(req.url, true).query

		version = if query?.v?
			parseInt query?.v
		else
			parseInt req.headers['x-ot-version']
		
		unless version? and version >= 0
			send400 res, 'Version required - attach query parameter ?v=X on your URL or set the X-OT-Version header'
		else
			expectJSONObject req, res, (obj) ->
				opData = {v:version, op:obj, meta:{source:req.socket.remoteAddress}}
				model.applyOp req.params.name, opData, (newVersion, error) ->
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
