$(function () {
  $("#start-towtruck").click(function () {
    TowTruck(function () {
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
