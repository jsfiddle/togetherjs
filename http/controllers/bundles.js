/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */



const
config = require('../../lib/configuration');

// Load the configured redis client.
var redis = require('../../lib/redis');

var etherpad = require('etherpad-lite-client').connect(config.get('etherpad'));


exports.collaborate = function(req, resp){
  var bundleId = parseInt(req.params.id, 36);
  
  redis.get(bundleId, function(err, reply){
    var bundle = JSON.parse(reply);
    
    var resources = [];
    for (x in bundle.resources){
      if (bundle.resources[x].contentType.indexOf('image') != 0){
        console.log(bundle.resources[x].originalUrl);
        var name = bundle.resources[x].originalUrl.split('/');
        name = name[name.length - 1];
        
        var contentType = bundle.resources[x].contentType;
        if (contentType.indexOf('javascript') > 0){
          name = 'javascripts/' + name;
        }
        else if (contentType.indexOf('css') > 0){
          name = 'stylesheets/' + name;
        }
        
        if (x == bundle.root){
          name = "index.html";
        }
        
        resources.push({
          'name': name,
          'key': bundle.id + '_' + x
        });
      }
    }
    resources.sort(function(a,b){ a.name > b.name ? 1 : -1});
    
    resp.render('bundles/collaborate', {
      'bundleId': bundle.id,
      'bundleKey': bundle.id.toString(36),
      'rootKey': bundle.id + '_' + bundle.root, 
      'resources': resources.reverse(), 
      'thisPath': req.url,
      'publicUrl': config.get('public_url'),
      'etherpadUrl': config.get('etherpad')['public_url'],
      'layout': false      
    });
  });
};

function escapeRegEx(text) {
  return text.replace(/[\=\-\[\]\{\}\(\)\*\+\?\.\,\\\/\^\$\|\#]/g, "\\$&");
}

exports.view = function(req, resp){
  var bundleId = parseInt(req.params.id, 36);
  
  
  redis.get(bundleId, function(err, bundle){
    //TODO: Error checking for 404 etc.
    bundle = JSON.parse(bundle);
    console.log(bundle);
    resp.header('Content-Type', bundle.resources[bundle.root].contentType);
    etherpad.getText({padID: bundleId + '_' + bundle.root}, function(error, data){
      var rootContent = data['text']
      
      
      var resources = [];
      
      for (x in bundle.resources){
        var extension = '';
        var contentType = bundle.resources[x].contentType;
        if (contentType.indexOf('javascript') > 0){
          extension = '.js';
        }
        else if (contentType.indexOf('text/css') == 0){
          extension = '.css';
        }
        
        
        if (extension != ''){
          resources.push({
            id: x, 
            originalUrl: bundle.resources[x].originalUrl,
            newUrl: "/resources/" + bundleId + "_" + x + extension
          });
        }
        else{
        
        }
      }
      // Sort by length of the originalUrl so that we don't clobber 
      // things we shouldn't when replacing with new url.
      resources = resources.sort(function(a,b){
        return b.originalUrl.length - a.originalUrl.length;
      });
      
      //TODO: Figure out how to replace image urls in a sane manner. -- For now we just give them full-path
      for (i in resources){
        var resource = resources[i];
        var regex = new RegExp("[\\\"\']" + escapeRegEx(resource.originalUrl) + "[\\\"\']", "g");
        rootContent = rootContent.replace(regex, "\"" + resource.newUrl + "\"");
      }
      
      resp.send(rootContent);
    });  
  });
};

exports.create = function(req, resp){
  redis.incr('global:last_bundle_id', function (err, bundleId) {
    bundleId = parseInt(bundleId);
    
    resp.header('Access-Control-Allow-Origin', '*');
    var sha1 = require('sha1');

    var bundle = {
      id: bundleId,
      resources: {
      }
    };
  
  
    var resources = req.body.resources;
  
  
    // Cycle through each resource
    for(x in resources){
      // For now we ignore those that don't have any data
      // they weren't properly downloaed and are probably available
      // publically.
      if (resources[x]['content-type'] == null){
        console.info("Ignoring " + x);
        delete resources[x];
      }
      else{
        var hash = sha1(x);
      
        // Set the root object of the bundle
        if (req.body.root == x)
          bundle.root = hash;
      
        var contentType = resources[x]['content-type'];
        bundle.resources[hash] = {
          'originalUrl': x,
          'contentType': contentType
        };
      
        redis.set(bundle.id, JSON.stringify(bundle));
      
        //SECURITY: This is an obvious way to get a resource on this server and do bad things...
        // Now we persist it. Images go to redis, 
        if (contentType.indexOf('image') == 0){
          redis.set(bundle.id + "_" + hash, resources[x].data);
        }
        else{
          var id = bundle.id + "_" + hash;
          etherpad.createPad({padID: id, text: resources[x].data});        
        }
      }
    }
    console.log(bundle);
    resp.render('bundles/create', {layout: false, url: config.get('public_url') + '/c/' + bundleId.toString(36)});
  });
};

