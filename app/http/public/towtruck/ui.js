/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["require", "jquery", "util", "session", "templates", "templating", "modal", "linkify", "peers", "windowing"], function (require, $, util, session, templates, templating, modal, linkify, peers, windowing) {
  var ui = util.Module('ui');
  var assert = util.assert;
  var AssertionError = util.AssertionError;
  var chat;
  var $window = $(window);
  // This is also in towtruck.less, as @button-height:
  var BUTTON_HEIGHT = 48;
  // This is also in towtruck.less, under .towtruck-animated
  var ANIMATION_DURATION = 1000;
  // Time the new user window sticks around until it fades away:
  var NEW_USER_FADE_TIMEOUT = 5000;
  // This is set when an animation will keep the UI from being ready
  // (until this time):
  var finishedAt = null;
  // Time in milliseconds for the dock to animate out:
  var DOCK_ANIMATION_TIME = 300;

  // This would be a circular import, but we just need the chat module sometime
  // after everything is loaded, and this is sure to complete by that time:
  require(["chat"], function (c) {
    chat = c;
  });

  /* Displays some toggleable element; toggleable elements have a
     data-toggles attribute that indicates what other elements should
     be hidden when this element is shown. */
  ui.displayToggle = function (el) {
    el = $(el);
    assert(el.length, "No element", arguments[0]);
    var other = $(el.attr("data-toggles"));
    assert(other.length, "Cannot toggle", el[0], "selector", other.selector);
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
      throw new AssertionError("#towtruck-interface doesn't have positioning class");
    }
  }

  ui.container = null;

  // This is called before activateUI; it doesn't bind anything, but does display
  // the dock
  // FIXME: because this module has lots of requirements we can't do
  // this before those requirements are loaded.  Maybe worth splitting
  // this out?  OTOH, in production we should have all the files
  // combined so there's not much problem loading those modules.
  ui.prepareUI = function () {
    var container = ui.container = $(templates["interface"]);
    assert(container.length);
    $("body").append(container);
    if (session.firstRun && TowTruck.startTarget) {
      // Time at which the UI will be fully ready:
      // (We have to do this because the offset won't be quite right
      // until the animation finishes - attempts to calculate the
      // offset without taking into account CSS transforms have so far
      // failed.)
      var timeoutSeconds = DOCK_ANIMATION_TIME / 1000;
      finishedAt = Date.now() + DOCK_ANIMATION_TIME + 50;
      setTimeout(function () {
        finishedAt = Date.now() + DOCK_ANIMATION_TIME + 40;
        var iface = container.find("#towtruck-interface");
        var start = iface.offset();
        var pos = $(TowTruck.startTarget).offset();
        pos.top = Math.floor(pos.top - start.top);
        pos.left = Math.floor(pos.left - start.left);
        var translate = "translate(" + pos.left + "px, " + pos.top + "px)";
        iface.css({
          MozTransform: translate,
          WebkitTransform: translate,
          transform: translate,
          opacity: "0.0"
        });
        setTimeout(function () {
          // We keep recalculating because the setTimeout times aren't always so accurate:
          finishedAt = Date.now() + DOCK_ANIMATION_TIME + 20;
          var transition = "transform " + timeoutSeconds + "s ease-out, ";
          transition += "opacity " + timeoutSeconds + "s ease-out";
          iface.css({
            opacity: "1.0",
            MozTransition: "-moz-" + transition,
            MozTransform: "translate(0, 0)",
            WebkitTransition: "-webkit-" + transition,
            WebkitTransform: "translate(0, 0)",
            transition: transition,
            transform: "translate(0, 0)"
          });
          setTimeout(function () {
            finishedAt = null;
            iface.attr("style", "");
          }, 510);
        }, 5);
      }, 5);
    }
    if (TowTruck.startTarget) {
      var el = $(TowTruck.startTarget);
      var text = el.text().toLowerCase().replace(/\s+/g, " ");
      text = text.replace(/^\s*/, "").replace(/\s*$/, "");
      if (text == "start towtruck") {
        el.attr("data-end-towtruck-html", "End TowTruck");
      }
      if (el.attr("data-end-towtruck-html")) {
        el.attr("data-start-towtruck-html", el.html());
        el.html(el.attr("data-end-towtruck-html"));
      }
      el.addClass("towtruck-started");
    }
  };

  // After prepareUI, this actually makes the interface live.  We have
  // to do this later because we call prepareUI when many components
  // aren't initialized, so we don't even want the user to be able to
  // interact with the interface.  But activateUI is called once
  // everything is loaded and ready for interaction.
  ui.activateUI = function () {
    if (! ui.container) {
      ui.prepareUI();
    }
    var container = ui.container;

    // The share link:
    container.find("#towtruck-share-link").click(function () {
      $(this).select();
    }).change(function () {
      updateShareLink();
    });
    session.on("shareId", updateShareLink);
    updateShareLink();

    // The chat input element:
    var input = container.find("#towtruck-chat-input");
    input.bind("keyup", function (event) {
      if (event.which == 13) { // Enter
        var val = input.val();
        if (! val) {
          return false;
        }
        chat.submit(val);
        input.val("");
      }
      if (event.which == 27) { // Escape
        windowing.hide("#towtruck-chat");
      }
      return false;
    });

    // Moving the window:
    // FIXME: this should probably be stickier, and not just move the window around
    // so abruptly
    var anchor = container.find("#towtruck-anchor");
    assert(anchor.length);
    // FIXME: This is in place to temporarily disable dock dragging:
    anchor = container.find("#towtruck-anchor-disabled");
    anchor.mousedown(function (event) {
      var iface = $("#towtruck-interface");
      // FIXME: switch to .offset() and pageX/Y
      var startPos = panelPosition();
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
        if (startPos && pos != startPos) {
          windowing.hide();
          startPos = null;
        }
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

    $("#towtruck-share-button").click(function () {
      windowing.toggle("#towtruck-share");
    });

    $("#towtruck-profile-button").click(function (event) {
      toggleMenu();
      event.stopPropagation();
      return false;
    });

    $("#towtruck-menu-end").click(function () {
      session.close();
    });

    $("#towtruck-menu-feedback").click(function(){
      windowing.hide();
      hideMenu();
      modal.showModal("#towtruck-feedback-form");
    });

    $("#towtruck-menu-help").click(function () {
      windowing.hide();
      hideMenu();
      require(["walkthrough"], function (walkthrough) {
        windowing.hide();
        walkthrough.start();
      });
    });

    $("#towtruck-menu-update-name").click(function () {
      var input = $("#towtruck-self-name");
      input.css({
        width: $("#towtruck-menu").width() - 32 + "px"
      });
      ui.displayToggle("#towtruck-self-name");
      $("#towtruck-self-name").focus();
    });

    $("#towtruck-self-name").bind("keyup", function (event) {
      if (event.which == 13) {
        ui.displayToggle("#towtruck-self-name-display");
        return false;
      }
      var val = $("#towtruck-self-name").val();
      if (val) {
        peers.Self.update({name: val});
      }
      return undefined;
    });

    $("#towtruck-menu-update-avatar").click(function () {
      hideMenu();
      windowing.show("#towtruck-avatar-edit");
    });

    $("#towtruck-cancel-end-session").click(function () {
      windowing.hide("#towtruck-about");
    });

    $("#towtruck-chat-button").click(function () {
      windowing.toggle("#towtruck-chat");
    });

    session.on("display-window", function (id, element) {
      if (id == "towtruck-chat") {
        $("#towtruck-chat-input").focus();
      } else if (id == "towtruck-share") {
        $("#towtruck-share-link").focus();
        $("#towtruck-share-link").select();
      }
    });

    container.find("#towtruck-chat-notifier").click(function (event) {
      if ($(event.target).is("a") || container.is(".towtruck-close")) {
        return;
      }
      windowing.show("#towtruck-chat");
    });

    // FIXME: Don't think this makes sense
    $(".towtruck header.towtruck-title").each(function (index, item) {
      var button = $('<button class="towtruck-minimize"></button>');
      button.click(function (event) {
        var window = button.closest(".towtruck-window");
        windowing.hide(window);
      });
      $(item).append(button);
    });

    $("#towtruck-avatar-done").click(function () {
      ui.displayToggle("#towtruck-no-avatar-edit");
    });

    $("#towtruck-self-color").css({backgroundColor: peers.Self.color});

    var avatar = peers.Self.avatar;
    if (avatar) {
      $("#towtruck-self-avatar").attr("src", avatar);
    }

    var starterButton = $("#towtruck-starter button");
    starterButton.click(function () {
      windowing.show("#towtruck-about");
    }).addClass("towtruck-running");
    if (starterButton.text() == "Start TowTruck") {
      starterButton.attr("data-start-text", starterButton.text());
      starterButton.text("End TowTruck Session");
    }

    session.emit("new-element", ui.container);

    if (finishedAt && finishedAt > Date.now()) {
      setTimeout(function () {
        finishedAt = null;
        session.emit("ui-ready", ui);
      }, finishedAt - Date.now());
    } else {
      session.emit("ui-ready", ui);
    }

  };

  // Menu

  function showMenu(event) {
    var el = $("#towtruck-menu");
    assert(el.length);
    el.show();
    var bound = $("#towtruck-profile-button");
    var boundOffset = bound.offset();
    el.css({
      top: boundOffset.top + bound.height() - $window.scrollTop() + "px",
      left: (boundOffset.left + bound.width() - 10 - el.width() - $window.scrollLeft()) + "px"
    });
    $(document).bind("click", maybeHideMenu);
  }

  function toggleMenu() {
    if ($("#towtruck-menu").is(":visible")) {
      hideMenu();
    } else {
      showMenu();
    }
  }

  function hideMenu() {
    var el = $("#towtruck-menu");
    el.hide();
    $(document).unbind("click", maybeHideMenu);
    ui.displayToggle("#towtruck-self-name-display");
  }

  function maybeHideMenu(event) {
    var t = event.target;
    while (t) {
      if (t.id == "towtruck-menu") {
        // Click inside the menu, ignore this
        return;
      }
      t = t.parentNode;
    }
    hideMenu();
  }

  // Misc

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
    if (TowTruck.startTarget) {
      var el = $(TowTruck.startTarget);
      if (el.attr("data-start-towtruck-html")) {
        el.html(el.attr("data-start-towtruck-html"));
      }
      el.removeClass("towtruck-started");
    }
  });

  ui.chat = {
    text: function (attrs) {
      assert(typeof attrs.text == "string");
      assert(attrs.peer);
      assert(attrs.messageId);
      var date = attrs.date || Date.now();
      var el = templating.sub("chat-message", {
        peer: attrs.peer,
        content: attrs.text,
        date: date
      });
      linkify(el.find(".towtruck-chat-content"));
      el.attr("data-person", attrs.peer.id)
        .attr("data-date", date);
      ui.chat.add(el, attrs.messageId, attrs.notify);
    },

    leftSession: function (attrs) {
      assert(attrs.peer);
      var date = attrs.date || Date.now();
      var el = templating.sub("chat-left", {
        peer: attrs.peer,
        date: date
      });
      ui.chat.add(el, attrs.messageId, true);
    },

    system: function (attrs) {
      assert(! attrs.peer);
      assert(typeof attrs.text == "string");
      var date = attrs.date || Date.now();
      var el = templating.sub("chat-system", {
        content: attrs.text,
        date: date
      });
      ui.chat.add(el, undefined, true);
    },

    clear: function () {
      var container = ui.container.find("#towtruck-chat-messages");
      container.empty();
    },

    urlChange: function (attrs) {
      assert(attrs.peer);
      assert(typeof attrs.url == "string");
      var date = attrs.date || Date.now();
      var title;
      // FIXME: strip off common domain from msg.url?  E.g., if I'm on
      // http://example.com/foobar, and someone goes to http://example.com/baz then
      // show only /baz
      // FIXME: truncate long titles
      if (attrs.title) {
        title = attrs.title + " (" + attrs.url + ")";
      } else {
        title = attrs.url;
      }
      var el = templating.sub("url-change", {
        peer: attrs.peer,
        date: date,
        href: attrs.url,
        title: title
      });
      ui.chat.add(el, attrs.peer.className("url-change-"), true);
    },

    add: function (el, id, notify) {
      if (id) {
        el.attr("id", "towtruck-chat-" + util.safeClassName(id));
      }
      var container = ui.container.find("#towtruck-chat-messages");
      assert(container.length);
      var popup = ui.container.find("#towtruck-chat-notifier");
      container.append(el);
      ui.chat.scroll();
      if (notify && ! container.is(":visible")) {
        var section = popup.find("#towtruck-chat-notifier-message");
        section.empty();
        section.append(el.clone());
        windowing.show(popup);
      }
    },

    scroll: function () {
      var container = ui.container.find("#towtruck-chat-messages")[0];
      container.scrollTop = container.scrollHeight;
    }

  };

  session.on("display-window", function (id, win) {
    if (id == "towtruck-chat") {
      ui.chat.scroll();
    }
  });

  /* This class is bound to peers.Peer instances as peer.view.
     The .update() method is regularly called by peer objects when info changes. */
  ui.PeerView = util.Class({

    constructor: function (peer) {
      assert(peer.isSelf !== undefined, "PeerView instantiated with non-Peer object");
      this.peer = peer;
      this.urlNotification = null;
      this.dockClick = this.dockClick.bind(this);
    },

    /* Takes an element and sets any person-related attributes on the element
       Different from updates, which use the class names we set here: */
    setElement: function (el) {
      el.find(".towtruck-person")
        .addClass(this.peer.className("towtruck-person-"));
      el.find(".towtruck-person-literal")
        .addClass(this.peer.className("towtruck-person-literal-"));
      var avatarEl = el.find(".towtruck-avatar img, img.towtruck-avatar");
      avatarEl.addClass(this.peer.className("towtuck-avatar-"));
      avatarEl = el.find(".towtruck-avatar-box");
      avatarEl.addClass(this.peer.className("towtruck-avatar-box-"));
      var colors = el.find(".towtruck-person-bgcolor");
      colors.addClass(this.peer.className("towtruck-person-bgcolor-"));
      colors = el.find(".towtruck-person-bordercolor");
      colors.addClass(this.peer.className("towtruck-person-bordercolor-"));
      this.updateDisplay(el);
    },

    updateDisplay: function (container) {
      container = container || ui.container;
      var name;
      if (this.peer.isSelf) {
        name = "me";
      } else {
        name = this.name;
      }
      container.find("." + this.peer.className("towtruck-person-")).text(name || "");
      container.find("." + this.peer.className("towtruck-person-literal-")).text(this.peer.name || "(no name set)");
      var avatarEl = container.find("." + this.peer.className("towtruck-avatar-"));
      if (this.peer.avatar) {
        avatarEl.attr("src", this.peer.avatar);
      }
      avatarEl = container.find("." + this.peer.className("towtruck-avatar-box-"));
      if (this.peer.avatar) {
        avatarEl.css({
          backgroundImage: "url(" + this.peer.avatar + ")"
        });
      }
      avatarEl.attr("title", this.peer.name);
      if (this.peer.color) {
        avatarEl.css({
          borderColor: this.peer.color
        });
      }
      if (name) {
        avatarEl.attr("title", name);
      }
      if (this.peer.color) {
        var colors = container.find("." + this.peer.className("towtruck-person-bgcolor-"));
        colors.css({
          backgroundColor: this.peer.color
        });
        colors = container.find("." + this.peer.className("towtruck-person-bordercolor-"));
        colors.css({
          borderColor: this.peer.color
        });
      }
      if (this.peer.isSelf) {
        // FIXME: these could also have consistent/reliable class names:
        $("#towtruck-self-name").val(this.peer.name);
        $("#towtruck-self-color").css({backgroundColor: this.peer.color});
        $("#towtruck-self-avatar").attr("src", this.peer.avatar);
      }
    },

    update: function () {
      if (! this.peer.isSelf) {
        if (this.peer.status == "live") {
          this.dock();
        } else {
          this.undock();
        }
      }
      if (! this.peer.isSelf) {
        var curUrl = location.href.replace(/\#.*$/, "");
        if (this.peer.url != curUrl) {
          if (this.urlNotification) {
            this.updateUrl();
          } else {
            this.createUrl();
          }
        } else if (this.urlNotification) {
          this.removeUrl();
        }
      }
      this.updateDisplay();
    },

    createUrl: function () {
      this.urlNotification = templating.sub("url-change-popup", {
        peer: this.peer
      });
      this.urlNotification.find(".towtruck-follow").click((function () {
        var url = this.urlNotification.find("a.towtruck-url").attr("href");
        location.href = url;
      }).bind(this));
      // FIXME: should be handled in windowing:
      this.urlNotification.find(".towtruck-ignore .towtruck-close").click((function () {
        this.urlNotification.remove();
        return false;
      }).bind(this));
      this.urlNotification.find(".towtruck-nudge").click((function () {
        session.send({
          type: "url-change-nudge",
          url: location.href,
          to: this.peer.id
        });
      }).bind(this));
      ui.container.append(this.urlNotification);
      windowing.show(this.urlNotification, {
        bind: this.dockElement
      });
      this.updateUrl();
    },

    updateUrl: function () {
      assert(this.urlNotification);
      var fullTitle = this.peer.title;
      if (this.peer.title) {
        fullTitle += " (";
      }
      fullTitle += util.truncateCommonDomain(this.peer.url, location.href);
      if (this.peer.title) {
        fullTitle += ")";
      }
      this.urlNotification.find("a.towtruck-url").attr("href", this.peer.url).text(fullTitle);
      // FIXME: we've lost the notion of hiding the notification
    },

    removeUrl: function () {
      this.urlNotification.remove();
      this.urlNotification = null;
    },

    urlNudge: function () {
      // Called when this peer has nudged us to follow them
      if (this.urlNotification) {
        this.urlNotification.show();
        this.urlNotification.find(".towtruck-follow").addClass("towtruck-nudge");
      }
    },

    notifyJoined: function () {
      windowing.hide();
      var el = templating.sub("new-user", {
        peer: this.peer
      });
      ui.container.append(el);
      windowing.show(el, {
        bind: this.dockElement
      });
      setTimeout(function () {
        // FIXME: also set opacity of towtruck-window-pointer-left/right?
        el.css({
          MozTransition: "opacity 1s",
          WebkitTransition: "opacity 1s",
          transition: "opacity 1s",
          opacity: "0"
        });
        setTimeout(function () {
          windowing.hide();
        }, 1000);
      }, NEW_USER_FADE_TIMEOUT);
    },

    dock: function () {
      if (this.dockElement) {
        return;
      }
      this.dockElement = templating.sub("dock-person", {
        peer: this.peer
      });
      ui.container.find("#towtruck-dock-participants").append(this.dockElement);
      this.dockElement.click(this.click);
      var iface = $("#towtruck-interface");
      iface.css({
        height: iface.height() + BUTTON_HEIGHT + "px"
      });
    },

    undock: function () {
      if (! this.dockElement) {
        return;
      }
      this.dockElement.remove();
      this.dockElement = null;
      var iface = $("#towtruck-interface");
      iface.css({
        height: (iface.height() - BUTTON_HEIGHT) + "px"
      });
    },

    dockClick: function () {
      // FIXME: scroll to person
    },

    destroy: function () {
      if (this.urlNotification) {
        this.removeUrl();
      }
    }
  });

  session.hub.on("url-change-nudge", function (msg) {
    if (msg.to && msg.to != session.clientId) {
      // Not directed to us
      return;
    }
    msg.peer.urlNudge();
  });

  return ui;

});
