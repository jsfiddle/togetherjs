"use strict";

define(["jquery", "fc/prefs"], function($, Preferences) {
  return function(options) {
    var codeMirror = options.codeMirror;
    var navItem = options.navItem;
    var menu = navItem.find("ul");
    var menuItems = menu.find("li");
    
    function menuItem(size) {
      var item = $("li[data-size=" + size + "]", menu);
      return item.length ? item : null;
    }
    
    Preferences.on("change:textSize", function() {
      var size = $("li[data-default-size]", menu).attr("data-size");
      var prefSize = Preferences.get("textSize");
      if (prefSize && typeof(prefSize) == "string" && menuItem(prefSize))
        size = prefSize;
      
      $(codeMirror.getWrapperElement()).attr("data-size", size);
      codeMirror.refresh();

      // Reparse as well, in case there were any errors.
      codeMirror.reparse();

      // Mark text size in drop-down.
      menuItems.removeClass("selected");
      menuItem(size).addClass("selected");
    });

    /**
     * Show or hide the font size drop-down menu
     */
    navItem.hover(function() {
      var t = $(this),
          lp = t.position().left;
      menu.css("display","inline")
        .css("left", (lp-1) + "px").css("top","7px");
      return false;
    }, function() {
      menu.hide();
    });

    /**
     * bind the resize behaviour to the various text resize options
     */
    menuItems.click(function() {
      Preferences.set("textSize", $(this).attr("data-size"));
      Preferences.save();
      menu.hide();
    });
    
    Preferences.trigger("change:textSize");
  };
});
