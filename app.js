#!/usr/local/bin/node

// Module dependencies.
var express = require('express')
  , routes = require('./routes')
  , whiskers = require('whiskers')
  , fs = require('fs');
  
var redis = require('redis').createClient();
var etherpad = require('etherpad-lite-client').connect({
  apikey: 'jZZMcZVwJKJS5jRJALhqATeOAgY2SV0a',
  host: 'localhost',
  port: 9001,
});


var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.use(express.logger());
  app.use(express.resourceParserHack());
  app.use(express.bodyParser());
  
  
  app.set('views', __dirname + '/views');
  app.set('view engine', 'html');
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
  
  app.register('.html', whiskers);

});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/', routes.index);
app.get('/v/:id', function(req, resp){
  var bundleId = parseInt(req.params.id, 36);
  
  
  redis.get(bundleId, function(err, bundle){
    //TODO: Error checking for 404 etc.
    bundle = JSON.parse(bundle);
    console.log(bundleId + '_' + bundle.root);
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
        resources.push({id: x, originalUrl: bundle.resources[x].originalUrl});
      }
      // Sort by length of the originalUrl so that we don't clobber 
      // things we shouldn't when replacing with new url.
      resources.sort(function(a,b){
        a.originalUrl.length > b.originalUrl.length ? 1 : -1
      });
      
      
      resp.send(rootContent);
    });
    
    
    
  });
});
app.get('/c/:id', function(req, resp){
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

    console.log(resources);
    resp.render('collaborate', {
      'bundleId': bundle.id,
      'rootKey': bundle.id + '_' + bundle.root, 
      'resources': resources.reverse(), 
      'thisUrl': 'http://localhost:3000' + req.url,
      'layout': false      
    });
  });
  
});

app.post('/bundle', function(req, resp){
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
    resp.render('towtruck_response', {url: 'http://localhost:3000/c/' + bundleId.toString(36)});
  });
});

app.all('/bundle', function(req, resp){
  resp.header('Access-Control-Allow-Origin', '*');
  resp.send('');
});

app.listen(3000);
console.log("TowTruck server listening on port %d in %s mode", app.address().port, app.settings.env);
