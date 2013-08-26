!function ($) {
    $(function(){
      
      //animate Why use ConnectJS?
      $('#tour').waypoint(function() {
          setTimeout(function() {
            $( ".why-connect-01 img" ).animate({
                top: "0",
                opacity: 1
              }, 300);
          }, 0);
          
          setTimeout(function() {
            $( ".why-connect-02 img" ).animate({
                top: "0",
                opacity: 1
              }, 300);
          }, 100);
          
          setTimeout(function() {
            $( ".why-connect-03 img" ).animate({
                top: "0",
                opacity: 1
              }, 300);
          }, 200);

        }, { offset: 300, triggerOnce: true });
  
        //animate How does ConnectJS work?
        $('.howto-animation-01').waypoint(function() {
          
          // 1. Add ConnectJS Javascript and HTML to your site.
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
              $('.how-section-imganim-03').fadeIn();
              });
          
        }, { offset: 300, triggerOnce: true });
        
        // 2. Your site is now ConnectJS enabled.
        $('.howto-animation-02').waypoint(function() {   
          $(".how-section-btncollab").fadeOut();  
          $(".how-section-btncollabpressed").fadeIn();
          setTimeout(function() {
            $(".how-section-dockplacement").fadeIn();     
          }, 1000);        
        }, { offset: 400, triggerOnce: true });
        
        // 3. Your site is now ConnectJS enabled.        
        $('.howto-animation-03').waypoint(function() {
          
          $('.cursor-placement-01').animate({
            left: "-=15"
          }, 800);
          $('.cursor-placement-03').animate({
            left: "-=30"
          }, 800);
          setTimeout(function() {
             $('.cursor-placement-02').animate({
               top: "-=40"
             }, 800);
             $('.cursor-placement-04').animate({
               top: "-=15"
             }, 800);  
               
           }, 1000);
          
          console.log("animation 3");
        }, { offset: 500, triggerOnce: true });
          
    })
}(window.jQuery)

