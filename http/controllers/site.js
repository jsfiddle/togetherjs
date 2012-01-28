/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * GET home page.
 */

function getBookmarkletHref(){
  //TODO: Cleanup
  var baseCode = "javascript:(function()%7Bvar%20script=document.createElement('script');script.src='http://localhost:3000/bookmarklet.js';script.className='TowTruck';document.head.appendChild(script);%7D)();"
  //TODO: replace localhost:3000 with the appropriate URL.
  return baseCode;
}

exports.index = function(req, res){
  res.render('site', {bodyClass: 'home', layout: false, bookmarkletHref: getBookmarkletHref()});
};

exports.bookmarklet = function(req, res){
  resp.header('Content-Type', 'application/javascript');
  res.render('site/bookmarklet.js.ejs', {layout: false});
};
