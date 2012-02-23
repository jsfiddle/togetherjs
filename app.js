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

var io = require('socket.io').listen(http);

// Configuration

http.configure(function(){
  http.use(express.logger());

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

// Chat and presence stuff:
var activeBundles = {};
io.sockets.on('connection', function(socket){
  socket.on('adduser', function(data){
    console.log({'activeBundles': activeBundles});

    socket.username = data['username'];
    socket.bundleId = data['bundleId'];

    if (!socket.username){
      socket.username = 'anonymous';
    }
    console.log({"activeBundles[socket.bundleId]": activeBundles[socket.bundleId]});
    // Initialize and add the user to the bundle.
    if (!activeBundles[socket.bundleId]){
      activeBundles[socket.bundleId] = [];
    }
    activeBundles[socket.bundleId].push(socket.username);

    socket.join(socket.bundleId);
    socket.broadcast.to(socket.bundleId).emit('appendToTimeline', socket.username, "Has joined to collaborate.");
    socket.broadcast.to(socket.bundleId).emit('updateCollaborators', activeBundles[socket.bundleId]);
    socket.emit('updateCollaborators', activeBundles[socket.bundleId]);
  });

  socket.on('disconnect', function(){
    // Remove user from collaborators list
    try{
      if (activeBundles[socket.bundleId].indexOf(socket.username) >= 0){
        activeBundles[socket.bundleId].splice(activeBundles[socket.bundleId].indexOf(socket.username), 1);
      }

  		if (activeBundles[socket.bundleId].length == 0){
  		  delete activeBundles[socket.bundleId];
  	  }
  	  else{
  	    socket.broadcast.to(socket.bundleId).emit('updateCollaborators', activeBundles[socket.bundleId]);
        socket.broadcast.to(socket.bundleId).emit('appendToTimeline', socket.username, "Has left.");
      }
    }
    catch(err){
      //Swallow this one.
    }
    finally{
      socket.leave(socket.bundleId);
    }
	});

  socket.on('openResource', function(resource){
    socket.broadcast.to(socket.bundleId).emit(
      'appendToTimeline',
      socket.username,
      "Is now working on <a class=\"FollowMe\" target=\"etherpad\" data-target-id=\"" + resource.id + "\" href=\"" + resource.href + "\">" + resource.name + "</a>"
    );
  });

});


// HTTP Routes
routes = {
  bundles: require('./http/controllers/bundles'),
  site: require('./http/controllers/site'),
  resources: require('./http/controllers/resources')
};

http.get('/', routes.site.index);
http.get('/bookmarklet.js', routes.site.bookmarklet);

http.get('/resources/:id.:extension', routes.resources.viewEditable);
http.get('/resources/:id/:contentType1/:contentType2', routes.resources.viewResource);

http.get('/c/:id',   routes.bundles.collaborate);
http.get('/v/:id',   routes.bundles.view);
http.post('/bundle', routes.bundles.create);
http.all('/bundle',  routes.site.allowCorsRequests);

process.on('uncaughtException', function(err) {
  console.log(err);
});

http.listen(config.get('bind_to').port);
if (http.address() == null){
  console.log("Error listening to " + JSON.stringify(config.get('bind_to')));
  process.exit(1);
}
console.log("TowTruck HTTP server listening on port %d in %s mode", http.address().port, http.settings.env);
