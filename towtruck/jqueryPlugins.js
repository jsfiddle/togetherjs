/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["jquery"], function ($) {
  // This isn't really a "module" since it just patches jQuery itself
  
  // walkthrough animations go here
  
  // animate avatar popping into the dock when they enter the session / telescope in the avatar
  // animate participant cursor and box popping in when they enter the session
  
  // animate avatar exiting the dock when the exit the session/ telescope out the avatar
  // animate participant cursor and box popping out when they leave the session
  
  // animate the participant cursor -> rotate down when they're down the page
  // animate the participant cursor -> rotate up when they're on the same frame as the user
  
  // animate participant typing
  
  /* Pop in window from dock button: */
  $.fn.popinWindow = function () {
    return this.animate({
      opacity: 0,
      right: '+=50'
    }, {
      duration: 400,
      easing: "linear"
    });
  };
  
  /* Slide in notification window: */
  $.fn.slideIn = function () {
    console.log("executing slideIn on", this)
    this.css({
      left: "+=74px",
      opacity: 1,
      "zIndex": 8888
    })
    return this.animate({
      "left": "-=74px",
       opacity: 1,
       "zIndex": 9999
      }, "fast");
  };

  /* Used to fade away notification windows: */
  $.fn.fadeOut = function (time) {
    return this.animate({
      opacity: 0
    }, {
      duration: time || 1000,
      easing: "linear"
    });
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

});
