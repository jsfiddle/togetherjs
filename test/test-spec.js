module("Specification loading");

function testSpec($, window) {
  function safeParse(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  }

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
      deepEqual(actualJson, expectedJson, "expectedJson matches actualJson");
    });
  });
}

asyncTest("frame loads", function() {
  var iframe = document.createElement("iframe");
  iframe.setAttribute("src", "../spec/index.html");
  document.body.appendChild(iframe);
  iframe.style.display = "none";
  iframe.addEventListener("load", function() {
    ok(true, "load event is triggered");
    var $ = iframe.contentWindow.jQuery;
    var interval = setInterval(function() {
      if ($("html").hasClass("done-loading")) {
        ok(true, "<html> has done-loading class");
        clearInterval(interval);
        testSpec($, iframe.contentWindow);
        start();
      }
    }, 100);
  }, false);
});
