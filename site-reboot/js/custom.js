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

  if(isMobile.any()){
  
    //play video on mobile a device
    $( "#video-area" ).click(function() {
      //auto play video
      window.location = "http://vimeo.com/64117317";
    });
  
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



// press Escape to close the video player
// $(document).keyup(function(e) {
// 
//   if (e.keyCode == 27) {
//     $( "#marketing-video" ).fadeOut();
//   }   // esc
// 
// });
