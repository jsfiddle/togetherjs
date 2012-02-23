/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

$(function(){
  var resizeHandler = function(){
    var bodyPadding = parseInt($('body.collaborate').css('padding-top'), 10);
    var footerHeight = 0; //$('footer').height();
    $("#etherpad, #timeline").height($(window).height() - (bodyPadding + footerHeight));
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

  var socket = io.connect([window.location.protocol, '//', window.location.host].join(''));

	// on connection to server, ask for user's name with an anonymous callback
	socket.on('connect', function(){
		socket.emit('adduser', {username: prompt("What's your name?"), 'bundleId': BUNDLE_ID});
	});

	socket.on('updateCollaborators', function(users){
	  console.log({'updateCollaborators': users});

	  var list = $('#collaborators ul');
	  list.empty();
	  for(i in users){
	    list.append($('<li class="alert alert-info">@' + users[i] + '</li>'));
    }
	  $('#collaborators').show();
  });

  socket.on('appendToTimeline', function(username, text){
    console.log(['appendToTimeline', username, text]);
    var term = $('<dt />');
    term.text('@' + username);
    var def = $('<dd />');
    def.html(text);
    $('#timeline dl').append(term).append(def);
    def.find(".FollowMe").click(function(){
      $('#file_tab_nav li.FileTab').removeClass('active');
      $("#" + $(this).attr('data-target-id')).addClass('active');
    });
    $("#timeline").show();
  });


  $(".FileTab a").click(function(){
    console.log($(this));
    var resource = {
      name: $(this).text(),
      href: $(this).attr('href'),
      id: $(this).parent().attr('id')
    };

    socket.emit('openResource', resource)

  });


});
