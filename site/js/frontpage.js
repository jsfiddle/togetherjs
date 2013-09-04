$(function () {
  $(".modal").on("show.bs.modal", function () {
    var iframes = $(this).find(".delay-open");
    iframes.each(function () {
      $(this).attr("src", $(this).attr("data-delay-src"));
    });
  });
});
