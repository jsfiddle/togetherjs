module("Specification loading");

function testSpec($, window) {
  module("Specification correctness");
  $('div.test').each(function() {
    var actualJson = $(".result", this).text();
    var expectedJson = $('script[type="application/json"]', this).text();
    test($("h2", this).attr("id") + " error type", function() {
      expectedJson = JSON.parse(expectedJson);
      ok(expectedJson, "expectedJson is valid JSON");
      actualJson = JSON.parse(actualJson);
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
