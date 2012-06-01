# This is an implementation of the OT data backend for Amazon Web Services.
#
# It uses Dynamo as the metadata store and it uses S3 for snapshot storage as
# Dynamo objects are limited to 64KB in size.
#
# In order to use this backend you must require the 'aws2js', 'async' and the
# 'dynamo' npm packages.
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
#
# By default the concurrency of requests made to amazon are limited to being
# serial. If you would like greater concurrency you can change the following
# options from their defaults (1 is serialized, anything greater is
# parallelized):
#
#  s3_rw_concurrency: 1
#  s3_ro_concurrency: 1
#  snapshots_ro_concurrency: 1
#  snapshots_rw_concurrency: 1
#  operations_ro_concurrency: 1
#  operations_rw_concurrency: 1
#
#  If you would like more detailed information about the requests going to
#  Amazon you can enabled timing information be setting the timing option to
#  true.
#
#  Example output:
#  Dynamo[<number of milliseconds>,<cost in throughput of operation>] <type of operation>
#  S3[<number of milliseconds>] <type of operation>

util = require('util')
async = require('async')

defaultOptions =
  amazon_region: 'us-east-1'
  timing: false
  s3_rw_concurrency: 1
  s3_ro_concurrency: 1
  snapshots_ro_concurrency: 1
  snapshots_rw_concurrency: 1
  operations_ro_concurrency: 1
  operations_rw_concurrency: 1

class DynamoQueue
  constructor: (@name, concurrency, @timing) ->
    @queue = async.queue((task, callback) ->
      task(callback)
    , concurrency)

  push: (fn, callback) =>
    start = new Date().getTime()
    @queue.push(fn, (error, results) =>
      if @timing
        elapsed = new Date().getTime() - start
        capacity = results.ConsumedCapacityUnits if results?
        console.log('Dynamo['+elapsed+'ms,'+capacity+'] '+@name)

      callback(error, results)
    )

