/* Co-browsing: moving around the site together
   */
define(["jquery", "util", "session", "ui"], function ($, util, session, ui) {
  var assert = util.assert;

  session.hub.on("hello hello-back", function (msg) {
    if (session.currentUrl() != msg.url) {
      // Someone has browsed somewhere we haven't
      var url = msg.url;
      if (msg.urlHash && msg.urlHash != "#") {
        url += msg.urlHash;
      }
      ui.addChat({
        type: "url-change",
        clientId: msg.clientId,
        url: url
      });
    }
  });

});
