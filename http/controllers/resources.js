/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */


const
config = require('../../lib/configuration');

// Load the configured redis client.
var redis = require('../../lib/redis');

var etherpad = require('etherpad-lite-client').connect(config.get('etherpad'));

exports.viewEditable = function(req, resp){
  var contentType = undefined;
  switch (req.params.extension){
    case 'js': 
      contentType = 'application/x-javascript';
      break;
    case 'css':
      contentType = 'text/css';
      break;
    case 'html':
      contentType = 'text/html';
      break;
    default:
      resp.send('Non-editable content-type', 404);
      return;
  }
  
  resp.header('Content-Type', contentType);
  
  //TODO: Error handling
  etherpad.getText({padID: req.params.id}, function(error, data){
    var rootContent = data['text']
    resp.send(data['text']);
  });
}

exports.viewResource = function(req, resp){
  resp.header('Content-Type', req.params.contentType1 + '/' + req.params.contentType2);
  redis.get(req.params.id, function(err, reply){
    console.log(err);
    console.log(reply);
    resp.send(reply);
  });
}
