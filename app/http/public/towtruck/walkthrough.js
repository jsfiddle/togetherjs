define(["util", "guiders", "jquery", "ui"], function (util, guiders, $, ui) {
  var assert = util.assert;
  var walkthrough = util.Module("walkthrough");

  // FIXME: not sure I should do this so aggressively.
  var link = $('<link rel="stylesheet">').attr("href", TowTruck.baseUrl + "/towtruck/libs/Guider-JS/guiders-1.3.0.css");
  $("head").append(link);

  // These are options that are added to the individual guides if the guides don't
  // have these options themselves:
  var defaultGuideOptions = {
    buttons: [{name: "Back"}, {name: "Next"}, {name: "Close"}],
    // This is assigned to the first item.buttons in the guide:
    firstButtons: [{name: "Next"}, {name: "Close"}],
    // This is assigned to the last item.buttons in the guide:
    lastButtons: [{name: "Back"}, {name: "Close"}],
    position: 9,
    xButton: true,
    closeOnEscape: true
  };

  function showSettings(){
    ui.displayWindow('#towtruck-about');
  }
  function hideWindow(){
    ui.hideWindow();
  }

  // See here for information about the options for Guiders:
  //   https://github.com/jeff-optimizely/Guiders-JS
  var guide = [
    {
      overlay: true,
      title: "Thanks for checking out \
              <a href=\"https://towtruck.mozillalabs.com/\" target=\"_blank\">TowTruck</a>!",
      description: "<p>\
                    This is an <strong>alpha preview</strong> so we apologize \
                    for the rough edges. Since this is an alpha we'd very much \
                    appreciate feedback, and you can be assured we'll be paying \
                    attention to it.  After trying this out some, please \
                    submit feedback via the link you can find by clicking \
                    the TowTruck button.\
                    </p> \
                    <p>\
                    For a basic introduction to TowTruck and what it's \
                    all about, watch this video:\
                    <iframe \
                      src=\"http://player.vimeo.com/video/57992755?byline=0&amp;portrait=0&amp;api=1&amp;player_id=modal_vimeo_iframe\" \
                      width=\"400\" height=\"300\" frameborder=\"0\" webkitAllowFullScreen mozallowfullscreen allowFullScreen>\
                    </iframe>\
                    </p>\
                    <p>To walk through the menu and features of TowTruck, click \"Next\".</p>"
    },
    {
      overlay: true,
      attachTo: "#towtruck-about-button",
      title: "The Great Big TowTruck Button",
      description: "<p>Hiding behind the Truck button are your settings.</p> \
                    <p>Click \"Next\" and we'll go through them.</p>"
    },
    {
      overlay: true,
      attachTo: "#towtruck-share-link",
      title: "Your Share Link",
      description: "<p>This is a link unique to this session.</p> \
                    <p><em>Anyone</em> with this link can join your session. \
                    &mdash; Send it to your friend over IM to have them join you.</p>",
      onShow: showSettings,
      onHide: hideWindow
    },
    {
      overlay: true,
      attachTo: "#towtruck-self-name",
      title: "Your Name",
      description: "<p> \
                      This is the name that other collaborators see next to your \
                      cursor and in chat messages. \
                    </p> \
                    <p> \
                      Fill it out now to set your name. \
                    </p>",
      onShow: showSettings,
      onHide: hideWindow
    },
    {
      overlay: true,
      attachTo: "#towtruck-end-session",
      title: "End TowTruck Session",
      description: "<p>Clicking this link disconnects you from all other collaborators.</p>",
      onShow: showSettings,
      onHide: hideWindow
    },
    {
      overlay: true,
      attachTo: "#towtruck-feedback-button",
      title: "We want your Feedback!",
      description: "<p> \
                      We're excited to hear from you. Click this link and give us your feedback. \
                    </p>",
      onShow: showSettings,
      onHide: hideWindow
    },
    {
      overlay: true,
      attachTo: "#towtruck-audio-button",
      title: "Audio",
      description: "<p> \
                      If your browser supports it, you can live chat with one other collaborator. \
                    </p> \
                    <p> \
                      This feature currently has some limitations and will be changing significantly \
                      before we go Beta. To learn more about this feature, check \
                      <a href=\"https://github.com/mozilla/towtruck/wiki/About-Audio-Chat-and-WebRTC\"> \
                        this page \
                      </a> on our developer Wiki.\
                    </p>"
    },
    {
      overlay: true,
      attachTo: "#towtruck-chat-button",
      onHide: hideWindow,
      title: "Chat",
      description: "<p> \
                      This is the Chat button. Click it to text chat with your collaborators.\
                    </p>"
    },
    {
      overlay: true,
      attachTo: "#towtruck-chat-input",
      onShow: function(){
        ui.displayWindow('#towtruck-chat');
      },
      onHide: hideWindow,
      title: "Chat",
      description: "<p> \
                      Type message here and hit enter. All of your collaborators will be able to see \
                      what you typed. \
                    </p>"
    }
  ];

  var builtGuiders = null;

  var idCount = 1;

  walkthrough.start = function () {
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
        console.log("creating", JSON.stringify(options, null, "  "));
        guiders.createGuider(options);
      });
    }
    console.log("starting", builtGuiders[0]);
    guiders.show("help-1");
  };

  return walkthrough;
});
