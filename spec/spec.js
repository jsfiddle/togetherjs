"use strict";

jQuery.fn.extend({
  // Take the given element containing plain-text source code and
  // rewrite it to highlight the spans mentioned in the data-highlight
  // attributes of elements in the current selection (which is expected to
  // be a human-readable error message). Also highlight said elements with
  // the same color, so it's easy for a reader to visually identify what
  // part of code something in the current selection is referring to.
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

// Because the contents of the page are only fully loaded after the
// browser has processed the URL fragment, we need to "simulate" scrolling
// to the fragment once we've really finished loading the page.
function refreshAnchor() {
  var anchor = window.location.hash.slice(1);
  if (anchor) {
    var anchoredElement = document.getElementById(anchor);
    if (anchoredElement)
      anchoredElement.scrollIntoView();
  }
}

// This function is called by a same-origin parent window that is supposedly
// running a test suite. It delegates the testing of the verification of
// our spec to this window, and therefore must pass in a number of
// QUnit globals.
function runTests(module, test, ok, deepEqual, cb) {
  function safeParse(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  }

  function testSpec() {
    module("Specification correctness");
    $('div.test').each(function() {
      var isFailed = $(this).hasClass("failed");
      var actualJson = $(".result", this).text();
      var expectedJson = $('script[type="application/json"]', this).text();
      test($("h2", this).attr("id") + " error type", function() {
        ok(!isFailed, "error type specification did not fail to execute");
        expectedJson = safeParse(expectedJson);
        ok(expectedJson, "expectedJson is valid JSON");
        actualJson = safeParse(actualJson);
        ok(actualJson, "actualJson is valid JSON");
        deepEqual(actualJson, expectedJson, "expectedJson == actualJson");
      });
    });
  }
  
  var interval = setInterval(function() {
    if ($("html").hasClass("done-loading")) {
      ok(true, "<html> has done-loading class");
      clearInterval(interval);
      testSpec();
      cb();
    }
  }, 100);
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
