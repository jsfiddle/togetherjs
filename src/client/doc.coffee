# A Doc is a client's view on a sharejs document.
#
# Documents are created by calling Connection.open(). They are only instantiated
# once the client has the document snapshot.
#
# Documents are event emitters - use doc.on(eventname, fn) to subscribe.
#
# Documents get mixed in with their type's API methods. So, you can .insert('foo', 0) into
# a text document and stuff like that.
#
# Events:
#  - remoteop (op)
#  - changed (op)
#
# connection is a Connection object.
# name is the documents' docName.
# version is the version number of the document _on the server_
# type is the OT type of the document, which defines .compose(), .tranform(), etc.
# snapshot is the current state of the document.

Doc = (connection, @name, @version, @type, @snapshot) ->
  throw new Error('Handling types without compose() defined is not currently implemented') unless @type.compose?

  # Gotta figure out a cleaner way to make this work with closure.

  # The op that is currently roundtripping to the server, or null.
  inflightOp = null
  inflightCallbacks = []

  # All ops that are waiting for the server to acknowledge @inflightOp
  pendingOp = null
  pendingCallbacks = []

  # Some recent ops, incase submitOp is called with an old op version number.
  serverOps = {}

  # Transform a server op by a client op, and vice versa.
  xf = @type.transformX or (client, server) =>
    client_ = @type.transform client, server, 'left'
    server_ = @type.transform server, client, 'right'
    return [client_, server_]
  
  otApply = (docOp, isRemote) =>
    oldSnapshot = @snapshot
    @snapshot = @type.apply(@snapshot, docOp)

    # Its important that these event handlers are called with oldSnapshot.
    # The reason is that the OT type APIs might need to access the snapshots to
    # determine information about the received op.
    @emit 'change', docOp, oldSnapshot
    @emit 'remoteop', docOp, oldSnapshot if isRemote
  
  # Send ops to the server, if appropriate.
  #
  # Only one op can be in-flight at a time, so if an op is already on its way then
  # this method does nothing.
  @flush = =>
    if inflightOp == null && pendingOp != null
      # Rotate null -> pending -> inflight, 
      inflightOp = pendingOp
      inflightCallbacks = pendingCallbacks

      pendingOp = null
      pendingCallbacks = []

      connection.send {'doc':@name, 'op':inflightOp, 'v':@version}, (error, response) =>
        oldInflightOp = inflightOp
        inflightOp = null

        if error
          # This will happen if the server rejects edits from the client.
          # We'll send the error message to the user and roll back the change.
          #
          # If the server isn't going to allow edits anyway, we should probably
          # figure out some way to flag that (readonly:true in the open request?)

          if type.invert

            undo = @type.invert oldInflightOp

            # Now we have to transform the undo operation by any server ops & pending ops
            if pendingOp
              [pendingOp, undo] = xf pendingOp, undo

            # ... and apply it locally, reverting the changes.
            # 
            # This call will also call @emit 'remoteop'. I'm still not 100% sure about this
            # functionality, because its really a local op. Basically, the problem is that
            # if the client's op is rejected by the server, the editor window should update
            # to reflect the undo.
            otApply undo, true
          else
            throw new Error "Op apply failed (#{response.error}) and the OT type does not define an invert function."

          callback error for callback in inflightCallbacks
        else
          throw new Error('Invalid version from server') unless response.v == @version

          serverOps[@version] = oldInflightOp
          @version++
          callback null, oldInflightOp for callback in inflightCallbacks

        @flush()

  # Internal API
  # The connection uses this method to notify a document that an op is received from the server.
  @_onOpReceived = (msg) ->
    # msg is {doc:, op:, v:}

    # There is a bug in socket.io (produced on firefox 3.6) which causes messages
    # to be duplicated sometimes.
    # We'll just silently drop subsequent messages.
    return if msg.v < @version

    throw new Error("Expected docName '#{@name}' but got #{msg.doc}") unless msg.doc == @name
    throw new Error("Expected version #{@version} but got #{msg.v}") unless msg.v == @version

#    p "if: #{i @inflightOp} pending: #{i @pendingOp} doc '#{@snapshot}' op: #{i msg.op}"

    op = msg.op
    serverOps[@version] = op

    docOp = op
    if inflightOp != null
      [inflightOp, docOp] = xf inflightOp, docOp
    if pendingOp != null
      [pendingOp, docOp] = xf pendingOp, docOp
      
    @version++
    # Finally, apply the op to @snapshot and trigger any event listeners
    otApply docOp, true

  # Submit an op to the server. The op maybe held for a little while before being sent, as only one
  # op can be inflight at any time.
  @submitOp = (op, callback) ->
    op = @type.normalize(op) if @type.normalize?

    # If this throws an exception, no changes should have been made to the doc
    @snapshot = @type.apply @snapshot, op

    if pendingOp != null
      pendingOp = @type.compose(pendingOp, op)
    else
      pendingOp = op

    pendingCallbacks.push callback if callback

    @emit 'change', op

    # A timeout is used so if the user sends multiple ops at the same time, they'll be composed
    # together and sent together.
    setTimeout @flush, 0
  
  # Close a document.
  # No unit tests for this so far.
  @close = (callback) ->
    return callback?() if connection.socket == null

    connection.send {'doc':@name, open:false}, =>
      callback?()
      @emit 'closed'
      return
    @emit 'closing'
  
  if @type.api
    this[k] = v for k, v of @type.api
    @_register?()
  else
    @provides = {}

  this

# Make documents event emitters
unless WEB?
  MicroEvent = require './microevent'

MicroEvent.mixin Doc

exports.Doc = Doc
