# This is an implementation of the OT data backend for Amazon Web Services.
#
# It uses Dynamo as the metadata store and it uses S3 for snapshot storage as
# Dynamo objects are limited to 64KB in size.
#
# In order to use this backend you must require the 'aws2js' and the 'dynamo'
# npm packages.
#
# Example usage:
#
#     var connect = require('connect');
#     var share   = require('share').server;
#
#     var server = connect(connect.logger());
#
#     var options = {
#       db: {
#         type: 'amazon',
#         amazon_region: 'us-east-1',
#         amazon_access_key: '',
#         amazon_secret_key: '',
#         amazon_s3_snapshots_bucket_name: 'a-bucket-just-for-snapshots',
#         amazon_dynamo_snapshots_table_name: 'a-dynamo-table-for-snapshots',
#         amazon_dynamo_operations_table_name: 'a-dynamo-table-for-operations',
#       }
#     };
#
#     share.attach(server, options);
#     server.listen(9000);
#
# You can run bin/setup_amazon (after editing bin/options.js) to provision the
# required resources.

util = require('util')
async = require('async')

defaultOptions =
  amazon_region: 'us-east-1'

module.exports = AmazonDb = (options) ->
  return new Db if !(this instanceof AmazonDb)

  options ?= {}
  options[k] ?= v for k, v of defaultOptions

  dynamo = require('dynamo')
  s3 = require('aws2js').load('s3', options.amazon_access_key, options.amazon_secret_key);

  client = dynamo.createClient({
    accessKeyId: options.amazon_access_key,
    secretAccessKey: options.amazon_secret_key
  })
  db = client.get(options.amazon_region)

  snapshots_table = options.amazon_dynamo_snapshots_table_name
  snapshots_bucket = options.amazon_s3_snapshots_bucket_name
  operations_table = options.amazon_dynamo_operations_table_name

  # Public: Creates a new document.
  #
  # docName - The unique name of the new document.
  # docData = {snapshot, type:typename, [meta]}
  #
  # FIXME: What should happen if it fails to save?
  #
  # Calls callback(true) if the document already exists. Calls callback() on
  # success.
  @create = (docName, docData, callback) ->
    async.auto(
      write_metadata: (callback) ->

        request =
          TableName: snapshots_table,
          Item:
            doc: { S: docName },
            v: { N: docData.v.toString() },
            meta: { S: JSON.stringify(docData.meta) },
            type: { S: docData.type },
            created_at: { N: new Date().getTime().toString() }
          Expected:
            doc:
              Exists: false

        db.putItem(request, callback)

      write_data: (callback) ->
        path = options.amazon_s3_snapshots_bucket_name+'/'+docName+'-'+docData.v+'.snapshot'
        headers = {}
        data = JSON.stringify(docData.snapshot)

        s3.put(path, headers, data, callback)
    (error, result) ->
      if error? and error.message.match 'The conditional request failed'
        callback?('Document already exists')
      else if error?
        console.log('Failed to save Snapshot('+docName+'-'+docData.v+'): '+util.inspect(error))
        callback?('Failure')
      else
        callback?()
    )

  # Public: Permanently deletes a document.
  #
  # docName - The name of the document to delete.
  # dbMeta - ?
  #
  # Calls callback which takes a single argument which is null if something was
  # deleted and the error message if something went wrong.
  @delete = (docName, dbMeta, callback) ->
    async.auto(
      list_snapshots: (callback) ->
        request =
          TableName: snapshots_table
          HashKeyValue: { S: docName }
          ScanIndexForward: false
          ConsistentRead: true

        # TODO: This will only return the latest 1 MB of results, so if there
        # are more keys additional requests must be made.
        db.query(request, callback)

      list_operations: (callback) ->
        request =
          TableName: operations_table
          HashKeyValue: { S: docName }
          ScanIndexForward: false
          ConsistentRead: true

        # TODO: This will only return the latest 1 MB of results, so if there
        # are more keys additional requests must be made.
        db.query(request, callback)

      delete_snapshots: ['list_snapshots', (callback, results) ->
        return callback("Document does not exist", null) if results.list_snapshots.Count == 0

        async.mapSeries(results.list_snapshots.Items,
          (item, cb) ->
            request = 
              TableName: snapshots_table
              Key:
                HashKeyElement: { S : item.doc.S }
                RangeKeyElement: { N : item.v.N }
              Expected:
                doc:
                  Value: { S: item.doc.S }
            db.deleteItem(request, cb)
          (error, result)->
            if error?
              callback(error, null)
            else
              callback(null, true)
          )
      ]

      delete_s3_snapshots: ['list_snapshots', (callback, results) ->
        return callback(null, {}) if results.list_snapshots.Count == 0

        async.forEachSeries(results.list_snapshots.Items,
          (item, cb) ->
            s3.del('/'+snapshots_bucket+'/'+item.doc.S+'-'+item.v.N+'.snapshot', cb)
          (error)->
            if error?
              callback(error, null)
            else
              callback(null, true)
          )
      ]

      delete_operations: ['list_operations', (callback, results) ->
        return callback(null, {}) if results.list_operations.Count == 0

        async.forEachSeries(results.list_operations.Items,
          (item, cb) ->
            request = 
              TableName: operations_table
              Key:
                HashKeyElement: { S : item.doc.S }
                RangeKeyElement: { N : item.v.N }
              Expected:
                doc:
                  Value: { S: item.doc.S }
            db.deleteItem(request, cb)
          (error)->
            if error?
              callback(error, null)
            else
              callback(null, true)
          )
      ]
    (error, result) ->
      if error?
        if error.toString().match "The conditional request failed"
          error = "Document does not exist"
        else if error != 'Document does not exist'
          console.log('Failed to delete snapshots or operations from Document('+docName+'): '+util.inspect(error))
        callback?(error)
      else
        callback?(null)
    )

  # Public: Retrieves the most recent snapshot
  #
  # docName - The name of the document to retrieve.
  #
  # data = {v, snapshot, type}. Snapshot == null and v = 0 if the document doesn't exist.
  #
  # Calls callback with (null, data) upon sucesss. Otherwise it calls callback with (error)
  @getSnapshot = (docName, callback) ->
    async.auto(
      get_snapshot: (cb) ->
        request =
          TableName: snapshots_table
          HashKeyValue: { S: docName }
          ScanIndexForward: false
          Limit: 1
          ConsistentRead: true

        db.query(request, cb)

      get_data: ['get_snapshot', (cb, results) ->
        return callback('Document does not exist', null) unless results.get_snapshot.Count == 1

        item = results.get_snapshot.Items[0]
        s3.get('/'+snapshots_bucket+'/'+item.doc.S+'-'+item.v.N+'.snapshot', 'buffer', cb)
      ]
    (error, results) ->
      if error?
        if error == 'Document does not exist'
          callback?(error)
        if results.get_snapshot?
          item = results.get_snapshot.Items[0]
          callback?('Failed to get snapshot data for Document('+item.doc.S+'-'+item.v.N+'): '+util.inspect(error))
        else
          callback?('Failed to get snapshot metadata for Document('+docName+')')
      else
        item = results.get_snapshot.Items[0]
        data =
          v: parseInt(item.v.N)
          snapshot: JSON.parse(results.get_data.buffer.toString())
          type: item.type.S
          meta: JSON.parse(item.meta.S)

        callback?(null, data)
    )

  # Public: Write new snapshot data to the database.
  #
  # docName - Name of document.
  # docData - Document snapshot data. {snapshot:s, type:t, meta}
  # dbMeta - ?
  #
  # The callback just takes an optional error.
  #
  # This function has UNDEFINED BEHAVIOUR if you call append before calling create().
  @writeSnapshot = (docName, docData, dbMeta, callback) ->
    async.auto(
      write_metadata: (callback) ->

        request =
          TableName: snapshots_table,
          Item:
            doc: { S: docName },
            v: { N: docData.v.toString() },
            meta: { S: JSON.stringify(docData.meta) },
            type: { S: docData.type },
            created_at: { N: new Date().getTime().toString() }
          Expected:
            doc:
              Exists: false

        db.putItem(request, callback)

      write_data: (callback) ->
        path = options.amazon_s3_snapshots_bucket_name+'/'+docName+'-'+docData.v+'.snapshot'
        headers = {}
        data = JSON.stringify(docData.snapshot)

        s3.put(path, headers, data, callback)
    (error, result) ->
      if error? and error.message.match 'The conditional request failed'
        callback?('Document already exists')
      else if error?
        console.log('Failed to save Snapshot('+docName+'-'+docData.v+'): '+util.inspect(error))
        callback?('Failure')
      else
        callback?()
    )

  # Public: Get all ops with version = start to version = end. Noninclusive.
  # end is trimmed to the size of the document.
  #
  # If any documents are passed to the callback, the first one has v = start
  # end can be null. If so, returns all documents from start onwards.
  #
  # Each document returned is in the form {op:o, meta:m, v:version}.
  #
  # docName - Name of the document
  # start   - The noninclusive starting version.
  # end     - The noninclusive ending version.
  #
  # Calls callback(null, data) on success and otherwise calls the callback with
  # just the error.
  @getOps = (docName, start, end, callback) ->
    end = 2147483648 unless end?
    return callback("Start must be less than end", []) if start >= end

    end = end - 1

    async.auto(
      get_metadata: (cb) ->
        request =
          TableName: operations_table
          HashKeyValue: { S: docName }
          ConsistentRead: true
          RangeKeyCondition:
            ComparisonOperator: 'BETWEEN'
            AttributeValueList: [{ N: start.toString() }, { N: end.toString() }]

        # TODO: This is limited to returning 1MB of data at a time, we should
        # handle getting more.
        db.query(request, cb)

    (error, result) ->
      if error?
        console.log('Failed to fetch Operations('+docName+'-'+start+'..'+end+'): '+util.inspect(error))
        callback?('Failure')
      else
        data = []
        for op in result.get_metadata.Items
          item = {
            op:   JSON.parse(op.op.S)
            meta: JSON.parse(op.meta.S)
          }
          data.push(item)

        callback? null, data
    )

  # Public: Write an operation to a document.
  #
  # opData = { op:the op to append, v:version, meta:optional }
  # callback = callback when operation committed
  #
  # opData.v MUST be the subsequent version for the document.
  #
  # This function has UNDEFINED BEHAVIOUR if you call append before calling create().
  # (its either that, or I have _another_ check when you append an op that the document already exists
  # ... and that would slow it down a bit.)
  @writeOp = (docName, opData, callback) ->
    async.auto(
      write_metadata: (cb) ->
        request =
          TableName: operations_table,
          Item:
            doc: { S: docName },
            v: { N: opData.v.toString() },
            op: { S: JSON.stringify(opData.op) },
            meta: { S: JSON.stringify(opData.meta) },

        db.putItem(request, cb)

    (error, result) ->
      if error?
        console.log('Failed to save Operation('+docName+'-'+opData.v+'): '+util.inspect(error))
        callback?('Failure')
      else
        callback?()
    )

  # Public: Call on close
  #
  # It's a noop here.
  @close = () ->

  this
