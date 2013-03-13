$(function () {
  $("#about-toggle").click(function () {
    if ($("#about-group").is(":visible")) {
      $("#about-group").hide();
      $("#about-toggle").text("Essay (+)");
    } else {
      $("#about-group").show();
      $("#about-toggle").text("Essay (-)");
    }
  });
});
