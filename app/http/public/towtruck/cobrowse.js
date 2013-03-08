/* Co-browsing: moving around the site together
   */
define(["jquery", "util", "session", "ui"], function ($, util, session, ui) {
  var assert = util.assert;

  session.peers.on("peer-url-change", function (change) {
    var peer = ui.Peer.get(change.clientId);
    var c = "towtruck-url-change-" + util.safeClassName(change.clientId);
    var changer = $("." + c);
    if (change.myUrl == change.url) {
      peer.removeUrl();
      return;
    }
    var force = change.url != change.oldUrl;
    peer.updateUrl(change.url, change.title, force);
  });

  session.hub.on("url-change-nudge", function (msg) {
    if (msg.to && msg.to != session.clientId) {
      // Not for us
      return;
    }
    var peer = ui.Peer.get(msg.clientId);
    peer.urlNudge();
  });

});
