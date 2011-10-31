# This file caches open documents and manages the interactions with the database.
#
# Document snapshots are stored in memory for all documents which are open by at
# least one client, or if they have been accessed recently. If you don't
# have a database specified, the cache will store all documents which have
# ever been opened.
#
# Because the database doesn't store metadata (like cursor positions), the
# cache stores this information too.
#
# In order to scale a ShareJS document across multiple servers, I'll need
# to stream metadata ops via redis's pubsub mechanism or something like that.
#
# Most of the API is the same as the database API. In fact, this code used
# to be the (reference) memory database implementation.
#
# This code implements:
#
# - Snapshot caching
# - In-memory document store when there's no database configured
# - Managing when to save ops & when to save snapshots.
# - getOps has version numbers added to the returned ops

types = require '../../types'

# The cache wraps a database, or null.
module.exports = DocCache = (db, options) ->
  return new DocCache(db, options) if !(this instanceof DocCache)

  options ?= {}

  # Map from docName -> {
  #   ops:[{op, meta}]
  #   data:{snapshot, type, v, meta}
  #   clients:{id -> client}
  #   reapTimer
  #   committedVersion: v
  #   snapshotWriteLock: bool to make sure writeSnapshot isn't re-entrant
  #   dbMeta: database specific data
  # }
  #
  # The ops list contains the document's last N ops. (Or all of them if we're a
  # memory store).
  docs = {}

  # This is a map from docName -> [callback]. It is used when a document hasn't been
  # cached and multiple getSnapshot() / getVersion() requests come in. All requests
  # are added to the callback list and called when db.getSnapshot() returns.
  #
  # callback(error, snapshot data)
  awaitingGetSnapshot = {}

  # The time that documents which no clients have open will stay in the cache.
  # Should be > 0.
  options.reapTime ?= 3000

  # The number of operations the cache holds before reusing the space
  options.numCachedOps ?= 10

  # This option forces documents to be reaped, even when there's no database backend.
  # This is useful when you don't care about persistance and don't want to gradually
  # fill memory.
  #
  # You might want to set reapTime to a day or something.
  options.forceReaping ?= false

  # Until I come up with a better strategy, we'll save a copy of the document snapshot
  # to the database every ~20 submitted ops.
  options.opsBeforeCommit ?= 20

  # **** Cache API methods

  # Add the data for the given docName to the cache. The named document shouldn't already
  # exist in the doc set.
  #
  # Returns the new doc.
  add = (docName, error, data, dbMeta) ->
    callbacks = awaitingGetSnapshot[docName]
    delete awaitingGetSnapshot[docName]

    if error
      callback error for callback in callbacks if callbacks
    else
      doc = docs[docName] =
        ops: new Array(options.numCachedOps)
        data:
          snapshot: data.snapshot
          v: data.v
          type: data.type
          meta: data.meta
        clients: {}
        reapTimer: null
        committedVersion: data.v
        snapshotWriteLock: false
        dbMeta: dbMeta
      
      refreshReapingTimeout docName
      callback null, doc for callback in callbacks if callbacks

    doc
  
  # The database doesn't put version numbers on each op (they can be inferred from context anyway).
  # docCache will add them back, because they're useful.
  getOpsInternal = (docName, start, end, callback) ->
    return callback 'Document does not exist' unless db

    db.getOps docName, start, end, (error, ops) ->
      return callback error if error

      v = start
      op.v = v++ for op in ops

      callback null, ops

  # Load the named document into the cache. This function is re-entrant.
  #
  # The callback is called with (error, doc)
  load = (docName, callback) ->
    if docs[docName]
      # The document is already loaded. Return immediately.
      options.stats?.cacheHit? 'getSnapshot'
      callback null, docs[docName]
    else
      # We're a memory store. If we don't have it, nobody does.
      return callback 'Document does not exist' unless db

      callbacks = awaitingGetSnapshot[docName]

      if callbacks
        # The document is being loaded already. Add ourselves as a callback.
        callbacks.push callback
      else
        options.stats?.cacheMiss? 'getSnapshot'

        # The document isn't loaded and isn't being loaded. Load it.
        awaitingGetSnapshot[docName] = [callback]
        db.getSnapshot docName, (error, data, dbMeta) ->
          return add docName, error if error

          type = types[data.type]
          unless type
            console.warn "Type '#{data.type}' missing"
            return callback "Type not found"
          data.type = type

          # The server can close without saving the most recent document snapshot.
          # In this case, there are extra ops which need to be applied before
          # returning the snapshot.
          getOpsInternal docName, data.v, null, (error, ops) ->
            return callback error if error

            if ops.length > 0
              console.log "Catchup #{docName} #{data.v} -> #{data.v + ops.length}"

              try
                for op in ops
                  data.snapshot = type.apply data.snapshot, op.op
                  data.v++
              catch e
                # This should never happen - it indicates that whats in the
                # database is invalid.
                console.error "Op data invalid for #{docName}: #{e.stack}"
                return callback 'Op data invalid'

            add docName, error, data, dbMeta

  # This makes sure the cache contains a document. If the doc cache doesn't contain
  # a document, it is loaded from the database and stored.
  #
  # Documents are stored so long as either:
  # - They have been accessed within the past #{PERIOD}
  # - At least one client has the document open
  refreshReapingTimeout = (docName) ->
    doc = docs[docName]
    return unless doc

    # I want to let the clients list be updated before this is called.
    process.nextTick ->
      # This is an awkward way to find out the number of clients on a document. If this
      # causes performance issues, add a numClients field to the document.
      #
      # The first check is because its possible that between refreshReapingTimeout being called and this
      # event being fired, someone called delete() on the document and hence the doc is something else now.
      if doc == docs[docName] and Object.keys(doc.clients).length is 0 and (db or options.forceReaping)
        clearTimeout doc.reapTimer
        doc.reapTimer = reapTimer = setTimeout ->
            tryWriteSnapshot docName, ->
              # If the reaping timeout has been refreshed while we're writing the snapshot,
              # don't reap.
              delete docs[docName] if docs[docName].reapTimer is reapTimer
          , options.reapTime

  # ** Public methods

  # This tells the cache that a client has been added to the named document. If a client
  # is listening, we won't purge the document.
  #
  # callback(error)
  @docOpened = (docName, client, callback) ->
    load docName, (error, doc) ->
      if error
        callback? error
      else
        clearTimeout doc.reapTimer
        doc.clients[client.id] = client

        callback? null

  # docClosed is synchronous. (Is that bad?)
  @docClosed = (docName, client) ->
    # The document should already be loaded.
    doc = docs[docName]
    throw new Error 'docClosed but document not loaded' unless doc

    delete doc.clients[client.id]
    refreshReapingTimeout docName

  # If any documents are passed to the callback, the first one has v = start.
  # end can be null. If end is null, getOps returns all documents from start onwards.
  #
  # Each op returned is in the form {op:o, meta:m, v:version}.
  #
  # If the document does not exist, getOps doesn't necessarily return an error. This is because
  # its awkward to figure out whether or not the document exists for things
  # like the redis database backend. I guess its a bit gross having this inconsistant
  # with the other DB calls, but its certainly convenient.
  #
  # Use getVersion() to determine if a document actually exists, if thats what you're
  # after.
  @getOps = (docName, start, end, callback) ->
    # getOps will only use the op cache if its there. It won't fill the op cache in.
    throw new Error 'start must be 0+' unless start >= 0

    ops = docs[docName]?.ops

    if ops?
      version = docs[docName].data.v

      # Ops contains an array of ops. The last op in the list is the last op applied
      end ?= version
      start = Math.min start, end

      # Base is the version number of the oldest op we have cached
      base = version - ops.length

      # If the database is null, we'll trim to the ops we do have and hope thats enough.
      if start >= base or db is null
        refreshReapingTimeout docName
        options.stats?.cacheHit 'getOps'

        return callback null, ops[(start - base)...(end - base)]

    options.stats?.cacheMiss 'getOps'

    getOpsInternal docName, start, end, callback

  # Create a new document.
  #
  # data = {snapshot, type, [meta]}
  @create = (docName, data, callback) ->
    if docs[docName]
      callback? 'Document already exists'
    else
      throw new Error 'snapshot missing from data' unless data.snapshot != undefined
      throw new Error 'type missing from data' unless data.type != undefined
      throw new Error 'version missing from data' unless typeof data.v == 'number'
      throw new Error 'meta missing from data' unless typeof data.meta == 'object'

      # The database should always store the type using its string name.
      #
      # This code is kinda yuck, and copied in part in the load() code above. But I can't
      # think of a way to clean it up :/
      if typeof data.type is 'string'
        type = types[data.type]
        return callback 'Type not found' unless type
      else
        type = data.type
        data.type = data.type.name

      if db
        db.create docName, data, (error, dbMeta) ->
          if error
            callback? error
          else
            # From here on we'll store the object version of the type name.
            data.type = type
            add docName, null, data, dbMeta
            callback?()
      else
        data.type = type
        add docName, null, data
        callback?()

  # Perminantly delete a document.
  # Callback is callback(error).
  @delete = (docName, callback) ->
    clearTimeout docs[docName]?.reapTimer

    if db
      dbMeta = docs[docName]?.dbMeta
      delete docs[docName]
      db.delete docName, dbMeta, callback
    else
      if docs[docName]
        delete docs[docName]
        callback?()
      else
        callback? 'Document does not exist'

  tryWriteSnapshot = (docName, callback) ->
    return callback?() unless db

    doc = docs[docName]

    # The doc is closed
    return callback?() unless doc

    # The document is already saved.
    return callback?() if doc.committedVersion is doc.data.v

    return callback? 'Another snapshot write is in progress' if doc.snapshotWriteLock

    doc.snapshotWriteLock = true

    options.stats?.writeSnapshot?()

    writeSnapshot = db?.writeSnapshot or (docName, docData, dbMeta, callback) -> callback()

    data =
      v: doc.data.v
      meta: doc.data.meta
      snapshot: doc.data.snapshot
      # The database doesn't know about object types.
      type: doc.data.type.name

    # Commit snapshot.
    writeSnapshot docName, data, doc.dbMeta, (error, dbMeta) ->
      doc.snapshotWriteLock = false

      # We have to use data.v here because the version in the doc could
      # have been updated between the call to writeSnapshot() and now.
      doc.committedVersion = data.v
      doc.dbMeta = dbMeta

      callback? error

  # Append an op to a document. The document must already exist.
  #
  # opData = {op:the op to append, v:version, meta:optional metadata object containing author, etc.}
  # docData = resultant document snapshot data. {snapshot:s, type:typename}
  # callback = callback when op committed
  #
  # This function is NOT REENTRANT. It shouldn't be called again on the same document
  # until the first call has returned via the callback.
  @append = (docName, newOpData, newDocData, callback) ->
    throw new Error 'snapshot missing from data' unless newDocData.snapshot != undefined
    throw new Error 'type missing from data' unless newDocData.type != undefined

    # When this is actually called by the model, we'll almost certainly have data anyway.
    load docName, (error, doc) ->
      return callback? error if error

      # The op data should be at the current version, and the new document data should be at
      # the next version.
      unless doc.data.v == newOpData.v == newDocData.v - 1
        # This should never happen.
        console.error "Version mismatch detected in cache. File a ticket - this is a bug."
        console.error "Expecting #{doc.data.v} == #{newOpData.v} == #{newDocData.v - 1}"
        return callback? 'Version mismatch in cache.append'

      writeOp = db?.writeOp or (docName, newOpData, callback) -> callback()
       
      writeOp docName, newOpData, (error) ->

        if error
          # The user should probably know about this.
          console.warn "Error writing ops to database: #{error}"
          return callback? error

        # Not copying in the type.
        doc.data.v = newDocData.v
        doc.data.snapshot = newDocData.snapshot
        doc.data.meta = newDocData.meta

        doc.ops.push newOpData
        doc.ops.shift() if db and doc.ops.length > options.numCachedOps

        callback()
        options.stats?.writeOp?()
    
        # I need a decent strategy here for deciding whether or not to save the snapshot.
        #
        # The 'right' strategy looks something like "Store the snapshot whenever the snapshot
        # is smaller than the accumulated op data". For now, I'll just store it every 20
        # ops or something. (Configurable with doc.committedVersion)
        if !doc.snapshotWriteLock and doc.committedVersion + options.opsBeforeCommit <= newDocData.v
          tryWriteSnapshot docName, (error) ->
            console.warn "Error writing snapshot #{error}. This will increase document loading time but is nonfatal" if error

  # Data = {v, snapshot, type}. Snapshot == null and v = 0 if the document doesn't exist.
  @getSnapshot = (docName, callback) ->
    load docName, (error, doc) ->
      if error
        callback error
      else
        callback null, doc.data

  # Get the version of the document. This is a convenience method. Internally, it loads the
  # whole document. (It doesn't need to do that much work, but its always used in situations
  # where we're going to need a bunch of other information about the document anyway, so there's
  # no benefit optimising it.)
  #
  # callback(error, version)
  @getVersion = (docName, callback) ->
    @getSnapshot docName, (error, data) ->
      callback error, data?.v

  # Flush saves all snapshot data to the database
  @flush = (callback) ->
    return callback?() unless db

    pendingWrites = 0

    for docName, doc of docs
      if doc.committedVersion < doc.data.v
        pendingWrites++
        # I'm hoping writeSnapshot will always happen in another thread.
        tryWriteSnapshot docName, ->
          process.nextTick ->
            pendingWrites--
            callback?() if pendingWrites is 0

    # If nothing was queued, terminate immediately.
    callback?() if pendingWrites is 0

  @close = (callback) ->
    @flush ->
      db?.close()
      callback?()

  this
