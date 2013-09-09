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
             $("#video-area").html('<a href="http://player.vimeo.com/video/64117317?byline=0&portrait=0&title=0&autoplay=1"><img src="images/site-hero-image-01@2x-overlay@2x.png" class="img-responsive"></a>');

            //alert('test');
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
  var inviteChannel = "https://hub.towtruck.mozillalabs.com/hub/developers";
  inviteChannel = "http://localhost:8080/hub/developers";
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
