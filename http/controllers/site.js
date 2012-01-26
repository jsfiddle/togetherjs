
/*
 * GET home page.
 */

function getBookmarklet(){
  var baseCode = "javascript:(function()%7Bvar%20script=document.createElement('script');script.src='http://localhost:3000/javascripts/towtruck.js';script.className='TowTruck';document.head.appendChild(script);%7D)();"
  //TODO: replace localhost:3000 with the appropriate URL.
  return baseCode;
}

exports.index = function(req, res){
  res.render('site/index', {bodyClass: 'home', layout: false, bookmarkletHref: getBookmarklet()})
};