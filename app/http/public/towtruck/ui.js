define(["require", "jquery", "util", "session", "templates"], function (require, $, util, session, templates) {
  var ui = util.Module('ui');
  var assert = util.assert;
  var chat;
  require(["chat"], function (c) {
    chat = c;
  });

  function cloneTemplate(id) {
    id = "towtruck-template-" + id;
    var el = $("#towtruck-templates #" + id).clone();
    el.attr("id", null);
    return el;
  }

  ui.container = null;

  ui.activateUI = function () {
    var container = ui.container = $(templates.chat);
    assert(container.length);
    $("body").append(container);

    // Tabs:
    container.find("*[data-activate]").click(function () {
      ui.activateTab(null, $(this));
    });

    // The share link:
    container.find(".towtruck-input-link").click(function () {
      $(this).select();
    });
    session.on("shareId", updateShareLink);
    updateShareLink();

    // Setting your name:
    var name = container.find(".towtruck-input-name");
    name.val(session.settings.get("nickname"));
    name.on("keyup", function () {
      var val = name.val();
      session.settings.set("nickname", val);
      container.find("#towtruck-name-confirmation").hide();
      container.find("#towtruck-name-waiting").show();
      // Fake timed saving, to make it look like we're doing work:
      // can we have the checkmark go to a greencheckmark once the name is confirmed?
      setTimeout(function () {
        container.find("#towtruck-name-waiting").hide();
        container.find("#towtruck-name-confirmation").css("color","#279a2c").show();
      }, 300);
      session.send({type: "nickname-update", nickname: val});
    });

    // The chat input element:
    var input = container.find(".towtruck-chat-input");
    input.bind("keyup", function (event) {
      if (event.which == 13) {
        var val = input.val();
        if (! val) {
          return false;
        }
        chat.Chat.submit(val);
        input.val("");
      }
      return false;
    });

    // Close button and confirmation of close:
    container.find(".towtruck-close").click(function () {
      ui.activateTab("towtruck-end-confirm");
    });
    container.find("#towtruck-end-session").click(function () {
      session.close();
    });
    container.find("#towtruck-cancel-end").click(function () {
      ui.activateTab("towtruck-chat");
    });

    ui.docking = false;
    ui.undockedPos = {};
    // Docking:
    if (! $(".towtruck-undocked").length) {
      // FIXME: this is static, but doesn't allow the doc location to be created
      // dynamically or added or removed later
      container.find(".towtruck-dock").hide();
    }
    container.find(".towtruck-dock").click(function () {
      ui.docking = ! ui.docking;
      if (ui.docking) {
        container.addClass("towtruck-container-docked");
      } else {
        container.removeClass("towtruck-container-docked");
      }
      if (ui.docking) {
        ui.undockedPos = container.offset();
      }
      var dockData = $("body").data();
      var prefix = "towtruckDock";
      var styles = {};
      for (var a in dockData) {
        if (! dockData.hasOwnProperty(a)) {
          continue;
        }
        if (a.indexOf(prefix) === 0) {
          var name = a.charAt(prefix.length).toLowerCase() + a.substr(prefix.length + 1);
          styles[name] = ui.docking ? dockData[a] : "";
        }
      }
      if (ui.docking) {
        if (! (styles.top || styles.bottom)) {
          styles.bottom = 0;
        }
        if (! (styles.left || styles.right)) {
          styles.right = 0;
        }
        if (styles.bottom !== undefined) {
          // FIXME: not sure if or when I might need to factor in margin-top:
          //   parseInt($(document.body).css("margin-top"), 10);
          styles.top =
              Math.max($(document.body).height() -
                       parseInt(styles.bottom, 10) -
                       container.height(), 0);
          delete styles.bottom;
        }
        if (styles.right !== undefined) {
          styles.left =
              $(document.body).width() -
              parseInt(styles.right, 10) -
              container.width() +
              parseInt($(document.body).css("margin-left"), 10);
          delete styles.right;
        }
      } else {
        styles.left = ui.undockedPos.left + "px";
        styles.top = ui.undockedPos.top + "px";
        ui.undockedPos = null;
      }
      container.css(styles);
      if (ui.docking) {
        $(".towtruck-undocked").removeClass("towtruck-undocked").addClass("towtruck-docked");
      } else {
        $(".towtruck-docked").removeClass("towtruck-docked").addClass("towtruck-undocked");
      }
    });

    // Moving the window:
    var header = container.find(".towtruck-header");
    header.mousedown(function (event) {
      if (ui.docking) {
        return;
      }
      header.addClass("towtruck-dragging");
      // FIXME: switch to .offset() and pageX/Y
      var start = container.position();
      function selectoff() {
        return false;
      }
      function mousemove(event2) {
        container.css({
          top: start.top + (event2.screenY - event.screenY),
          left: start.left + (event2.screenX - event.screenX)
        });
      }
      $(document).bind("mousemove", mousemove);
      // If you don't turn selection off it will still select text, and show a
      // text selection cursor:
      $(document).bind("selectstart", selectoff);
      $(document).one("mouseup", function () {
        $(document).unbind("mousemove", mousemove);
        $(document).unbind("selectstart", selectoff);
        header.removeClass("towtruck-dragging");
      });
    });

    session.emit("ui-ready");

  };

  function updateShareLink() {
    var el = $(".towtruck-input-link");
    if (! session.shareId) {
      el.val("");
    } else {
      el.val(session.shareUrl());
    }
  }

  session.on("close", function () {
    if (ui.container) {
      ui.container.remove();
      ui.container = null;
    }
  });

  ui.activateTab = function (name, button) {
    if (! button) {
      button = $('[data-activate="' + name + '"]');
    } else if (! name) {
      name = button.attr("data-activate");
      $('[data-activate="' + name + '"] img').css("opacity", "1");
    }
    // $("#towtruck-nav-btns").find("img.triangle").remove();
    // var triangle = cloneTemplate("triangle");
    // button.closest("li").append(triangle);
    $(".towtruck-screen").hide();
    var els = $(".towtruck-screen." + name).show();
    assert(els.length, "No screen with name:", name);
    els.show();
    session.emit("ui-showing-" + name);
  };

  ui.addChat = function (msg) {
    var nick, el;
    var container = ui.container.find(".towtruck-chat-container");
    assert(container.length);
    function addEl(el, id) {
      if (id) {
        el.attr("id", "towtruck-chat-" + util.safeClassName(id));
      }
      container.append(el);
      el[0].scrollIntoView();
    }
    if (msg.type == "text") {
      // FIXME: this should not show the name if the last chat was fairly
      // recent
      assert(msg.clientId);
      assert(typeof msg.text == "string");
      el = cloneTemplate("chat-message");
      setPerson(el, msg.clientId);
      el.find(".towtruck-chat-content").text(msg.text);
      el.attr("data-person", msg.clientId)
        .attr("data-date", msg.date || Date.now());
      assert(msg.messageId);
      addEl(el, msg.messageId);
    } else if (msg.type == "left-session") {
      nick = session.peers.get(msg.clientId).nickname;
      el = cloneTemplate("chat-left");
      setPerson(el, msg.clientId);
      addEl(el, msg.messageId);
    } else if (msg.type == "system") {
      assert(! msg.clientId);
      assert(typeof msg.text == "string");
      el = cloneTemplate("chat-system");
      el.find(".towtruck-chat-content").text(msg.text);
      addEl(el, msg.clientId);
    } else if (msg.type == "clear") {
      container.empty();
    } else if (msg.type == "url-change") {
      assert(msg.clientId);
      assert(typeof msg.url == "string");
      el = cloneTemplate("url-change");
      setPerson(el, msg.clientId);
      el.find(".towtruck-url").attr("href", msg.url).text(msg.url);
      addEl(el, msg.clientId);
    } else {
      console.warn("Did not understand message type:", msg.type, "in message", msg);
    }
  };

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
    var nick = session.peers.get(clientId).nickname;
    templateElement.find(".towtruck-person")
      .text(nick)
      .addClass("towtruck-person-" + util.safeClassName(clientId));
  }

  /* Called when a person's nickname is updated */
  ui.updatePerson = function (clientId) {
    var nick = session.peers.get(clientId).nickname;
    ui.container.find(".towtruck-person-" + util.safeClassName(clientId)).text(nick);
  };

  return ui;


});
