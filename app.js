#!/usr/local/bin/node

// Module dependencies.
var express = require('express');
var whiskers = require('whiskers');
var fs = require('fs');

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

routes = {
  bundles: require('./controllers/bundles'),
  site: require ('./controllers/site')
};

app.get('/', routes.site.index);

app.get('/c/:id',   routes.bundles.collaborate);
app.get('/v/:id',   routes.bundles.view);
app.post('/bundle', routes.bundles.create);
app.all('/bundle',  routes.bundles.allowCorsRequests);

app.listen(3000);
console.log("TowTruck server listening on port %d in %s mode", app.address().port, app.settings.env);
