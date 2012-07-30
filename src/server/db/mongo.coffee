# OT storage for MongoDB
# Author: J.D. Zamfirescu (@jdzamfi)
#
# The mongodb database contains two collections:
#
# - 'docs': document snapshots with 'docName' set to document name.
# - 'ops': document ops with 'docName' defined and version stored in 'v'.
#
# This implementation isn't written to support multiple frontends
# talking to a single mongo backend.

mongodb = require 'mongodb'

defaultOptions = {
  # Prefix for all database keys.
  db: 'sharejs'

  # Default options
  hostname: '127.0.0.1'
  port: 27017
  mongoOptions: {auto_reconnect: true}
}

# Valid options as above.
module.exports = MongoDb = (options) ->

  options ?= {}
  options[k] ?= v for k, v of defaultOptions

  client = new mongodb.Db(options.db, new mongodb.Server(options.hostname, options.port, options.mongoOptions))

  checked = false
  checkIndex = (callback) ->
    return callback?() if checked

    client.ensureIndex 'docs', 'docName', {unique: true}, (err1, name) ->
      console.warn "failed to ensure mongo index on docs collection: #{err1}" if err1

      client.ensureIndex 'ops', {docName: 1, v: 1}, {unique: true}, (err2, name) ->
        console.warn "failed to ensure mongo index on ops collection: #{err2}" if err2

        checked = true if not err1 and not err2
        callback?(err1 or err2 or null)
      

  # Creates a new document.
  # data = {snapshot, type:typename, [meta]}
  @create = (docName, data, callback) ->
    checkIndex ->    
      client.collection 'docs', (err, collection) ->
        return callback? err if err
      
        doc =
          docName: docName
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
    checkIndex ->
      if start == end
        callback null, []
        return

      client.collection 'ops', (err, collection) ->
        return callback? err if err
      
        query = 
          docName: docName
          v:
            $gte: start
        query.v.$lt = end if end
      
        collection.find(query).sort('v').toArray (err, docs) ->
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
    checkIndex ->
      client.collection 'ops', (err, collection) ->
        return callback? err if err
      
        doc = 
          docName: docName
          opData:
            op: opData.op
            meta: opData.meta
          v: opData.v
      
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
    checkIndex ->
      client.collection 'docs', (err, collection) ->
        return callback? err if err
      
        doc =
          docName: docName
          data: data
      
        collection.update {docName: docName}, doc, safe: true, (err, doc) ->
          console.warn "failed to save snapshot for doc #{docName}: #{err}" if err
          return callback? err if err
        
          callback?()
      
  # Data = {v, snapshot, type}. Error if the document doesn't exist.
  @getSnapshot = (docName, callback) ->
    checkIndex ->
      client.collection 'docs', (err, collection) ->
        return callback? err if err
      
        collection.findOne { docName: docName }, (err, doc) ->
          return callback? err if err
          if doc != null
            callback null, doc.data
          else
            callback "Document does not exist"
        
  # Permanently deletes a document. There is no undo.
  @delete = (docName, dbMeta, callback) ->
    checkIndex ->
      client.collection 'ops', (err, collection) ->
        collection.remove { docName: docName }

      client.collection 'docs', (err, collection) ->
        return callback? err if err
      
        collection.remove { docName: docName }, safe: true, (err, count) ->
          return callback? err if err
          if count == 0
            callback? "Document does not exist" 
          else
            callback? null

  # Close the connection to the database
  @close = ->
    client.close()

  this
