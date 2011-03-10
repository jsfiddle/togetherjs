http = require 'http'
sys = require 'sys'
util = require 'util'
url = require 'url'

model = require './model'

send404 = (res, message = '404: Your document could not be found.\n') ->
	res.writeHead 404, {'Content-Type': 'text/plain'}
	res.end message

send400 = (res, message) ->
	res.writeHead 400, {'Content-Type': 'text/plain'}
	res.end message

send200 = (res, message = 'OK') ->
	res.writeHead 200, {'Content-Type': 'text/plain'}
	res.end message

getDocName = (req) ->
	path = url.parse(req.url).pathname
	# The path will still have a leading '/'. Remove it.
	path.slice 1

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


methods =
	GET: (req, res) ->
		docName = getDocName req
		model.getSnapshot docName, (doc) ->
			if doc.snapshot?
				doc.type = doc.type.name
				sendJSON res, doc
			else
				send404 res

	POST: (req, res) ->
		docName = getDocName req
		query = url.parse(req.url, true).query
		version = parseInt(query?.v)
		unless version?
			send400 res, 'Version required - attach query parameter ?v=X on your URL'
		else
			expectJSONObject req, res, (obj) ->
				opData = {v:version, op:obj, meta:{source:req.socket.remoteAddress}}
				model.applyOp docName, opData, (error, newVersion) ->
					if error?
						send400 res, error.stack
					else
						sendJSON res, {v:newVersion}

	DELETE: (req, res) ->
		docName = getDocName req
		model.delete docName, (result) ->
			if result
				send200 res
			else
				# The document to be deleted doesn't exist
				send404 res, "The document to be deleted doesn't exist"


router = (req, res) ->
	method = methods[req.method]
	method ?= (req, res) ->
		allowedMethods = (k for own k,_ of methods).join ','
		res.writeHead 405, {'Content-Type': 'text/plain', 'Allow': allowedMethods}
		res.end 'HTTP method not allowed'

	try
		method(req, res)
	catch error
		res.writeHead 500, {'Content-Type': 'text/plain'}
		res.end "Internal server error:\n#{error.stack}"
		util.debug "Internal server error - #{error.stack}"


exports.server = http.createServer(router)
