_.templateSettings = {
  escape: /\{\{(.+?)\}\}/g
};

jQuery.fn.extend({
  showHighlights: function(source) {
    function sourceText(interval) {
      return source.text().slice(interval.start, interval.end);
    }
    
    var newSource = $("<div></div>"),
        slices = [],
        i = 0;
    this.find("[data-highlight]").each(function(n) {
      var parts = $(this).attr("data-highlight").split(",");
      slices.push({
        start: parseInt(parts[0]),
        end: parts[1] ? parseInt(parts[1]) : undefined,
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
  $("#templates .error-msgs").load("error-msgs.html", function() {
    $('div.test').each(function() {
      var badHtmlElement = $('script[type="text/x-bad-html"]', this);
      var badHtml = badHtmlElement.text().trim();
      var t = $("#templates .report").clone();
      var js = $(".js > div:first-child", t).text();
      var error;

      js = js.replace("{{HTML}}", JSON.stringify(badHtml));
      $(".js > div:first-child", t).text(js);
      $(".html", t).text(badHtml);
      try {
        error = Slowparse.HTML(document, badHtml).error;
      } catch (e) {
        $(this).addClass("failed");
        $("h2", t).text("");
        $(".result", t).text(e.toString());
        badHtmlElement.replaceWith(t);
        return;
      }
      
      $("h2", t).text(error.type).attr("id", error.type);
      $(".result", t).text(JSON.stringify(error, null, "  "));

      var errMsg = $("#templates .error-msg." + error.type);
      if (errMsg.length) {
        $(".error", t).html(_.template(errMsg.html(), error))
          .showHighlights($(".html", t));
      } else
        $(".error", t).text("ERROR: No error message available.");

      badHtmlElement.replaceWith(t);
    });
    refreshAnchor();
    $("html").addClass("done-loading");
  });
});
