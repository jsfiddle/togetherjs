# Documentation

<!--
template: docs.tmpl
-->

Would you like to use TowTruck on your site?  Great!  If you have feedback on this or any other part of TowTruck [we'd like to hear it](https://docs.google.com/forms/d/1lVE7JyRo_tjakN0mLG1Cd9X9vseBX9wci153z9JcNEs/viewform)!

## Quick Start

The quickest is to include two things on your page.  First the Javascript:

```html
<script>
  // Set to false or delete to disable analytics/tracking:
  TowTruckConfig_enableAnalytics = true;
</script>
<script src="https://towtruck.mozillalabs.com/towtruck.js"></script>
```

The first part configures TowTruck.  In the example we configure it to send analytics information back to us (Mozilla), so we can get an idea of who is using TowTruck.  You can turn it off, but we do appreciate the information, especially during the alpha stage.  There's not much configuration yet, but we'll go over what there is later.

The next step is to put a button on your site that lets a user start TowTruck:

```html
<button onclick="TowTruck(this); return false;">Start TowTruck</button>
```

You could also do something like:

```html
<button id="start-towtruck">Start TowTruck</button>
<script>
$(function () {
  $("#start-towtruck").click(TowTruck);
});
</script>
```

You should put the `towtruck.js` script on every page in your site – two people can collaborate across the entire site then.  If you forget it on a page, then if someone visits that page while in a TowTruck session they will essentially go "offline" until they come back to another page that includes `towtruck.js`

Note that `towtruck.js` *is not* the entire code for TowTruck, it's only a fairly small file that loads the rest of TowTruck on demand.  You can place the `<script>` anywhere on the page – generally before `</body>` is considered the best place to put scripts.

### Scope of the session

TowTruck sessions are connected to the domain you start them on (specifically the [origin](http://tools.ietf.org/html/rfc6454)).  So if part of your site is on another domain, people won't be able to talk across those domains.  Even a page that is on https when another is on http will cause the session to be lost.  We might make this work sometime, but if it's an issue to you please give us [feedback](https://docs.google.com/forms/d/1lVE7JyRo_tjakN0mLG1Cd9X9vseBX9wci153z9JcNEs/viewform).

## Configuring TowTruck

As mentioned there are a few TowTruck configuration parameters.  In the future there will probably be more.  To see the exact list of settings and their defaults, look at `TowTruck._defaultConfiguration`.

`TowTruckConfig_siteName`:
    In the help screen the site is referred to.  By default the page title is used, but this is often over-specific.  The idea siteName is the name of your site.

`TowTruckConfig_enableAnalytics`:
    During the TowTruck alpha we'd like to get some idea of who is using the project, and what clients/browsers users have, the native language of users, and maybe some stuff we haven't even thought of.  Setting this to `true` adds tracking when someone starts TowTruck; Google manages the analytics, but the results are contractually private to Mozilla.  The setting `TowTruckConfig_analyticsCode` is the analytics code that is used.

`TowTruckConfig_hubBase`:
    This is where the hub lives.  The hub is a simple server that echoes messages back and forth between clients.  It's the only real server component of TowTruck (besides the statically hosted scripts).  It's also really boring.  If you wanted to use a hub besides ours you can override it here.  The primary reason would be for privacy; though we do not look at any traffic, by hosting the hub yourself you can be more assured that it is private.  You'll find that a hub with a valid https certificate is very useful, as mixed http/https is strictly forbidden with WebSockets, and because there's no public pages that a user will typically visit on the hub there's no opportunity to put in a security exception.

`TowTruckConfig_cloneClicks`:
    This is an experimental feature **that will probably be removed** (see [#75](https://github.com/mozilla/towtruck/issues/75)).  But if you want to play around you might find it amusing.  This setting should be a jQuery selector, and instead of just *showing* the other person a click, if the element clicked on matches this selector it will trigger an artificial click on the other user's browser.  For example, `TowTruckConfig_cloneClicks = ".tab"`

`TowTruckConfig_siteName`:
    This is the name of your site.  It defaults to the title of the page, but often a more abbreviated title is appropriate.  This is used in some help text.

`TowTruckConfig_toolName`:
    If you want to remove the "TowTruck" brand from the tool, you can rename it.  You should use a proper noun of some sort, like "Collaboration Tool", so that it fits into the text.

`TowTruckConfig_enableShortcut`:
    If you want to try TowTruck out on an application, but don't want to put up a "Start TowTruck" button, you can use `TowTruckConfig_enableShortcut = true` and then an event handler will be put into place that will start TowTruck when you hit **alt-T alt-T** (twice in a row!).  TowTruck will still automatically start when someone opens an invitation link.

In the future we expect to include more configuration parameters, specifically so you can customize TowTruck to integrate with your site.  We'd very much like to get [feedback](https://docs.google.com/forms/d/1lVE7JyRo_tjakN0mLG1Cd9X9vseBX9wci153z9JcNEs/viewform) about what specifically in your site you'd like to integrate with TowTruck.

## Start TowTruck Button

The button you add to your site to start TowTruck will typically look like this:

```html
<button id="start-towtruck" type="button"
 onclick="TowTruck(this); return false"
 data-end-towtruck-html="End TowTruck">
  Start TowTruck
</button>
```

1. If you give your button the same `id` across your site, TowTruck will know what the start/end TowTruck button is.

2. `onclick="TowTruck(this); return false"` – this starts TowTruck, and by passing `this` TowTruck knows what button it started from.  This lets it animate out of the button.  It'll also work fine with `document.getElementById("start-towtruck").addEventListener("click", TowTruck, false)`

3. `data-end-towtruck-html` is what TowTruck will insert into the content of the button after it is started.  You can use this to switch Start to End, or whatever language you use.  As a special case "Start TowTruck" is changed to "End TowTruck"

4. The class `towtruck-started` will be added to the button while TowTruck is active.  You might want to use this to style the background color to red to show that it changes to ending the session.

## Extending TowTruck For Your Application

See the page [Extending TowTruck](https://github.com/mozilla/towtruck/wiki/Extending-TowTruck)

# About Audio Chat and WebRTC

The live audio chat is based on [WebRTC](http://www.webrtc.org/).  This is a very new technology, built into some new browsers.

To enable WebRTC both you and your collaborator need a new browser.  Right now, [Firefox Nightly](http://nightly.mozilla.org/) is supported, and we believe that the newest release of Chrome should work.

Sometime in 2013 support for this should be available in new (non-experimental) versions of Firefox, Chrome, and both Firefox and Chrome for Android.

To see a summary of outstanding issues that we know of with audio chat see [this page](https://github.com/mozilla/towtruck/issues?labels=rtc&milestone=&page=1&state=open).

Note that audio chat will not work between some networks.  These networks require a [TURN server](http://en.wikipedia.org/wiki/Traversal_Using_Relays_around_NAT) which unfortunately we do not have allocated (and full support for TURN has not landed in some browsers).  Unfortunately when the network makes chat impossible, chat will simply not work – we don't receive an error, and can't tell you why chat is not working.  See [#327](https://github.com/mozilla/towtruck/issues/327) for progress.

# Addons

There is an addon for Firefox in [addon/](https://github.com/mozilla/towtruck/tree/develop/addon).

This isn't intended to be the "normal" way anyone uses TowTruck, but it is a development tool to try TowTruck out on a site that hasn't integrated `towtruck.js` itself.  When you activate the addon (via a link in the [Add-On Toolbar](https://support.mozilla.org/en-US/kb/add-on-bar-quick-access-to-add-ons)) it simply adds `towtruck.js` to every page in that tab (until you close the tab or turn it off).  Also if you open a link with `#&towtruck=...` (the code used in the share link) it will automatically turn TowTruck on for the tab.

## Installing

A simple way to install is simply to [click this link](http://towtruck.mozillalabs.com/towtruck.xpi) in Firefox, and install the addon.  You can turn the addon on or off via the addon manager.  No restart is required.

## Building

You can build the addon using the [Addon-SDK](https://addons.mozilla.org/en-US/developers/builder).  Once you've installed the SDK, go into the `addon/` directory and run `cfx xpi` to create an XPI (packaged addon file) or `cfx run` to start up Firefox with the addon installed (for development).

# Contributing

Here are a variety of notes about contributing to the TowTruck codebase.  This isn't stuff that applies if you are simply integrating TowTruck in your site.

## Code Style

[Here is a style document](https://github.com/ianb/javascript).  It's a fork of the [Airbnb](https://github.com/airbnb/javascript) style guide, and maybe takes a little from the [Mozilla style guide](https://developer.mozilla.org/en-US/docs/Developer_Guide/Coding_Style), and then a little of our own opinions.

### Code Cleanliness

Please figure out how to get your editor to delete trailing whitespace!  It's a nuisance and creates useless diffs.  Files should also end with a newline.

## TowTruck Patterns

### Modules

There are [some notes in the style guide](https://github.com/ianb/javascript#modules).  TowTruck uses [requirejs](http://requirejs.org/) for module loading, and the AMD pattern generally.  Each module should go in `app/http/towtruck/public/` and look like:

```javascript
define(["util", "jquery", "require"], function (util, $, require) {
  var myModule = util.Module("myModule");
  var assert = util.assert;
  myModule.object = ... // and so on
  return myModule;
});
```

The first list is the dependencies (modules) you need.  If you need to require module modules later (lazily, or later than load time due to circular dependencies) you must include `require` among your dependencies.  There *is* a global `require()` object, but you can't use it, because TowTruck uses a [context](http://requirejs.org/docs/api.html#multiversion).

You should define an object with a name matching the name of the module (and filename).  This way an object or function will be named the same throughout the project, both when used internally and externally (e.g., `myModule.object`), and when it is being created.

If you want to load a module from the console, you do it like this:

```javascript
session = require({context: "towtruck"})("session");
```

(This form of `require` only works when the module is already loaded, but from the console that's usually the case.)

### Classes

There is a class factory in `util.Class`.  It supports subclassing, but we haven't used any subclasses yet, and I'm not sure we will.  Look at the implementation if you want to know more.

To define a class, do:

```javascript
var MyClass = util.Class({
  constructor: function (...) {...}
});
MyClass.classMethod = function (...) {...};
var instance = MyClass();
```

The `constructor` function is called when the object is instantiated.  You don't need to use `new` when creating instances, and really you shouldn't (it'll just create an object that'll be thrown away).  MyClass.prototype is what you would expect.

### `this`

You should understand how `this` is bound, and how that binding is lost.

Generally we prefer using `.bind(this)` to keep the references to this.  For example:

```
var MyClass = Class({

  goodExample: function () {
    doSomething((function () {return this.foo;}).bind(this));
  },

  badExample: function () {
    var self = this;
    doSomething(function () {return self.foo;});
  }
});
```

Why?  Mostly so that `this` is always called `this`, and you don't have to figure out whether or where there is an alias.

### Templating

Right now we aren't using any real templating system.  Almost everything is in `app/http/views/interface.html` – and most likely any new markup should also go there.

We try to keep most of the code that actually touches the ui in `ui.js` – though it's not done very strictly.  Moving stuff back into ui.js is appreciated though.

"Templates" are just elements that are cloned out of `interface.html`.  They generally have an id like `towtruck-template-foo`, and you'd clone them by doing `ui.cloneTemplate("foo")`.

You should avoid having text or markup in Javascript, and instead clone templates or hide and show different elements to represent different states.  Occasionally you do need to put markup-related stuff in code (like pixel sizes or other details).  When this is the case leave a comment in both sources (HTML/CSS and JS) pointing to the other location.

### Async

Use [jQuery.Deferred](http://api.jquery.com/category/deferred-object/) when possible.

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

# Hosting the Hub Server

We have a server at `https://hub.towtruck.mozillalabs.com` which you are welcome to use for peer-to-peer communications with TowTruck.  But you may wish to host your own.  The server is fairly small and simple, so it should be reasonable.  Note that we haven't really "finished" the story around self-hosting, so the details of this are likely to change.  The server itself is quite stable.

The server is located in `hub/server.js`, and is a simple Node.js application.  You can run this like `node hub/server.js`, and you can use environmental variables to control things like the port (look in `server.js` for references to `process.env`).  You will need to `npm install websocket` to get the websocket library installed.

If you want to use TowTruck on an https site you must host the hub on https.  We don't it setup in `server.js` for Node to do SSL directly, so we recommend a proxy.  [stunnel](https://www.stunnel.org/) is an example of the kind of proxy you'd want – not all proxies support websockets.

Once you have the hub installed you need to configure TowTruck to use the hub, like:

```javascript
TowTruckConfig_hubBase = "https://myhub.com";
```

## Getting a static copy of the client

You may also want a static copy of the client that you can host yourself.  Run `grunt build` to create a static copy of the TowTruck library in `build/` (use `--dest` to control the output location, and `--exclude-tests` to avoid including the tests in your version).

The hub changes quite infrequently, so if you just stability then making a static copy of the client will do it for you.  This option is highly recommended for production!

# Browser Support

TowTruck is intended for relatively newer browsers.  Especially as we experiment with what we're doing, supporting older browsers causes far more challenge than it is an advantage.

The bare minimum that we've identified for TowTruck is [WebSocket support](http://caniuse.com/websockets).  That said, we generally only test on the most recent version of Firefox and Chrome, so bugs specific to older browsers are more likely (but please [submit bugs](https://github.com/mozilla/towtruck/issues/new) from those browsers anyway – we aren't deliberately not supporting them).  Our next set of browsers to target will be mobile browsers.

## Internet Explorer

With IE 10 it is *possible* to support Internet Explorer (version 9 and before do not support WebSockets).  However we do not test at all regularly on Internet Explorer, and we know we have active issues but are not trying to fix them.  Pull requests to support Internet Explorer are welcome, but right now we don't plan to address bug reports for Internet Explorer that don't come with a pull request.  If Internet Explorer support is important to you we do [welcome your feedback](https://docs.google.com/a/mozilla.com/forms/d/1lVE7JyRo_tjakN0mLG1Cd9X9vseBX9wci153z9JcNEs/viewform).  No decision is set in stone, but we don't want to mislead you with respect to our current priorities and intentions.

# Supported Browsers

We recommend the most recent release of [Firefox](http://www.mozilla.org/en-US/firefox/new/) or [Chrome](https://www.google.com/intl/en/chrome/browser/).

If you want to have [WebRTC support](https://github.com/mozilla/towtruck/wiki/About-Audio-Chat-and-WebRTC) and are using Firefox, as of April 2013 this requires [Firefox Nightly](http://nightly.mozilla.org/) (this support will be moving towards beta and release in the coming months).

We haven't done much testing on mobile (yet!) and cannot recommend anything there.
