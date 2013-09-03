$(function () {
  var dl = $("#source-toc > dl");
  var showButton = $("#source-toc-show");
  var hideButton = $("#source-toc-hide");
  $("#source-toc header").click(function () {
    console.log("click");
    if (dl.is(":visible")) {
      hideDl();
    } else {
      showDl();
    }
  });
  function showDl() {
    dl.show();
    showButton.hide();
    hideButton.show();
    localStorage.setItem("site.showing", "yes");
  }
  function hideDl() {
    dl.hide();
    showButton.show();
    hideButton.hide();
    localStorage.removeItem("site.showing");
  }
  if (! localStorage.getItem("site.showing")) {
    hideDl();
  } else {
    showDl();
  }
});
