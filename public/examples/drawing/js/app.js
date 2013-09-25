$(function () {
  var color = "#000";
  $(".swatch").click(function (event) {
    color = $(event.target).css("background-color");
  });
  var start;
  $("#canvas").mousedown(function (event) {
    var base = $("#canvas").offset();
    start = {
      top: event.pageY - base.top,
      left: event.pageX - base.left
    };
  });
  $("#canvas").mouseup(function () {
    start = null;
  });
  $("#canvas").mousemove(function () {
    if (! start) {
      return;
    }
    var ctx = $("#canvas")[0].getContext("2d");
    ctx.beginPath();

});
