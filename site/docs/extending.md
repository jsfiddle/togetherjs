# Extending TogetherJS

This page documents some of the ways you can customize the TowTruck experience on your site.  Especially how you can extend TowTruck to synchronize parts of your application that require special treatment.

### Work in progress

We're still working on this part, and your feedback is especially important.  We're using the [extending](https://github.com/mozilla/towtruck/issues?labels=extending&milestone=&page=1&state=open) label to categorize tickets related to this.  If you have a use case you'd like us to address, please [open a new issue](https://github.com/mozilla/towtruck/issues/new) and describe it – and don't be shy, if it's a problem that can be solved with the API we've already implemented we don't mind describing how to use it in detail in a ticket.

### Configuring events

Like other configuration, you may not wish to set up these callbacks before `towtruck.js` is loaded.  You can do that with the `"on"` configuration parameter, like:

```js
TowTruckConfig_on = {
  ready: function () {}
};
```

Or if you want to set things separately you can do:

```js
TowTruckConfig_on_ready = function () {};
```

## Communication Channel

If you have a component you want to synchronize between two clients, you'll want to use the TowTruck communication channel.  This is a broadcast channel – any message you send is sent to everyone else in the session (which can also be no one), and includes people who are on different pages.

All messages are JSON objects with a `type` property.  Custom application messages are put into their own namespace.  So imagine you want to keep an element hidden or visible on all clients, in a synchronized way, and when the element visibility changes an event is fired, `MyApp.emit("visibilityChange", element, isVisible)`:

```js
TowTruckConfig_on_ready = function () {
  MyApp.on("visibilityChange", fireTowTruckVisibility);
};
TowTruckConfig_on_close = function () {
  MyApp.off("visibilityChange", fireTowTruckVisibility);
};
```

Now when TowTruck is activated we'll call `fireTowTruckVisibility(el, isVisible)`.  Now we have to write that function:

```js
function fireTowTruckVisibility(element, isVisible) {
  TowTruck.send({type: "visibilityChange", isVisible: isVisible, element: element});
}
```

Well, that's not quite right, we have to send a JSON object, and we can't send `element`.  Instead we need to give an identifier for the element.  TowTruck has a helpful function for that, which will require us to import the `elementFinder` module:

```js
function fireTowTruckVisibility(element, isVisible) {
  var elementFinder = TowTruck.require("elementFinder");
  var location = elementFinder.elementLocation(element);
  TowTruck.send({type: "visibilityChange", isVisible: isVisible, element: location});
}
```

Then we also have to listen for the message.  We can setup this listener right away (without using the ready/close TowTruck events) because when TowTruck isn't on then the event will just not fire:

```js
TowTruck.hub.on("visibilityChange", function (msg) {
  var elementFinder = TowTruck.require("elementFinder");
  // If the element can't be found this will throw an exception:
  var element = elementFinder.findElement(msg.element);
  MyApp.changeVisibility(element, msg.isVisible);
});
```

This has two major problems though: when you call `MyApp.changeVisibility` it will probably fire a `visibilityChange` event, which will cause another `fireTowTruckVisibility` call.  The result may or may not be circular, but it's definitely not efficient.  Another problem is that you can get messages from peers who are at a different URL.  We'll use a simple global variable to handle the first case, and `msg.sameUrl` to fix the second:

```js
var visibilityChangeFromRemote = false;

function fireTowTruckVisibility(element, isVisible) {
  if (visibilityChangeFromRemote) {
    return;
  }
  var elementFinder = TowTruck.require("elementFinder");
  var location = elementFinder.elementLocation(element);
  TowTruck.send({type: "visibilityChange", isVisible: isVisible, element: location});
}

TowTruck.hub.on("visibilityChange", function (msg) {
  if (! msg.sameUrl) {
    return;
  }
  var elementFinder = TowTruck.require("elementFinder");
  // If the element can't be found this will throw an exception:
  var element = elementFinder.findElement(msg.element);
  visibilityChangeFromRemote = true;
  try {
    MyApp.changeVisibility(element, msg.isVisible);
  } finally {
    visibilityChangeFromRemote = false;
  }
});
```

Now we're getting close, except for one last problem: these events sync everything when the users are on the same page, but there may be a late comer whose page won't be in sync with everything else.  An event `towtruck.hello` will fire when a person appears on a new page, and we can use to that send all our state.  To do this we'll imagine the `MyApp` object has a function like `MyApp.allToggleElements()` that returns a list of elements that we'd be expected to sync.

```js
TowTruck.hub.on("towtruck.hello", function (msg) {
  if (! msg.sameUrl) {
    return;
  }
  MyApp.allToggleElements.forEach(function (el) {
    var isVisible = $(el).is(":visible");
    fireTowTruckVisibility(el, isVisible);
  });
});
```

You'll notice that multiple clients might do this reset.  This is an open question for us, and in the future we'll provide a higher-level API for this kind of initialization.

### Implementing those visibility function from jQuery

Let's say your app doesn't have all these methods, and you are just using plain ol' jQuery.  Here's how you might implement them each; you'll just have to start using `$(el).syncShow()` and `$(el).syncHide()` to do your showing and hiding:

```js
$.fn.syncShow = function () {
  this.show();
  this.trigger("visibilityChange");
};

$.fn.syncHide = function () {
  this.hide();
  this.trigger("visibilityChange");
};

$(document).on("visibilityChange", function () {
  MyApp.emit("visibilityChange", this, $(this).is(":visible"));
});

MyApp.changeVisibility = function (el, isVisible) {
  if (isVisible && ! el.is(":visible")) {
    el.syncShow();
  } else if ((! isVisible) && el.is(":visible")) {
    el.syncHide();
  }
};
```

## Setting identity information

There's a good chance your application has its own identity, and you know the name of the user, and perhaps have an avatar.  (If you don't have an avatar but do have an email, you might want to use that to make a Gravatar.)

