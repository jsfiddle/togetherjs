# OT storage for CouchDB
# Author: Max Ogden (@maxogden)

request = require('request').defaults json: true
_ = require 'underscore'

defaults =
  port: 5984
  hostname: "http://localhost"
  db: "ot"

encodeOptions = (options) ->
  buf = []
  if options? and typeof options is "object"
    for own name, value of options
      value = JSON.stringify value if name in ['key', 'startkey', 'endkey']

      buf.push "#{encodeURIComponent(name)}=#{encodeURIComponent(value)}"
  
  if buf.length is 0
    ""
  else
    "?" + buf.join "&"

module.exports = (options) ->
  options = _.extend {}, defaults, options

  db = options.hostname + ":" + options.port + '/' + options.db
  ops = db + '/_design/sharejs/_view/operations'
  
  getOps: (docName, start, end, callback) ->
    return callback null, [] if start == end
    
    # Its a bit gross having this end parameter here....
    if end then end-- else end = 999999
    
    request uri: ops + encodeOptions(startkey: [docName, start], endkey: [docName, end], include_docs: true), (err, resp, body) ->
      # Can we just return row.doc? What else is in it?
      data = ({op: row.doc.op, meta: row.doc.meta, v: row.doc.v} for row in body.rows)
      callback null, data
  
  # in the context of couchdb mapreduce this create function doesn't
  # really make sense, since the existence of operations is an implicit
  # indicator that a document exists and each op gets it's own doc.
  # regardless, to make the test suite pass, im storing 'document' documents
  create: (docName, data, callback) ->
    throw new Error 'snapshot missing from data' unless data.snapshot != undefined
    throw new Error 'type missing from data' unless data.type != undefined
    throw new Error 'version missing from data' unless typeof data.v == 'number'
    throw new Error 'meta missing from data' unless typeof data.meta == 'object'

    doc = {_id: docName, type: "document", data}
    request.post uri: db, body: doc, (err, resp, body) ->
      if err
        callback? err, false
      else if body.ok
        callback? null, true
      else
        if body.error is "conflict"
          callback? 'Document already exists', false
        else
          callback? body.error + ' reason: ' + body.reason, false
 
  delete: (docName, callback) ->
    request "#{db}/#{docName}", (err, resp, body) ->
      return callback? 'Document does not exist', false if resp.statusCode is 404

      docs = [_.extend({}, body, {_deleted: true})]
      # Again with the hard version number limit. Version numbers can actually get really large - a couple hours of editing
      # easily pushes 10k ops.
      request uri: ops + encodeOptions({startkey:[docName,0], endkey:[docName,999999], include_docs: true}), (err, resp, body) ->
        docs.push _.extend({}, row.doc, {_deleted: true}) for row in body.rows

        request.post {url: db + '/_bulk_docs', body: {docs}}, (err, resp, body) ->
          if err
            callback? err, false
          else
            callback? null, true
 
  append: (docName, opData, docData, callback) ->
    throw new Error 'snapshot missing from data' unless docData.snapshot != undefined
    throw new Error 'type missing from data' unless docData.type != undefined
    
    request "#{db}/#{docName}", (err, resp, body) ->
      return callback? 'Document does not exist' if resp.statusCode is 404

      body.data = docData
      request.post url: db, body: body, (err, resp, body) ->
        opData.docName = docName
        request.post {uri: db, body: opData}, (err, resp, body) ->
          if body?.ok
            callback?()
          else
            callback? err or body.error

  getSnapshot: (docName, callback) ->
    request "#{db}/#{docName}", (err, resp, body) ->
      if resp.statusCode is 404
        callback 'Document does not exist'
      else
        callback null, body.data

  getVersion: (docName, callback) ->
    request "#{db}/#{docName}", (err, resp, body) ->
      if resp.statusCode is 404
        callback 'Document does not exist'
      else
        callback null, body.data.v

  close: ->
