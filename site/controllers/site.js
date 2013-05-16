/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * GET home page.
 */
exports.index = function(req, resp){
  resp.render('site/index');
};

exports.catchall = function(req, resp){
  //TODO: Security Review
  // We only care if we get A-z 0-9 "-", "/" and _
  var matches = req.path.match(/^\/([\w\-\_\/]+)$/);

  if (matches){
    resp.render("site/" + matches[1]);
  }
  else{
    resp.send("404 - Not Found", 404);
  }
}
