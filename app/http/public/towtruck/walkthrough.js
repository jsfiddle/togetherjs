define(["util", "guiders", "jquery", "ui"], function (util, guiders, $, ui) {
  var assert = util.assert;
  var walkthrough = util.Module("walkthrough");

  // FIXME: not sure I should do this so aggressively.
  var link = $('<link rel="stylesheet">').attr("href", TowTruck.baseUrl + "/towtruck/libs/Guider-JS/guiders-1.3.0.css");
  $("head").append(link);

  // These are options that are added to the individual guides if the guides don't
  // have these options themselves:
  var defaultGuideOptions = {
    buttons: [{name: "Get started", onclick: guiders.hideAll},{name: "Back"}, {name: "Next"}],
    // This is assigned to the first item.buttons in the guide:
    firstButtons: [{name: "Get started", onclick: guiders.hideAll},{name: "Next"}],
    // This is assigned to the last item.buttons in the guide:
    lastButtons: [{name: "Get started", onclick: guiders.hideAll}],
    position: 9,
	  overlay: true,
	  width:400,
    closeOnEscape: true,
    onHide: hideWindow
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
      title: "Welcome to TowTruck!",
      description: "<p>\
                    <iframe \
                      src=\"http://player.vimeo.com/video/57992755?byline=0&amp;portrait=0&amp;api=1&amp;player_id=modal_vimeo_iframe\" \
                      width=\"400\" height=\"300\" frameborder=\"0\" webkitAllowFullScreen mozallowfullscreen allowFullScreen>\
                    </iframe>\
                    </p>\
					<p><a href='https://towtruck.mozillalabs.com/' target='_blank'>TowTruck</a> is a service for your website that makes it easy to collaborate in real-time.</p>",
	    onHide: hideWindow,
	    onShow: showSettings
    },
    {
      overlay: true,
      attachTo: "#towtruck-about-button",
      title: "Connect with friends",
      description: "Click here to start your TowTruck session.  Just copy and paste the TowTruck link, and send it to your friend!"
    },
    {
      overlay: true,
      attachTo: "#towtruck-audio-button",
      title: "Talk with friends",
      description: "If your browser supports it, you can audio chat live with your friend over the browser just like magic!"
    },
    {
      overlay: true,
      attachTo: "#towtruck-chat-button",
      onHide: hideWindow,
      title: "Chat with friends",
      description: "You know how this works :)"
    },
    {
      overlay: true,
      attachTo: "#towtruck-anchor",
      title: "Move the dock",
      description: "Grab here to move the dock to the right or left side of the browser."
    },
    {
      overlay: true,
      attachTo: "#towtruck-interface",
      title: "TowTruck it up!",
      description: "You're ready to use TowTruck!  Remember, to "
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
