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
  };

  function updateShareLink() {
    $(".towtruck-input-link").val(TowTruck.shareUrl());
  }

  TowTruck.messageHandler.on("self-bye", function () {
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
