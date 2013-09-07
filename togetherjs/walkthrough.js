/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["util", "ui", "jquery", "windowing", "templates", "templating", "session", "peers"], function (util, ui, $, windowing, templates, templating, session, peers) {
  var assert = util.assert;
  var walkthrough = util.Module("walkthrough");
  var onHideAll = null;
  var container = null;

  var slides = null;

  walkthrough.start = function (firstTime, doneCallback) {
    if (! container) {
      container = $(templates.walkthrough);
      container.hide();
      ui.container.append(container);
      slides = container.find(".towtruck-walkthrough-slide");
      slides.hide();
      var progress = $("#towtruck-walkthrough-progress");
      slides.each(function (index) {
        var bullet = templating.sub("walkthrough-slide-progress");
        progress.append(bullet);
        bullet.click(function () {
          show(index);
        });
      });
      container.find("#towtruck-walkthrough-previous").click(previous);
      container.find("#towtruck-walkthrough-next").click(next);
      ui.prepareShareLink(container);
      container.find(".towtruck-self-name").bind("keyup", function (event) {
        var val = $(event.target).val();
        peers.Self.update({name: val});
      });
      container.find(".towtruck-swatch").click(function () {
        var picker = $("#towtruck-pick-color");
        if (picker.is(":visible")) {
          picker.hide();
          return;
        }
        picker.show();
        picker.find(".towtruck-swatch-active").removeClass("towtruck-swatch-active");
        picker.find(".towtruck-swatch[data-color=\"" + peers.Self.color + "\"]").addClass("towtruck-swatch-active");
        var location = container.find(".towtruck-swatch").offset();
        picker.css({
          top: location.top,
          // The -7 comes out of thin air, but puts it in the right place:
          left: location.left-7
        });
      });
      if (session.isClient) {
        container.find(".towtruck-if-creator").remove();
        container.find(".towtruck-ifnot-creator").show();
      } else {
        container.find(".towtruck-if-creator").show();
        container.find(".towtruck-ifnot-creator").remove();
      }
      container.find(".towtruck-site-name").text(session.siteName());
      ui.activateAvatarEdit(container, {
        onSave: function () {
          container.find("#towtruck-avatar-when-saved").show();
          container.find("#towtruck-avatar-when-unsaved").hide();
        },
        onPending: function () {
          container.find("#towtruck-avatar-when-saved").hide();
          container.find("#towtruck-avatar-when-unsaved").show();
        }
      });
      // This triggers substititions in the walkthrough:
      peers.Self.update({});
      session.emit("new-element", container);
    }
    assert(typeof firstTime == "boolean", "You must provide a firstTime boolean parameter");
    if (firstTime) {
      container.find(".towtruck-walkthrough-firsttime").show();
      container.find(".towtruck-walkthrough-not-firsttime").hide();
    } else {
      container.find(".towtruck-walkthrough-firsttime").hide();
      container.find(".towtruck-walkthrough-not-firsttime").show();
    }
    onHideAll = doneCallback;
    show(0);
    windowing.show(container);
  };

  function show(index) {
    slides.hide();
    $(slides[index]).show();
    var bullets = container.find("#towtruck-walkthrough-progress .towtruck-walkthrough-slide-progress");
    bullets.removeClass("towtruck-active");
    $(bullets[index]).addClass("towtruck-active");
    var $next = $("#towtruck-walkthrough-next").removeClass("towtruck-disabled");
    var $previous = $("#towtruck-walkthrough-previous").removeClass("towtruck-disabled");
    if (index == slides.length - 1) {
      $next.addClass("towtruck-disabled");
    } else if (index === 0) {
      $previous.addClass("towtruck-disabled");
    }
  }

  function previous() {
    var index = getIndex();
    index--;
    if (index < 0) {
      index = 0;
    }
    show(index);
  }

  function next() {
    var index = getIndex();
    index++;
    if (index >= slides.length) {
      index = slides.length-1;
    }
    show(index);
  }

  function getIndex() {
    var active = slides.filter(":visible");
    if (! active.length) {
      return 0;
    }
    for (var i=0; i<slides.length; i++) {
      if (slides[i] == active[0]) {
        return i;
      }
    }
    return 0;
  }

  walkthrough.stop = function () {
    windowing.hide(container);
    if (onHideAll) {
      onHideAll();
      onHideAll = null;
    }
  };

  session.on("hide-window", function () {
    if (onHideAll) {
      onHideAll();
      onHideAll = null;
    }
  });

  return walkthrough;
});
