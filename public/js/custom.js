!function ($) {
    $(function(){

        // hero image swap
        // $("img.swap1")
        //      .mouseover(function() {
        //          $(this).fadeIn("slow", function(){
        //            var src = $(this).attr("src").match(/[^\.]+/) + "-overlay.png";
        //            $(this).attr("src", src);
        //          });
        //      })
        //      .mouseout(function() {
        //          var src = $(this).attr("src").replace("-overlay.png", ".png");
        //          $(this).attr("src", src);
        //      });


        // stop youtube from playing on btn close
        $('.video-closebtn').click(function(){
          //alert("tset");
          var myPlayer = document.getElementById('youtubevid');
          myPlayer.stopVideo();
        });

        

        // detect a mobile device
        var isMobile = {
            Android: function() {
                return navigator.userAgent.match(/Android/i);
            },
            BlackBerry: function() {
                return navigator.userAgent.match(/BlackBerry/i);
            },
            iOS: function() {
                return navigator.userAgent.match(/iPhone|iPad|iPod/i);
            },
            Opera: function() {
                return navigator.userAgent.match(/Opera Mini/i);
            },
            Windows: function() {
                return navigator.userAgent.match(/IEMobile/i);
            },
            any: function() {
                return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
            }
        };

          // open up video url
          if(isMobile.any()){

            //play video on mobile a device
             $("#video-area").html('<a href="http://www.youtube.com/embed/hJEq4W0FZQ0?autoplay=1"><img src="images/site-hero-image@2x.png" class="img-responsive"></a>');

            // turn off animations
            jQuery.fx.off = true;
            
            $('#video-area').css("-webkit-animation", "none");
            $('#video-area').css("-moz-animation", "none");
            $('#video-area').css("-ms-animation", "none");
            $('#video-area').css("animation", "none");
            
            $('.hero-header-text').css("-webkit-animation", "none");
            $('.hero-header-text').css("-moz-animation", "none");
            $('.hero-header-text').css("-ms-animation", "none");
            $('.hero-header-text').css("animation", "none");
            
            $('.hero-tagline').css("-webkit-animation", "none");
            $('.hero-tagline').css("-moz-animation", "none");
            $('.hero-tagline').css("-ms-animation", "none");
            $('.hero-tagline').css("animation", "none");
            
            $('.main-get-started').css("-webkit-animation", "none");
            $('.main-get-started').css("-moz-animation", "none");
            $('.main-get-started').css("-ms-animation", "none");
            $('.main-get-started').css("animation", "none");
            
            $( ".howto-animation-01" ).replaceWith( "<div class='col-xs-12'><p><img src='images/togetherjs-how-01-addit.png' alt='...' class='img-rounded img-responsive how-section'></p><h4 class='text-left' style='margin-top:0px'>Add TogetherJS Javascript and HTML to your site.</h4><p class='text-left smtextright'>Just copy and paste TogetherJS's JS library and HTML snippet into your site or app to give it out-of-the-box collaboration tools and features.</p></div>" );
            $( ".howto-animation-02" ).replaceWith( "<div class='col-xs-12'><p><img src='images/togetherjs-how-02-dock-sm@2x.png' alt='...' class='img-rounded img-responsive how-section'></p><h4 class='text-left' style='margin-top:0px'>Your site is now TogetherJS enabled.</h4><p class='text-left smtextleft'>If your users want to collaborate with a friend, they can click the TogetherJS button on your site.</p></div>" );
            $( ".howto-animation-03" ).replaceWith( "<div class='col-xs-12'><p><img src='images/togetherjs-how-03-collaborate-cursors@2x.png' alt='...' class='img-rounded img-responsive how-section'></p><h4 class='text-left' style='margin-top:0px'>Your users can then collaborate in real time!</h4><p class='text-left smtextright'>Your users can send a unique TogetherJS url to a friend.  When the friend opens the link, each user sees the same page and can interact with it together in real time.</p></div>" );
            
            $("#features .col-xs-12.col-sm-6").first().css({
              marginBottom: "-8px",
              paddingBottom: "0px"
            });
            //
            
          }

          else {
            
            
            
            //Video player
            $( "#video-area" ).click(function() {
              $( "#marketing-video" ).fadeIn();
            });

            $( "#marketing-video" ).click(function() {
              $( "#marketing-video" ).fadeOut();
            });

            $( ".video-closebtn" ).click(function() {
              $( "#marketing-video" ).fadeOut();
            });

          }

    })
}(window.jQuery)





// hover effect over video player
  // $('#main-image').on('mouseenter', function() {
  //         $(this).fadeOut('slow');
  //         $('#main-image-overlay').fadeIn('slow');
  // });
  //
  // $('#main-image-overlay').css({left: $('#main-image').position().left, top: $('#main-image').position().top})
  //            .on('mouseleave', function() {
  //         $(this).fadeOut('slow');
  //         $('#main-image').fadeIn('slow');
  // });


// press Escape to close the video player
// $(document).keyup(function(e) {
//
//   if (e.keyCode == 27) {
//     $( "#marketing-video" ).fadeOut();
//   }   // esc
//
// });

// Handler for the Get Help button, to check that help is actually available
$(function () {
  var inviteChannel = "https://hub.togetherjs.com/hub/developers";
  var $help = $("#get-help");
  if (! $help.length) {
    // No button on this page
    return;
  }
  $help.click(TogetherJS);
  TogetherJS.checkForUsersOnChannel(inviteChannel, function (n) {
    if (n === 0) {
      $help.prop("disabled", true);
      $help.attr("title", "Sorry, no one is currently available");
      // FIXME: should grey out the invite text too
      $("#nobody-home").show();
    }
  });
  TogetherJS.on("ready", function () {
    TogetherJS.require(["who", "session"], function (who, session) {
      if (session.firstRun) {
        who.invite(inviteChannel, null);
      }
    });
  });
});

// Keeps the invite popup from happening, since the invite will automatically
// be sent to the Get Help developers
window.TogetherJSConfig_suppressInvite = true;
