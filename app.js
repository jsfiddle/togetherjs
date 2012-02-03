#!/usr/local/bin/node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */



// Module dependencies.
const
path = require('path'),
express = require('express'),
ejs = require('ejs'),
fs = require('fs');

const config = require('./lib/configuration');

var http = undefined;
http = express.createServer();

// Configuration

http.configure(function(){
  http.use(express.logger());
  http.use(express.resourceParserHack());
  http.use(express.bodyParser());
  
  
  http.set('views', __dirname + '/http/views');
  http.set('view engine', 'ejs');
  
  http.use(express.methodOverride());
  http.use(http.router);
  http.use(express.static(__dirname + '/http/public'));

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

http.get('/bookmarklet.js', routes.site.bookmarklet);

http.get('/c/:id',   routes.bundles.collaborate);
http.get('/v/:id',   routes.bundles.view);
http.post('/bundle', routes.bundles.create);
http.all('/bundle',  routes.bundles.allowCorsRequests);

http.listen(config.get('bind_to').port);
console.log("TowTruck HTTP server listening on port %d in %s mode", http.address().port, http.settings.env);
