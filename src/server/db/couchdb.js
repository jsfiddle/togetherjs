/**  OT storage for CouchDB
  *  Author: Max Ogden (@maxogden)
 **/

var request = require('request').defaults({ json: true })
  , _ = require('underscore')
  , defaults = {
      port: 5984
    , hostname: "http://localhost"
    , db: "ot"
  }
  ;

function encodeOptions(options) {
  var buf = [];
  if (typeof(options) == "object" && options !== null) {
    for (var name in options) {
      if (!options.hasOwnProperty(name)) {continue;}
      var value = options[name];
      if (name == "key" || name == "startkey" || name == "endkey") {
        value = JSON.stringify(value);
      }
      buf.push(encodeURIComponent(name) + "=" + encodeURIComponent(value));
    }
  }
  if (!buf.length) {
    return "";
  }
  return "?" + buf.join("&");
}

module.exports = function(options) {
  options = _.extend({}, defaults, options);
  var db = options.hostname + ":" + options.port + '/' + options.db
    , ops = db + '/_design/sharejs/_view/operations'
    ;
  
  return {
    getOps: function(docName, start, end, callback) {
      if (start === end) {
        callback([]);
        return;
      }
      
      if (end) end--
      else end = 9999
      
      request({uri: ops + encodeOptions({startkey: [docName, start], endkey: [docName, end], include_docs: true})}
        , function(err, resp, body) {
          callback(_(body.rows).map(function(row) { return {op: row.doc.op, meta: row.doc.meta, v: row.doc.v} }));
        })
    },
    // in the context of couchdb mapreduce this create function doesn't
    // really make sense, since the existence of operations is an implicit
    // indicator that a document exists and each op gets it's own doc.
    // regardless, to make the test suite pass, im storing 'document' documents
    create: function(docName, data, callback) {
      if (!(_.include(_.keys(data), "snapshot"))) throw new Error('snapshot missing from data');
      if (!(_.include(_.keys(data), "type"))) throw new Error('type missing from data');
      if (!_.isNumber(data.v)) throw new Error('version missing from data');
      if (!_.isObject(data.meta)) throw new Error('meta missing from data');

      var doc = {_id: docName, type: "document", data: data};
      request.post({uri: db, body: doc}
        , function(err, resp, body) {
          if (err) callback(false, err);
          if (body.error === "conflict") callback(false, 'Document already exists');
          if (body.ok) callback(true);          
        })
    },
    delete: function(docName, callback) {
      var docID = db + '/' + docName;
      request.get(docID
        , function(err, resp, body) {
          if (resp.statusCode === 404) {
            if(callback) callback(false, 'Document does not exist');
          } else {
            var docs = [_.extend({}, body, {_deleted: true})];
            request({uri: ops + encodeOptions({startkey: [docName,0], endkey: [docName,9999], include_docs: true})}
              , function(err, resp, body) {
                _(body.rows).each(function(row) { docs.push(_.extend({}, row.doc, {_deleted: true})) });
                request.post({url: db + '/_bulk_docs', body: {docs: docs}}
                  , function(err, resp, body) {
                    if (!err && callback) callback(true);
                  })
              })
          }
        })
    },
    append: function(docName, opData, docData, callback) {
      if (!(_.include(_.keys(docData), "snapshot"))) throw new Error('snapshot missing from data');
      if (!(_.include(_.keys(docData), "type"))) throw new Error('type missing from data');
      
      var docID = db + '/' + docName;
      request.get(docID
        , function(err, resp, body) {
          if (resp.statusCode === 404) throw new Error('doc missing');
          body.data = docData;
          request.post({url: db, body: body}
            , function(err, resp, body) {
              opData.docName = docName;
              request.post({uri: db, body: opData}
                , function(err, resp, body) {
                  if (body.ok) callback(true);
                })
            })
        })
    },
    getSnapshot: function(docName, callback) {
      var docID = db + '/' + docName;
      request.get(docID
        , function(err, resp, body) {
          if (resp.statusCode === 404) {
            callback(null, 'Document does not exist');
          } else {
            callback(body.data);
          }
        })
    },
    getVersion: function(docName, callback) {
      request(db + '/' + docName
        , function(err, resp, body) {
         if(resp.statusCode === 404) {
           callback(null, 'Document does not exist');
         } else {
           callback(body.data.v);
         }
      })
    },
    close: function() { }
  }
}