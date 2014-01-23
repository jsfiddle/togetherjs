/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["jquery"], function ($) {
  // This isn't really a "module" since it just patches jQuery itself

  // FIX ME Animations TO DO
  // walkthrough animations go here
  // animate participant cursor and box popping in when they enter the session
  // animate participant cursor and box popping out when they leave the session
  // animate the participant cursor -> rotate down when they're down the page
  $.fn.rotateCursorDown = function () {
    $('svg').animate({borderSpacing: -150, opacity: 1}, {
      step: function(now, fx) {
        if (fx.prop == "borderSpacing") {
          $(this).css('-webkit-transform', 'rotate('+now+'deg)')
            .css('-moz-transform', 'rotate('+now+'deg)')
            .css('-ms-transform', 'rotate('+now+'deg)')
            .css('-o-transform', 'rotate('+now+'deg)')
            .css('transform', 'rotate('+now+'deg)');
        } else {
          $(this).css(fx.prop, now);
        }
      },
      duration: 500
    }, 'linear').promise().then(function () {
      this.css('-webkit-transform', '');
      this.css('-moz-transform', '');
      this.css('-ms-transform', '');
      this.css('-o-transform', '');
      this.css('transform', '');
      this.css("opacity", "");
    });
  };

  // animate the participant cursor -> rotate up when they're on the same frame as the user
  $.fn.rotateCursorDown = function () {
    $('.togetherjs-cursor svg').animate({borderSpacing: 0, opacity: 1}, {
      step: function(now, fx) {
        if (fx.prop == "borderSpacing") {
          $(this).css('-webkit-transform', 'rotate('+now+'deg)')
            .css('-moz-transform', 'rotate('+now+'deg)')
            .css('-ms-transform', 'rotate('+now+'deg)')
            .css('-o-transform', 'rotate('+now+'deg)')
            .css('transform', 'rotate('+now+'deg)');
        } else {
          $(this).css(fx.prop, now);
        }
      },
      duration: 500
    }, 'linear').promise().then(function () {
      this.css('-webkit-transform', '');
      this.css('-moz-transform', '');
      this.css('-ms-transform', '');
      this.css('-o-transform', '');
      this.css('transform', '');
      this.css("opacity", "");
    });
  };

  // Move notification when another notification slides in //


  /* Pop in window from dock button: */
  $.fn.popinWindow = function () {

    //mobile popout window with no animation
    if($.browser.mobile) {

       //starting position
        this.css({
          left: "0px",
          opacity: 1,
          "zIndex": 8888
        });

        //starting position for arrow
        $('#togetherjs-window-pointer-right').css({
          left: "+=74px",
          opacity: 1,
          "zIndex": 8888
        });

        //animate arrow out
        $('#togetherjs-window-pointer-right').animate({
          opacity: 1,
          left: "-=78px"
        }, {
          duration:60, easing:"linear"
        });
        $('#togetherjs-window-pointer-right').queue();

        //bounce arrow back
        $('#togetherjs-window-pointer-right').animate({
          left:'+=4px'
        }, {
          duration:60, easing:"linear"
        });

        //animate window out
        this.animate({
          opacity: 1,
          left: "0px"
        }, {
          duration:60, easing:"linear"
        });
        this.queue();

        //bounce window back
        this.animate({
          left:'0px'
        }, {
          duration:60, easing:"linear"
        });
    }

    else {

      //starting position
      this.css({
        left: "+=74px",
        opacity: 1,
        "zIndex": 8888
      });

      //starting position for arrow
      $('#togetherjs-window-pointer-right').css({
        left: "+=74px",
        opacity: 1,
        "zIndex": 8888
      });

      //animate arrow out
      $('#togetherjs-window-pointer-right').animate({
        opacity: 1,
        left: "-=78px"
      }, {
        duration:60, easing:"linear"
      });
      $('#togetherjs-window-pointer-right').queue();

      //bounce arrow back
      $('#togetherjs-window-pointer-right').animate({
        left:'+=4px'
      }, {
        duration:60, easing:"linear"
      });

      //animate window out
      this.animate({
        opacity: 1,
        left: "-=78px"
      }, {
        duration:60, easing:"linear"
      });
      this.queue();

      //bounce window back
      this.animate({
        left:'+=4px'
      }, {
        duration:60, easing:"linear"
      });

    }

  };

  /* Slide in notification window: */
  $.fn.slideIn = function () {
    this.css({
      //top: "240px",
      left: "+=74px",
      opacity: 0,
      "zIndex": 8888
    });
    return this.animate({
      "left": "-=74px",
      opacity: 1,
      "zIndex": 9999
    }, "fast");
  };

  /* Used to fade away notification windows + flip the bottom of them out: */
  $.fn.fadeOut = function () {
    this.animate({borderSpacing: -90, opacity: 0.5}, {
      step: function(now, fx) {
        if (fx.prop == "borderSpacing") {
          $(this).css('-webkit-transform', 'perspective( 600px ) rotateX('+now+'deg)')
            .css('-moz-transform', 'perspective( 600px ) rotateX('+now+'deg)')
            .css('-ms-transform', 'perspective( 600px ) rotateX('+now+'deg)')
            .css('-o-transform', 'perspective( 600px ) rotateX('+now+'deg)')
            .css('transform', 'perspective( 600px ) rotateX('+now+'deg)');
        } else {
          $(this).css(fx.prop, now);
        }
      },
      duration: 500
    }, 'linear').promise().then(function () {
      this.css('-webkit-transform', '');
      this.css('-moz-transform', '');
      this.css('-ms-transform', '');
      this.css('-o-transform', '');
      this.css('transform', '');
      this.css("opacity", "");
    });
    return this;
  };

  /* used when user goes down to participant cursor location on screen */
  $.fn.easeTo = function (y) {
    return this.animate({
      scrollTop: y
    }, {
      duration: 400,
      easing: "swing"
    });
  };

  // avatar animate in
  $.fn.animateDockEntry = function () {
    var height = this.height();
    var width = this.width();
    var backgroundSize = height + 4;
    var margin = parseInt(this.css("marginLeft"), 10);

    // set starting position CSS for avatar
    this.css({
      marginLeft: margin + width/2,
      height: 0,
      width: 0,
      backgroundSize: "0 0"
    });

    var self = this;

    //then animate avatar to the actual dimensions, and reset the values
    this.animate({
      marginLeft: margin,
      height: height,
      width: width,
      backgroundSize: backgroundSize
    }, {
      duration: 600
    }).promise().then(function () {
      self.css({
        marginLeft: "",
        height: "",
        width: "",
        backgroundSize: ""
      });
    });
    return this;
  };

  // avatar animate out, reverse of above
  $.fn.animateDockExit = function () {

    // get the current avatar dimenensions
    var height = this.height();
    var width = this.width();
    var backgroundSize = height + 4;
    var margin = parseInt(this.css("marginLeft"), 10);

    //then animate avatar to shrink to nothing, and reset the values again
    // FIXME this needs to animate from the CENTER
    this.animate({
      marginLeft: margin + width/2,
      height: 0,
      width: 0,
      backgroundSize: "0 0",
      opacity: 0
    }, 600 );

    return this;

  };

  $.fn.animateCursorEntry = function () {
    // Make the cursor bubble pop in
  };

  // keyboard typing animation
  $.fn.animateKeyboard = function () {
    var one = this.find(".togetherjs-typing-ellipse-one");
    var two = this.find(".togetherjs-typing-ellipse-two");
    var three = this.find(".togetherjs-typing-ellipse-three");
    var count = -1;
    var run = (function () {
      count = (count+1) % 4;
      if (count === 0) {
        one.css("opacity", 0.5);
        two.css("opacity", 0.5);
        three.css("opacity", 0.5);
      } else if (count == 1) {
        one.css("opacity", 1);
      } else if (count == 2) {
        two.css("opacity", 1);
      } else { // count==3
        three.css("opacity", 1);
      }
    }).bind(this);
    run();
    var interval = setInterval(run, 300);
    this.data("animateKeyboard", interval);
  };

  $.fn.stopKeyboardAnimation = function () {
    clearTimeout(this.data("animateKeyboard"));
    this.data("animateKeyboard", null);
  };

  // FIXME: not sure if this is legit, but at least the modern mobile devices we
  // care about should have this defined:
  if (! $.browser) {
    $.browser = {};
  }
  $.browser.mobile = window.orientation !== undefined;
  if (navigator.userAgent.search(/mobile/i) != -1) {
    // FIXME: At least on the Firefox OS simulator I need this
    $.browser.mobile = true;
  }

  if ($.browser.mobile && window.matchMedia && ! window.matchMedia("screen and (max-screen-width: 480px)").matches) {
    // FIXME: for Firefox OS simulator really:
    document.body.className += " togetherjs-mobile-browser";
  }

});
