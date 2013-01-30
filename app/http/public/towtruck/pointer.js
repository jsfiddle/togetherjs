/* Implements the pointing part of the UI */
define(["jquery", "util", "session"], function ($, util, session) {
  var pointer = util.Module("pointer");
  var assert = util.assert;

  $(document).on("mousedown", ".towtruck-chat-real", function (event) {
    var el = $(event.target).closest(".towtruck-chat-real"); // or $(this)?
    if (el.attr("id") == "towtruck-template-chat-message") {
      // FIXME: this shouldn't happen, but Walkabout is sometimes catching
      // these
      return;
    }
    el.addClass("towtruck-arrow-message");
    //el.find(".towtruck-arrow-control").show().bind("click", arrowCheck);
    el.find(".towtruck-arrow-checkbox").attr("checked", true);
    var messageId = el.attr("id");
    assert(messageId.indexOf("towtruck-chat-") === 0,
           "Bad ID, should be towtruck-chat-*:",
           messageId);
    messageId = messageId.replace(/^towtruck-chat-/, "");
    var arrowId = "towtruck-chat-arrow-" + messageId;
    var arrow = $("#" + arrowId);
    var pos = messagePosition(el);
    var startX = pos.anchorLeft;
    var startY = pos.anchorTop;
    var endX;
    var endY;
    var moved = true;
    if (! arrow.length) {
      arrow = $('<hr class="towtruck-arrow">').attr("data-message-id", messageId);
      arrow.attr("id", arrowId);
      $("body").append(arrow);
      moved = false;
    }

    function mousemove(event) {
      var x = event.pageX;
      var y = event.pageY;
      if (pos.inside(y, x)) {
        return;
      }
      endX = x;
      endY = y;
      moved = true;
      moveArrow(arrow, startX, startY, x, y);
    }

    function selectoff() {
      return false;
    }

    $(document).bind("mousemove", mousemove);
    $(document).bind("selectstart", selectoff);
    $(document).one("mouseup", function () {
      $(document).unbind("mousemove", mousemove);
      $(document).unbind("selectstart", selectoff);
      if (! moved) {
        arrow.remove();
        el.removeClass("towtruck-arrow-message");
        el.find(".towtruck-arrow-control").hide();
        el.find(".towtruck-arrow-control").show().unbind("click", arrowCheck);
      } else if (endX !== undefined) {
        session.send({
          type: "pointer",
          messageId: messageId,
          top: endY,
          left: endX
        });
      }
    });
  });

  session.hub.on("pointer", function (msg) {
    var arrowId = "towtruck-chat-arrow-" + msg.messageId;
    var arrow = $("#" + arrowId);
    if (! arrow.length) {
      arrow = $('<hr class="towtruck-arrow">').attr("data-message-id", msg.messageId);
      arrow.attr("id", arrowId);
      $("body").append(arrow);
    }
    var el = $("#towtruck-chat-" + msg.messageId);
    var pos = messagePosition(el);
    console.log("move to", pos.anchorLeft, pos.anchorTop, msg.left, msg.top);
    moveArrow(arrow, pos.anchorLeft, pos.anchorTop, msg.left, msg.top);
    el.addClass("towtruck-arrow-message");
    //el.find(".towtruck-arrow-control").show().bind("click", arrowCheck);
    el.find(".towtruck-arrow-checkbox").attr("checked", true);
  });

  function setTransform(el, value) {
    el.css({
      MozTransform: value,
      MsTransform: value,
      WebkitTransform: value,
      transform: value
    });
    el[0].style.MozTransform = el[0].style.MsTransform = el[0].style.WebKitTransform = el[0].style.transform = value;
  }

  function moveArrow(arrow, startX, startY, endX, endY) {
    var length = Math.sqrt(Math.pow(startX - endX, 2) + Math.pow(startY - endY, 2));
    var angle = Math.atan2(startY - endY, startX - endX);
    arrow.css({
      top: endY + "px",
      left: endX + "px",
      width: length + "px"
    });
    setTransform(arrow, "rotate(" + angle + "rad)");
  }

  function messagePosition(el) {
    assert(el.length);
    var pos = el.offset();
    var height = el.outerHeight();
    return {
      top: pos.top,
      bottom: pos.top + height,
      left: pos.left,
      right: pos.left + el.outerWidth(),
      anchorTop: Math.floor(pos.top + height / 2),
      anchorLeft: pos.left - 5,
      inside: function (top, left) {
        return left > this.left && left < this.right &&
          top > this.top && top < this.bottom;
      }
    };
  }

  function arrowCheck(event) {
    var c = $(this);
    var checked = ! c[0].checked;//.attr("checked");
    c[0].checked = checked;//c.attr("checked", checked);
    var m = c.closest(".towtruck-chat-real");
    var messageId = m.attr("id");
    assert(messageId.indexOf("towtruck-chat-") === 0);
    messageId = messageId.replace(/^towtruck-chat-/, "");
    var arrowId = "towtruck-chat-arrow-" + messageId;
    if (checked) {
      $("#" + arrowId).show();
      m.addClass("towtruck-arrow-message");
    } else {
      $("#" + arrowId).hide();
      m.removeClass("towtruck-arrow-message");
    }
    return false;
  }

  return pointer;

});
