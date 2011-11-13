# The server module...

connect = require 'connect'

Model = require './model'
createDb = require './db'

rest = require './rest'
socketio = require './socketio'
browserChannel = require './browserchannel'

# Create an HTTP server and attach whatever frontends are specified in the options.
#
# The model will be created based on options if it is not specified.
module.exports = create = (options, model = createModel(options)) ->
  attach(connect(), options, model)

# Create an OT document model attached to a database.
create.createModel = createModel = (options) ->
  dbOptions = options?.db

  db = createDb dbOptions
  new Model db, options

# Attach the OT server frontends to the provided Node HTTP server. Use this if you
# already have a http.Server or https.Server and want to make some URL paths do OT.
#
# The options object specifies options for everything. If settings are missing,
# defaults will be provided.
#
# Set options.rest == null or options.socketio == null to turn off that frontend.
create.attach = attach = (server, options, model = createModel(options)) ->
  options ?= {}
  options.staticpath ?= '/share'

  server.model = model

  server.use options.staticpath, connect.static("#{__dirname}/../../webclient") if options.staticpath != null

  createClient = require('./auth') model, options

  # The client frontend doesn't get access to the model at all, to make sure security stuff is
  # done properly.
  server.use rest(createClient, options.rest) if options.rest != null
  socketio.attach(server, createClient, options.socketio or {}) if options.socketio != null

  if options.browserChannel != null
    options.browserChannel ?= {}
    options.browserChannel.server = server
    server.use browserChannel(createClient, options.browserChannel)

  server

