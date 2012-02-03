/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const
config = require('../../lib/configuration');


function getBookmarkletHref(){
  //TODO: Cleanup
  var baseCode = "javascript:(function()%7Bvar%20script=document.createElement('script');script.src='" + 
                 config.get('public_url') + 
                 "/bookmarklet.js';script.className='TowTruck';document.head.appendChild(script);%7D)();"

  return baseCode;
}

/*
 * GET home page.
 */
exports.index = function(req, res){
  res.render('site', {bodyClass: 'home', layout: false, bookmarkletHref: getBookmarkletHref()});
};

/*
 * GET /bookmarklet.js
 */
exports.bookmarklet = function(req, res){
  res.header('Content-Type', 'application/javascript');
  res.render('site/bookmarklet.js.ejs', {layout: false, baseUrl: config.get('public_url')});
};
