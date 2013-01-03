(function () {
  var TowTruck = window.TowTruck;
  var $ = TowTruck.$;

  // FIXME: make this all a class?

  TowTruck.intro = null;

  function remove() {
    if (TowTruck.intro) {
      TowTruck.intro.remove();
      TowTruck.intro = null;
    }
    document.removeEventListener("click", captureClick, true);
  }
  
  function close() {
    if (! TowTruck.chat) {
      TowTruck.createChat();
    } else {
      TowTruck.chat.show();
    }
    remove();
  }

  TowTruck.messageHandler.on("self-bye", remove);

  function captureClick(event) {
    var node = event.target;
    while (node) {
      if (node.className && node.className.indexOf("towtruck-intro") != -1) {
        // They clicked inside the intro thing, which is fine
        return;
      }
      node = node.parentNode;
    }
    // They are not in the parent node
    event.preventDefault();
    event.stopPropagation();
    close();
  }
  
  TowTruck.showIntro = function (fromChat) {
    var tmpl = TowTruck.intro = $(TowTruck.templates.intro({}));
    if (fromChat) {
      tmpl.find(".towtruck-first-run").hide();
    } else {
      tmpl.find(".towtruck-from-info").hide();
    }
    tmpl.find(".towtruck-close, .towtruck-continue").click(close);
    document.addEventListener("click", captureClick, true);
    tmpl.find(".towtruck-cancel").click(function () {
      TowTruck.stop();
    });
    var link = tmpl.find("#towtruck-link");
    link.val(TowTruck.shareUrl());
    link.click(function () {
      link.select();
      return false;
    });
    var name = tmpl.find("#towtruck-name");
    name.val(TowTruck.settings("nickname"));
    name.on("keyup", function () {
      var val = name.val();
      TowTruck.settings("nickname", val);
      $("#towtruck-name-confirmation").hide();
      $("#towtruck-name-waiting").show();
      // Fake timed saving, to make it look like we're doing work:
      setTimeout(function () {
        $("#towtruck-name-waiting").hide();
        $("#towtruck-name-confirmation").show();
      }, 300);
      TowTruck.send({type: "nickname-update", nickname: val});
    });
    if (TowTruck.chat) {
      TowTruck.chat.hide();
    }
    $("body").append(tmpl);
  };
  
})();
