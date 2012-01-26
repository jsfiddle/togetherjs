#!/usr/local/bin/node

// Module dependencies.
var express = require('express');
var whiskers = require('whiskers');
var fs = require('fs');

var http = module.exports = express.createServer();

// Configuration

http.configure(function(){
  http.use(express.logger());
  http.use(express.resourceParserHack());
  http.use(express.bodyParser());
  
  
  http.set('views', __dirname + '/http/views');
  http.set('view engine', 'html');
  http.use(express.methodOverride());
  http.use(http.router);
  http.use(express.static(__dirname + '/http/public'));
  
  http.register('.html', whiskers);

});

http.configure('development', function(){
  http.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

http.configure('production', function(){
  http.use(express.errorHandler()); 
});

// Routes

routes = {
  bundles: require('./http/controllers/bundles'),
  site: require ('./http/controllers/site')
};

http.get('/', routes.site.index);

http.get('/c/:id',   routes.bundles.collaborate);
http.get('/v/:id',   routes.bundles.view);
http.post('/bundle', routes.bundles.create);
http.all('/bundle',  routes.bundles.allowCorsRequests);

http.listen(3000);
console.log("TowTruck HTTP server listening on port %d in %s mode", http.address().port, http.settings.env);
