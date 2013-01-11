(function () {
  var TowTruck = window.TowTruck;
  var $ = TowTruck.$;
  var assert = TowTruck.assert;

  function cloneTemplate(id) {
    id = "towtruck-template-" + id;
    var el = $("#towtruck-templates #" + id).clone();
    el.attr("id", null);
    return el;
  }

  TowTruck.container = null;

  TowTruck.activateUI = function () {
    var container = TowTruck.container = $(TowTruck.templates.chat({}));
    $("body").append(container);

    // Tabs:
    container.find("*[data-activate]").click(function () {
      TowTruck.activateTab(null, $(this));
    });

    // The share link:
    container.find(".towtruck-input-link").click(function () {
      $(this).select();
    });
    TowTruck.on("shareId", updateShareLink);
    updateShareLink();

    // Setting your name:
    var name = container.find(".towtruck-input-name");
    name.val(TowTruck.settings("nickname"));
    name.on("keyup", function () {
      var val = name.val();
      TowTruck.settings("nickname", val);
      container.find("#towtruck-name-confirmation").hide();
      container.find("#towtruck-name-waiting").show();
      // Fake timed saving, to make it look like we're doing work:

	  // can we have the checkmark go to a greencheckmark once the name is confirmed?
      setTimeout(function () {
        container.find("#towtruck-name-waiting").hide();
        container.find("#towtruck-name-confirmation").css("color","#279a2c").show();
      }, 300);
      TowTruck.send({type: "nickname-update", nickname: val});
    });

    // The chat input element:
    var input = container.find(".towtruck-chat-input");
    input.bind("keyup", function (event) {
      if (event.which == 13) {
        var val = input.val();
        if (! val) {
          return false;
        }
        TowTruck.Chat.submit(val);
        input.val("");
      }
      return false;
    });

    // Close button and confirmation of close:
    container.find(".towtruck-close").click(function () {
      TowTruck.activateTab("towtruck-end-confirm");
    });
    container.find("#towtruck-end-session").click(function () {
      TowTruck.stop();
    });
    container.find("#towtruck-cancel-end").click(function () {
      TowTruck.activateTab("towtruck-chat");
    });

    // Moving the window:
    var header = container.find(".towtruck-header");
    header.mousedown(function (event) {
      header.addClass("towtruck-dragging");
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

    TowTruck.emit("ui-ready");

  };

  function updateShareLink() {
    $(".towtruck-input-link").val(TowTruck.shareUrl());
  }

  TowTruck.on("close", function () {
    if (TowTruck.container) {
      TowTruck.container.remove();
      TowTruck.container = null;
    }
  });

  TowTruck.activateTab = function (name, button) {
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
  };

  TowTruck.addChat = function (msg) {
    var nick, el;
    var container = TowTruck.container.find(".towtruck-chat-container");
    assert(container.length);
    function addEl(el, id) {
      if (id) {
        el.attr("id", "towtruck-chat-" + TowTruck.safeClassName(id));
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
      nick = TowTruck.peers.get(msg.clientId).nickname;
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

  TowTruck.isChatEmpty = function () {
    var container = TowTruck.container.find(".towtruck-chat-container");
    // We find if there's any chat messages with people who aren't ourself:
    return ! container.find(
      ".towtruck-chat-real .towtruck-person:not(.towtruck-person-" +
      TowTruck.safeClassName(TowTruck.clientId) + ")").length;
  };

  /* Given a template with a .towtruck-person element, puts the appropriate
     name into the element and sets the class name so it can be updated with
     updatePerson() later */
  function setPerson(templateElement, clientId) {
    var nick = TowTruck.peers.get(clientId).nickname;
    templateElement.find(".towtruck-person")
      .text(nick)
      .addClass("towtruck-person-" + TowTruck.safeClassName(clientId));
  }

  /* Called when a person's nickname is updated */
  TowTruck.updatePerson = function (clientId) {
    var nick = TowTruck.peers.get(clientId).nickname;
    TowTruck.container.find(".towtruck-person-" + TowTruck.safeClassName(clientId)).text(nick);
  };

})();
