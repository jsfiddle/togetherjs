#!/usr/local/bin/node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

var
express = require('express'),
app     = express(),
logger  = require('../../lib/logger');

// Configuration
app.configure(function(){
  app.use(express.static(__dirname + '/public'));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

var host = process.env.HOST || "127.0.0.1";
app.listen(process.env.EXAMPLE_SERVER_PORT, host);

logger.info("Example server listening at http://" + host + ":" + process.env.EXAMPLE_SERVER_PORT + "/ .");
