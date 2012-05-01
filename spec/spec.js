jQuery.fn.extend({
  showHighlights: function(source) {
    function sourceText(interval) {
      return source.text().slice(interval.start, interval.end);
    }
    
    var newSource = $("<div></div>"),
        slices = [],
        i = 0;
    this.eachErrorHighlight(function(start, end, n) {
      slices.push({
        start: start,
        end: end,
        linkedNode: this
      });
      $(this).attr("class", "color-" + (n + 1));
    });
    slices.sort(function(a, b) { return a.start - b.start; });
    jQuery.each(slices, function(n, slice) {
      var color = $(slice.linkedNode).attr("class"),
          span = $("<span></span>");
      if (slice.start > i) {
        newSource.append(document.createTextNode(sourceText({
          start: i,
          end: slice.start
        })));
      }
      span.addClass(color)
        .text(sourceText(slice))
        .appendTo(newSource);
      i = slice.end;
    });
    if (i < source.text().length) {
      newSource.append(document.createTextNode(sourceText({
        start: i,
        end: undefined
      })));
    }
    source.html(newSource.html());
    return this;
  }
});

function refreshAnchor() {
  var anchor = window.location.hash.slice(1);
  if (anchor) {
    var anchoredElement = document.getElementById(anchor);
    if (anchoredElement)
      anchoredElement.scrollIntoView();
  }
}

$(window).ready(function() {
  jQuery.loadErrors("", ["base", "forbidjs"], function() {
    $('div.test').each(function() {
      var badHtmlElement = $('script[type="text/x-bad-html"]', this);

      if (badHtmlElement.length == 0)
        badHtmlElement = $('div.bad-html', this);
      
      var badHtml = badHtmlElement.text().trim();
      var t = $("#templates .report").clone();
      var js = $('div.js', this).text().trim();
      var expect = $('script[type="application/json"]', this).text();
      var error, expectedError, expectedErrorType;

      if (expect) {
        expectedError = JSON.parse(expect);
        expectedErrorType = expectedError.type;
      }
      
      if (!js)
        js = $(".js > div:first-child", t).text();
      js = js.replace("{{HTML}}", JSON.stringify(badHtml));
      $(".js > div:first-child", t).text(js);
      $(".html", t).text(badHtml);
      try {
        error = eval(js);
      } catch (e) {
        $(this).addClass("failed");
        $("h2", t).text(expectedErrorType || "UNKNOWN");
        $(".result", t).text(e.toString());
        badHtmlElement.replaceWith(t);
        return;
      }
      
      expectedErrorType = expectedErrorType || error.type;
      $("h2", t).text(expectedErrorType).attr("id", expectedErrorType);

      var errMsg = $(".error", t);
      try {
        errMsg.fillError(error);
      } catch (e) {
        $(this).addClass("failed");
        errMsg.text("ERROR: " + e.message);
      }
      errMsg.showHighlights($(".html", t));
      badHtmlElement.replaceWith(t);
      
      // Set the result last, as this effectively tells the test
      // suite that this test didn't throw an exception.
      $(".result", t).text(JSON.stringify(error, null, "  "));
    });
    refreshAnchor();
    $("html").addClass("done-loading");
  });
});
