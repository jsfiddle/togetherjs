/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["require", "jquery", "util", "session", "templates", "templating", "linkify", "peers", "windowing", "tinycolor", "elementFinder"], function (require, $, util, session, templates, templating, linkify, peers, windowing, tinycolor, elementFinder) {
  var ui = util.Module('ui');
  var assert = util.assert;
  var AssertionError = util.AssertionError;
  var chat;
  var $window = $(window);
  // This is also in towtruck.less, as @button-height:
  var BUTTON_HEIGHT = 60 + 1; // 60 is button height, 1 is border
  // This is also in towtruck.less, under .towtruck-animated
  var ANIMATION_DURATION = 1000;
  // Time the new user window sticks around until it fades away:
  var NEW_USER_FADE_TIMEOUT = 5000;
  // This is set when an animation will keep the UI from being ready
  // (until this time):
  var finishedAt = null;
  // Time in milliseconds for the dock to animate out:
  var DOCK_ANIMATION_TIME = 300;

  var COLORS = [
    "#8A2BE2", "#7FFF00", "#DC143C", "#00FFFF", "#8FBC8F", "#FF8C00", "#FF00FF",
    "#FFD700", "#F08080", "#90EE90", "#FF6347"];

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
    var iface = $("#towtruck-dock");
    if (iface.hasClass("towtruck-dock-right")) {
      return "right";
    } else if (iface.hasClass("towtruck-dock-left")) {
      return "left";
    } else if (iface.hasClass("towtruck-dock-bottom")) {
      return "bottom";
    } else {
      throw new AssertionError("#towtruck-dock doesn't have positioning class");
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
        var iface = container.find("#towtruck-dock");
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
    ui.container.find(".towtruck-window > header, .towtruck-modal > header").each(function () {
      $(this).append($('<button class="towtruck-close"></button>'));
    });
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
    ui.prepareShareLink(container);
    container.find(".towtruck-share-link").on("keydown", function (event) {
      if (event.which == 27) {
        windowing.hide("#towtruck-share");
        return false;
      }
      return undefined;
    });
    session.on("shareId", updateShareLink);

    // The chat input element:
    var input = container.find("#towtruck-chat-input");
    input.bind("keyup", function (event) {
      if (event.which == 13) { // Enter
        submitChat();
        return false;
      }
      if (event.which == 27) { // Escape
        windowing.hide("#towtruck-chat");
      }
      return false;
    });

    function submitChat() {
      var val = input.val();
      if (! val) {
        return;
      }
      chat.submit(val);
      input.val("");
    }

    util.testExpose({submitChat: submitChat});

    // Moving the window:
    // FIXME: this should probably be stickier, and not just move the window around
    // so abruptly
    var anchor = container.find("#towtruck-dock-anchor");
    assert(anchor.length);
    // FIXME: This is in place to temporarily disable dock dragging:
    anchor = container.find("#towtruck-dock-anchor-disabled");
    anchor.mousedown(function (event) {
      var iface = $("#towtruck-dock");
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
        iface.removeClass("towtruck-dock-left");
        iface.removeClass("towtruck-dock-right");
        iface.removeClass("towtruck-dock-bottom");
        iface.addClass("towtruck-dock-" + pos);
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

    $("#towtruck-menu-feedback").click(function(){
      windowing.hide();
      hideMenu();
      windowing.show("#towtruck-feedback-form");
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
      var input = $("#towtruck-menu .towtruck-self-name");
      input.css({
        width: $("#towtruck-menu").width() - 32 + "px"
      });
      ui.displayToggle("#towtruck-menu .towtruck-self-name");
      $("#towtruck-menu .towtruck-self-name").focus();
    });

    $("#towtruck-menu .towtruck-self-name").bind("keyup", function (event) {
      if (event.which == 13) {
        ui.displayToggle("#towtruck-self-name-display");
        return;
      }
      var val = $("#towtruck-menu .towtruck-self-name").val();
      if (val) {
        peers.Self.update({name: val});
      }
    });

    $("#towtruck-menu-update-avatar").click(function () {
      hideMenu();
      windowing.show("#towtruck-avatar-edit");
    });

    $("#towtruck-menu-end").click(function () {
      hideMenu();
      windowing.show("#towtruck-confirm-end");
    });

    $("#towtruck-end-session").click(function () {
      session.close();
    });

    $("#towtruck-menu-update-color").click(function () {
      var picker = $("#towtruck-pick-color");
      if (picker.is(":visible")) {
        picker.hide();
        return;
      }
      picker.show();
      bindPicker();
      picker.find(".towtruck-swatch-active").removeClass("towtruck-swatch-active");
      picker.find(".towtruck-swatch[data-color=\"" + peers.Self.color + "\"]").addClass("towtruck-swatch-active");
    });

    $("#towtruck-pick-color").click(".towtruck-swatch", function (event) {
      var swatch = $(event.target);
      var color = swatch.attr("data-color");
      peers.Self.update({
        color: color
      });
      event.stopPropagation();
      return false;
    });

    $("#towtruck-pick-color").click(function (event) {
      $("#towtruck-pick-color").hide();
      event.stopPropagation();
      return false;
    });

    COLORS.forEach(function (color) {
      var el = templating.sub("swatch");
      el.attr("data-color", color);
      var darkened = tinycolor.darken(color);
      el.css({
        backgroundColor: color,
        borderColor: darkened
      });
      $("#towtruck-pick-color").append(el);
    });

    $("#towtruck-chat-button").click(function () {
      windowing.toggle("#towtruck-chat");
    });

    session.on("display-window", function (id, element) {
      if (id == "towtruck-chat") {
        $("#towtruck-chat-input").focus();
      } else if (id == "towtruck-share") {
        element.find(".towtruck-share-link").focus();
        element.find(".towtruck-share-link").select();
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

  ui.prepareShareLink = function (container) {
    container.find(".towtruck-share-link").click(function () {
      $(this).select();
    }).change(function () {
      updateShareLink();
    });
    updateShareLink();
  };

  // Menu

  function showMenu(event) {
    var el = $("#towtruck-menu");
    assert(el.length);
    el.show();
    bindMenu();
    $(document).bind("click", maybeHideMenu);
  }

  function bindMenu() {
    var el = $("#towtruck-menu:visible");
    if (el.length) {
      var bound = $("#towtruck-profile-button");
      var boundOffset = bound.offset();
      el.css({
        top: boundOffset.top + bound.height() - $window.scrollTop() + "px",
        left: (boundOffset.left + bound.width() - 10 - el.width() - $window.scrollLeft()) + "px"
      });
    }
  }

  function bindPicker() {
    var picker = $("#towtruck-pick-color:visible");
    if (picker.length) {
      var menu = $("#towtruck-menu-update-color");
      var menuOffset = menu.offset();
      picker.css({
        top: menuOffset.top + menu.height(),
        left: menuOffset.left
      });
    }
  }

  session.on("resize", function () {
    bindMenu();
    bindPicker();
  });

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
    $("#towtruck-pick-color").hide();
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
    var el = $(".towtruck-share-link");
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

    joinedSession: function (attrs) {
      assert(attrs.peer);
      var date = attrs.date || Date.now();
      var el = templating.sub("chat-joined", {
        peer: attrs.peer,
        date: date
      });
      // FIXME: should bind the notification to the dock location
      ui.chat.add(el, attrs.peer.className("join-message-"), 4000);
    },

    leftSession: function (attrs) {
      assert(attrs.peer);
      var date = attrs.date || Date.now();
      var el = templating.sub("chat-left", {
        peer: attrs.peer,
        date: date,
        declinedJoin: attrs.declinedJoin
      });
      // FIXME: should bind the notification to the dock location
      ui.chat.add(el, attrs.peer.className("join-message-"), 4000);
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
      console.log("urlChange", attrs);
      assert(attrs.peer);
      assert(typeof attrs.url == "string");
      assert(typeof attrs.sameUrl == "boolean");
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
        title: title,
        sameUrl: attrs.sameUrl
      });
      ui.chat.add(el, attrs.peer.className("url-change-"), false);
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
        if (typeof notify == "number") {
          // This is the amount of time we're supposed to notify
          popup.fadeOut(notify);
        }
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
      windowing.hide("#towtruck-chat-notifier");
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
      var count = 0;
      var classes = ["towtruck-person", "towtruck-person-status",
                     "towtruck-person-name", "towtruck-person-name-abbrev",
                     "towtruck-person-bgcolor", "towtruck-person-swatch",
                     "towtruck-person-status", "towtruck-person-role",
                     "towtruck-person-url", "towtruck-person-url-title"];
      classes.forEach(function (cls) {
        var els = el.find("." + cls);
        els.addClass(this.peer.className(cls + "-"));
        count += els.length;
      }, this);
      if (! count) {
        console.warn("setElement(", el, ") doesn't contain any person items");
      }
      this.updateDisplay(el);
    },

    updateDisplay: function (container) {
      container = container || ui.container;
      var abbrev = this.peer.name;
      if (this.peer.isSelf) {
        abbrev = "me";
      }
      container.find("." + this.peer.className("towtruck-person-name-")).text(this.peer.name || "");
      container.find("." + this.peer.className("towtruck-person-name-abbrev-")).text(abbrev);
      var avatarEl = container.find("." + this.peer.className("towtruck-person-"));
      if (this.peer.avatar) {
        avatarEl.css({
          backgroundImage: "url(" + this.peer.avatar + ")"
        });
      }
      if (this.peer.idle == "inactive") {
        avatarEl.addClass("towtruck-person-inactive");
      } else {
        avatarEl.removeClass("towtruck-person-inactive");
      }
      avatarEl.attr("title", this.peer.name);
      if (this.peer.color) {
        avatarEl.css({
          borderColor: this.peer.color
        });
      }
      if (this.peer.color) {
        var colors = container.find("." + this.peer.className("towtruck-person-bgcolor-"));
        colors.css({
          backgroundColor: this.peer.color
        });
      }
      container.find("." + this.peer.className("towtruck-person-role-"))
        .text(this.peer.isCreator ? "Creator" : "Participant");
      var urlName = this.peer.title || "";
      if (this.peer.title) {
        urlName += " (";
      }
      urlName += util.truncateCommonDomain(this.peer.url, location.href);
      if (this.peer.title) {
        urlName += ")";
      }
      container.find("." + this.peer.className("towtruck-person-url-title-"))
        .text(urlName);
      var url = this.peer.url;
      if (this.peer.urlHash) {
        url += this.peer.urlHash;
      }
      container.find("." + this.peer.className("towtruck-person-url-"))
        .attr("href", url);
      // FIXME: should have richer status:
      container.find("." + this.peer.className("towtruck-person-status-"))
        .text(this.peer.idle == "active" ? "Active" : "Inactive");
      if (this.peer.isSelf) {
        // FIXME: these could also have consistent/reliable class names:
        var selfName = $(".towtruck-self-name");
        selfName.each((function (index, el) {
          el = $(el);
          if (el.val() != this.peer.name) {
            el.val(this.peer.name);
          }
        }).bind(this));
        $("#towtruck-menu-avatar").attr("src", this.peer.avatar);
      }
      updateChatParticipantList();
      this.updateFollow();
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
      this.updateUrlDisplay();
    },

    updateUrlDisplay: function () {
      var url = this.peer.url;
      if ((! url) || url == this._lastUpdateUrlDisplay) {
        return;
      }
      this._lastUpdateUrlDisplay = url;
      var sameUrl = url == session.currentUrl();
      ui.chat.urlChange({
        peer: this.peer,
        url: this.peer.url,
        title: this.peer.title,
        sameUrl: sameUrl
      });
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
        this.peer.nudge();
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
      ui.chat.joinedSession({
        peer: this.peer
      });
    },

    dock: function () {
      if (this.dockElement) {
        return;
      }
      this.dockElement = templating.sub("dock-person", {
        peer: this.peer
      });
      this.dockElement.attr("id", this.peer.className("towtruck-dock-element-"));
      ui.container.find("#towtruck-dock-participants").append(this.dockElement);
      this.dockElement.animateDockEntry();
      var iface = $("#towtruck-dock");
      iface.css({
        height: iface.height() + BUTTON_HEIGHT + "px"
      });
      this.detailElement = templating.sub("participant-window", {
        peer: this.peer
      });
      this.detailElement.find(".towtruck-follow").click(function () {
        location.href = $(this).attr("href");
      });
      this.detailElement.find(".towtruck-nudge").click((function () {
        this.peer.nudge();
      }).bind(this));
      ui.container.append(this.detailElement);
      this.dockElement.click((function () {
        if (this.detailElement.is(":visible")) {
          windowing.hide(this.detailElement);
        } else {
          windowing.show(this.detailElement, {bind: this.dockElement});
          this.scrollTo();
        }
      }).bind(this));
      this.updateFollow();
    },

    undock: function () {
      if (! this.dockElement) {
        return;
      }
      this.dockElement.animateDockExit().promise().then((function () {
        this.dockElement.remove();
        this.dockElement = null;
        this.detailElement.remove();
        this.detailElement = null;
        var iface = $("#towtruck-dock");
        iface.css({
         height: (iface.height() - BUTTON_HEIGHT) + "px"
        });
      }).bind(this));
    },

    scrollTo: function () {
      if (this.peer.url != session.currentUrl()) {
        return;
      }
      var pos = this.peer.scrollPosition;
      if (! pos) {
        console.warn("Peer has no scroll position:", this.peer);
        return;
      }
      pos = elementFinder.pixelForPosition(pos);
      $(document.body).easeTo(pos);
    },

    updateFollow: function () {
      if (! this.peer.url) {
        return;
      }
      if (! this.detailElement) {
        return;
      }
      var same = this.detailElement.find(".towtruck-same-url");
      var different = this.detailElement.find(".towtruck-different-url");
      if (this.peer.url == session.currentUrl()) {
        same.show();
        different.hide();
      } else {
        same.hide();
        different.show();
      }
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

  function updateChatParticipantList() {
    var live = peers.getAllPeers(true);
    if (live.length) {
      ui.displayToggle("#towtruck-chat-participants");
      $("#towtruck-chat-participant-list").text(
        live.map(function (p) {return p.name;}).join(", "));
    } else {
      ui.displayToggle("#towtruck-chat-no-participants");
    }
  }

  ui.showUrlChangeMessage = function (peer, url) {
    var window = templating.sub("url-change", {peer: peer});
    ui.container.append(window);
    windowing.show(window);
  };

  session.hub.on("url-change-nudge", function (msg) {
    if (msg.to && msg.to != session.clientId) {
      // Not directed to us
      return;
    }
    msg.peer.urlNudge();
  });

  return ui;

});
