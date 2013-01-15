defineTests([
  "fc/publisher",
  "text!test/publisher/pre-publish.html",
  "text!test/publisher/post-publish.html"
], function(Publisher, prePublish, postPublish) {
  module("Publisher");

  fixDoctypeHeadBodyMunging = Publisher._fixDoctypeHeadBodyMunging;
  
  test("fixDoctypeHeadBodyMunging() works", function() {
    equal(fixDoctypeHeadBodyMunging(postPublish), prePublish);
  });

  test("fixDoctypeHeadBodyMunging() ignores non-munged strings", function() {
    var html = '<!DOCTYPE html><html><head></head><body>hi</body></html>';
    equal(fixDoctypeHeadBodyMunging(html), html);
  });
});
