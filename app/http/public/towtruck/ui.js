define(["require", "jquery", "util", "session", "templates"], function (require, $, util, session, templates) {
  TowTruck.$ = $;
  var ui = util.Module('ui');
  var assert = util.assert;
  var AssertionError = util.AssertionError;
  var chat;
  var $window = $(window);

  // This would be a circular import, but we just need the chat module sometime
  // after everything is loaded:
  require(["chat"], function (c) {
    chat = c;
  });

  ui.cloneTemplate = function (id) {
    id = "towtruck-template-" + id;
    var el = $("#" + id).clone();
    assert(el.length, "No element found with id", id);
    el.attr("id", null);
    return el;
  };

  ui.displayToggle = function (el) {
    el = $(el);
    var other = $(el.attr("data-toggles"));
    assert(other.length);
    other.hide();
    el.show();
  };

  function panelPosition() {
    var iface = $("#towtruck-interface");
    if (iface.hasClass("towtruck-interface-right")) {
      return "right";
    } else if (iface.hasClass("towtruck-interface-left")) {
      return "left";
    } else if (iface.hasClass("towtruck-interface-bottom")) {
      return "bottom";
    } else {
      throw AssertionError("#towtruck-interface doesn't have positioning class");
    }
  }

  function displayWindow(el) {
    el = $(el);
    assert(el.length);
    $(".towtruck-window, .towtruck-popup").hide();
    var bound = $("#" + el.attr("data-bound-to"));
    assert(bound.length, bound.selector, el.selector);
    var ifacePos = panelPosition();
    var boundPos = bound.offset();
    boundPos.height = bound.height();
    boundPos.width = bound.width();
    var windowHeight = $window.height();
    var windowWidth = $window.width();
    el.show();
    // FIXME: I appear to have to add the padding to the width to get a "true"
    // width.  But it's still not entirely consistent.
    var height = el.height() + 5;
    var width = el.width() + 20;
    var left, top;
    if (ifacePos == "right") {
      left = boundPos.left - 10 - width;
      top = boundPos.top + (boundPos.height / 2) - (height / 2);
    } else if (ifacePos == "left") {
      left = boundPos.left + boundPos.width + 10;
      top = boundPos.top + (boundPos.height / 2) - (height / 2);
    } else if (ifacePos == "bottom") {
      left = (boundPos.left + boundPos.width / 2) - (width / 2);
      top = boundPos.top - 10 - height;
    }
    top = Math.min(windowHeight - 10 - height, Math.max(10, top));
    el.css({
      top: top + "px",
      left: left + "px"
    });
    session.emit("display-window", el.attr("id"), el);
  }

  function hideWindow(el) {
    el = $(el);
    el.hide();
  }

  function toggleWindow(el) {
    el = $(el);
    if (el.is(":visible")) {
      hideWindow(el);
    } else {
      displayWindow(el);
    }
  }

  ui.container = null;

  ui.activateUI = function () {
    var container = ui.container = $(templates.interface);
    assert(container.length);
    $("body").append(container);

    // The share link:
    container.find("#towtruck-share-link").click(function () {
      $(this).select();
    });
    session.on("shareId", updateShareLink);
    updateShareLink();

    // Setting your name:
    var name = container.find("#towtruck-self-name");
    name.val(session.settings.get("nickname"));
    name.on("keyup", function () {
      var val = name.val();
      session.settings.set("nickname", val);
      ui.displayToggle("#towtruck-self-name-saving");
      // Fake timed saving, to make it look like we're doing work:
      // can we have the checkmark go to a greencheckmark once the name is confirmed?
      setTimeout(function () {
        ui.displayToggle("#towtruck-self-name-saved");
      }, 300);
      session.send({type: "nickname-update", nickname: val || session.settings.get("defaultNickname")});
    });

    // The chat input element:
    var input = container.find("#towtruck-chat-input");
    input.bind("keyup", function (event) {
      if (event.which == 13) { // Enter
        var val = input.val();
        if (! val) {
          return false;
        }
        chat.Chat.submit(val);
        input.val("");
      }
      if (event.which == 27) { // Escape
        hideWindow("#towtruck-chat");
      }
      return false;
    });

    // Moving the window:
    // FIXME: this should probably be stickier, and not just move the window around
    // so abruptly
    var anchor = container.find("#towtruck-anchor");
    assert(anchor.length);
    anchor.mousedown(function (event) {
      var iface = $("#towtruck-interface");
      // FIXME: switch to .offset() and pageX/Y
      function selectoff() {
        return false;
      }
      function mousemove(event2) {
        var fromRight = $window.width() + window.pageXOffset - event2.pageX;
        var fromLeft = event2.pageX - window.pageXOffset;
        var fromBottom = $window.height() + window.pageYOffset - event2.pageY;
        var pos;
        if (fromLeft < fromRight && fromLeft < fromBottom) {
          pos = "left";
        } else if (fromRight < fromLeft && fromRight < fromBottom) {
          pos = "right";
        } else {
          pos = "bottom";
        }
        iface.removeClass("towtruck-interface-left");
        iface.removeClass("towtruck-interface-right");
        iface.removeClass("towtruck-interface-bottom");
        iface.addClass("towtruck-interface-" + pos);
      }
      $(document).bind("mousemove", mousemove);
      // If you don't turn selection off it will still select text, and show a
      // text selection cursor:
      $(document).bind("selectstart", selectoff);
      // FIXME: it seems like sometimes we lose the mouseup event, and it's as though
      // the mouse is stuck down:
      $(document).one("mouseup", function () {
        $(document).unbind("mousemove", mousemove);
        $(document).unbind("selectstart", selectoff);
      });
      return false;
    });

    $("#towtruck-about-button").click(function () {
      toggleWindow("#towtruck-about");
    });

    $("#towtruck-end-session").click(function () {
      session.close();
    });

    $("#towtruck-cancel-end-session").click(function () {
      hideWindow("#towtruck-about");
    });

    $("#towtruck-share-button").click(function () {
      toggleWindow("#towtruck-share");
    });

    $("#towtruck-chat-button").click(function () {
      toggleWindow("#towtruck-chat");
    });

    session.on("display-window", function (id, element) {
      if (id == "towtruck-chat") {
        $("#towtruck-chat-input").focus();
      }
    });

    container.find(".towtruck-close").click(function (event) {
      var w = $(event.target).closest(".towtruck-window, .towtruck-popup");
      hideWindow(w);
      event.stopPropagation();
      return false;
    });

    container.find("#towtruck-chat-notifier").click(function () {
      displayWindow("#towtruck-chat");
    });

    $("#towtruck-participants-button").click(function () {
      toggleWindow("#towtruck-participants");
    });

    if (session.isClient) {
      ui.displayToggle("#towtruck-participants-is-following");
    } else {
      ui.displayToggle("#towtruck-participants-is-owner");
    }

    $(".towtruck header.towtruck-title").each(function (index, item) {
      var button = $('<button class="towtruck-minimize"><img src="http://localhost:8080/images/icn-minimize.png"></button>');
      button.click(function (event) {
        var window = button.closest(".towtruck-window");
        hideWindow(window);
      });
      $(item).append(button);
    });

    $("#towtruck-avatar-done").click(function () {
      ui.displayToggle("#towtruck-no-avatar-edit");
    });

    $("#towtruck-self-color").css({backgroundColor: session.settings.get("color")});

    var avatar = session.settings.get("avatar");
    if (avatar) {
      $("#towtruck-self-avatar").attr("src", avatar);
    }

    session.emit("ui-ready");

  };

  function updateShareLink() {
    var el = $("#towtruck-share-link");
    var display = $("#towtruck-session-id");
    if (! session.shareId) {
      el.val("");
      display.text("(none)");
    } else {
      el.val(session.shareUrl());
      display.text(session.shareId);
    }
  }

  session.on("close", function () {
    if (ui.container) {
      ui.container.remove();
      ui.container = null;
    }
    // Clear out any other spurious elements:
    $(".towtruck").remove();
  });

  // FIXME: this should be a series of methods, not one big method with
  // different msg.type
  ui.addChat = function (msg) {
    var nick, el;
    var container = ui.container.find("#towtruck-chat-messages");
    var popup = ui.container.find("#towtruck-chat-notifier");
    assert(container.length);
    function addEl(el, id) {
      if (id) {
        el.attr("id", "towtruck-chat-" + util.safeClassName(id));
      }
      container.append(el);
      var bottom = el.find(".towtruck-chat-content");
      if (! bottom.length) {
        bottom = el;
      }
      bottom[0].scrollIntoView();
      if (! container.is(":visible")) {
        var section = popup.find("#towtruck-chat-notifier-message");
        section.empty();
        section.append(el.clone());
        displayWindow(popup);
      }
    }
    if (msg.type == "text") {
      // FIXME: this should not show the name if the last chat was fairly
      // recent
      assert(msg.clientId);
      assert(typeof msg.text == "string");
      el = ui.cloneTemplate("chat-message");
      setPerson(el, msg.clientId);
      el.find(".towtruck-chat-content").text(msg.text);
      el.attr("data-person", msg.clientId)
        .attr("data-date", msg.date || Date.now());
      setDate(el, msg.date || Date.now());
      assert(msg.messageId);
      addEl(el, msg.messageId);
    } else if (msg.type == "left-session") {
      nick = session.peers.get(msg.clientId).nickname;
      el = ui.cloneTemplate("chat-left");
      setPerson(el, msg.clientId);
      addEl(el, msg.messageId);
    } else if (msg.type == "system") {
      assert(! msg.clientId);
      assert(typeof msg.text == "string");
      el = ui.cloneTemplate("chat-system");
      el.find(".towtruck-chat-content").text(msg.text);
      addEl(el, msg.clientId);
    } else if (msg.type == "clear") {
      container.empty();
    } else if (msg.type == "url-change") {
      assert(msg.clientId);
      assert(typeof msg.url == "string");
      el = ui.cloneTemplate("url-change");
      setPerson(el, msg.clientId);
      el.find(".towtruck-url").attr("href", msg.url).text(msg.url);
      addEl(el, msg.clientId);
    } else {
      console.warn("Did not understand message type:", msg.type, "in message", msg);
    }
  };

  // FIXME: this is crude:
  ui.isChatEmpty = function () {
    var container = ui.container.find(".towtruck-chat-container");
    // We find if there's any chat messages with people who aren't ourself:
    return ! container.find(
      ".towtruck-chat-real .towtruck-person:not(.towtruck-person-" +
      util.safeClassName(session.clientId) + ")").length;
  };

  /* Given a template with a .towtruck-person element, puts the appropriate
     name into the element and sets the class name so it can be updated with
     updatePerson() later */
  function setPerson(templateElement, clientId) {
    var nick, avatar;
    if (clientId == session.clientId) {
      nick = "me";
      avatar = session.settings.get("avatar");
    } else {
      var peer = session.peers.get(clientId);
      nick = peer.nickname;
      avatar = peer.avatar;
    }
    templateElement.find(".towtruck-person")
      .text(nick)
      .addClass("towtruck-person-" + util.safeClassName(clientId));
    if (avatar) {
      templateElement.find(".towtruck-avatar img")
        .attr("src", avatar)
        .addClass("towtruck-avatar-" + util.safeClassName(clientId));
    }
  }

  function setDate(templateElement, date) {
    if (typeof date == "number") {
      date = new Date(date);
    }
    var ampm = "AM";
    var hour = date.getHours();
    if (hour > 12) {
      hour -= 12;
      ampm = "PM";
    }
    var minute = date.getMinutes();
    var t = hour + ":";
    if (minute < 10) {
      t += "0";
    }
    t += minute;
    templateElement.find(".towtruck-time").text(t);
    templateElement.find(".towtruck-ampm").text(ampm);
  }

  /* Called when a person's nickname is updated */
  ui.updatePerson = function (clientId) {
    var nick, avatar;
    if (clientId == session.clientId) {
      nick = "me";
      avatar = session.settings.get("avatar");
    } else {
      var peer = session.peers.get(clientId);
      nick = peer.nick;
      avatar = peer.avatar;
    }
    ui.container.find(".towtruck-person-" + util.safeClassName(clientId)).text(nick);
    if (avatar) {
      ui.container.find(".towtruck-avatar-" + util.safeClassName(clientId)).attr("src", avatar);
    }
  };

  session.peers.on("add update", function (peer) {
    var id = "towtruck-participant-" + util.safeClassName(peer.clientId);
    var el = $("#" + id);
    if (! el.length) {
      el = ui.cloneTemplate("participant");
      el.attr("id", id);
      $("#towtruck-participants-list").append(el);
    }
    $("#towtruck-participants-none").hide();
    if (peer.color) {
      el.find(".towtruck-color").css({
        backgroundColor: peer.color
      });
    }
    if (peer.nickname !== undefined) {
      el.find(".towtruck-participant-name").text(peer.nickname || "???");
    }
  });

  session.settings.on("change", function (name, oldValue, newValue) {
    if (name == "color") {
      $("#towtruck-self-color").css({backgroundColor: newValue});
    } else if (name == "avatar") {
      // FIXME: should fixup any other places where the avatar is set:
      $("#towtruck-self-avatar").attr("src", newValue);
    }
    ui.updatePerson(session.clientId);
  });

  return ui;

});
