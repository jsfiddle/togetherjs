# The model of all the ops. Responsible for applying & transforming remote deltas
# and managing the storage layer.
#
# Actual storage is handled by the database wrappers in db/*, wrapped by DocCache

hat = require 'hat'

queue = require './syncqueue'
types = require '../types'
Events = require './events'

module.exports = Model = (db, options) ->
  return new Model(db, options) if !(this instanceof Model)

  options ?= {}

  # Callback is called with (error, deltas)
  # Deltas is a list of the deltas from versionFrom to versionTo, or
  # to the most recent version if versionTo is null.
  #
  # At time of writing, error is always null. If the document doesn't exist or if
  # start / end are too long, the ops are trimmed.
  @getOps = (docName, start, end, callback) -> db.getOps docName, start, end, callback

  # Gets the snapshot data for the specified document.
  # getSnapshot(docName, callback)
  # Callback is called with (error, {v: <version>, type: <type>, snapshot: <snapshot>, meta: <meta>})
  @getSnapshot = getSnapshot = (docName, callback) -> db.getSnapshot docName, callback

  # Gets the latest version # of the document.
  # getVersion(docName, callback)
  # callback is called with (error, version).
  @getVersion = (docName, callback) -> db.getVersion docName, callback

  # Create a document.
  @create = (docName, type, meta, callback) ->
    [meta, callback] = [{}, meta] if typeof meta == 'function'

    type = types[type] if typeof type == 'string'
    return callback? 'Type not found' unless type

    return callback? 'Invalid document name' if docName.match /\//

    docData =
      snapshot:type.create()
      type:type
      meta:meta || {}
      v:0

    db.create docName, docData, (error) ->
      if error
        callback error
      else
        callback null, docData

  # applyOp is not re-entrant for the same docName. Hence its logic is wrapped in a queue structure.
  queues = {} # docName -> syncQueue

  # Apply an op to the specified document.
  # The callback is passed (error, applied version #)
  # opData = {op:op, v:v, meta:metadata}
  # 
  # Ops are queued before being applied so that the following code applies op C before op B:
  # model.applyOp 'doc', OPA, -> model.applyOp 'doc', OPB
  # model.applyOp 'doc', OPC
  @applyOp = (docName, opData, callback) ->
    # Its important that all ops are applied in order.
    queues[docName] ||= queue (opData, callback) ->
      getSnapshot docName, (error, docData) ->
        return callback error if error

        opVersion = opData.v
        op = opData.op
        meta = opData.meta || {}
        meta.ts = Date.now()

        {v:version, snapshot, type} = docData

        submit = ->
          try
            snapshot = docData.type.apply docData.snapshot, op
          catch error
            console.error error.stack
            callback error.message
            return

          newOpData = {op, v:opVersion, meta}
          newDocData = {snapshot, type:type.name, v:opVersion + 1, meta:docData.meta}

          db.append docName, newOpData, newDocData, ->
            # Success!
            events.onApplyOp docName, newOpData
            callback null, opVersion

        if opVersion > version
          callback 'Op at future version'
          return

        if opVersion < version
          # We'll need to transform the op to the current version of the document.
          db.getOps docName, opVersion, version, (error, ops) ->
            return callback error if error

            try
              for realOp in ops
                op = docData.type.transform op, realOp.op, 'left'
                opVersion++

            catch error
              console.error error.stack
              callback error.message
              return

            submit()
        else
          # The op is up to date already. Apply and submit.
          submit()

    # process.nextTick is used to avoid an obscure timing problem involving listenFromVersion.
    process.nextTick -> queues[docName](opData, callback)

  # Not yet implemented.
  @applyMetaOp = (docName, metaOpData, callback) ->
    {v, op} = metaOpData
    throw new Error 'Not implemented'
  
  # Perminantly deletes the specified document.
  # If listeners are attached, they are removed.
  # 
  # The callback is called with (true) if any data was deleted, else (false).
  #
  # WARNING: This isn't well supported throughout the code. (Eg, streaming clients aren't told about the
  # deletion. Subsequent op submissions will fail).
  @delete = (docName, callback) ->
    events.removeAllListeners docName
    db.delete docName, callback

  events = new Events(this)

  # Register a listener for a particular document.
  # listen(docName, listener, callback)
  @listen = events.listen

  # Remove a listener for a particular document.
  # removeListener(docName, listener)
  @removeListener = events.removeListener

  # Listen to all ops from the specified version. If version is in the past, all
  # ops since that version are sent immediately to the listener.
  # Callback is called once the listener is attached, but before any ops have been passed
  # to the listener.
  # 
  # listenFromVersion(docName, version, listener, callback)
  @listenFromVersion = events.listenFromVersion
  
  # ------------ Auth stuffs.

  # By default, accept any client's connection + data submission.
  # Don't let anyone delete documents though.
  auth = options.auth || (client, action) ->
    if action.type in ['connect', 'read', 'create', 'update'] then action.accept() else action.reject()

  # This method wraps auth() above. It creates the action and calls auth.
  # If authentication succeeds, acceptCallback() is called if it exists.
  # otherwise userCallback(true) is called.
  #
  # If authentication fails, userCallback('forbidden', null) is called.
  #
  # If supplied, actionData is turned into the action.
  doAuth = (client, actionData, name, userCallback, acceptCallback) ->
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

    auth client, action

  # At some stage, I'll probably pull this out into a class. No rush though.
  createClient = (data) ->
    id: hat()
    connectTime: new Date
    headers: data.headers
    remoteAddress: data.remoteAddress

    # This is a map from docName -> true
    openDocs: {}

    # We have access to these with socket.io, but I'm not sure we can support
    # these properties on the REST API.
    #xdomain: data.xdomain
    #secure: data.secure

  # I wish there was a cleaner way to write all of these.

  @clientConnect = (data, callback) ->
    client = createClient data
    doAuth client, null, 'connect', callback, ->
      # Maybe store a set of clients in the model?
      # clients[client.id] = client ?
      callback null, client

  @clientDisconnect = (client) ->
    db.docClosed docName, client for docName of client.openDocs

  @clientGetOps = (client, docName, start, end, callback) ->
    doAuth client, {docName, start, end}, 'get ops', callback, =>
      @getOps docName, start, end, callback

  @clientGetSnapshot = (client, docName, callback) ->
    doAuth client, {docName}, 'get snapshot', callback, =>
      @getSnapshot docName, callback
  
  @clientCreate = (client, docName, type, meta, callback) ->
    # We don't check that types[type.name] == type. That might be important at some point.
    type = types[type] if typeof type == 'string'

    doAuth client, {docName, docType:type, meta}, 'create', callback, =>
      @create docName, type, meta, callback

  # Attempt to submit an op from a client. Auth functions
  # are checked before the op is submitted.
  @clientSubmitOp = (client, docName, opData, callback) ->
    opData.meta ||= {}
    opData.meta.source = client.id

    doAuth client, {docName, op:opData.op, v:opData.v, meta:opData.meta}, 'submit op', callback, =>
      @applyOp docName, opData, callback

  # Delete the named operation.
  # Callback is passed (deleted?, error message)
  @clientDelete = (client, docName, callback) ->
    doAuth client, {docName}, 'delete', callback, =>
      @delete docName, callback
  
  # Open the named document for reading.
  @clientOpen = (client, docName, version, listener, callback) ->
    # I might want to promote some form of this method.
    clientDidOpen = =>
      db.docOpened docName, client, (error) =>
        return callback? error if error

        client.openDocs[docName] = true
        @listenFromVersion docName, version, listener, (error, v) ->
          if error
            delete client.openDocs[docName]
            db.docClosed docName, client

          callback? error, v

    # Urgh no nice way to share this callbacky code.
    if version?
      # If the specified version is older than the current version, we have to also check that the
      # client is allowed to get_ops from the specified version.
      #
      # We _could_ check the version number of the document and then only check getOps if
      # the specified version is old, but an auth check is _probably_ faster than a db roundtrip.
      doAuth client, {docName, start:version, end:null}, 'get ops', callback, ->
        doAuth client, {docName, v:version}, 'open', callback, clientDidOpen
    else
      doAuth client, {docName}, 'open', callback, clientDidOpen

  this
