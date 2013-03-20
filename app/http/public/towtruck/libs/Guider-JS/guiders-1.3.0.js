/**
 * guiders.js
 *
 * version 1.3.0
 *
 * Developed at Optimizely. (www.optimizely.com)
 * We make A/B testing you'll actually use.
 *
 * Released under the Apache License 2.0.
 * www.apache.org/licenses/LICENSE-2.0.html
 *
 * Questions about Guiders?
 * You may email me (Jeff Pickhardt) at pickhardt+guiders@gmail.com
 *
 * Questions about Optimizely should be sent to:
 * sales@optimizely.com or support@optimizely.com
 *
 * Enjoy!
 */

(function () {

function init($) {
  var guiders = {};

  guiders.version = "1.3.0";

  guiders._defaultSettings = {
    attachTo: null, // Selector of the element to attach to.
    autoFocus: false, // Determines whether or not the browser scrolls to the element.
    buttons: [{name: "Close"}],
    buttonCustomHTML: "",
    classString: null,
    closeOnEscape: false,
    description: "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
    highlight: null,
    isHashable: true,
    offset: {
      top: null,
      left: null
    },
    onClose: null,
    onHide: null,
    onShow: null,
    overlay: false,
    position: 0, // 1-12 follows an analog clock, 0 means centered.
    shouldSkip: function() {}, // Optional handler allows you to skip a guider if returns true.
    title: "Sample title goes here",
    width: 400,
    xButton: false // This places a closer "x" button in the top right of the guider.
  };

  guiders._htmlSkeleton = [
    "<div class='guider'>",
    "  <div class='guiders_content'>",
    "    <h1 class='guiders_title'></h1>",
    "    <div class='guiders_close'></div>",
    "    <p class='guiders_description'></p>",
    "    <div class='guiders_buttons_container'>",
    "    </div>",
    "  </div>",
    "  <div class='guiders_arrow'>",
    "  </div>",
    "</div>"
  ].join("");

  guiders._arrowSize = 42; // This is the arrow's width and height.
  guiders._backButtonTitle = "Back";
  guiders._buttonAttributes = {"href": "javascript:void(0);"};
  guiders._buttonClassName = "guiders_button"; // Override this if you use a different class name for your buttons.
  guiders._buttonClickEvent = "click touch"; // Using click touch allows this to trigger with iPad/iPhone taps, as well as browser clicks
  guiders._buttonElement = "<a></a>"; // Override this if you want to use a different element for your buttons, like spans.
  guiders._closeButtonTitle = "Close";
  guiders._currentGuiderID = null;
  guiders._fixedOrAbsolute = "fixed";
  guiders._guiders = {};
  guiders._lastCreatedGuiderID = null;
  guiders._nextButtonTitle = "Next";
  guiders._offsetNameMapping = {
    "topLeft": 11,
    "top": 12,
    "topRight": 1,
    "rightTop": 2,
    "right": 3,
    "rightBottom": 4,
    "bottomRight": 5,
    "bottom": 6,
    "bottomLeft": 7,
    "leftBottom": 8,
    "left": 9,
    "leftTop": 10
  };
  guiders._windowHeight = 0;

  // Basic IE browser detection
  var ieBrowserMatch = navigator.userAgent.match('MSIE (.)');
  guiders._isIE = ieBrowserMatch && ieBrowserMatch.length > 1;
  guiders._ieVersion = ieBrowserMatch && ieBrowserMatch.length > 1 ? Number(ieBrowserMatch[1]) : -1;

  guiders._addButtons = function(myGuider) {
    var guiderButtonsContainer = myGuider.elem.find(".guiders_buttons_container");

    if (myGuider.buttons === null || myGuider.buttons.length === 0) {
      guiderButtonsContainer.remove();
      return;
    }

    for (var i = myGuider.buttons.length - 1; i >= 0; i--) {
      var thisButton = myGuider.buttons[i];
      var thisButtonElem = $(guiders._buttonElement,
        $.extend({"class" : guiders._buttonClassName, "html" : thisButton.name }, guiders._buttonAttributes, thisButton.html || {})
      );

      if (typeof thisButton.classString !== "undefined" && thisButton.classString !== null) {
        thisButtonElem.addClass(thisButton.classString);
      }

      guiderButtonsContainer.append(thisButtonElem);

      var thisButtonName = thisButton.name.toLowerCase();
      if (thisButton.onclick) {
        thisButtonElem.bind(guiders._buttonClickEvent, thisButton.onclick);
      } else {
        switch (thisButtonName) {
          case guiders._closeButtonTitle.toLowerCase():
            thisButtonElem.bind(guiders._buttonClickEvent, function () {
              guiders.hideAll();
              if (myGuider.onClose) {
                myGuider.onClose(myGuider, false /* close by button */);
              }
            });
            break;
          case guiders._nextButtonTitle.toLowerCase():
            thisButtonElem.bind(guiders._buttonClickEvent, function () {
              !myGuider.elem.data("locked") && guiders.next();
            });
            break;
          case guiders._backButtonTitle.toLowerCase():
            thisButtonElem.bind(guiders._buttonClickEvent, function () {
              !myGuider.elem.data("locked") && guiders.prev();
            });
            break;
        }
      }
    }

    if (myGuider.buttonCustomHTML !== "") {
      var myCustomHTML = $(myGuider.buttonCustomHTML);
      myGuider.elem.find(".guiders_buttons_container").append(myCustomHTML);
    }

    if (myGuider.buttons.length === 0) {
      guiderButtonsContainer.remove();
    }
  };

  guiders._addXButton = function(myGuider) {
    var xButtonContainer = myGuider.elem.find(".guiders_close");
    var xButton = $("<div></div>", {
      "class" : "guiders_x_button",
      "role" : "button"
    });
    xButtonContainer.append(xButton);
    xButton.click(function() {
      guiders.hideAll();
      if (myGuider.onClose) {
        myGuider.onClose(myGuider, true);
       }
    });
  };

  guiders._wireEscape = function (myGuider) {
    $(document).keydown(function(event) {
      if (event.keyCode == 27 || event.which == 27) {
        guiders.hideAll();
        if (myGuider.onClose) {
          myGuider.onClose(myGuider, true /*close by X/Escape*/);
        }
        return false;
      }
    });
  };

  guiders._unWireEscape = function (myGuider) {
    $(document).unbind("keydown");
  };

  guiders._attach = function(myGuider) {
    if (typeof myGuider !== 'object') {
      return;
    }

    var attachTo = $(myGuider.attachTo);

    var myHeight = myGuider.elem.innerHeight();
    var myWidth = myGuider.elem.innerWidth();

    if (myGuider.position === 0 || attachTo.length === 0) {
      var fixedOrAbsolute = "fixed";
      if (guiders._isIE && guiders._ieVersion < 9) {
        fixedOrAbsolute = "absolute";
      }
      myGuider.elem.css("position", fixedOrAbsolute);
      myGuider.elem.css("top", ($(window).height() - myHeight) / 3 + "px");
      myGuider.elem.css("left", ($(window).width() - myWidth) / 2 + "px");
      return;
    }

    // Otherwise, the guider is positioned relative to the attachTo element.
    var base = attachTo.offset();
    var top = base.top;
    var left = base.left;

    // topMarginOfBody corrects positioning if body has a top margin set on it.
    var topMarginOfBody = $("body").outerHeight(true) - $("body").outerHeight(false);
    top -= topMarginOfBody;

    // Now, take into account how the guider should be positioned relative to the attachTo element.
    // e.g. top left, bottom center, etc.
    if (guiders._offsetNameMapping[myGuider.position]) {
      // As an alternative to the clock model, you can also use keywords to position the guider.
      myGuider.position = guiders._offsetNameMapping[myGuider.position];
    }

    var attachToHeight = attachTo.innerHeight();
    var attachToWidth = attachTo.innerWidth();
    var bufferOffset = 0.9 * guiders._arrowSize;

    // offsetMap follows the form: [height, width]
    var offsetMap = {
      1: [-bufferOffset - myHeight, attachToWidth - myWidth],
      2: [0, bufferOffset + attachToWidth],
      3: [attachToHeight/2 - myHeight/2, bufferOffset + attachToWidth],
      4: [attachToHeight - myHeight, bufferOffset + attachToWidth],
      5: [bufferOffset + attachToHeight, attachToWidth - myWidth],
      6: [bufferOffset + attachToHeight, attachToWidth/2 - myWidth/2],
      7: [bufferOffset + attachToHeight, 0],
      8: [attachToHeight - myHeight, -myWidth - bufferOffset],
      9: [attachToHeight/2 - myHeight/2, -myWidth - bufferOffset],
      10: [0, -myWidth - bufferOffset],
      11: [-bufferOffset - myHeight, 0],
      12: [-bufferOffset - myHeight, attachToWidth/2 - myWidth/2]
    };

    var offset = offsetMap[myGuider.position];
    top += offset[0];
    left += offset[1];

    var positionType = "absolute";
    // If the element you are attaching to is position: fixed, then we will make the guider
    // position: fixed as well.
    if (attachTo.css("position") === "fixed" && guiders._fixedOrAbsolute === "fixed") {
      positionType = "fixed";
      top -= $(window).scrollTop();
      left -= $(window).scrollLeft();
    }

    // If you specify an additional offset parameter when you create the guider, it gets added here.
    if (myGuider.offset.top !== null) {
      top += myGuider.offset.top;
    }
    if (myGuider.offset.left !== null) {
      left += myGuider.offset.left;
    }

    guiders._styleArrow(myGuider);

    // Finally, set the style of the guider and return it!
    myGuider.elem.css({
      "position": positionType,
      "top": top,
      "left": left
    });

    return myGuider;
  };

  guiders._guiderById = function(id) {
    if (typeof guiders._guiders[id] === "undefined") {
      throw "Cannot find guider with id " + id;
    }
    return guiders._guiders[id];
  };

  guiders._showOverlay = function() {
    // This callback is needed to fix an IE opacity bug.
    // See also:
    // http://www.kevinleary.net/jquery-fadein-fadeout-problems-in-internet-explorer/
    $("#guiders_overlay").fadeIn("fast", function(){
      if (this.style.removeAttribute) {
        this.style.removeAttribute("filter");
      }
    });
    if (guiders._isIE) {
      $("#guiders_overlay").css("position", "absolute");
    }
  };

  guiders._highlightElement = function(selector) {
    $(selector).addClass('guiders_highlight');
  };

  guiders._dehighlightElement = function(selector) {
    $(selector).removeClass('guiders_highlight');
  };

  guiders._hideOverlay = function() {
    $("#guiders_overlay").fadeOut("fast");
  };

  guiders._initializeOverlay = function() {
    if ($("#guiders_overlay").length === 0) {
      $("<div id='guiders_overlay'></div>").hide().appendTo("body");
    }
  };

  guiders._styleArrow = function(myGuider) {
    var position = myGuider.position || 0;
    if (!position) {
      return;
    }
    var myGuiderArrow = $(myGuider.elem.find(".guiders_arrow"));
    var newClass = {
      1: "guiders_arrow_down",
      2: "guiders_arrow_left",
      3: "guiders_arrow_left",
      4: "guiders_arrow_left",
      5: "guiders_arrow_up",
      6: "guiders_arrow_up",
      7: "guiders_arrow_up",
      8: "guiders_arrow_right",
      9: "guiders_arrow_right",
      10: "guiders_arrow_right",
      11: "guiders_arrow_down",
      12: "guiders_arrow_down"
    };
    myGuiderArrow.addClass(newClass[position]);

    var myHeight = myGuider.elem.innerHeight();
    var myWidth = myGuider.elem.innerWidth();
    var arrowOffset = guiders._arrowSize / 2;
    var positionMap = {
      1: ["right", arrowOffset],
      2: ["top", arrowOffset],
      3: ["top", myHeight/2 - arrowOffset],
      4: ["bottom", arrowOffset],
      5: ["right", arrowOffset],
      6: ["left", myWidth/2 - arrowOffset],
      7: ["left", arrowOffset],
      8: ["bottom", arrowOffset],
      9: ["top", myHeight/2 - arrowOffset],
      10: ["top", arrowOffset],
      11: ["left", arrowOffset],
      12: ["left", myWidth/2 - arrowOffset]
    };
    position = positionMap[myGuider.position];
    myGuiderArrow.css(position[0], position[1] + "px");
  };

  /**
   * One way to show a guider to new users is to direct new users to a URL such as
   * http://www.mysite.com/myapp#guider=welcome
   *
   * This can also be used to run guiders on multiple pages, by redirecting from
   * one page to another, with the guider id in the hash tag.
   *
   * Alternatively, if you use a session variable or flash messages after sign up,
   * you can add selectively add JavaScript to the page: "guiders.show('first');"
   */
  guiders._showIfHashed = function(myGuider) {
    var GUIDER_HASH_TAG = "guider=";
    var hashIndex = window.location.hash.indexOf(GUIDER_HASH_TAG);
    if (hashIndex !== -1) {
      var hashGuiderId = window.location.hash.substr(hashIndex + GUIDER_HASH_TAG.length);
      if (myGuider.id.toLowerCase() === hashGuiderId.toLowerCase()) {
        guiders.show(myGuider.id);
      }
    }
  };

  guiders.reposition = function() {
    var currentGuider = guiders._guiders[guiders._currentGuiderID];
    guiders._attach(currentGuider);
  };

  guiders.next = function() {
    var currentGuider = guiders._guiders[guiders._currentGuiderID];
    if (typeof currentGuider === "undefined") {
      return;
    }
    currentGuider.elem.data("locked", true);

    var nextGuiderId = currentGuider.next || null;
    if (nextGuiderId !== null && nextGuiderId !== "") {
      var nextGuider = guiders._guiderById(nextGuiderId);
      var omitHidingOverlay = nextGuider.overlay ? true : false;
      guiders.hideAll(omitHidingOverlay, true);
      if (currentGuider && currentGuider.highlight) {
        guiders._dehighlightElement(currentGuider.highlight);
      }
      if (nextGuider.shouldSkip && nextGuider.shouldSkip()) {
        guiders._currentGuiderID = nextGuider.id;
        guiders.next();
        return;
      }
      else {
        guiders.show(nextGuiderId);
      }
    }
  };

  guiders.prev = function () {
    var currentGuider = guiders._guiders[guiders._currentGuiderID];
    if (typeof currentGuider === "undefined") {
      // not what we think it is
      return;
    }
    if (currentGuider.prev === null) {
      // no previous to look at
      return;
    }

    var prevGuider = guiders._guiders[currentGuider.prev];
    prevGuider.elem.data("locked", true);

    // Note we use prevGuider.id as "prevGuider" is _already_ looking at the previous guider
    var prevGuiderId = prevGuider.id || null;
    if (prevGuiderId !== null && prevGuiderId !== "") {
      var myGuider = guiders._guiderById(prevGuiderId);
      var omitHidingOverlay = myGuider.overlay ? true : false;
      guiders.hideAll(omitHidingOverlay, true);
      if (prevGuider && prevGuider.highlight) {
        guiders._dehighlightElement(prevGuider.highlight);
      }
      guiders.show(prevGuiderId);
    }
  };

  guiders.createGuider = function(passedSettings) {
    if (passedSettings === null || passedSettings === undefined) {
      passedSettings = {};
    }

    // Extend those settings with passedSettings
    var myGuider = $.extend({}, guiders._defaultSettings, passedSettings);
    myGuider.id = myGuider.id || String(Math.floor(Math.random() * 1000));

    var guiderElement = $(guiders._htmlSkeleton);
    myGuider.elem = guiderElement;
    if (typeof myGuider.classString !== "undefined" && myGuider.classString !== null) {
      myGuider.elem.addClass(myGuider.classString);
    }
    myGuider.elem.css("width", myGuider.width + "px");

    var guiderTitleContainer = guiderElement.find(".guiders_title");
    guiderTitleContainer.html(myGuider.title);

    guiderElement.find(".guiders_description").html(myGuider.description);

    guiders._addButtons(myGuider);

    if (myGuider.xButton) {
        guiders._addXButton(myGuider);
    }

    guiderElement.hide();
    guiderElement.appendTo("body");
    guiderElement.attr("id", myGuider.id);

    // Ensure myGuider.attachTo is a jQuery element.
    if (typeof myGuider.attachTo !== "undefined" && myGuider !== null) {
      guiders._attach(myGuider);
    }

    guiders._initializeOverlay();

    guiders._guiders[myGuider.id] = myGuider;
    if (guiders._lastCreatedGuiderID !== null) {
      myGuider.prev = guiders._lastCreatedGuiderID;
    }
    guiders._lastCreatedGuiderID = myGuider.id;

    /**
     * If the URL of the current window is of the form
     * http://www.myurl.com/mypage.html#guider=id
     * then show this guider.
     */
    if (myGuider.isHashable) {
      guiders._showIfHashed(myGuider);
    }

    return guiders;
  };

  guiders.hideAll = function(omitHidingOverlay, next) {
    next = next || false;

    $(".guider:visible").each(function(index, elem){
      var myGuider = guiders._guiderById($(elem).attr('id'));
      if (myGuider.onHide) {
        myGuider.onHide(myGuider, next);
      }
    });
    $(".guider").fadeOut("fast");
    var currentGuider = guiders._guiders[guiders._currentGuiderID];
    if (currentGuider && currentGuider.highlight) {
        guiders._dehighlightElement(currentGuider.highlight);
    }
    if (typeof omitHidingOverlay !== "undefined" && omitHidingOverlay === true) {
      // do nothing for now
    } else {
      guiders._hideOverlay();
    }
    return guiders;
  };

  guiders.show = function(id) {
    if (!id && guiders._lastCreatedGuiderID) {
      id = guiders._lastCreatedGuiderID;
    }

    var myGuider = guiders._guiderById(id);
    if (myGuider.overlay) {
      guiders._showOverlay();
      // if guider is attached to an element, make sure it's visible
      if (myGuider.highlight) {
        guiders._highlightElement(myGuider.highlight);
      }
    }

    if (myGuider.closeOnEscape) {
      guiders._wireEscape(myGuider);
    } else {
      guiders._unWireEscape(myGuider);
    }

    // You can use an onShow function to take some action before the guider is shown.
    if (myGuider.onShow) {
      myGuider.onShow(myGuider);
    }
    guiders._attach(myGuider);
    myGuider.elem.fadeIn("fast").data("locked", false);

    guiders._currentGuiderID = id;

    var windowHeight = guiders._windowHeight = $(window).height();
    var scrollHeight = $(window).scrollTop();
    var guiderOffset = myGuider.elem.offset();
    var guiderElemHeight = myGuider.elem.height();

    var isGuiderBelow = (scrollHeight + windowHeight < guiderOffset.top + guiderElemHeight); /* we will need to scroll down */
    var isGuiderAbove = (guiderOffset.top < scrollHeight); /* we will need to scroll up */

    if (myGuider.autoFocus && (isGuiderBelow || isGuiderAbove)) {
      // Sometimes the browser won't scroll if the person just clicked,
      // so let's do this in a setTimeout.
      setTimeout(guiders.scrollToCurrent, 10);
    }

    $(myGuider.elem).trigger("guiders.show");

    return guiders;
  };

  guiders.scrollToCurrent = function() {
    var currentGuider = guiders._guiders[guiders._currentGuiderID];
    if (typeof currentGuider === "undefined") {
      return;
    }

    var windowHeight = guiders._windowHeight;
    var scrollHeight = $(window).scrollTop();
    var guiderOffset = currentGuider.elem.offset();
    var guiderElemHeight = currentGuider.elem.height();

    // Scroll to the guider's position.
    var scrollToHeight = Math.round(Math.max(guiderOffset.top + (guiderElemHeight / 2) - (windowHeight / 2), 0));
    window.scrollTo(0, scrollToHeight);
  };

  // Change the bubble position after browser gets resized
  var _resizing = undefined;
  $(window).resize(function() {
    if (typeof(_resizing) !== "undefined") {
      clearTimeout(_resizing); // Prevents seizures
    }
    _resizing = setTimeout(function() {
      _resizing = undefined;
      if (typeof (guiders) !== "undefined") {
        guiders.reposition();
      }
    }, 20);
  });

  return guiders;
}

if (typeof define == "undefined") {
  window.guiders = init(jQuery);
} else {
  define(["jquery"], init);
}

})();
