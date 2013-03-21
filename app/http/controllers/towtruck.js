/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

var read = require('fs').readFileSync;
var path = require('path');
var ua = require('universal-analytics');

var dirname = path.resolve(__dirname, "../views/towtruck/");

function readInclude(name, options) {
  var incPath = path.join(dirname, name);
  var ext = path.extname(name);
  if (!ext) incPath += '.tmpl';
  if (options){
    if (options.ignorePostProcess){
      return read(incPath, 'utf8');
    }
  }
  return read(incPath, 'utf8')
    .replace(/\n/g, "\\n")
    .replace(/\"/g, "\\\"")
    .replace(/http:\/\/localhost:8080/g, process.env.PUBLIC_BASE_URL);
}

/*
 * GET home page.
 */
exports.index = function(req, resp){
  resp.set('Content-Type', 'application/javascript');
  resp.render('towtruck/towtruck.js');

  var visitor = ua(process.env.GA_ACCOUNT);
  visitor.pageview({
    dp: '/towtruck.js', // doc page
    dt: 'TowTruck Include', // doc title
    dr: req.headers.referer
  }).send();
};


exports.js = function(req, resp){
  resp.set('Content-Type', 'application/javascript');
  /*
   * This will look like:
   * /towtruck/(.*?).js
   */
  

  // There may be a more efficient way to do this, but we're ensuring that we 
  // don't get any path messery with ".." etc.
  // TODO: See if this is actually plugging a security hole, or if it's covered 
  //       by express
  var matches = req.path.match(/^\/(towtruck\/[\w\-]+\.js)$/);

  // We only care if we get A-z 0-9 and _
  if (matches){
    resp.render(matches[1], {read: readInclude, includeNotify: true, name: matches[1]});
  }
  else{
    resp.send("404 - Not Found", 404);
  } 
}
