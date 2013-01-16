/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

routes = {
  site: require('./controllers/site'),
  javascripts: require('./controllers/site')
};


module.exports = function(http){
  http.get('/', routes.site.index)
  http.get('/javascripts/towtruck.js', routes.site.index)
}