class S3Queue
  constructor: (@name, concurrency, @timing) ->
    @queue = async.queue((task, callback) ->
      task(callback)
    , concurrency)

  push: (fn, callback) =>
    start = new Date().getTime()
    @queue.push(fn, (error, results) =>
      if @timing
        elapsed = new Date().getTime() - start
        console.log('S3['+elapsed+'ms] '+@name)

      callback(error, results)
    )

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

  s3_ro_queue = new S3Queue('read', options['s3_ro_concurrency'], options['timing'])
  s3_rw_queue = new S3Queue('write', options['s3_rw_concurrency'], options['timing'])
  snapshots_ro_queue = new DynamoQueue('snapshots read', options['snapshots_ro_concurrency'], options['timing'])
  snapshots_rw_queue = new DynamoQueue('snapshots write', options['snapshots_rw_concurrency'], options['timing'])
  operations_ro_queue = new DynamoQueue('operations read', options['operations_ro_concurrency'], options['timing'])
  operations_rw_queue = new DynamoQueue('operations write', options['operations_rw_concurrency'], options['timing'])

  # Public: Creates a new document.
  #
  # docName - The unique name of the new document.
  # docData - { snapshot:string, type:string, v:int, meta:string }
  #
  # Calls callback('Document already exists') if the document already exists.
  # Calls callback(error) on failure.
  # Calls callback() on success.
  @create = (docName, docData, callback) ->
    async.auto(
      write_metadata: (cb) ->
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

        snapshots_rw_queue.push((c) ->
          db.putItem(request, c)
        , cb)

      write_data: (cb) ->
        path = snapshots_bucket+'/'+docName+'-'+docData.v+'.snapshot'
        headers = {}
        data = JSON.stringify(docData.snapshot)

        s3_rw_queue.push((c) ->
          s3.put(path, headers, data, c)
        , cb)
    (error, results) ->
      if error?
        if error.message? and error.message.match 'The conditional request failed'
          callback?('Document already exists')
        else if results? and results.write_metadata?
          console.error('Failed to save Snapshot('+docName+'-'+docData.v+') to S3: '+util.inspect(error))
          callback?('Failed to save snapshot to S3')
        else
          console.error('Failed to save Snapshot('+docName+'-'+docData.v+'): '+util.inspect(error))
          callback?('Failed to save snapshot')
      else
        callback?()
    )

  # Public: Permanently deletes a document.
  #
  # docName - The name of the document to delete.
  # dbMeta  - This argument is unused as it's unused in other storage engines
  #
  # Calls callback('Document does not exist') if no document exists.
  # Calls callback(error) on failure.
  # Calls callback(null) on success.
  @delete = (docName, dbMeta, callback) ->
    async.auto(
      list_snapshots: (cb) ->
        request =
          TableName: snapshots_table
          HashKeyValue: { S: docName }
          ScanIndexForward: false
          ConsistentRead: true

        # TODO: This will only return the latest 1 MB of results, so if there
        # are more keys additional requests must be made.
        snapshots_ro_queue.push((c) ->
          db.query(request, c)
        , cb)

      list_operations: (cb) ->
        request =
          TableName: operations_table
          HashKeyValue: { S: docName }
          ScanIndexForward: false
          ConsistentRead: true

        # TODO: This will only return the latest 1 MB of results, so if there
        # are more keys additional requests must be made.
        operations_ro_queue.push((c) ->
          db.query(request, c)
        , cb)

      delete_snapshots: ['list_snapshots', (cb, results) ->
        return cb('Document does not exist', null) if results.list_snapshots.Count == 0

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
            snapshots_rw_queue.push((c) ->
              db.deleteItem(request, c)
            , cb)
          (error, result)->
            if error?
              cb(error, null)
            else
              cb(null, true)
          )
      ]

      delete_s3_snapshots: ['list_snapshots', (cb, results) ->
        return cb(null, {}) if results.list_snapshots.Count == 0

        async.forEachSeries(results.list_snapshots.Items,
          (item, cb) ->
            s3_rw_queue.push((c) ->
              s3.del('/'+snapshots_bucket+'/'+item.doc.S+'-'+item.v.N+'.snapshot', c)
            , cb)
          (error)->
            if error?
              cb(error, null)
            else
              cb(null, true)
          )
      ]

      delete_operations: ['list_operations', (cb, results) ->
        return cb(null, {}) if results.list_operations.Count == 0

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
            operations_rw_queue.push((c) ->
              db.deleteItem(request, c)
            , cb)
          (error)->
            if error?
              cb(error, null)
            else
              cb(null, true)
          )
      ]
    (error, results) ->
      if error?
        if error.toString().match 'The conditional request failed'
          callback?('Document does not exist')
        else if error == 'Document does not exist'
          callback?(error)
        else
          console.error('Failed to delete snapshots or operations from Document('+docName+'): '+util.inspect(error))
          callback?('Failed to delete snapshots or operations')
      else
        callback?(null)
    )

  # Public: Retrieves the most recent snapshot
  #
  # docName - The name of the document to retrieve.
  #
  # Calls callback('Document does not exist') if no document exists.
  # Calls callback(error) on failure.
  # Calls callback(null, { v:int, snapshot:string, type:typename, meta:string }) on success.
  @getSnapshot = (docName, callback) ->
    async.auto(
      get_snapshot: (cb) ->
        request =
          TableName: snapshots_table
          HashKeyValue: { S: docName }
          ScanIndexForward: false
          Limit: 1
          ConsistentRead: true

        snapshots_ro_queue.push((c) ->
          db.query(request, c)
        , cb)

      get_data: ['get_snapshot', (cb, results) ->
        return cb('Document does not exist', null) unless results.get_snapshot.Count == 1

        item = results.get_snapshot.Items[0]
        s3_ro_queue.push((c) ->
          s3.get('/'+snapshots_bucket+'/'+item.doc.S+'-'+item.v.N+'.snapshot', 'buffer', c)
        , cb)
      ]
    (error, results) ->
      if error?
        if error == 'Document does not exist'
          callback?(error)
        else if results? and results.get_snapshot?
          item = results.get_snapshot.Items[0]
          console.error('Failed to get snapshot data for Document('+item.doc.S+'-'+item.v.N+'): '+util.inspect(error))
          callback?('Failed to get snapshot data')
        else
          console.error('Failed to get snapshot metadata for Document('+docName+'): '+util.inspect(error))
          callback?('Failed to get snapshot metadata')
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
  # docData - { snapshot:string, type:typename, meta:string, v:int }
  # dbMeta  - This argument is unused as it's unused in other storage engines
  #
  # This function has UNDEFINED BEHAVIOUR if you call append before calling create().
  #
  # Calls callback('Document already exists') if the document already exists.
  # Calls callback(error) on failure.
  # Calls callback() on success.
  @writeSnapshot = (docName, docData, dbMeta, callback) ->
    async.auto(
      write_metadata: (cb) ->
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

        snapshots_rw_queue.push((c) ->
          db.putItem(request, c)
        , cb)

      write_data: (cb) ->
        path = snapshots_bucket+'/'+docName+'-'+docData.v+'.snapshot'
        headers = {}
        data = JSON.stringify(docData.snapshot)

        s3_rw_queue.push((c) ->
          s3.put(path, headers, data, c)
        , cb)
    (error, results) ->
      if error?
        if error.message? and error.message.match 'The conditional request failed'
          callback?('Document already exists')
        else if results? and results.write_metadata?
          console.error('Failed to save Snapshot('+docName+'-'+docData.v+') to S3: '+util.inspect(error))
          callback?('Failed to save snapshot data')
        else
          console.error('Failed to save Snapshot('+docName+'-'+docData.v+'): '+util.inspect(error))
          callback?('Failed to save snapshot metadata')
      else
        callback?()
    )

  # Public: Get all operations between start and end noninclusive.
  #
  # docName - Name of the document
  # start   - The noninclusive starting version, must be less than end.
  # end     - The noninclusive ending version, if null assumed to be maximum
  #           value.
  #
  # Calls callback(error) on failure.
  # Calls callback(null, [{ op:string, meta:string }]) on success.
  @getOps = (docName, start, end, callback) ->
    end = 2147483648 unless end?
    return callback('Start must be less than end', []) if start >= end

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
        operations_ro_queue.push((c) ->
          db.query(request, c)
        , cb)

    (error, results) ->
      if error?
        console.error('Failed to fetch Operations('+docName+'-'+start+'..'+end+'): '+util.inspect(error))
        callback?('Failed to fetch operations')
      else
        data = []
        for op in results.get_metadata.Items
          item = {
            op:   JSON.parse(op.op.S)
            meta: JSON.parse(op.meta.S)
          }
          data.push(item)

        callback? null, data
    )

  # Public: Write an operation to a document.
  #
  # docName - Name of the document
  # opData  - { op:string, v:int, meta:string }
  #
  # opData.v MUST be the subsequent version for the document.
  #
  # This function has UNDEFINED BEHAVIOUR if you call append before calling create().
  # (its either that, or I have _another_ check when you append an op that the
  # document already exists ... and that would slow it down a bit.)
  #
  # Calls callback(error) on failure.
  # Calls callback() on success.
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

        operations_rw_queue.push((c) ->
          db.putItem(request, c)
        , cb)

    (error, results) ->
      if error?
        console.error('Failed to save Operation('+docName+'-'+opData.v+'): '+util.inspect(error))
        callback?('Failure')
      else
        callback?()
    )

  # Public: Call on close
  #
  # It's a noop here.
  @close = () ->

  this
