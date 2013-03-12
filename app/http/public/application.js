/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

$(function(){
  $("#login").click(function(){
    navigator.id.request();
    return false;
  });

  $("#logout").click(function(){
    navigator.id.logout();
    return false;
  });

  $("#year").text((new Date).getFullYear());

  $('.carousel').carousel({
    interval: 0
  });

  var cursorPositions = [
    {top: 150, left: 50},
    {top: 340, left: 160},
    {top: 220, left: 190},
    {top: 90, left: 80}
  ];

  var animateCursor = function(){
    var cursor = $('#towtruck_demo_cursor');
    var position = cursorPositions.pop();
    cursorPositions.unshift(position);
    cursor.animate(position, 'slow', function(){
      setTimeout(animateCursor, 900);
    });
  };

  animateCursor();

  $('.copy-input').click(function(){
    $(this).select();
  });
});
