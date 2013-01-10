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
      setTimeout(function () {
        container.find("#towtruck-name-waiting").hide();
        container.find("#towtruck-name-confirmation").show();
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

    container.find(".towtruck-close").click(function () {
      TowTruck.activateTab("towtruck-end-confirm");
    });
    container.find("#towtruck-end-session").click(function () {
      TowTruck.stop();
    });
    container.find("#towtruck-cancel-end").click(function () {
      TowTruck.activateTab("towtruck-chat");
    });

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
    if (msg.type == "text") {
      // FIXME: this should not show the name if the last chat was fairly
      // recent
      assert(msg.clientId);
      assert(typeof msg.text == "string");
      el = cloneTemplate("chat-message");
      setPerson(el, msg.clientId);
      el.find(".towtruck-chat-content").text(msg.text);
      el.attr("data-person", msg.clientId)
        .attr("data-date", Date.now());
      container.append(el);
      el[0].scrollIntoView();
    } else if (msg.type == "left-session") {
      nick = TowTruck.peers.get(msg.clientId).nickname;
      el = cloneTemplate("chat-left");
      setPerson(el, msg.clientId);
      container.append(el);
      el[0].scrollIntoView();
    } else if (msg.type == "system") {
      assert(! msg.clientId);
      assert(typeof msg.text == "string");
      el = cloneTemplate("chat-system");
      el.find(".towtruck-chat-content").text(msg.text);
      container.append(el);
      el[0].scrollIntoView();
    } else if (msg.type == "clear") {
      container.empty();
    } else {
      console.warn("Did not understand message type:", msg.type, "in message", msg);
    }
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
