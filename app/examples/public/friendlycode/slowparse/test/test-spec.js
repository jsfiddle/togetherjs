module("Specification loading");

asyncTest("frame loads", function() {
  var iframe = document.createElement("iframe");
  iframe.setAttribute("src", "../spec/index.html");
  document.body.appendChild(iframe);
  iframe.style.display = "none";
  iframe.addEventListener("load", function() {
    ok(true, "load event is triggered");
    iframe.contentWindow.runTests(module, test, ok, deepEqual, start);
  }, false);
});
