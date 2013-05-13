/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["util", "guiders", "jquery", "windowing"], function (util, guiders, $, windowing) {
  var assert = util.assert;
  var walkthrough = util.Module("walkthrough");

  // FIXME: not sure I should do this so aggressively, maybe only when
  // the walkthrough is started.
  var link = $('<link rel="stylesheet">').attr("href", TowTruck.baseUrl + "/towtruck/libs/Guider-JS/guiders-1.3.0.css");
  $("head").append(link);

  walkthrough.stop = function () {
    guiders.hideAll();
    if (onHideAll) {
      onHideAll();
      onHideAll = null;
    }
  };

  // These are options that are added to the individual guides if the guides don't
  // have these options themselves:
  var defaultGuideOptions = {
    onClose: walkthrough.stop,
    buttons:
      [{
       name: "Back",
       classString: "towtruck-walkthru-back-button"
       },
       {
         name: "Use TowTruck",
         classString: "towtruck-walkthru-getstarted-button",
         onclick: walkthrough.stop
        },
      {
       name: "Next",
       classString: "towtruck-walkthru-next-button"
       }],

    // buttons: [{name: "Get started", onclick: walkthrough.stop},{name: "Back"}, {name: "Next"}],
    // This is assigned to the first item.buttons in the guide:
    firstButtons:
      [{
        name: "Use TowTruck",
        classString: "towtruck-walkthru-getstarted-button",
        onclick: walkthrough.stop
       },
      {
       name: "Next",
       classString: "towtruck-walkthru-next-button"
       }],

    // This is assigned to the last item.buttons in the guide:
    lastButtons:
      [{
        name: "Use TowTruck",
        classString: "towtruck-walkthru-getstarted-button",
        onclick: walkthrough.stop
       },{
         name: "Back",
         classString: "towtruck-walkthru-back-button"
      }],

    position: 9,
    overlay: true,
    width:400,
    closeOnEscape: true,
    onHide: hideWindow,
    xButton: true
  };

  function showChat(){
    windowing.show('#towtruck-chat');
  }

  function showSettings(){
    windowing.show('#towtruck-about');
  }
  function hideWindow(){
    windowing.hide();
  }

  // See here for information about the options for Guiders:
  //   https://github.com/jeff-optimizely/Guiders-JS
  var guide = [
    {
      overlay: true,
      title: "Welcome to TowTruck!",
      description: (
        "<p>\n" +
            "<iframe " +
            "src=\"//player.vimeo.com/video/64117317?byline=0&amp;portrait=0&amp;api=1&amp;player_id=modal_vimeo_iframe\" " +
            "width=\"400\" height=\"300\" frameborder=\"0\" webkitAllowFullScreen mozallowfullscreen allowFullScreen>" +
            "</iframe>" +
            "</p>\n" +
			"<p>TowTruck is a service for your website that makes it easy to collaborate in real-time.</p>"
        ),
      onHide: hideWindow
    },
    {
      overlay: true,
      attachTo: "#towtruck-about-button",
      title: "Connect with friends",
      description: "<img src=\"/images/walkthru-img-01.png\" alt=\"Walkthrough image 1\"><p>Click here to collaborate with friends.</p>"
    },
    {
      overlay: true,
      attachTo: "#towtruck-share-link",
      title: "Share this link",
      description: "<img src=\"/images/walkthru-img-02.png\" alt=\"Walkthrough image 2\"><p>To collaborate using TowTruck, just copy and paste this link and send it to a friend!</p>",
      onShow: showSettings
    },
    {
      overlay: true,
      attachTo: "#towtruck-audio-button",
      title: "Talk in real-time",
      description: "<img src=\"/images/walkthru-img-03.png\" alt=\"Walkthrough image 3\"><p>If your browser supports it, click here to begin a live audio chat.</p><p>Since this is an experimental feature, you can learn more <a href=\"https://github.com/mozilla/towtruck/wiki/About-Audio-Chat-and-WebRTC\">here</a>.</p>"
    },
    {
      overlay: true,
      attachTo: "#towtruck-chat",
      onHide: hideWindow,
      title: "Chat with friends",
      description: "<img src=\"/images/walkthru-img-04.png\" alt=\"Walkthrough image 4\"><p>Easily text chat with your friends.</p>",
      onShow: showChat
    },
    {
      overlay: true,
      title: "Start TowTruck!",
      description: "<img src=\"/images/walkthru-img-05.png\" alt=\"Walkthrough image 5\"><p>Alright, you're ready to use TowTruck! Now get collaborating!</p>"
    }
  ];

  var builtGuiders = null;

  var idCount = 1;

  var onHideAll = null;

  walkthrough.start = function (doneCallback) {
    onHideAll = doneCallback;
    if (! builtGuiders) {
      builtGuiders = [];
      guide.forEach(function (item) {
        if (! item.id) {
          item.id = "help-" + (idCount++);
        }
      });
      guide.forEach(function (item, index) {
        var options = util.extend(util.extend(defaultGuideOptions), item);
        if (options.next === undefined && guide[index+1]) {
          options.next = guide[index+1].id;
        }
        if (index === 0 && options.buttons === defaultGuideOptions.buttons) {
          options.buttons = options.firstButtons;
        }
        if (index === guide.length-1 && options.buttons === defaultGuideOptions.buttons) {
          options.buttons = options.lastButtons;
        }
        guiders.createGuider(options);
      });
    }
    guiders.show("help-1");
  };

  return walkthrough;
});