To see an example of this see `/example/app-integration`

To do this you configure TowTruck with some functions:

`TowTruckConfig_getUserName = function () {return 'User Name';};`

This returns the user's name (or nick).  Return null if you can't determine the name.

`TowTruckConfig_getUserAvatar = function () {return avatarUrl;};`

This returns a URL to the user's avatar.  It should be 40px square.  Again return null if you aren't sure.

`TowTruckConfig_getUserColor = function () {return '#ff00ff';};`

This returns the user's preferred color that represents them.  This should be a CSS color.

If any of these values are updated while in the page (like if you have a login process that doesn't cause a page reload) then call `TowTruck.refreshUserData()` and the respective `getUser*` callbacks will all be called again.

See [#504](https://github.com/mozilla/towtruck/issues/504) for a bug related to improving this support.

## `TowTruck.reinitialize()`

You can run this to try to reinitialize anything TowTruck initializes on page load.  In particular you can use it if there are new textareas or code editors that should be sync'd, but were added dynamically to the page.  E.g.:

```javascript
$("#form").append("<textarea>");
TowTruck.reinitialize();
```

(We hope with [#70](https://github.com/mozilla/towtruck/issues/70) that this will no longer be necessary.)

## TowTruck events

The `TowTruck` object is an event emitter.  It uses the style of `TowTruck.on("event", handler)`.  The available events:

- `TowTruck.on("ready", function () {})`: emitted when TowTruck is fully started up.
- `TowTruck.on("close", function () {})`: emitted when TowTruck is closed.  This is *not* emitted when the page simply closes or navigates elsewhere.  It is only closed when TowTruck is specifically stopped.

## Deferring Initialization

TowTruck starts up automatically as soon as it can, especially when continuing a session.  Sometimes this is problematic, like an application that bootstraps all of its UI after page load.  To defer this initialization, define a function `TowTruckConfig_callToStart` like:

```js
TowTruckConfig_callToStart = function (callback) {
  MyApp.onload = callback;
};
```

In this example when `MyApp.onload()` is called, TowTruck will start to initialize itself.  Note that calling `TowTruck.reinitialize()` might be sufficient for your application's needs if it does a lot of setup after the page loads.

## Invitation

Sometimes instead of having the user invite someone to TowTruck you might want to handle the invitation internally in your app.  So typically when the person started TowTruck, you'd want to find some other person they want to collaborate with and send the TowTruck link to them.  To get at the TowTruck link:

```js
TowTruckConfig_on_ready = function () {
  sendTowTruckURLToServer(TowTruck.shareUrl());
};
```

If you call `TowTruck.shareUrl()` before TowTruck is initialized it will return `null`.

## Getting At The Innards

You can still get at TowTruck, even if you can't rely on the internals not to change underneath you.  (You would be well recommended to deploy your own copy of the client if you do this stuff.)

Most of the TowTruck features are implemented as individual modules, so it should be possible to introduce your own module to do many of the same things.  The most important thing is the `session` module, and sending and receiving messages.

To get the session module (or any module) you can run this after TowTruck starts:

```javascript
var session = TowTruck.require("session");
```

This assumes that the module has already been loaded... but that assumption would be correct once TowTruck has started.

Then there are two interesting methods:

```javascript
session.send({type: "my-custom-type", attr: value});
session.hub.on("my-custom-type", function (msg) {
  alert(msg.value);
});
```

I.e., `session.send()` and `session.hub.on()`.  As you can see the messages are dispatched based on `msg.type`.  These messages are broadcasted to all other participants.  Note that the messages are *always* sent, even if the other person is at a different URL.  To check if an incoming message comes from a person on the same page as you, check `msg.sameUrl` (`msg.url` shows the actual URL of the other person).