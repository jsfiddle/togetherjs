# Documentation

<!--
template: docs.tmpl
-->

Would you like to use TogetherJS on your site?  Great!  If you have feedback on this or any other part of TogetherJS [we'd like to hear it](https://docs.google.com/forms/d/1lVE7JyRo_tjakN0mLG1Cd9X9vseBX9wci153z9JcNEs/viewform)!

## Quick Start

The quickest is to include two things on your page.  First the Javascript:

```html
<script>
  // Set to false or delete to disable analytics/tracking:
  TogetherJSConfig_enableAnalytics = true;
</script>
<script src="https://togetherjs.mozillalabs.com/togetherjs-min.js"></script>
```

The first part configures TogetherJS.  In the example we configure it to send analytics information back to us (Mozilla), so we can get an idea of who is using TogetherJS.  You can turn it off, but we do appreciate the information, especially during the alpha stage. There's not much configuration yet, but we'll go over what there is later.

The next step is to put a button on your site that lets a user start TogetherJS:

```html
<button onclick="TogetherJS(this); return false;">Start TogetherJS</button>
```

You could also do something like:

```html
<button id="start-togetherjs">Start TogetherJS</button>
<script>
$(function () {
  $("#start-togetherjs").click(TogetherJS);
});
</script>
```

You should put the `togetherjs-min.js` script on every page in your site – two people can collaborate across the entire site then.  If you forget it on a page, then if someone visits that page while in a TogetherJS session they will essentially go "offline" until they come back to another page that includes `togetherjs-min.js`

Note that `togetherjs-min.js` *is not* the entire code for TogetherJS, it's only a fairly small file that loads the rest of TogetherJS on demand.  You can place the `<script>` anywhere on the page – generally before `</body>` is considered the best place to put scripts.

## Technology Overview

In this section we'll describe the general way that TogetherJS works, without diving into any code.  If you are ready to use TogetherJS and want to know how, skip to the next section; if you want to understand how it works, or if it can help you in a particular use case, then this section is for you.

The core of TogetherJS is the *hub*: this is a server that everyone in a session connects to, and it echos messages to all the participants using Web Sockets.  This server does not rewrite the messages or do much of anything besides pass the messages between the participants.

[WebRTC](http://www.webrtc.org/) is available for audio chat, but is not otherwise used.  We are often asked about this, as WebRTC offers data channels that allow browsers to send data directly to other browsers without a server.  Unfortunatley you still need a server to establish the connection (the connection strings to connect browsers are quite unwieldy), it only supports one-to-one connections, and that support is limited to only some browsers and browser versions.  Also establishing the connection is significantly slower than Web Sockets.

### Scope of the session

TogetherJS sessions are connected to the domain you start them on (specifically the [origin](http://tools.ietf.org/html/rfc6454)).  So if part of your site is on another domain, people won't be able to talk across those domains.  Even a page that is on https when another is on http will cause the session to be lost.  We might make this work sometime, but if it's an issue to you please give us [feedback](https://docs.google.com/forms/d/1lVE7JyRo_tjakN0mLG1Cd9X9vseBX9wci153z9JcNEs/viewform).

## Configuring TogetherJS

As mentioned there are a few TogetherJS configuration parameters.  In the future there will probably be more.  To see the exact list of settings and their defaults, look at `TogetherJS._defaultConfiguration`.

`TogetherJSConfig_siteName`:
    In the help screen the site is referred to.  By default the page title is used, but this is often over-specific.  The idea siteName is the name of your site.

`TogetherJSConfig_enableAnalytics`:
    During the TogetherJS alpha we'd like to get some idea of who is using the project, and what clients/browsers users have, the native language of users, and maybe some stuff we haven't even thought of. Setting this to `true` adds tracking when someone starts TogetherJS; Google manages the analytics, but the results are contractually private to Mozilla.  The setting `TogetherJSConfig_analyticsCode` is the analytics code that is used.

`TogetherJSConfig_hubBase`:
    This is where the hub lives.  The hub is a simple server that echoes messages back and forth between clients.  It's the only real server component of TogetherJS (besides the statically hosted scripts).  It's also really boring.  If you wanted to use a hub besides ours you can override it here.  The primary reason would be for privacy; though we do not look at any traffic, by hosting the hub yourself you can be more assured that it is private.  You'll find that a hub with a valid https certificate is very useful, as mixed http/https is strictly forbidden with WebSockets, and because there's no public pages that a user will typically visit on the hub there's no opportunity to put in a security exception.

`TogetherJSConfig_cloneClicks`:
    This is an experimental feature **that will probably be removed** (see [#75](https://github.com/mozilla/togetherjs/issues/75)).  But if you want to play around you might find it amusing.  This setting should be a jQuery selector, and instead of just *showing* the other person a click, if the element clicked on matches this selector it will trigger an artificial click on the other user's browser.  For example, `TogetherJSConfig_cloneClicks = ".tab"`

`TogetherJSConfig_siteName`:
    This is the name of your site.  It defaults to the title of the page, but often a more abbreviated title is appropriate.  This is used in some help text.

`TogetherJSConfig_toolName`:
    If you want to remove the "TogetherJS" brand from the tool, you can rename it.  You should use a proper noun of some sort, like "Collaboration Tool", so that it fits into the text.

`TogetherJSConfig_enableShortcut`:
    If you want to try TogetherJS out on an application, but don't want to put up a "Start TogetherJS" button, you can use `TogetherJSConfig_enableShortcut = true` and then an event handler will be put into place that will start TogetherJS when you hit **alt-T alt-T** (twice in a row!).  TogetherJS will still automatically start when someone opens an invitation link.

In the future we expect to include more configuration parameters, specifically so you can customize TogetherJS to integrate with your site.  We'd very much like to get [feedback](https://docs.google.com/forms/d/1lVE7JyRo_tjakN0mLG1Cd9X9vseBX9wci153z9JcNEs/viewform) about what specifically in your site you'd like to integrate with TogetherJS.

## Start TogetherJS Button

The button you add to your site to start TogetherJS will typically look like this:

```html
<button id="start-togetherjs" type="button"
 onclick="TogetherJS(this); return false"
 data-end-togetherjs-html="End TogetherJS">
  Start TogetherJS
</button>
```

1. If you give your button the same `id` across your site, TogetherJS will know what the start/end TogetherJS button is.

2. `onclick="TogetherJS(this); return false"` – this starts TogetherJS, and by passing `this` TogetherJS knows what button it started from.  This lets it animate out of the button.  It'll also work fine with `document.getElementById("start-togetherjs").addEventListener("click", TogetherJS, false)`

3. `data-end-togetherjs-html` is what TogetherJS will insert into the content of the button after it is started.  You can use this to switch Start to End, or whatever language you use.  As a special case "Start TogetherJS" is changed to "End TogetherJS"

4. The class `togetherjs-started` will be added to the button while TogetherJS is active.  You might want to use this to style the background color to red to show that it changes to ending the session.

## Extending TogetherJS For Your Application

See the page [Extending TogetherJS](https://github.com/mozilla/togetherjs/wiki/Extending-TogetherJS)

## About Audio Chat and WebRTC

The live audio chat is based on [WebRTC](http://www.webrtc.org/). This is a very new technology, built into some new browsers.

To enable WebRTC both you and your collaborator need a new browser. Right now, [Firefox Nightly](http://nightly.mozilla.org/) is supported, and we believe that the newest release of Chrome should work.

Sometime in 2013 support for this should be available in new (non-experimental) versions of Firefox, Chrome, and both Firefox and Chrome for Android.

To see a summary of outstanding issues that we know of with audio chat see [this page](https://github.com/mozilla/togetherjs/issues?labels=rtc&milestone=&page=1&state=open).

Note that audio chat will not work between some networks.  These networks require a [TURN server](http://en.wikipedia.org/wiki/Traversal_Using_Relays_around_NAT) which unfortunately we do not have allocated (and full support for TURN has not landed in some browsers).  Unfortunately when the network makes chat impossible, chat will simply not work – we don't receive an error, and can't tell you why chat is not working.  See [#327](https://github.com/mozilla/togetherjs/issues/327) for progress.

## Addons

There is an addon for Firefox in [addon/](https://github.com/mozilla/togetherjs/tree/develop/addon).

This isn't intended to be the "normal" way anyone uses TogetherJS, but it is a development tool to try TogetherJS out on a site that hasn't integrated `togetherjs-min.js` itself.  When you activate the addon (via a link in the [Add-On Toolbar](https://support.mozilla.org/en-US/kb/add-on-bar-quick-access-to-add-ons)) it simply adds `togetherjs-min.js` to every page in that tab (until you close the tab or turn it off).  Also if you open a link with `#&togetherjs=...` (the code used in the share link) it will automatically turn TogetherJS on for the tab.

### Installing

A simple way to install is simply to [click this link](http://togetherjs.mozillalabs.com/togetherjs.xpi) in Firefox, and install the addon.  You can turn the addon on or off via the addon manager.  No restart is required.

### Building

You can build the addon using the [Addon-SDK](https://addons.mozilla.org/en-US/developers/builder). Once you've installed the SDK, go into the `addon/` directory and run `cfx xpi` to create an XPI (packaged addon file) or `cfx run` to start up Firefox with the addon installed (for development).

## Extending TogetherJS

This page documents some of the ways you can customize the TogetherJS experience on your site.  Especially how you can extend TogetherJS to synchronize parts of your application that require special treatment.

### Work in progress

We're still working on this part, and your feedback is especially important.  We're using the [extending](https://github.com/mozilla/togetherjs/issues?labels=extending&milestone=&page=1&state=open) label to categorize tickets related to this.  If you have a use case you'd like us to address, please [open a new issue](https://github.com/mozilla/togetherjs/issues/new) and describe it – and don't be shy, if it's a problem that can be solved with the API we've already implemented we don't mind describing how to use it in detail in a ticket.

### Configuring events

Like other configuration, you may not wish to set up these callbacks before `togetherjs-min.js` is loaded.  You can do that with the `"on"` configuration parameter, like:

```js
TogetherJSConfig_on = {
  ready: function () {}
};
```

Or if you want to set things separately you can do:

```js
TogetherJSConfig_on_ready = function () {};
```

## Communication Channel

If you have a component you want to synchronize between two clients, you'll want to use the TogetherJS communication channel.  This is a broadcast channel – any message you send is sent to everyone else in the session (which can also be no one), and includes people who are on different pages.

All messages are JSON objects with a `type` property.  Custom application messages are put into their own namespace.  So imagine you want to keep an element hidden or visible on all clients, in a synchronized way, and when the element visibility changes an event is fired, `MyApp.emit("visibilityChange", element, isVisible)`:

```js
TogetherJSConfig_on_ready = function () {
  MyApp.on("visibilityChange", fireTogetherJSVisibility);
};
TogetherJSConfig_on_close = function () {
  MyApp.off("visibilityChange", fireTogetherJSVisibility);
};
```

Now when TogetherJS is activated we'll call `fireTogetherJSVisibility(el, isVisible)`.  Now we have to write that function:

```js
function fireTogetherJSVisibility(element, isVisible) {
  TogetherJS.send({type: "visibilityChange", isVisible: isVisible, element: element});
}
```

Well, that's not quite right, we have to send a JSON object, and we can't send `element`.  Instead we need to give an identifier for the element.  TogetherJS has a helpful function for that, which will require us to import the `elementFinder` module:

```js
function fireTogetherJSVisibility(element, isVisible) {
  var elementFinder = TogetherJS.require("elementFinder");
  var location = elementFinder.elementLocation(element);
  TogetherJS.send({type: "visibilityChange", isVisible: isVisible, element: location});
}
```

Then we also have to listen for the message.  We can setup this listener right away (without using the ready/close TogetherJS events) because when TogetherJS isn't on then the event will just not fire:

```js
TogetherJS.hub.on("visibilityChange", function (msg) {
  var elementFinder = TogetherJS.require("elementFinder");
  // If the element can't be found this will throw an exception:
  var element = elementFinder.findElement(msg.element);
  MyApp.changeVisibility(element, msg.isVisible);
});
```

This has two major problems though: when you call `MyApp.changeVisibility` it will probably fire a `visibilityChange` event, which will cause another `fireTogetherJSVisibility` call.  The result may or may not be circular, but it's definitely not efficient. Another problem is that you can get messages from peers who are at a different URL.  We'll use a simple global variable to handle the first case, and `msg.sameUrl` to fix the second:

```js
var visibilityChangeFromRemote = false;

function fireTogetherJSVisibility(element, isVisible) {
  if (visibilityChangeFromRemote) {
    return;
  }
  var elementFinder = TogetherJS.require("elementFinder");
  var location = elementFinder.elementLocation(element);
  TogetherJS.send({type: "visibilityChange", isVisible: isVisible, element: location});
}

TogetherJS.hub.on("visibilityChange", function (msg) {
  if (! msg.sameUrl) {
    return;
  }
  var elementFinder = TogetherJS.require("elementFinder");
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

Now we're getting close, except for one last problem: these events sync everything when the users are on the same page, but there may be a late comer whose page won't be in sync with everything else.  An event `togetherjs.hello` will fire when a person appears on a new page, and we can use to that send all our state.  To do this we'll imagine the `MyApp` object has a function like `MyApp.allToggleElements()` that returns a list of elements that we'd be expected to sync.

```js
TogetherJS.hub.on("togetherjs.hello", function (msg) {
  if (! msg.sameUrl) {
    return;
  }
  MyApp.allToggleElements.forEach(function (el) {
    var isVisible = $(el).is(":visible");
    fireTogetherJSVisibility(el, isVisible);
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

To do this you configure TogetherJS with some functions:

`TogetherJSConfig_getUserName = function () {return 'User Name';};`

This returns the user's name (or nick).  Return null if you can't determine the name.

`TogetherJSConfig_getUserAvatar = function () {return avatarUrl;};`

This returns a URL to the user's avatar.  It should be 40px square. Again return null if you aren't sure.

`TogetherJSConfig_getUserColor = function () {return '#ff00ff';};`

This returns the user's preferred color that represents them.  This should be a CSS color.

If any of these values are updated while in the page (like if you have a login process that doesn't cause a page reload) then call `TogetherJS.refreshUserData()` and the respective `getUser*` callbacks will all be called again.

See [#504](https://github.com/mozilla/togetherjs/issues/504) for a bug related to improving this support.

## TogetherJS.reinitialize&#40;&#41;

You can run this to try to reinitialize anything TogetherJS initializes on page load.  In particular you can use it if there are new textareas or code editors that should be sync'd, but were added dynamically to the page.  E.g.:

```javascript
$("#form").append("<textarea>");
TogetherJS.reinitialize();
```

(We hope with [#70](https://github.com/mozilla/togetherjs/issues/70) that this will no longer be necessary.)

## TogetherJS events

The `TogetherJS` object is an event emitter.  It uses the style of `TogetherJS.on("event", handler)`.  The available events:

- `TogetherJS.on("ready", function () {})`: emitted when TogetherJS is fully started up.
- `TogetherJS.on("close", function () {})`: emitted when TogetherJS is closed.  This is *not* emitted when the page simply closes or navigates elsewhere.  It is only closed when TogetherJS is specifically stopped.

## Deferring Initialization

TogetherJS starts up automatically as soon as it can, especially when continuing a session.  Sometimes this is problematic, like an application that bootstraps all of its UI after page load.  To defer this initialization, define a function `TogetherJSConfig_callToStart` like:

```js
TogetherJSConfig_callToStart = function (callback) {
  MyApp.onload = callback;
};
```

In this example when `MyApp.onload()` is called, TogetherJS will start to initialize itself.  Note that calling `TogetherJS.reinitialize()` might be sufficient for your application's needs if it does a lot of setup after the page loads.

## Invitation

Sometimes instead of having the user invite someone to TogetherJS you might want to handle the invitation internally in your app.  So typically when the person started TogetherJS, you'd want to find some other person they want to collaborate with and send the TogetherJS link to them.  To get at the TogetherJS link:

```js
TogetherJSConfig_on_ready = function () {
  sendTogetherJSURLToServer(TogetherJS.shareUrl());
};
```

If you call `TogetherJS.shareUrl()` before TogetherJS is initialized it will return `null`.

## Getting At The Innards

You can still get at TogetherJS, even if you can't rely on the internals not to change underneath you.  (You would be well recommended to deploy your own copy of the client if you do this stuff.)

Most of the TogetherJS features are implemented as individual modules, so it should be possible to introduce your own module to do many of the same things.  The most important thing is the `session` module, and sending and receiving messages.

To get the session module (or any module) you can run this after TogetherJS starts:

```javascript
var session = TogetherJS.require("session");
```

This assumes that the module has already been loaded... but that assumption would be correct once TogetherJS has started.

Then there are two interesting methods:

```javascript
session.send({type: "my-custom-type", attr: value});
session.hub.on("my-custom-type", function (msg) {
  alert(msg.value);
});
```

I.e., `session.send()` and `session.hub.on()`.  As you can see the messages are dispatched based on `msg.type`.  These messages are broadcasted to all other participants.  Note that the messages are *always* sent, even if the other person is at a different URL.  To check if an incoming message comes from a person on the same page as you, check `msg.sameUrl` (`msg.url` shows the actual URL of the other person).

## Getting a static copy of the client

You may also want a static copy of the client that you can host yourself.  Run `grunt build` to create a static copy of the TogetherJS library in `build/` (use `--dest` to control the output location, and `--exclude-tests` to avoid including the tests in your version).

The hub changes quite infrequently, so if you just stability then making a static copy of the client will do it for you.  This option is highly recommended for production!

## Browser Support

TogetherJS is intended for relatively newer browsers.  Especially as we experiment with what we're doing, supporting older browsers causes far more challenge than it is an advantage.

The bare minimum that we've identified for TogetherJS is [WebSocket support](http://caniuse.com/websockets).  That said, we generally only test on the most recent version of Firefox and Chrome, so bugs specific to older browsers are more likely (but please [submit bugs](https://github.com/mozilla/togetherjs/issues/new) from those browsers anyway – we aren't deliberately not supporting them). Our next set of browsers to target will be mobile browsers.

## Internet Explorer

With IE 10 it is *possible* to support Internet Explorer (version 9 and before do not support WebSockets).  However we do not test at all regularly on Internet Explorer, and we know we have active issues but are not trying to fix them.  Pull requests to support Internet Explorer are welcome, but right now we don't plan to address bug reports for Internet Explorer that don't come with a pull request.  If Internet Explorer support is important to you we do [welcome your feedback](https://docs.google.com/a/mozilla.com/forms/d/1lVE7JyRo_tjakN0mLG1Cd9X9vseBX9wci153z9JcNEs/viewform). No decision is set in stone, but we don't want to mislead you with respect to our current priorities and intentions.

## Supported Browsers

We recommend the most recent release of [Firefox](http://www.mozilla.org/en-US/firefox/new/) or [Chrome](https://www.google.com/intl/en/chrome/browser/).

If you want to have [WebRTC support](https://github.com/mozilla/togetherjs/wiki/About-Audio-Chat-and-WebRTC) and are using Firefox, as of April 2013 this requires [Firefox Nightly](http://nightly.mozilla.org/) (this support will be moving towards beta and release in the coming months).

We haven't done much testing on mobile (yet!) and cannot recommend anything there.

## Getting Help

### IRC / Live Chat

We are available on the `#togetherjs` channel on `irc.mozilla.org`

If you don't use IRC, you can quickly join the chat from the web [using kiwiirc](https://kiwiirc.com/client/irc.mozilla.org/togetherjs).

### Issues

Please submit any issues you have via [the Github issue tracker](https://github.com/mozilla/togetherjs/issues/new).

Don't be shy about opening an issue.  If you have a question or feature request that might already be possible, we can exchange comments via the issue tracker to figure it out.  We don't have a mailing list, so issues are a good way to keep a persistent record of these exchanges.

### Email

Feel free to email us at [togetherjs@mozilla.com](mailto:togetherjs@mozilla.com) with any questions, suggestions, or concerns.
