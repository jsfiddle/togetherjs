#!/usr/local/bin/node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

require('../../lib/extensions/number');

const STATIC_EXPIRATION = 60*60*24; // 24 hours
const TOGETHERJS_EXPIRATION = 60*60; // 1 hour

const
env         = require('../../lib/environment'),
express     = require('express'),
logger      = require('../../lib/logger'),
util        = require('util'),
engine      = require('ejs-locals'),
route       = require('./routes'),
less        = require('less-middleware'),
application = require('./controllers/application');

var http = express();

// Express Configuration
http.configure(function(){

  // Use the EJS view engine
  http.set('views', __dirname + '/views');
  http.set('view engine', 'ejs');
  http.engine('ejs', engine);
  http.engine('js',  engine);

  http.use(less({
    src: __dirname + '/public'
  }));

  http.on('view_locals', function(locals) {
    extend(locals, require(''));
  });

  // FIXME: this outputs more than I'm interested in, but maybe there's a better way of suppressing those via Foreman?
  //http.use(express.logger());
  http.use(express.static(__dirname + '/public'));
  http.use(express.cookieParser());
  http.use(express.bodyParser());
  http.use(express.methodOverride());

  // Remove the HTTP Server Header, in case of security issues.
  http.use(function (req, res, next) {
    res.removeHeader("X-Powered-By");
    next();
  });

  http.use(function (req, res, next) {
    var expire_time;
    if (req.url.search("/togetherjs.js") == -1) {
      expire_time = STATIC_EXPIRATION;
    } else {
      expire_time = TOGETHERJS_EXPIRATION;
    }
    res.setHeader("Cache-Control", "public, max-age=" + expire_time);
    res.setHeader("Expires", new Date(Date.now() + expire_time * 1000).toUTCString());
    next();
  });

  http.use(http.router);

  http.use(function(err, req, res, next){
    if (err.message.indexOf("Failed to lookup view") === 0){
      res.render('site/errors/404', { status: 404, url: req.url });
    }
    else{
      res.render('site/errors/500', { status: 500, url: req.url });
    }
  });
});

http.configure('development', function(){
  http.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

http.configure('production', function(){
  http.use(express.errorHandler());
});

// HTTP Routes
route(http);

process.on('uncaughtException', function(err) {
  logger.error(err);
});

var port = env.get("PORT");
var host = env.get("HOST") || "127.0.0.1";
http.listen(port, host);

logger.info("HTTP server listening on port " + port + " (http://" + process.env.PUBLIC_BASE_URL + ").");
