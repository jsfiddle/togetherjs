/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

$(function () {
  $("#start-towtruck").click(function () {
    TowTruck(this, function () {
      var session = require({context: "towtruck"})("session");
      session.on("shareId", function () {
        var other;
        console.log("got shareId", session.shareId, window.name);
        if (window.name == "left") {
          other = "right";
        } else if (window.name == "right") {
          other = "left";
        }
        if (other) {
          console.log("window.open", session.shareUrl(), other);
          window.open("about:blank", other);
          setTimeout(function () {
            window.open(session.shareUrl(), other);
          }, 500);
        }
      });
    });
    return false;
  });
});


$(function () {
  $("#how_it_works_carousel").on("slide", function (event) {
    var allSlides = $(event.target).find(".item");
    var slide = event.relatedTarget;
    var index = Array.prototype.slice.call(allSlides).indexOf(slide);
    $("#how_it_works_indicators li").removeClass("active");
    $("#how_it_works_indicators li[data-slide-index=\"" + index + "\"]").addClass("active");
  });
});
