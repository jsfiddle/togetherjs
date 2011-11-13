# This class exposes an authenticated interface to the model code.
#
# This is used by all the client frontends to interact with the server.

hat = require 'hat'
types = require '../types'

# This module exports a function which you can call with the model and options. Calling the function
# returns _another_ function which you can call when clients connect.
module.exports = (model, options) ->
  # By default, accept any client's connection + data submission.
  # Don't let anyone delete documents though.
  auth = options.auth or (client, action) ->
    if action.type in ['connect', 'read', 'create', 'update'] then action.accept() else action.reject()

  # At some stage, I'll probably pull this out into a class. No rush though.
  class Client
    constructor: (data) ->
      @id = hat()
      @connectTime = new Date
      @headers = data.headers
      @remoteAddress = data.remoteAddress

      # This is a map from docName -> listener function
      @listeners = {}

      # We have access to these with socket.io, but I'm not sure we can support
      # these properties on the REST API or sockjs, etc.
      #xdomain: data.xdomain
      #secure: data.secure

    # This is a helper method which wraps auth() above. It creates the action and calls
    # auth. If authentication succeeds, acceptCallback() is called if it exists. otherwise
    # userCallback(true) is called.
    #
    # If authentication fails, userCallback('forbidden', null) is called.
    #
    # If supplied, actionData is turned into the action object passed to auth.
    doAuth: (actionData, name, userCallback, acceptCallback) ->
      action = actionData || {}
      action.name = name
      action.type = switch name
        when 'connect' then 'connect'
        when 'create' then 'create'
        when 'get snapshot', 'get ops', 'open' then 'read'
        when 'submit op' then 'update'
        when 'delete' then 'delete'
        else throw new Error "Invalid action name #{name}"

      responded = false
      action.reject = ->
        throw new Error 'Multiple accept/reject calls made' if responded
        responded = true
        userCallback 'forbidden', null
      action.accept = ->
        throw new Error 'Multiple accept/reject calls made' if responded
        responded = true
        acceptCallback()

      auth this, action

    disconnect: ->
      model.removeListener docName, listener for docName, listener of @listeners

    getOps: (docName, start, end, callback) ->
      @doAuth {docName, start, end}, 'get ops', callback, ->
        model.getOps docName, start, end, callback

    getSnapshot: (docName, callback) ->
      @doAuth {docName}, 'get snapshot', callback, ->
        model.getSnapshot docName, callback
    
    create: (docName, type, meta, callback) ->
      # We don't check that types[type.name] == type. That might be important at some point.
      type = types[type] if typeof type == 'string'

      # The action object has a 'type' property already. Hence the doc type is renamed to 'docType'
      @doAuth {docName, docType:type, meta}, 'create', callback, =>
        model.create docName, type, meta, callback

    submitOp: (docName, opData, callback) ->
      opData.meta ||= {}
      opData.meta.source = @id

      @doAuth {docName, op:opData.op, v:opData.v, meta:opData.meta}, 'submit op', callback, =>
        model.applyOp docName, opData, callback

    # Delete the named operation.
    # Callback is passed (deleted?, error message)
    delete: (docName, callback) ->
      @doAuth {docName}, 'delete', callback, =>
        model.delete docName, callback
    
    # Open the named document for reading. Just like model.listen, version is optional.
    listen: (docName, version, listener, callback) ->
      authOps = if version?
        # If the specified version is older than the current version, we have to also check that the
        # client is allowed to get ops from the specified version.
        #
        # We _could_ check the version number of the document and then only check getOps if
        # the specified version is old, but an auth check is almost certainly faster than a db roundtrip.
        (c) => @doAuth {docName, start:version, end:null}, 'get ops', callback, c
      else
        (c) -> c()

      authOps =>
        @doAuth {docName, v:version if version?}, 'open', callback, =>
          return callback? 'Document is already open' if @listeners[docName]
          @listeners[docName] = listener

          model.listen docName, version, listener, (error, v) =>
            if error
              delete @listeners[docName]

            callback? error, v

    removeListener: (docName) ->
      throw new Error 'Document is not open' unless @listeners[docName]
      model.removeListener docName, @listeners[docName]
      delete @listeners[docName]

  # Finally, return a function which takes client data and returns an authenticated client object
  # through a callback.
  (data, callback) ->
    client = new Client data
    client.doAuth null, 'connect', callback, ->
      # Maybe store a set of clients? Is that useful?
      callback null, client

