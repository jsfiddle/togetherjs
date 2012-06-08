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
# If you would like more detailed information about the requests going to
# Amazon you can enabled timing information be setting the timing option to
# true.
#
# Example output:
# Dynamo[<number of milliseconds>,<cost in throughput of operation>] <type of operation>
# S3[<number of milliseconds>] <type of operation>
#
# The 'compress' option controls whether the JSON blobs are stored using gzip
# or not, it defaults to true. If this is disabled, there is a good chance that
# your operations might be larger than the 64KB limit of dynamo, you have been
# warned.

util = require('util')
async = require('async')
zlib = require('zlib')

defaultOptions =
  amazon_region: 'us-east-1'
  timing: false
  compress: true
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

  push: (fn, description, callback) =>
    start = new Date().getTime()
    @queue.push(fn, (error, results) =>
      if @timing
        elapsed = new Date().getTime() - start
        if results?
          capacity = results.ConsumedCapacityUnits
        else
          capacity = -1
        console.log('Dynamo['+elapsed+'ms,'+capacity+'] '+@name+': '+description)

      callback(error, results)
    )

class S3Queue
  constructor: (@name, concurrency, @timing) ->
    @queue = async.queue((task, callback) ->
      task(callback)
    , concurrency)

  push: (fn, description, callback) =>
    start = new Date().getTime()
    @queue.push(fn, (error, results) =>
      if @timing
        elapsed = new Date().getTime() - start
        console.log('S3['+elapsed+'ms] '+@name+': '+description)

      callback(error, results)
    )

class BlobHandler
  constructor: (@name, @encodeFunction, @decodeFunction, @logging) ->

  encode: (data, callback) =>
    start = new Date().getTime()
    @encodeFunction data, (error, result) =>
      elapsed = new Date().getTime() - start
      if result?
        length = result.length
      else
        length = -1
      console.log(@name+'Blob:Compressed['+data.length+','+length+','+elapsed+'ms]') if @logging
      callback?(error, result)

  decode: (data, callback) =>
    start = new Date().getTime()
    @decodeFunction data, (error, result) =>
      elapsed = new Date().getTime() - start
      if result?
        length = result.length
      else
        length = -1
      console.log(@name+'Blob:Decompressed['+data.length+','+length+','+elapsed+'ms]') if @logging
      callback?(error, result)

class TextCompressor
  constructor: (@compression, logging) ->
    @gzip = new BlobHandler 'Base64Gzip',
      (data, callback) ->
        zlib.gzip(new Buffer(data), callback)
      (data, callback) ->
        zlib.gunzip(data, callback)
      logging

    @base64 = new BlobHandler 'Base64',
      (data, callback) ->
        callback?(null, new Buffer(data, 'binary').toString('base64'))
      (data, callback) ->
        callback?(null, new Buffer(data, 'base64'))
      logging

  encode: (data, callback) =>
    if @compression
      @gzip.encode data, (error, result) =>
        @base64.encode(result, callback)
    else
      callback?(null, data)

  decode: (data, callback) =>
    if @compression
      @base64.decode data, (error, result) =>
        @gzip.decode(result, callback)
    else
      callback?(null, data)

