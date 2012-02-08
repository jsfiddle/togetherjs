/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const
config = require('../../lib/configuration');


function getBookmarkletHref(){
  //TODO: Cleanup
  var baseCode = "javascript:(function()%7Bvar%20script=document.createElement('script');script.src='" + 
                 config.get('public_url') + 
                 "/bookmarklet.js';script.className='tow-truck';document.head.appendChild(script);%7D)();"

  return baseCode;
}

/*
 * GET home page.
 */
exports.index = function(req, res){
  var environmentTag = '';
  if (config.get('env') != 'production'){
    environmentTag = '[' + config.get('env').substring(0, 3) + ']';
  }
  res.render('site', {bodyClass: 'home', layout: false, bookmarkletHref: getBookmarkletHref(), 'environmentTag': environmentTag});
};

/*
 * GET /bookmarklet.js
 */
exports.bookmarklet = function(req, resp){
  resp.header('Access-Control-Allow-Origin', '*');
  resp.header('Content-Type', 'application/javascript');
  resp.render('site/bookmarklet.js.ejs', {layout: false, baseUrl: config.get('public_url')});
};

exports.allowCorsRequests = function(req, resp){
  resp.header('Access-Control-Allow-Origin', '*');
  resp.send('');
};
