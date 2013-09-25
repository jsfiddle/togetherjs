!function ($) {
    $(function(){
      
      function jsUpdateSize(){
          // Get the dimensions of the viewport
          var width = window.innerWidth ||
                      document.documentElement.clientWidth ||
                      document.body.clientWidth;
          var height = window.innerHeight ||
                       document.documentElement.clientHeight ||
                       document.body.clientHeight;

          //document.getElementById('jsWidth').innerHTML = width;  // Display the width
          //document.getElementById('jsHeight').innerHTML = height;// Display the height
          
          if(width <= 480){
            //disable animations
          }
          else{
            //play animations
          }
          
      };
      window.onload = jsUpdateSize;       // When the page first loads
      window.onresize = jsUpdateSize;     // When the browser changes size

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
 
          
          // 1. Add ConnectJS JavaScript and HTML to your site.
          // animate in first 
          startFirstAnimation();
          function startFirstAnimation() {
            $('.how-section-imganim-01').animate({
              left: "60%"
            }, 800).animate({
                opacity: "0"
              }, 800).animate({
                left: "11%"
                }, 7000).animate({
                  opacity: "1"
                  }, startFirstAnimation);
          }
          // animate in second
          startSecondAnimation();
          function startSecondAnimation() {
            $('.how-section-imganim-02').animate({
              left: "60%"
            }, 800).animate({
                opacity: "0"
              }, 800).animate({
                left: "9%"
              }, 7000).animate({
                opacity: "1"
              }, startSecondAnimation);
          
            startFadeInOut();
            function startFadeInOut(){
              $('.how-section-imganim-03').delay(1000).fadeIn().delay(6000).fadeOut(); 
            }

          }
          
        }, { offset: 300, triggerOnce: false });
        
        // 2. Your site is now ConnectJS enabled.
        $('.howto-animation-02').waypoint(function() {   
          
          //startHowAnimation2();
          
          function fadeinDock() {
            $(".how-section-btncollab").fadeOut();  
            $(".how-section-btncollabpressed").fadeIn();
            $(".how-section-dockplacement").fadeIn();
            
          }
            
          function fadeoutDock() {
            $(".how-section-dockplacement").fadeOut();   
            $(".how-section-btncollabpressed").fadeOut();  
            $(".how-section-btncollab").fadeIn(); 
          }
          
          function startit(){
            fadeinDock();
            setTimeout(function () {
              fadeoutDock(); 
              setTimeout(startit, 5000);
              }, 5000)
          }
          
          startit();
          
        }, { offset: 200, triggerOnce: false });
        
        // 3. Your site is now ConnectJS enabled.        
        $('.howto-animation-03').waypoint(function() {
          
          function startCursorAnimation(){
            $('.cursor-placement-01').animate({
              left: "76%"
            }, 800);
            $('.cursor-placement-03').animate({
              left: "40%"
            }, 800);
            setTimeout(function() {
               $('.cursor-placement-02').animate({
                 top: "60%"
               }, 800);
               $('.cursor-placement-04').animate({
                 top: "29%"
               }, 800);  
             }, 1000);
            setTimeout(function() {
                $('.cursor-placement-01').animate({
                  left: "78%"
                }, 800);
                $('.cursor-placement-03').animate({
                  left: "44%"
                }, 800);  
              }, 1000);
              setTimeout(function() {
                 $('.cursor-placement-02').animate({
                   top: "57%"
                 }, 800);
                 $('.cursor-placement-04').animate({
                   top: "27%"
                 }, 800);  
               }, 1000);
            setTimeout(startCursorAnimation, 7000);
            
          }
          startCursorAnimation();
          console.log("animation 3");
          
        }, { offset: 200, triggerOnce: true });
          
    })
}(window.jQuery)