class BinaryCompressor
  constructor: (@compression, logging) ->
    @gzip = new BlobHandler 'Gzip',
      (data, callback) ->
        zlib.gzip(new Buffer(data), callback)
      (data, callback) ->
        zlib.gunzip(data, callback)
      logging

  encode: (data, callback) =>
    if @compression
      @gzip.encode data, callback
    else
      callback?(null, data)

  decode: (data, callback) =>
    if @compression
      @gzip.decode data, callback
    else
      callback?(null, data)

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
    compressor = new TextCompressor(options['compress'], options['timing'])
    binaryCompressor = new BinaryCompressor(options['compress'], options['timing'])
    async.auto(
      compress_meta: (cb) ->
        compressor.encode(JSON.stringify(docData.meta), cb)

      write_metadata: ['compress_meta', (cb, results) ->
        request =
          TableName: snapshots_table,
          Item:
            doc: { S: docName },
            v: { N: docData.v.toString() },
            meta: { S: results.compress_meta },
            type: { S: docData.type },
            created_at: { N: new Date().getTime().toString() }
          Expected:
            doc:
              Exists: false

        # Mark a snapshot as being compressed
        request.Item['c'] = { S: 't' } if options['compress']

        snapshots_rw_queue.push((c) ->
          db.putItem(request, c)
        , 'write Snapshot('+docName+'-'+docData.v+')', cb)
      ]

      compress_data: (cb) ->
        binaryCompressor.encode(JSON.stringify(docData.snapshot), cb)

      write_data: ['compress_data', (cb, results) ->
        path = snapshots_bucket+'/'+docName+'-'+docData.v+'.snapshot'
        headers = {}

        s3_rw_queue.push((c) ->
          s3.put(path, headers, results.compress_data, c)
        , 'write Snapshot('+docName+'-'+docData.v+')', cb)
      ]
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
        , 'query Snapshots('+docName+')', cb)

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
        , 'query Operations('+docName+')', cb)

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
            , 'delete Snapshot('+item.doc.S+'-'+item.v.N+')', cb)
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
            , 'delete Snapshot('+item.doc.S+'-'+item.v.N+')', cb)
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
            , 'delete Operation('+item.doc.S+'-'+item.v.N+')', cb)
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
        , 'query Snapshot('+docName+')', cb)

      get_data: ['get_snapshot', (cb, results) ->
        return cb('Document does not exist', null) unless results.get_snapshot.Count == 1

        item = results.get_snapshot.Items[0]
        s3_ro_queue.push((c) ->
          s3.get('/'+snapshots_bucket+'/'+item.doc.S+'-'+item.v.N+'.snapshot', 'buffer', c)
        , 'fetch Snapshot('+item.doc.S+'-'+item.v.N+')', cb)
      ]

      compressor: ['get_snapshot', 'get_data', (cb, results) ->
        cb(null,
          text: new TextCompressor(results.get_snapshot.Items[0].c, options['timing'])
          binary: new BinaryCompressor(results.get_snapshot.Items[0].c, options['timing'])
        )
      ]

      snapshot: ['compressor', (cb, results) ->
        results.compressor.binary.decode(results.get_data.buffer, cb)
      ]

      meta: ['compressor', (cb, results) ->
        results.compressor.text.decode(results.get_snapshot.Items[0].meta.S, cb)
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

        try
          snapshot = JSON.parse(results.snapshot)
        catch error
          snapshot = {}
          console.error('Failure: data was corrupt for Snapshot('+docName+'-'+item.v.N+')')

        try
          meta = JSON.parse(results.meta)
        catch error
          meta = {}
          console.error('Failure: metadata was corrupt for Snapshot('+docName+'-'+item.v.N+')')

        data =
          v: parseInt(item.v.N)
          snapshot: snapshot
          type: item.type.S
          meta: meta

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
    compressor = new TextCompressor(options['compress'], options['timing'])
    binaryCompressor = new BinaryCompressor(options['compress'], options['timing'])
    async.auto(
      compress_meta: (cb) ->
        compressor.encode(JSON.stringify(docData.meta), cb)

      write_metadata: ['compress_meta', (cb, results) ->
        request =
          TableName: snapshots_table,
          Item:
            doc: { S: docName },
            v: { N: docData.v.toString() },
            meta: { S: results.compress_meta },
            type: { S: docData.type },
            created_at: { N: new Date().getTime().toString() }
          Expected:
            doc:
              Exists: false

        # Mark a snapshot as being compressed
        request.Item['c'] = { S: 't' } if options['compress']

        snapshots_rw_queue.push((c) ->
          db.putItem(request, c)
        , 'write Snapshot('+docName+'-'+docData.v+')', cb)
      ]

      compress_data: (cb) ->
        binaryCompressor.encode(JSON.stringify(docData.snapshot), cb)

      write_data: ['compress_data', (cb, results) ->
        path = snapshots_bucket+'/'+docName+'-'+docData.v+'.snapshot'
        headers = {}

        s3_rw_queue.push((c) ->
          s3.put(path, headers, results.compress_data, c)
        , 'write Snapshot('+docName+'-'+docData.v+')', cb)
      ]
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
  # start   - The inclusive starting version, must be less than end.
  # end     - The noninclusive ending version. If null, assumed to be maximum
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
        , 'query Operations('+docName+'-'+start+':'+end+')', cb)

    (error, results) ->
      if error?
        console.error('Failed to fetch Operations('+docName+'-'+start+'..'+end+'): '+util.inspect(error))
        callback?('Failed to fetch operations')
      else
        data = []
        async.map(results.get_metadata.Items, (operation, cb) ->
          compressor = new TextCompressor(operation.c?, options['timing'])
          async.auto(
            snapshot: (c) ->
              compressor.decode(operation.op.S, c)

            meta: (c) ->
              compressor.decode(operation.meta.S, c)

          (error, results) ->
            try
              op = JSON.parse(results.snapshot)
            catch error
              op = {}
              console.error('Failure: data was corrupt for Operation('+docName+'-'+operation.v.N+')')

            try
              meta = JSON.parse(results.meta)
            catch error
              meta = {}
              console.error('Failure: metadata was corrupt for Operation('+docName+'-'+operation.v.N+')')

            item = {
              op: op
              meta: meta
            }
            cb(null, item)
          )
        (error, results) ->
          callback? null, results
        )
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
    compressor = new TextCompressor(options['compress'], options['timing'])
    async.auto(
      compress_op: (cb) ->
        compressor.encode(JSON.stringify(opData.op), cb)

      compress_meta: (cb) ->
        compressor.encode(JSON.stringify(opData.meta), cb)

      write_metadata: ['compress_op', 'compress_meta', (cb, results) ->
        request =
          TableName: operations_table,
          Item:
            doc: { S: docName },
            v: { N: opData.v.toString() },
            op: { S: results.compress_op },
            meta: { S: results.compress_meta },

        # Mark a snapshot as being compressed
        request.Item['c'] = { S: 't' } if options['compress']

        operations_rw_queue.push((c) ->
          db.putItem(request, c)
        , 'write Operation('+docName+'-'+opData.v+')', cb)
      ]
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
