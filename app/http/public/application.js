/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

$(function(){
  navigator.id.watch({
    loggedInUser: currentUser,
    onlogin: function(assertion) {
      $.ajax({
        type: 'POST',
        url: '/persona/verify',
        data: {assertion: assertion},
        success: function(res, status, xhr) {
          window.location.reload();
        },
        error: function(xhr, status, err) { alert("Login failure: " + err); }
      });
    },
    onlogout: function() {
      // A user has logged out! Here you need to:
      // Tear down the user's session by redirecting the user or making a call to your backend.
      // Also, make sure loggedInUser will get set to null on the next page load.
      // (That's a literal JavaScript null. Not false, 0, or undefined. null.)
      $.ajax({
        type: 'POST',
        url: '/persona/logout',
        success: function(res, status, xhr) { 
          window.location.reload();
        },
        error: function(xhr, status, err) { alert("Logout failure: " + err); }
      });
    }
  });
  
  $("#login").click(function(){
    navigator.id.request();
    return false;
  });

  $("#logout").click(function(){
    navigator.id.logout();
    return false;
  });
});
