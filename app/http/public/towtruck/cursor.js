/* Cursor viewing support
   */
define(["jquery", "ui", "util", "session", "element-finder", "tinycolor"], function ($, ui, util, session, elementFinder, tinycolor) {
  var cursor = util.Module("cursor");
  var assert = util.assert;
  var AssertionError = util.AssertionError;

  var cursors = {};
  var CURSOR_SIZE = {height: 10, width: 10};
  var FOREGROUND_COLORS = ["#111", "#eee"];

  session.hub.on("cursor-update", function (msg) {
    var c = cursors[msg.clientId];
    if (! c) {
      cursors[msg.clientId] = c = Cursor(msg.clientId);
    }
    c.updatePosition(msg);
  });

  // FIXME: should check for a peer leaving and remove the cursor object

  var Cursor = util.Class({
    constructor: function (clientId) {
      this.clientId = clientId;
      // FIXME: should track updates:
      this.peer = session.peers.get(clientId);
      this.element = ui.cloneTemplate("cursor");
      this.element.css({color: this.peer.color});
      var name = this.element.find(".towtruck-cursor-name");
      assert(name.length);
      name.text(this.peer.nickname);
      name.css({
        backgroundColor: this.peer.color,
        color: tinycolor.mostReadable(this.peer.color, FOREGROUND_COLORS)
      });
      console.log(this.element[0].outerHTML);
      //console.log("inserted", this.element[0].outerHTML);
      $(document.body).append(this.element);
    },
    updatePosition: function (pos) {
      if (pos.element) {
        var target = $(elementFinder.findElement(pos.element));
        var offset = target.offset();
        this.element.css({
          top: offset.top + pos.offsetY,
          left: offset.left + pos.offsetX
        });
      } else {
        // No anchor, just an absolute position
        this.element.css({
          top: pos.top,
          left: pos.left
        });
      }
    }
  });

  // FIXME: need to enable this more lazily, and disable on close:
  var lastTime = 0;
  var MIN_TIME = 100;
  $(document).mousemove(function (event) {
    var now = Date.now();
    if (now - lastTime < MIN_TIME) {
      return;
    }
    lastTime = now;
    var target = event.target;
    if (target == document.documentElement || target == document.body) {
      session.send({
        type: "cursor-update",
        top: event.pageY,
        left: event.pageX
      });
      return;
    }
    target = $(target);
    var offset = target.offset();
    var offsetX = event.pageX - offset.left;
    var offsetY = event.pageY - offset.top;
    session.send({
      type: "cursor-update",
      element: elementFinder.elementLocation(target),
      offsetX: Math.floor(offsetX),
      offsetY: Math.floor(offsetY)
    });
  });

  return cursor;
});
