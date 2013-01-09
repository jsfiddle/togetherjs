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
    container.find("*[data-activate]").click(function () {
      TowTruck.activateTab(null, $(this));
    });
    container.find(".towtruck-input-link").click(function () {
      $(this).select();
    });
    TowTruck.on("shareId", updateShareLink);
    updateShareLink();
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
    assert(button.length, "No screen with name", name);
    $("#towtruck-nav-btns").find("img.triangle").remove();
    var triangle = cloneTemplate("triangle");
    button.closest("li").append(triangle);
    $(".towtruck-screen").hide();
    $(".towtruck-screen." + name).show();
  };

})();
