!function ($) {
    $(function(){
      
      //animate Why use ConnectJS?
      
      $('#tour').waypoint(function() {
          //animate this...
          $( ".why-connect-01 img" ).animate({
              top: "0",
              opacity: 1
            }, 300).queue(function(){
              // then this...
              $( ".why-connect-02 img" ).animate({
                  top: "0",
                  opacity: 1
                }, 300).queue(function(){ 
                  // then this...
                  $( ".why-connect-03 img" ).animate({
                      top: "0",
                      opacity: 1
                    }, 300);
                  });
              });
        }, { offset: 300, triggerOnce: true });

        //animate How does ConnectJS work?
        $('.howto-animation-01').waypoint(function() {
          
          // Add ConnectJS Javascript and HTML to your site.
          $('.how-section-imganim-01').animate({
            left: "350"
          }, 800).animate({
              opacity: "0"
            }, 800);
            
          $('.how-section-imganim-02').animate({
            left: "350"
          }, 800).animate({
              opacity: "0"
            }, 800).queue(function(){ 
              
              //animate in the button
              alert("animate button");
              
              });
          
        }, { offset: 300, triggerOnce: true });
        
        $('.howto-animation-02').waypoint(function() {
          console.log("animation 2");
        });
        
        $('.howto-animation-03').waypoint(function() {
          console.log("animation 3");
        });
          
    })
}(window.jQuery)

