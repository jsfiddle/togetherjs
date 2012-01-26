/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
 
$(function(){
  var resizeHandler = function(){
    $("#etherpad").height($(window).height() - 180);
  };
  $(window).resize(resizeHandler);
  resizeHandler();
  
  $('.share-url').click(function(){
    return false;
  });
  $('input.share').click(function(){
    $(this).focus().select();
  });
  
  $('li.FileTab a').click(function(){
    $('#file_tab_nav li.FileTab').removeClass('active');
    $(this).parent().addClass('active');
  });
});
