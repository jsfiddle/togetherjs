
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

// $(document).keyup(function(e) {
// 
//   if (e.keyCode == 27) {
//     $( "#marketing-video" ).fadeOut();
//   }   // esc
// 
// });
