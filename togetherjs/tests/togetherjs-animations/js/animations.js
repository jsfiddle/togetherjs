   // Methods
  
    function participantScaleUp() {
      $('#participant-avatar').transition({ opacity: 1, scale: 2 });
    }
  
    function participantScaleDown() {
      $('#participant-avatar').transition({ opacity: 0, scale: 0 });
    }

  	function notificationSlideIn() {
  	  $('#notification').css({
        left: "+=84px",
        opacity: 0,
        "zIndex": 8888
      });
      $('#notification').animate({
        "left": "-=164px",
         opacity: 1,
         "zIndex": 9999
        }, "fast");
    };
  
    function notificationSlideInParticipantLeave() {
  	  $('#notification2').css({
        left: "+=84px",
        opacity: 0,
        "zIndex": 8888
      });
      $('#notification2').animate({
        "left": "-=164px",
         opacity: 1,
         "zIndex": 9999
        }, "fast");
    };
    
    function notificationChat() {
  	  $('#notification3').css({
        left: "+=84px",
        opacity: 0,
        "zIndex": 8888
      });
      $('#notification3').animate({
        "left": "-=164px",
         opacity: 1,
         "zIndex": 9999
        }, "fast");
    };
  
    function closeNotification() {
  	  $('#notification').transition({
        perspective: '300px',
        rotateX: '-90deg',
        delay: 3000,
        opacity: 0
      });
    };
  
    function closeNotification2() {
  	  $('#notification2').transition({
        perspective: '300px',
        rotateX: '-90deg',
        delay: 3000,
        opacity: 0
      });
    };
    
    function closeNotification3() {
  	  $('#notification3').transition({
        perspective: '300px',
        rotateX: '-90deg',
        opacity: 0
      });
    };
  
    function cursorPopIn() {
      scaleUp($("#participant-box"), 10);
    }
  
    function cursorPopOut() {
      $("#participant-box")
        .transition({ opacity: 0, scale: 0 })
    }
  
    function scaleUp(el, size) {
      var height = el.height();
      var width = el.width();
      var buffer = size / 2;
      el.animate({
        opacity: 1,
        width: (width + size) + "px",
        height: (height + size) + "px",
        marginLeft: -buffer + "px",
        paddingLeft: buffer + "px"
      }).animate({
        width: width + "px",
        height: height + "px",
        marginLeft: 0,
        paddingLeft: 0
      });
    }
  	 
    // Objects	  
    
    //chat notification
    function chatnotification() {
  	  notificationChat();
  	  closeNotification();
    };
  
    // when the participant enters the session
    function participantEnter() {
  	  notificationSlideIn();
  	  participantScaleUp();
  	  closeNotification();
  	  cursorPopIn();
    };
  
    // when the participant leaves the session
    function participantLeave() {
      notificationSlideInParticipantLeave();
      participantScaleDown();
      closeNotification2();
      cursorPopOut();
    }
  
    // when the participant is down the page or up the page
    function participantCursorRotateDown() {
      $('#participant-cursor').transition({
        rotate: '-180deg'
      });
    }
  
    // when the user is at the same location as the participant
    function participantCursorRotateUp() {
      $('#participant-cursor').transition({
        rotate: '-30deg'
      });
    }
  
    // NEEDS WORK when user presses a button in the dock to popout a window
    function windowPopOut() {
      $("#windowpopout")
        //.css({ transformOrigin: '100px 50px' })
        .transition({ x: '-110', y: '100', opacity: 1, scale: 2.2 }, 100, 'ease')
        .transition({ scale: 2 }, 100, 'ease')
    }
  
    // when the participant is typing
    function participantTyping() {
      var count = 0;
      
      setInterval(function(){
        count++;
        document.getElementById('participant-typing').innerHTML = new Array(count % 5).join('.');
      }, 150);
      
    }
    
    function transformPers() {
      alert("transform");
      
    }
