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

  var carousel = $('.carousel').carousel({
    interval: false
  });

  $('ol#how_it_works_indicators li').click(function(a,b,c){
    carousel.carousel(parseInt($(this).attr('data-slide-index')));
    $('ol#how_it_works_indicators li').removeClass('active');
    $(this).addClass('active');
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

  // animateCursor();

  $('.copy-input').click(function(){
    $(this).select();
  });

  /* Vimeo player on index.ejs */
  if ($('#modal_vimeo_iframe').length){
    var player = $f($('#modal_vimeo_iframe')[0]);

    var playOnLoad = false;

    $('a#show_video_modal').click(function(){
      // This won't play if the player isn't ready
      player.api('play');
      playOnLoad = true;
    });

    player.addEvent('ready', function() {
      // We play if we already tried to open, but the player wasn't ready
      if (playOnLoad){
        player.api('play');
      }

      //TODO: Possibly close modal when video is finished and scroll to example
      // player.addEvent('finish', onFinish);
    });

    $('#close_vimeo_modal').click(function() {
      player.api('pause');
    });
  }
});
