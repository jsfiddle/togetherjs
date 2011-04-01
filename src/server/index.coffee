# The server module...

connect = require 'connect'

Model = require './model'
Db = require './db'

rest = require './rest'
socketio = require './socketio'

# Create an HTTP server and attach whatever frontends are specified in the options.
#
# The model will be created based on options if it is not specified.
module.exports = create = (options, model = createModel(options)) ->
	attach(connect(), model, options)

# Create an OT document model attached to a database.
create.createModel = createModel = (options) ->
	dbOptions = options?.db

	db = new Db(dbOptions)
	new Model(db)


# Attach the OT server frontends to the provided Node HTTP server. Use this if you
# already have a http.Server or https.Server and want to make some URL paths do OT.
#
# The options object specifies options for everything. If settings are missing,
# defaults will be provided.
#
# Set options.rest == null or options.socketio == null to turn off that frontend.
create.attach = attach = (server, model = createModel(options), options) ->
	server.use rest(model, options?.rest) if options?.rest != null
	socketio.attach(server, model, options?.socketio) if options?.socketio != null

	server

