define(["require", "jquery", "util", "session", "templates"], function (require, $, util, session, templates) {
  TowTruck.$ = $;
  var ui = util.Module('ui');
  var assert = util.assert;
  var AssertionError = util.AssertionError;
  var chat;
  var $window = $(window);
  // This is also in towtruck.less, as @button-height:
  var BUTTON_HEIGHT = 40;

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

  ui.displayWindow = function (el) {
    el = $(el);
    assert(el.length);
    $(".towtruck-window, .towtruck-popup").hide();
    el.show();
    ui.bindWindow(el);
    session.emit("display-window", el.attr("id"), el);
  };

  ui.bindWindow = function (win, bound) {
    win = $(win);
    if (! bound) {
      bound = $("#" + win.attr("data-bound-to"));
    } else {
      bound = $(bound);
    }
    assert(bound.length, bound.selector, win.selector);
    var ifacePos = panelPosition();
    var boundPos = bound.offset();
    boundPos.height = bound.height();
    boundPos.width = bound.width();
    var windowHeight = $window.height();
    var windowWidth = $window.width();
    boundPos.top -= $window.scrollTop();
    boundPos.left -= $window.scrollLeft();
    // FIXME: I appear to have to add the padding to the width to get a "true"
    // width.  But it's still not entirely consistent.
    var height = win.height() + 5;
    var width = win.width() + 20;
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
    win.css({
      top: top + "px",
      left: left + "px"
    });
  };

  function hideWindow(el) {
    el = $(el);
    el.hide();
  }

  function toggleWindow(el) {
    el = $(el);
    if (el.is(":visible")) {
      hideWindow(el);
    } else {
      ui.displayWindow(el);
    }
  }

  ui.container = null;

  // This is called before activateUI; it doesn't bind anything, but does display
  // the dock
  ui.prepareUI = function () {
    var container = ui.container = $(templates.interface);
    assert(container.length);
    $("body").append(container);
  };

  ui.activateUI = function () {
    if (! ui.container) {
      ui.prepareUI();
    }
    var container = ui.container;

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
        // FIXME: this is to temporarily disable the bottom view:
        fromBottom = 10000;

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

    container.find("#towtruck-chat-notifier").click(function (event) {
      if ($(event.target).is("a") || container.is(".towtruck-close")) {
        return;
      }
      ui.displayWindow("#towtruck-chat");
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
      var button = $('<button class="towtruck-minimize"><img src="' + TowTruck.baseUrl + '/images/icn-minimize.png"></button>');
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

    var starterButton = $("#towtruck-starter button");
    starterButton.click(function () {
      ui.displayWindow("#towtruck-about");
    }).addClass("towtruck-running");
    if (starterButton.text() == "Start TowTruck") {
      starterButton.attr("data-start-text", starterButton.text());
      starterButton.text("End TowTruck Session");
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
    var starterButton = $("#towtruck-starter button");
    starterButton.removeClass("towtruck-running");
    if (starterButton.attr("data-start-text")) {
      starterButton.text(starterButton.attr("data-start-text"));
      starterButton.attr("data-start-text", "");
    }
  });

  // FIXME: this should be a series of methods, not one big method with
  // different msg.type
  ui.addChat = function (msg) {
    var nick, el;
    var container = ui.container.find("#towtruck-chat-messages");
    var popup = ui.container.find("#towtruck-chat-notifier");
    assert(container.length);
    function addEl(el, id, self) {
      if (id) {
        el.attr("id", "towtruck-chat-" + util.safeClassName(id));
      }
      container.append(el);
      var bottom = el.find(".towtruck-chat-content");
      if (! bottom.length) {
        bottom = el;
      }
      bottom[0].scrollIntoView();
      if ((! self) && ! container.is(":visible")) {
        var section = popup.find("#towtruck-chat-notifier-message");
        section.empty();
        section.append(el.clone());
        ui.displayWindow(popup);
      }
    }
    if (msg.type == "text") {
      // FIXME: this should not show the name if the last chat was fairly
      // recent
      assert(msg.clientId);
      assert(typeof msg.text == "string");
      el = ui.cloneTemplate("chat-message");
      ui.setPerson(el, msg.clientId);
      el.find(".towtruck-chat-content").text(msg.text);
      el.attr("data-person", msg.clientId)
        .attr("data-date", msg.date || Date.now());
      setDate(el, msg.date || Date.now());
      assert(msg.messageId);
      addEl(el, msg.messageId, msg.clientId == session.clientId);
    } else if (msg.type == "left-session") {
      nick = session.peers.get(msg.clientId).nickname;
      el = ui.cloneTemplate("chat-left");
      ui.setPerson(el, msg.clientId);
      setDate(el, msg.date || Date.now());
      addEl(el, msg.messageId, false);
    } else if (msg.type == "system") {
      assert(! msg.clientId);
      assert(typeof msg.text == "string");
      el = ui.cloneTemplate("chat-system");
      el.find(".towtruck-chat-content").text(msg.text);
      setDate(el, msg.date || Date.now());
      addEl(el, msg.clientId, false);
    } else if (msg.type == "clear") {
      container.empty();
    } else if (msg.type == "url-change") {
      assert(msg.clientId);
      assert(typeof msg.url == "string");
      el = ui.cloneTemplate("url-change");
      ui.setPerson(el, msg.clientId);
      setDate(el, msg.date || Date.now());
      var title;
      // FIXME: strip off common domain from msg.url?  E.g., if I'm on
      // http://example.com/foobar, and someone goes to http://example.com/baz then
      // show only /baz
      // FIXME: truncate long titles
      if (msg.title) {
        title = msg.title + " (" + msg.url + ")";
      } else {
        title = msg.url;
      }
      el.find(".towtruck-url").attr("href", msg.url).text(title);
      addEl(el, msg.clientId, msg.clientId == session.clientId);
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
  ui.setPerson = function (templateElement, clientId) {
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
    var avatarEl = templateElement.find(".towtruck-avatar img, img.towtruck-avatar");
    if (avatar) {
      avatarEl.attr("src", avatar);
    }
    avatarEl.addClass("towtruck-avatar-" + util.safeClassName(clientId));
  };

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
      nick = peer.nickname;
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
    // FIXME: need to hide this when all participants leave, but right now
    // we aren't tracking anyone leaving:
    $("#towtruck-participants-list").show();
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

  session.peers.on("add", function (peer) {
    var newPeer = ui.Peer(peer.clientId);
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

  /****************************************
   * Dock peers
   */

  ui.Peer = util.Class({

    constructor: function (clientId) {
      this.clientId = clientId;
      this.element = ui.cloneTemplate("dock-person");
      ui.setPerson(this.element, this.clientId);
      ui.container.find("#towtruck-dock-participants").append(this.element);
      var iface = $("#towtruck-interface");
      iface.css({
        height: iface.height() + BUTTON_HEIGHT + "px"
      });
      ui.Peer._peers[this.clientId] = this;
    },

    destroy: function () {
      this.element.remove();
      if (this._urlChangeElement) {
        this._urlChangeElement.remove();
      }
      delete ui.Peer._peers[this.clientId];
    },

    urlChangeElement: function () {
      if (! this._urlChangeElement) {
        var c = this._urlChangeElement = ui.cloneTemplate("url-change-popup");
        ui.setPerson(c, this.clientId);
        c.find(".towtruck-follow").click(function () {
          var url = c.find("a.towtruck-url").attr("href");
          location.href = url;
        });
        c.find(".towtruck-ignore").click((function () {
          c.hide();
          return false;
        }).bind(this));
        c.find(".towtruck-nudge").click((function () {
          // FIXME: the .send() is here, but the receive is in cobrowse.js,
          // kind of messy
          session.send({
            type: "url-change-nudge",
            url: location.href,
            to: this.clientId
          });
        }).bind(this));
        ui.container.append(c);
        ui.bindWindow(c, this.element);
      }
      return this._urlChangeElement;
    },

    updateUrl: function (url, title, force) {
      console.log("hey", this);
      var c = this.urlChangeElement();
      c.find("a.towtruck-url").attr("href", url).text(title);
      if (force) {
        c.show();
      }
    },

    removeUrl: function () {
      this._urlChangeElement.remove();
      this._urlChangeElement = null;
    },

    urlNudge: function () {
      if (this._urlChangeElement) {
        this._urlChangeElement.show();
        this._urlChangeElement.find(".towtruck-follow").addClass("towtruck-nudge");
      }
    }

  });

  ui.Peer._peers = {};
  ui.Peer.get = function (id) {
    var peer = ui.Peer._peers[id];
    assert(peer);
    return peer;
  };

  ui.urlNudge = function (clientId) {
    var c = "towtruck-url-change-" + util.safeClassName(clientId);
    var changer = $("." + c);
    changer.show();
    changer.find(".towtruck-follow").addClass("towtruck-nudge");
  };

  return ui;

});
