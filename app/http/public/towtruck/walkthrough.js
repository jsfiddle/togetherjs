define(["util", "guiders", "jquery", "ui"], function (util, guiders, $, ui) {
  var assert = util.assert;
  var walkthrough = util.Module("walkthrough");

  // FIXME: not sure I should do this so aggressively.
  var link = $('<link rel="stylesheet">').attr("href", TowTruck.baseUrl + "/towtruck/libs/Guider-JS/guiders-1.3.0.css");
  $("head").append(link);

  // These are options that are added to the individual guides if the guides don't
  // have these options themselves:
  var defaultGuideOptions = {
    buttons: [{name: "Back"}, {name: "Next"}, {name: "Okay, I get it!"}],
    // This is assigned to the first item.buttons in the guide:
    firstButtons: [{name: "Next"}, {name: "Okay, I get it!"}],
    // This is assigned to the last item.buttons in the guide:
    lastButtons: [{name: "Cool, let's get started!"}],
    position: 9,
	overlay: true,
	width:300,
    closeOnEscape: true
  };

  // See here for information about the options for Guiders:
  //   https://github.com/jeff-optimizely/Guiders-JS
  var guide = [
	{
	  attachTo: "#towtruck-about-button",
      title: "Set up TowTruck",
      description: "Click here to <ol><li>Send a link to your friend to start the TowTruck session</li><li>Set up your profile</li><li>End the TowTruck session</li></ol>"
    },
    {
      attachTo: "#towtruck-audio-button",
      title: "Talk in real-time",
      description: "If your browser supports it, you can audio chat live with your friend over the browser just like...magic!"
    },
    {
      attachTo: "#towtruck-chat-button",
      title: "Chat with friends",
      description: "You know how this works :)"
    },
	{
      attachTo: "#towtruck-anchor",
      title: "Move the dock",
      description: "You can move the dock to the right or left side of the browser.<p>Ready to start?</p>"
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
