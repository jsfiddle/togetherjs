(function(jQuery) {
  "use strict";

  var $ = jQuery;
  
  var TAG_COLORS = [
    "#C60C46",
    "#00AEEF",
    "#F3739B",
    "#FF66FF",
    "#E66124",
    "#FFC328",
    "#B2E725",
    "#660066",
    "#FF9900"
  ];

  var NUM_TAG_COLORS = TAG_COLORS.length;

  var TAG_COLOR_MAP = {
    img: 0,
    p: 1,
    div: 2,
    a: 3,
    span: 4,
    body: 5,
    h1: 6,
    html: 7,
    footer: 8
  };

  var DEFAULT_OVERLAY_OPACITY = 0.7;

  function tagNameToNumber(tagName) {
    var total = 0;
    for (var i = 0; i < tagName.length; i++)
      total += tagName.charCodeAt(i);
    return total;
  }

  jQuery.extend({
    // This is only really exported so unit tests can use it.
    NUM_TAG_COLORS: NUM_TAG_COLORS,

    // Returns the color hex for the "official" Web X-Ray color
    // for the given tag name, excluding angled brackets.
    colorForTag: function colorForTag(tagName) {
      var colorNumber;

      tagName = tagName.toLowerCase();
      if (tagName in TAG_COLOR_MAP)
        colorNumber = TAG_COLOR_MAP[tagName];
      else
        colorNumber = (tagNameToNumber(tagName) % NUM_TAG_COLORS);

      return TAG_COLORS[colorNumber];
    }
  });

  jQuery.fn.extend({
    // Applies the "official" Web X-Ray color for fromElement to
    // the current set of matched elements with the given
    // optional opacity. Returns the current set of matched
    // elements to support chaining.
    applyTagColor: function applyTagColor(fromElement, opacity) {
      var bgColor;
      var baseColor = $.colorForTag($(fromElement).get(0).nodeName);

      if (opacity === undefined)
        opacity = DEFAULT_OVERLAY_OPACITY;

      bgColor = $.makeRGBA(baseColor, opacity);

      this.css({backgroundColor: bgColor});
      return this;
    },
    // Like $.overlay(), but applies the "official" Web X-Ray color
    // for the element type being overlaid, with the given opacity.
    // A default opacity is used if none is provided.
    overlayWithTagColor: function overlayWithTagColor(opacity) {
      return $(this).overlay().applyTagColor(this, opacity);
    }
  });
})(jQuery);
