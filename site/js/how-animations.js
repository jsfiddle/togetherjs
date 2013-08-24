!function ($) {
    $(function(){
      
        $('#tour').waypoint(function() {
                 
          $( ".why-connect-01 img" ).animate({
              top: "0",
              opacity: 1
            }, 500);
        
          $( ".why-connect-02 img" ).animate({
              top: "0",
              opacity: 1
            }, 500);

          $( ".why-connect-03 img" ).animate({
              top: "0",
              opacity: 1
            }, 500);
          
        }, { offset: 200, triggerOnce: true });

        $('.howto-animation-01').waypoint(function() {
          console.log("animation 1");
        });
        
        $('.howto-animation-02').waypoint(function() {
          console.log("animation 2");
        });
        
        $('.howto-animation-03').waypoint(function() {
          console.log("animation 3");
        });
          
    })
}(window.jQuery)

