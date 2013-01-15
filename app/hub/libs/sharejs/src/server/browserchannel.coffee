browserChannel = require('browserchannel').server

sessionHandler = require('./session').handler

wrapSession = (session) ->
  session.ready = -> @state isnt 'closed'
  session

exports.attach = (server, createAgent, options) ->
  options.server = server
  server.use browserChannel options, (session) ->
    sessionHandler wrapSession(session), createAgent