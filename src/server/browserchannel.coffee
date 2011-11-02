# This implements the network API for ShareJS thats not broken.
#
# This uses an updated version of the socket.io protocol.
#
# When a client connects the server first authenticates the client and sends it:
#
# S: {auth:<client id>}
#  or
# S: {auth:null, error:'forbidden'}
#
# After that, the client can open documents:
#
# C: {doc:'foo', open:true, snapshot:null, create:true, type:'text'}
# S: {doc:'foo', open:true, snapshot:{snapshot:'hi there', v:5, meta:{}}, create:false}
#
# ...
#
# The client can send open requests as soon as the socket has opened - it doesn't need to
# wait for auth.
#
# The wire protocol is documented here:
# https://github.com/josephg/ShareJS/wiki/Wire-Protocol

browserChannel = require('browserchannel').server
util = require 'util'
hat = require 'hat'

syncQueue = require './syncqueue'

# Attach the streaming protocol to the supplied http.Server.
#
# Options = {}
module.exports = (model, options) ->
  options or= {}

  browserChannel options, (session) ->
    console.log "New BC session from #{session.address} with id #{session.id}"
    data =
      headers: session.headers
      remoteAddress: session.address

    # This is the corresponding sharejs object. It is set when the
    # session is authenticated.
    client = null

    # To save on network traffic, the client & server can leave out the docName with each message to mean
    # 'same as the last message'
    lastSentDocName = null
    lastReceivedDocName = null

    # Map from docName -> {queue, listener if open}
    docState = {}

    # We'll only handle one message from each client at a time.
    handleMessage = (query) ->
      console.log "Message from #{session.id}", query

      # The client can specify null as the docName to get a random doc name.
      if query.doc is null
        query.doc = lastReceivedDoc = hat()
      else if query.doc != undefined
        lastReceivedDoc = query.doc
      else
        unless lastReceivedDoc
          console.warn "msg.doc missing in query #{JSON.stringify query} from #{client.id}"
          # The disconnect handler will be called when we do this, which will clean up the open docs.
          return session.abort()

        query.doc = lastReceivedDoc

      docState[query.doc] or= queue: syncQueue (query, callback) ->
        # When the session is closed, we'll nuke docState. When that happens, no more messages
        # should be handled.
        return callback() unless docState

        # Close messages are {open:false}
        if query.open == false
          handleClose query, callback
   
        # Open messages are {open:true}. There's a lot of shared logic with getting snapshots
        # and creating documents. These operations can be done together; and I'll handle them
        # together.
        else if query.open or query.snapshot is null or query.create
          # You can open, request a snapshot and create all in the same
          # request. They're all handled together.
          handleOpenCreateSnapshot query, callback

        # The socket is submitting an op.
        else if query.op?
          handleOp query, callback

        else
          console.warn "Invalid query #{JSON.stringify query} from #{client.id}"
          session.abort()
          callback()

      # ... And add the message to the queue.
      docState[query.doc].queue query


    # # Some utility methods for message handlers

    # Send a message to the socket.
    # msg _must_ have the doc:DOCNAME property set. We'll remove it if its the same as lastReceivedDoc.
    send = (response) ->
      if response.doc is lastSentDoc
        delete response.doc
      else
        lastSentDoc = response.doc

      # Its invalid to send a message to a closed session. We'll silently drop messages if the
      # session has closed.
      if session.state isnt 'closed'
        console.log "Sending", response
        session.send response

    # Open the given document name, at the requested version.
    # callback(error, version)
    open = (docName, version, callback) ->
      return callback 'Session closed' unless docState
      return callback 'Document already open' if docState[docName].listener
      #p "Registering listener on #{docName} by #{socket.id} at #{version}"

      docState[docName].listener = listener = (opData) ->
        throw new Error 'Consistency violation - doc listener invalid' unless docState[docName].listener == listener

        #p "listener doc:#{docName} opdata:#{i opData} v:#{version}"

        # Skip the op if this socket sent it.
        return if opData.meta.source is client.id

        opMsg =
          doc: docName
          op: opData.op
          v: opData.v
          meta: opData.meta

        send opMsg
      
      # Tell the socket the doc is open at the requested version
      model.clientOpen client, docName, version, listener, callback

    # Close the named document.
    # callback([error])
    close = (docName, callback) ->
      #p "Closing #{docName}"
      return callback 'Session closed' unless docState
      listener = docState[docName].listener
      return callback 'Doc already closed' unless listener?

      # The model should really have a clientClose() method.
      model.removeListener docName, listener
      delete docState[docName].listener
      callback()

    # Handles messages with any combination of the open:true, create:true and snapshot:null parameters
    handleOpenCreateSnapshot = (query, finished) ->
      docName = query.doc
      msg = doc:docName

      callback = (error) ->
        if error
          close(docName) if msg.open == true
          msg.open = false if query.open == true
          msg.snapshot = null if query.snapshot != undefined
          delete msg.create

          msg.error = error

        send msg
        finished()

      return callback 'No docName specified' unless query.doc?

      if query.create == true
        if typeof query.type != 'string'
          return callback 'create:true requires type specified'

      if query.meta != undefined
        unless typeof query.meta == 'object' and Array.isArray(query.meta) == false
          return callback 'meta must be an object'

      docData = undefined
      # Technically, we don't need a snapshot if the user called create but not open or createSnapshot,
      # but no clients do that yet anyway.
      #
      # It might be nice to add a 'createOrGet()' method to model / db manager. But most
      # of the time clients are opening an existing document rather than creating a new one anyway.
      ###
      model.clientGetSnapshot client, query.doc, (error, data) ->
        maybeCreate = (callback) ->
          if query.create and error is 'Document does not exist'
            model.clientCreate client, docName, query.type, query.meta or {}, callback
          else
            callback error, data

        maybeCreate (error, data) ->
          if query.create
            msg.create = !!error
          if error is 'Document already exists'
            msg.create = false
          else if error and (!msg.create or error isnt 'Document already exists')
            # This is the real final callback, to say an error has occurred.
            return callback error
          else if query.create or query.snapshot is null


          if query.snapshot isnt null
      ###

      # This is implemented with a series of cascading methods for each different type of
      # thing this method can handle. This would be so much nicer with an async library. Welcome to
      # callback hell.

      step1Create = ->
        return step2Snapshot() if query.create != true

        # The document obviously already exists if we have a snapshot.
        if docData
          msg.create = false
          step2Snapshot()
        else
          model.clientCreate client, docName, query.type, query.meta || {}, (error) ->
            if error is 'Document already exists'
              # We've called getSnapshot (-> null), then createClient (-> already exists). Its possible
              # another client has called createClient first.
              model.clientGetSnapshot client, docName, (error, data) ->
                return callback error if error

                docData = data
                msg.create = false
                step2Snapshot()
            else if error
              callback error
            else
              msg.create = !error
              step2Snapshot()

      # The socket requested a document snapshot
      step2Snapshot = ->
        # Skip inserting a snapshot if the document was just created.
        if query.snapshot != null or msg.create == true
          step3Open()
          return

        if docData
          msg.v = docData.v
          msg.type = docData.type.name unless query.type == docData.type.name
          msg.snapshot = docData.snapshot
        else
          return callback 'Document does not exist'

        step3Open()

      # Attempt to open a document with a given name. Version is optional.
      # callback(opened at version) or callback(null, errormessage)
      step3Open = ->
        return callback() if query.open != true

        # Verify the type matches
        return callback 'Type mismatch' if query.type and docData and query.type != docData.type.name

        open docName, query.v, (error, version) ->
          return callback error if error

          # + Should fail if the type is wrong.

          #p "Opened #{docName} at #{version} by #{socket.id}"
          msg.open = true
          msg.v = version
          callback()

      if query.snapshot == null or (query.open == true and query.type)
        model.clientGetSnapshot client, query.doc, (error, data) ->
          return callback error if error and error != 'Document does not exist'

          docData = data
          step1Create()
      else
        step1Create()

    # The socket closes a document
    handleClose = (query, callback) ->
      close query.doc, (error) ->
        if error
          # An error closing still results in the doc being closed.
          send {doc:query.doc, open:false, error:error}
        else
          send {doc:query.doc, open:false}

        callback()

    # We received an op from the socket
    handleOp = (query, callback) ->
      # ...
      #throw new Error 'No version specified' unless query.v?

      op_data = {v:query.v, op:query.op}
      #op_data.meta = query.meta || {}
      #op_data.meta.source = client.id

      model.clientSubmitOp client, query.doc, op_data, (error, appliedVersion) ->
        msg = if error
          #p "Sending error to socket: #{error}"
          {doc:query.doc, v:null, error:error}
        else
          {doc:query.doc, v:appliedVersion}

        send msg
        callback()

    # We don't process any messages from the client until they've authorized. Instead,
    # they are stored in this buffer.
    buffer = []
    session.on 'message', bufferMsg = (msg) -> buffer.push msg

    model.clientConnect data, (error, client_) ->
      if error
        # The client is not authorized, so they shouldn't try and reconnect.
        client.stop()
      else
        client = client_

        # Ok. Now we can handle all the messages in the buffer. They'll go straight to
        # handleMessage from now on.
        session.removeListener 'message', bufferMsg
        handleMessage msg for msg in buffer
        buffer = null
        session.on 'message', handleMessage


    session.on 'close', ->
      console.log "Client #{client.id} disconnected"
      for docName, {listener} of docState
        model.removeListener docName, listener if listener
      docState = null

