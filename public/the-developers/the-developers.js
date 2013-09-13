$(function () {

  TogetherJS.hub.on("togetherjs.invite", function (msg) {
    var div = $("<div />");
    div.text("Invite from: " + msg.userInfo.name + " at " + (new Date()) + " ");
    div.append($("<a />").attr("href", msg.url).text(msg.url));
    $("#record").append(div);
  });

});
