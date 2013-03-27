define(["util", "jquery", "session"], function (util, $, session) {
  var assert = util.assert;
  var modal = util.Module("modal");
  var onClose = null;

  function getBackground() {
    if (getBackground.element) {
      return getBackground.element;
    }
    var background = $("#towtruck-modal-background");
    assert(background.length);
    getBackground.element = background;
    background.click(function () {
      modal.stopModal();
    });
    return background;
  }

  modal.showModal = function (el, onCloseCallback) {
    onClose = onCloseCallback;
    el = $(el);
    assert(el.hasClass("towtruck-modal"), "no modal class");
    if (! el.find(".towtruck-close").length) {
      el.prepend($('<div class="towtruck-close">&times;</div>'));
    }
    el.find(".towtruck-close, .towtruck-modal-close, .towtruck-minimize").click(modal.stopModal);
    getBackground().show();
    el.show();
    bindEscape();
  };

  function bindEscape() {
    $(document).keydown(onKeydown);
  }

  function unbindEscape() {
    $(document).unbind("keydown", onKeydown);
  }

  session.on("close", function () {
    unbindEscape();
  });

  function onKeydown(event) {
    if (event.which == 27) {
      modal.stopModal();
    }
  }

  modal.stopModal = function () {
    getBackground().hide();
    var active = $(".towtruck-modal:visible");
    active.find(".towtruck-close, .towtruck-modal-close").unbind("close", modal.stopModal);
    active.hide();
    unbindEscape();
    if (onClose) {
      onClose();
      onClose = null;
    }
  };

  return modal;
});
