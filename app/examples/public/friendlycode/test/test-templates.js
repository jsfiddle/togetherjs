"use strict";

defineTests(["template!error-msg", "template!help-msg"], function(err, help) {
  module("templates");

  function contains(str, terms) {
    if (typeof(terms) == "string")
      terms = [terms];
    terms.forEach(function(term) {
      ok(str.indexOf(term) != -1, "'" + term + "' is in " + 
         JSON.stringify(str));
    });
  }
  
  test("error template works", function() {
    contains(err({error: "<p>yo</p>"}), "<p>yo</p>")
  });
  
  test("help template works", function() {
    contains(help({
      html: "<i>hi</i>",
      type: "nom",
      url: "meh<"
    }), ["<i>hi</i>", "meh&lt;"]);

    contains(help({
      html: "<i>hi</i>",
      type: "cssSelector",
      matchCount: 5,
      url: "meh<"
    }), ["5", "<i>hi</i>", "meh&lt;"]);
  });
});
