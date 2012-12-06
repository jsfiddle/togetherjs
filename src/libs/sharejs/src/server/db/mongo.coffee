# OT storage for MongoDB
# Author: J.D. Zamfirescu (@jdzamfi)
#
# The mongodb database contains two collections:
#
# - 'docs': document snapshots, id set to document name.
# - 'ops': document ops with docName stored in 'd' and version stored in 'v'.
#
# This implementation isn't written to support multiple frontends
# talking to a single mongo backend.

mongodb = require 'mongodb'

defaultOptions =
  # Prefix for all database keys.
  db: 'sharejs'

  # Default options
  hostname: '127.0.0.1'
  port: 27017
  mongoOptions: {auto_reconnect: true}
  client: null    # an instance of mongodb.Db
  user: null      # an optional username for authentication
  password: null  # an optional password for authentication

# Valid options as above.
module.exports = MongoDb = (options) ->

  options ?= {}
  options[k] ?= v for k, v of defaultOptions

  client = options.client or new mongodb.Db(options.db, new mongodb.Server(options.hostname, options.port, options.mongoOptions))
  
  if options.user and options.password
    client.open (err, db) -> 
      if not err
        client = db
        client.authenticate(options.user, options.password)

  opsCollectionForDoc = (docName) -> 'ops.' + encodeURIComponent(docName).replace(/\./g, '%2E').replace(/-/g, '%2D')

  # Creates a new document.
  # data = {snapshot, type:typename, [meta]}
  @create = (docName, data, callback) ->
    # docName too long? http://www.mongodb.org/display/DOCS/Collections#Collections-Overview
    return callback? "Document name too long: #{docName}" if opsCollectionForDoc(docName).length > 90

    client.collection 'docs', (err, collection) ->
      return callback? err if err
      
      doc =
        _id: docName
        data: data
      
      collection.insert doc, safe: true, (err, doc) ->
        if err?.code == 11000
          return callback? "Document already exists"
          
        console.warn "failed to create new doc: #{err}" if err
        return callback? err if err
        
        callback?()
                
  # Get all ops with version = start to version = end, noninclusive.
  # end is trimmed to the size of the document.
  # If any documents are passed to the callback, the first one has v = start
  # end can be null. If so, returns all documents from start onwards.
  # Each document returned is in the form {op:o, meta:m, v:version}.
  @getOps = (docName, start, end, callback) ->
    if start == end
      callback null, []
      return

    client.collection opsCollectionForDoc(docName), (err, collection) ->
      return callback? err if err
      
      query = 
        _id:
          $gte: start
      query._id.$lt = end if end
      
      collection.find(query).sort('_id').toArray (err, docs) ->
        console.warn "failed to get ops for #{docName}: #{err}" if err
        return callback? err if err

        callback? null, (doc.opData for doc in docs)
        
  # Write an op to a document.
  #
  # opData = {op:the op to append, v:version, meta:optional metadata object containing author, etc.}
  # callback = callback when op committed
  # 
  # opData.v MUST be the subsequent version for the document.
  #
  # This function has UNDEFINED BEHAVIOUR if you call append before calling create().
  # (its either that, or I have _another_ check when you append an op that the document already exists
  # ... and that would slow it down a bit.)
  @writeOp = (docName, opData, callback) ->
    # ****** NOT SAFE FOR MULTIPLE PROCESSES. Rewrite me using transactions or something.
    client.collection opsCollectionForDoc(docName), (err, collection) ->
      return callback? err if err
      
      doc = 
        _id: opData.v
        opData:
          op: opData.op
          meta: opData.meta
      
      collection.insert doc, safe: true, (err, doc) ->
        console.warn "failed to save op #{opData} for #{docName}: #{err}" if err
        return callback? err if err

        callback? null, doc
      
  # Write new snapshot data to the database.
  #
  # docData = resultant document snapshot data. {snapshot:s, type:t, meta}
  #
  # The callback just takes an optional error.
  #
  # This function has UNDEFINED BEHAVIOUR if you call append before calling create().
  @writeSnapshot = (docName, data, dbMeta, callback) ->
    client.collection 'docs', (err, collection) ->
      return callback? err if err
      
      doc =
        _id: docName
        data: data
      
      collection.update {_id: docName}, doc, safe: true, (err, doc) ->
        console.warn "failed to save snapshot for doc #{docName}: #{err}" if err
        return callback? err if err
        
        callback?()
      
  # Data = {v, snapshot, type}. Error if the document doesn't exist.
  @getSnapshot = (docName, callback) ->
    client.collection 'docs', (err, collection) ->
      return callback? err if err
      
      collection.findOne { _id: docName }, (err, doc) ->
        return callback? err if err
        if doc != null
          callback null, doc.data
        else
          callback "Document does not exist"
        
  # Permanently deletes a document. There is no undo.
  @delete = (docName, dbMeta, callback) ->
    client.collection opsCollectionForDoc(docName), (err, collection) ->
      collection.drop()

    client.collection 'docs', (err, collection) ->
      return callback? err if err
      
      collection.remove { _id: docName }, safe: true, (err, count) ->
        return callback? err if err
        if count == 0
          callback? "Document does not exist" 
        else
          callback? null

  # Close the connection to the database
  @close = ->
    client.close()

  this
