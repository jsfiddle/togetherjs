"use strict";

define(function (require) {
  var $ = require("jquery"),
      ErrorDialogTemplate = require("template!error-dialog");
  
  return function(options) {
    var self = {},
        div = options.container,
        errorDialog = $(ErrorDialogTemplate()).appendTo(div);

    var hideModals = function() {
      div.find(".modal-overlay").fadeOut();
    }
    
    /**
     * When someone clicks on the darkening-overlay, rather
     * than the modal dialog, close the modal dialog again.
     */
    div.on("click", ".modal-overlay", function(event) { 
      if (event.target === this)
        $(this).fadeOut(); 
    });

    div.on("click", "[data-close-modal]", hideModals);

    /**
     * The escape key should univerally close modal dialogs
     */ 
    $(document).keyup(function(event) {
      if (event.keyCode == 27)
        hideModals();
    });
    
    self.add = function() {
      for (var i = 0; i < arguments.length; i++)
        div.append(arguments[i]);
    };
    
    self.showErrorDialog = function(options) {
      $(".error-text", errorDialog).text(options.text);
      errorDialog.show();
    };
    
    return self;
  };
});
