define(["jquery", "util", "runner"], function ($, util, runner) {
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
    var container = ui.container = $(runner.templates.chat({}));
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
    util.on("shareId", updateShareLink);
    updateShareLink();

    // Setting your name:
    var name = container.find(".towtruck-input-name");
    name.val(runner.settings("nickname"));
    name.on("keyup", function () {
      var val = name.val();
      runner.settings("nickname", val);
      container.find("#towtruck-name-confirmation").hide();
      container.find("#towtruck-name-waiting").show();
      // Fake timed saving, to make it look like we're doing work:
      // can we have the checkmark go to a greencheckmark once the name is confirmed?
      setTimeout(function () {
        container.find("#towtruck-name-waiting").hide();
        container.find("#towtruck-name-confirmation").css("color","#279a2c").show();
      }, 300);
      runner.send({type: "nickname-update", nickname: val});
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
      runner.stop();
    });
    container.find("#towtruck-cancel-end").click(function () {
      ui.activateTab("towtruck-chat");
    });

    // Moving the window:
    var header = container.find(".towtruck-header");
    header.mousedown(function (event) {
      header.addClass("towtruck-dragging");
      console.log("container", container[0]);
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

    util.emit("ui-ready");

  };

  function updateShareLink() {
    $(".towtruck-input-link").val(runner.shareUrl());
  }

  util.on("close", function () {
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
    }
    $("#towtruck-nav-btns").find("img.triangle").remove();
    var triangle = cloneTemplate("triangle");
    button.closest("li").append(triangle);
    $(".towtruck-screen").hide();
    var els = $(".towtruck-screen." + name).show();
    assert(els.length, "No screen with name:", name);
    els.show();
    util.emit("ui-showing-" + name);
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
      nick = runner.peers.get(msg.clientId).nickname;
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
    } else {
      console.warn("Did not understand message type:", msg.type, "in message", msg);
    }
  };

  ui.isChatEmpty = function () {
    var container = ui.container.find(".towtruck-chat-container");
    // We find if there's any chat messages with people who aren't ourself:
    return ! container.find(
      ".towtruck-chat-real .towtruck-person:not(.towtruck-person-" +
      util.safeClassName(runner.clientId) + ")").length;
  };

  /* Given a template with a .towtruck-person element, puts the appropriate
     name into the element and sets the class name so it can be updated with
     updatePerson() later */
  function setPerson(templateElement, clientId) {
    var nick = runner.peers.get(clientId).nickname;
    templateElement.find(".towtruck-person")
      .text(nick)
      .addClass("towtruck-person-" + util.safeClassName(clientId));
  }

  /* Called when a person's nickname is updated */
  ui.updatePerson = function (clientId) {
    var nick = runner.peers.get(clientId).nickname;
    ui.container.find(".towtruck-person-" + util.safeClassName(clientId)).text(nick);
  };

  return ui;

});
