# Documentation

<!--
template: docs.tmpl
-->

Would you like to use TogetherJS on your site?  Great!  If you have feedback on this or any other part of TogetherJS [we'd like to hear it](https://docs.google.com/forms/d/1lVE7JyRo_tjakN0mLG1Cd9X9vseBX9wci153z9JcNEs/viewform)!

## Quick Start

Get started quickly by including two things on your page.  First the JavaScript:

```html
<script>
  // TogetherJS configuration would go here, but we'll talk about that
  // later
</script>
<script src="https://togetherjs.com/togetherjs-min.js"></script>
```

You can put that wherever; e.g., right before `</body>`.

The next step is to put a button on your site that lets a user start TogetherJS:

```html
<button onclick="TogetherJS(this); return false;">Start TogetherJS</button>
```

Or if you don't like `onclick`:

```html
<button id="start-togetherjs">Start TogetherJS</button>
<script>
$(function () {
  $("#start-togetherjs").click(TogetherJS);
});
</script>
```

Calling `TogetherJS()` will start the tool, or stop the tool if it is already started.

You should put the `togetherjs-min.js` script on every page in your site, even if you don't include the "Start TogetherJS" button.  As long as the script is on a page then two people can collaborate on that page. If you forget it on a page, then if someone visits that page while in a TogetherJS session they will essentially go "offline" until they come back to another page that includes `togetherjs-min.js`

Note that `togetherjs-min.js` *is not* the entire code for TogetherJS, it's only a fairly small file that loads the rest of TogetherJS on demand.  You can place the `<script>` anywhere on the page – generally before `</body>` is considered the best place to put scripts.

If you want to dive into code you might want to skip to [Configuring TogetherJS](#configuring-togetherjs).

## Technology Overview

In this section we'll describe the general way that TogetherJS works, without diving into any code.  If you are ready to use TogetherJS and want to know how, skip to the next section; if you want to understand how it works, or if it can help you in a particular use case, then this section is for you.

The core of TogetherJS is the **hub**: this is a server that everyone in a session connects to, and it echos messages to all the participants using Web Sockets.  This server does not rewrite the messages or do much of anything besides **pass the messages between the participants**.

[WebRTC](http://www.webrtc.org/) is available for **audio chat**, but is not otherwise used.  We are often asked about this, as WebRTC offers data channels that allow browsers to send data directly to other browsers without a server.  Unfortunately you still need a server to establish the connection (the connection strings to connect browsers are quite unwieldy), it only supports one-to-one connections, and that support is limited to only some browsers and browser versions.  Also establishing the connection is significantly slower than Web Sockets. But maybe someday.

Everything that TogetherJS does is based on these messages being passed between browsers.  It doesn't require that everyone be on the same page, all it requires is that everyone in the session know what hub URL to connect to (the URL is essentially the session name). People *can* be on different sites, but the session URL is stored in [sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window.sessionStorage) which is local to one domain (and because we use sessionStorage instead of localStorage, it is local to one tab).  We don't have any techniques implemented to share sessions across multiple sites, but the only barrier is this local storage of session information.

Features are built on top of this messaging system.  For instance when you move your mouse around, a `cursor-update` message is sent giving the new mouse position.  Other clients that aren't at the same page as you see the message but ignore it.

**Most features work directly with the DOM**, and so don't require any special instrumenting of your code, or integration work.  As much as possible we anchor messages things to the most specific element possible.  When using [responsive web design](http://en.wikipedia.org/wiki/Responsive_web_design) different clients at the same URL may see different things, but to the degree they see the same elements things like the mouse position will be "correct".  For instance, on mobile you might put a button in a different location on the page, but because the cursor message says "the mouse is over the button named `#submit`" the mouse will be positioned in the equivalent position.  As a result **TogetherJS is also resolution-independent**.

We support the **synchronization of form states**, and also support [operational transformation](http://en.wikipedia.org/wiki/Operational_transformation) for text fields.  Again, this is all layered on top of the message system.

Unlike products like [Etherpad](http://etherpad.org/), the [Google Drive Realtime API](https://developers.google.com/drive/realtime/) we **do not have any persistence in our system**.  When two people are on the same page their text fields are synchronized, but all we've done is changed their browser states to be in sync.  We expect all persistence to still happen through your application.  You should generally write an application like you always have, and TogetherJS adds features on top of that.  **TogetherJS doesn't change your security model, your persistence model, or your authentication model**.  If one user hits "submit" then they are the one who saved the page, probably using a typical POST request, just as if they weren't using TogetherJS.

**TogetherJS relies on the same URL returning the same page**.  When two users are at the same URL we don't force the page to be the same. For example one person might not have permission to view a page: in that case the person will still get a permission denied page, and will be unable to follow along with the first person.  Generally we try to fail gracefully, so inconsistencies will only degrade the experience, not completely break it.  In an ideal situation when two people are using TogetherJS you might allow them both to see an edit screen, but only put permission restrictions on who can actually save those edits.

**TogetherJS relies on the application to synchronize its state**.  If you have a web application that has lots of dynamic client-side content, the two users won't automatically see the same things. TogetherJS isn't like screen sharing: each person is running your web application in their own normal browser environment.  We do [provide tools](#extending-togetherjs-for-your-application) to help you synchronize your state.

You can [host your own hub](contributing.html#hosting-the-web-server), which is the only dynamic server-side part of TogetherJS.  But you don't need to host your own server, the server we host is entirely generic and capable of serving multiple sites.  Though if your site is generating a lot of traffic we'll probably want to talk.

Most of the actual code is in the client, which is **open source** and **easy to freeze**.  You can easily make your own static copy of the client, and so ensure the code won't change out from underneath you and invalidate your own testing of the product on your site.  Almost all client updates do not involve the server, so version management and stability is very easy to achieve.  Because TogetherJS does not save anything, it's easy to include in any development environment as well, and you can run it on an intranet or private site so long as everyone using it has access to that site; our servers.

## Configuring TogetherJS

As mentioned there are several configuration parameters.  To see the exact list of settings and their defaults, look at `TogetherJS._defaultConfiguration` in [together.js](https://github.com/mozilla/togetherjs/blob/develop/togetherjs/togetherjs.js)

There are a couple ways of configuring TogetherJS.  The one that we prefer is to set a global variable before `togetherjs(-min).js` is included.  Each variable is named `TogetherJSConfig_*`.  This makes it fairly easy to add or remove variables.  Note however that once `togetherjs(-min).js)` is loaded that these variables might not be respected.  So do:

```js
<script>
var TogetherJSConfig_something = "foo";
// more config...
</script>
<script src="https://togetherjs.com/togetherjs-min.js"></script>
```

The other way to set a variable *after* TogetherJS is loaded is `TogetherJS.config("variable", value)`.  Some variables cannot be updated after TogetherJS has started, but if this is the case then you should get an error.

### The Configuration

`TogetherJSConfig_siteName`:
    This is the name of your site.  It defaults to the title of the page, but often a more abbreviated title is appropriate.  This is used in some help text.

`TogetherJSConfig_toolName`:
    This is the name that you are giving this tool.  If you use this then "TogetherJS" won't be in the UI.  So you might want to use `TogetherJSConfig_toolName = "Collaboration".

`TogetherJSConfig_hubBase`:
    This is where the hub lives.  The hub is a simple server that echoes messages back and forth between clients.  It's the only real server component of TogetherJS (besides the statically hosted scripts).  It's also really boring.  If you wanted to use a hub besides ours you can override it here.  The primary reason would be for privacy; though we do not look at any traffic, by hosting the hub yourself you can be more assured that it is private.  You'll find that a hub with a valid https certificate is very useful, as mixed http/https is strictly forbidden with WebSockets.

`TogetherJSConfig_dontShowClicks`:
    This should be set to a jQuery selector or set to true. This will disable the visual click display indicating that a user has clicked on the defined element. For example: "canvas", "h1", "p", etc.  Setting `TogetherJSConfig_dontShowClicks = true` will globally disable all clicks.

`TogetherJSConfig_cloneClicks`:
    This should be set to a jQuery selector or set to true. Whenever someone clicks on an element matching this selector, that click will be repeated (as an actual click) on everyone else's browser.  This is useful for cases when a click typically doesn't *do* anything, but shows or hides or switches the view of the page.  Note that any control that toggles will definitely not work here!  If you have tab buttons that show different things you might use `TogetherJSConfig_cloneClicks = ".tab"`. Setting `TogetherJSConfig_cloneClicks = true` will globally clone clicks.

`TogetherJSConfig_enableShortcut`:
    If you want to try TogetherJS out on an application, but don't want to put up a "Start TogetherJS" button, you can use `TogetherJSConfig_enableShortcut = true` and then an event handler will be put into place that will start TogetherJS when you hit **alt-T alt-T** (twice in a row!).  TogetherJS will still automatically start when someone opens an invitation link.

`TogetherJSConfig_useMinimizedCode`:
    Typically if you use `togetherjs.js` you'll get the unminimized and uncombined code, with each module loaded lazily.  If you use `togetherjs-min.js` you get the combined code.  But if you want to override that more dynamically, you can use this setting.

`TogetherJSConfig_findRoom`:
    To see this in action, check out the examples.  This setting assigns people to a room.  If you use a single string, this will be the name of the room; for instance: `TogetherJSConfig_findRoom = "my_site_com_users"`.  You can also assign people to a series of rooms with maximum occupancy (what our examples do): `TogetherJSConfig_findRoom = {prefix: "my_site_com_users", max: 5}` **Note:** if you change this setting, test in a *new tab* (old browser tabs carry session information that will confuse you).

`TogetherJSConfig_autoStart`:
    If true then start TogetherJS automatically.  Note TogetherJS already starts automatically when a session is continued, so if you just always call `TogetherJS()` then you might cause TogetherJS to stop.  Note you must set this as `TogetherJSConfig_autoStart = true`, not using `TogetherJS.config("autoStart", true)` (it must be set when TogetherJS loads).  Anyone who autostarts a session will not be considered the session creator.

`TogetherJSConfig_suppressJoinConfirmation`:
    When a person is invited to a session, they'll be asked if they want to join in browsing with the other person.  Set this to `true` and they won't be asked to confirm joining.  Useful when combined with `findRoom`.

`TogetherJSConfig_suppressInvite`:
    When a person starts a session, usually a window will pop open with the invite link so they can send it to someone.  If this is true then that window doesn't automatically pop open (but it is still available).

`TogetherJSConfig_inviteFromRoom`:
    This adds the ability from the profile menu to invite people who are hanging out in another room (using TogetherJS).  This is kind of (but not exactly) how the "Get Help" button works on this site.  This is still an experimental feature.

`TogetherJSConfig_includeHashInUrl`:
    When true (default false), TogetherJS treats the entire URL, including the hash, as the identifier of the page; i.e., if you one person is on `http://example.com/#view1` and another person is at `http://example.com/#view2` then these two people are considered to be at completely different URLs.  You'd want to use this in single-page apps where being at the same base URL doesn't mean the two people are looking at the same thing.

`TogetherJSConfig_disableWebRTC`:
    Disables/removes the button to do audio chat via WebRTC.

`TogetherJSConfig_youtube`:
    If true, then YouTube videos will be synchronized (i.e., when one person plays or pauses a video, it will play for all people).  This will also load up the YouTube iframe API.

`TogetherJSConfig_ignoreMessages`:
    Contains a list of all the messages that will be ignored when console logging. Defaults to the list ["cursor-update", "keydown", "scroll-update"]. Will ignore all messages if set to true.

`TogetherJSConfig_ignoreForms`:
    Contains a list of all the forms that will be ignored. Each item of the list is a jQuery selector matching the form element to be ignored. Defaults to [":password"]. Will ignore all forms if set to true.

There are additional hooks you can configure, which are described in [Extending TogetherJS](#extending-togetherjs).

## Start TogetherJS Button

The button you add to your site to start TogetherJS will typically look like this:

```html
<button id="start-togetherjs" type="button"
 onclick="TogetherJS(this); return false"
 data-end-togetherjs-html="End TogetherJS">
  Start TogetherJS
</button>
```

1. If you give your button the same `id` across your site, TogetherJS will know what the start/end TogetherJS button is.  It's not essential, but TogetherJS uses this to zoom the controls into and out of the button.

2. `onclick="TogetherJS(this); return false"` – this starts TogetherJS, and by passing `this` TogetherJS knows what button it started from.  This lets it animate out of the button.  It'll also work fine with `document.getElementById("start-togetherjs").addEventListener("click", TogetherJS, false)`

3. `data-end-togetherjs-html` is what TogetherJS will insert into the content of the button after it is started.  You can use this to switch Start to End, or whatever language you use.  As a special case "Start TogetherJS" is changed to "End TogetherJS".

4. The class `togetherjs-started` will be added to the button while TogetherJS is active.  You might want to use this to style the background color to red to show that it changes to ending the session.

### Scope of the session

TogetherJS sessions are connected to the domain you start them on (specifically the [origin](http://tools.ietf.org/html/rfc6454)).  So if part of your site is on another domain, people won't be able to talk across those domains.  Even a page that is on https when another is on http will cause the session to be lost.  We might make this work sometime, but if it's an issue to you please give us [feedback](https://docs.google.com/forms/d/1lVE7JyRo_tjakN0mLG1Cd9X9vseBX9wci153z9JcNEs/viewform).

## About Audio Chat and WebRTC

The live audio chat is based on [WebRTC](http://www.webrtc.org/). This is a very new technology, built into some new browsers.

To enable WebRTC both you and your collaborator need a new browser. Right now, [Firefox Nightly](http://nightly.mozilla.org/) is supported, and we believe that the newest release of Chrome should work.

Sometime in 2013 support for this should be available in new (non-experimental) versions of Firefox, Chrome, and both Firefox and Chrome for Android.

To see a summary of outstanding issues that we know of with audio chat see [this page](https://github.com/mozilla/togetherjs/issues?labels=rtc&milestone=&page=1&state=open).

Note that audio chat will not work between some networks.  These networks require a [TURN server](http://en.wikipedia.org/wiki/Traversal_Using_Relays_around_NAT) which unfortunately we do not have allocated (and full support for TURN has not landed in some browsers).  Unfortunately when the network makes chat impossible, chat will simply not work – we don't receive an error, and can't tell you why chat is not working.  See [#327](https://github.com/mozilla/togetherjs/issues/327) for progress.

## Extending TogetherJS

While [configuration](#configuring-togetherjs) covers some of what you can do to customize TogetherJS, you may also need to integrate TogetherJS with your application, or sync your application data between clients.

### Configuring events

Like other configuration, you can configure the event handlers and hooks we describe before `togetherjs(-min).js` is loaded.  Event handlers are just a smidge different.  You'd normally add event handler like `TogetherJS.on("ready", function () {...})`.  To do it as configuration:

```js
TogetherJSConfig_on = {
  ready: function () {}
};
```

Or if you want to set things up one-by-one you can do:

```js
TogetherJSConfig_on_ready = function () {};
```

Additionally you may want to add event listeners to `TogetherJS.hub`; these are done like:

```js
TogetherJS_hub_on = {
  "my-event": function (msg) {
  }
};
```

### Communication Channel

If you have a component you want to synchronize between two clients, you'll want to use the TogetherJS communication channel.  This is a broadcast channel – any message you send is sent to everyone else in the session (which can also be no one), and includes people who are on different pages.

All messages are JSON objects with a `type` property.  Custom application messages are put into their own namespace.  So imagine you want to keep an element hidden or visible on all clients, in a synchronized way, and when the element visibility changes an event is fired inside your app, `MyApp.emit("visibilityChange", element, isVisible)`:

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

#### Implementing those visibility function from jQuery

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

### Setting identity information

There's a good chance your application has its own identity, and you know the name of the user, and perhaps have an avatar.  (If you don't have an avatar but do have an email, you might want to use that to make a Gravatar.)

To do this you configure TogetherJS with some functions:

`TogetherJSConfig_getUserName = function () {return 'User Name';};`

This returns the user's name (or nick).  Return null if you can't determine the name.

`TogetherJSConfig_getUserAvatar = function () {return avatarUrl;};`

This returns a URL to the user's avatar.  It should be 40px square. Again return null if you aren't sure.

`TogetherJSConfig_getUserColor = function () {return '#ff00ff';};`

This returns the user's preferred color that represents them.  This should be a CSS color.

The names might confuse you: you are providing functions that TogetherJS will call to get the user's name, avatar, and color.  It doesn't return the name the user has set through TogetherJS (that would be `TogetherJS.require("peers").Self.name`).

If any of these values are updated while in the page (like if you have a login process that doesn't cause a page reload) then call `TogetherJS.refreshUserData()` and the respective `getUser*` callbacks will all be called again.

See [#504](https://github.com/mozilla/togetherjs/issues/504) for a bug related to improving this support.

### TogetherJS.reinitialize&#40;&#41;

You can run this to try to reinitialize anything TogetherJS initializes on page load.  In particular you can use it if there are new code editors or video elements that should be sync'd, but were added dynamically to the page.  E.g.:

```javascript
$("#content").append('<video src="foo.mov">');
TogetherJS.reinitialize();
```

### TogetherJS events

The `TogetherJS` object is an event emitter.  It uses the style of `TogetherJS.on("event", handler)`.  The available events:

- `TogetherJS.on("ready", function () {})`: emitted when TogetherJS is fully started up.
- `TogetherJS.on("close", function () {})`: emitted when TogetherJS is closed.  This is *not* emitted when the page simply closes or navigates elsewhere.  It is only closed when TogetherJS is specifically stopped.

### Deferring Initialization

TogetherJS starts up automatically as soon as it can, especially when continuing a session.  Sometimes this is problematic, like an application that bootstraps all of its UI after page load.  To defer this initialization, define a function `TogetherJSConfig_callToStart` like:

```js
TogetherJSConfig_callToStart = function (callback) {
  MyApp.onload = callback;
};
```

In this example when `MyApp.onload()` is called, TogetherJS will start to initialize itself.  Note that calling `TogetherJS.reinitialize()` might be sufficient for your application's needs if it does a lot of setup after the page loads.

### Invitation

Sometimes instead of having the user invite someone to TogetherJS you might want to handle the invitation internally in your app.  So typically when the person started TogetherJS, you'd want to find some other person they want to collaborate with and send the TogetherJS link to them.  To get at the TogetherJS link:

```js
TogetherJSConfig_on_ready = function () {
  sendTogetherJSURLToServer(TogetherJS.shareUrl());
};
```

If you call `TogetherJS.shareUrl()` before TogetherJS is initialized it will return `null`.

### Getting At The Innards

You can still get at TogetherJS, even if you can't rely on the internals not to change underneath you.  (You would be well recommended to deploy your own copy of the client if you do this stuff.)

Most of the TogetherJS features are implemented as individual modules, so it should be possible to introduce your own module to do many of the same things.  The most important thing is the `session` module, and sending and receiving messages.

To get the session module (or any module) you can run this after TogetherJS starts:

```javascript
var session = TogetherJS.require("session");
```

This assumes that the module has already been loaded... but that assumption would be correct once TogetherJS has started.

## Getting a static copy of the client

You may also want a static copy of the client that you can host yourself.  Run `grunt build` to create a static copy of the TogetherJS library in `build/` (use `--dest` to control the output location, and `--exclude-tests` to avoid including the tests in your version).

The hub changes quite infrequently, so if you just stability then making a static copy of the client will do it for you.  This option is highly recommended for production!

## Localization Support

* Check [translation file](../../togetherjs/locale/en-US.json) for template example if you want to translate into your own language
* Adding new language inside [locale](../../togetherjs/locale/) directory should be in this format: "th-TH.json", "th.json", "pt-BR.json" or "pt.json" and enable support language in [`availableTranslations`](../../togetherjs/togetherjs.js#L320) inside togetherjs.js file.  Note that your file name and language names in  your configuration should use hyphens in accord with [BCP 47](http://tools.ietf.org/html/bcp47), not underscores.

To get your language display you can enable it by:

``` html
<script>
  var TogetherJSConfig_lang = "pt-BR";
</script>
```

## Browser Support

TogetherJS is intended for relatively newer browsers.  Especially as we experiment with what we're doing, supporting older browsers causes far more challenge than it is an advantage.

The bare minimum that we've identified for TogetherJS is [WebSocket support](http://caniuse.com/websockets).  That said, we generally only test on the most recent version of Firefox and Chrome, so bugs specific to older browsers are more likely (but please [submit bugs](https://github.com/mozilla/togetherjs/issues/new) from those browsers anyway – we aren't deliberately not supporting them). Our next set of browsers to target will be mobile browsers.

### Supported Browsers

We recommend the most recent release of [Firefox](http://www.mozilla.org/en-US/firefox/new/) or [Chrome](https://www.google.com/intl/en/chrome/browser/).

If you want to have [WebRTC support](https://github.com/mozilla/togetherjs/wiki/About-Audio-Chat-and-WebRTC) and are using Firefox, as of April 2013 this requires [Firefox Nightly](http://nightly.mozilla.org/) (this support will be moving towards beta and release in the coming months).

We haven't done much testing on mobile (yet!) and cannot recommend anything there.

#### Internet Explorer

With IE 10 it is *possible* to support Internet Explorer (version 9 and before do not support WebSockets).  However we do not test at all regularly on Internet Explorer, and we know we have active issues but are not trying to fix them.  Pull requests to support Internet Explorer are welcome, but right now we don't plan to address bug reports for Internet Explorer that don't come with a pull request.  If Internet Explorer support is important to you we do [welcome your feedback](https://docs.google.com/a/mozilla.com/forms/d/1lVE7JyRo_tjakN0mLG1Cd9X9vseBX9wci153z9JcNEs/viewform). No decision is set in stone, but we don't want to mislead you with respect to our current priorities and intentions.

We need your help!  If you're itching to help out, it would be great if you take on one of these Internet Explorer bugs [here](https://github.com/mozilla/togetherjs/issues?labels=IE&milestone=&page=1&state=open)!

## Hosting the Hub Server

We have a server at `https://hub.togetherjs.com` which you are welcome to use for peer-to-peer communications with TogetherJS.  But you may wish to host your own.  The server is fairly small and simple, so it should be reasonable.  Note that we haven't really "finished" the story around self-hosting, so the details of this are likely to change.  The server itself is quite stable.

The server is located in `hub/server.js`, and is a simple Node.js application.  You can run this like `node hub/server.js` - use `node hub/server.js --help` to see the available options.  You will need to `npm install websocket optimist` to get the websocket library and option library installed.

If you want to use TogetherJS on an https site you must host the hub on https.  We don't have it set up in `server.js` for Node to do SSL directly, so we recommend a proxy. [stunnel](https://www.stunnel.org/) is an example of the kind of proxy you'd want – not all proxies support websockets.

If you want to change the port or interface the server binds to, simply run `node hub/server.js -h` and it will show the command-line options as well as environmental variables.

Once you have the hub installed you need to configure TogetherJS to use the hub, like:

```javascript
TogetherJSConfig_hubBase = "https://myhub.com";
```

If you are curious about the exact version of code on the server it should be always be [server.js on master](https://github.com/mozilla/togetherjs/blob/master/hub/server.js), and you can double-check by fetching [`/server-source`](https://hub.togetherjs.com/server-source).

### Deploying the hub server to Heroku

You need a Heroku account. If you don't have one, their [Node.js getting started guide](https://devcenter.heroku.com/articles/getting-started-with-nodejs) is a good place to start.

What's about to happen: we clone the repo and create a new Heroku app within it. We need to set the HOST environment variable to get the app to bind to 0.0.0.0 instead of 127.0.0.1. It'll pick up the PORT variable automatically. We also need to enable WebSockets for the app. Then, push the code and we should be good to go!

	git clone git@github.com:mozilla/togetherjs.git
	cd togetherjs
	heroku create
	heroku config:add HOST=0.0.0.0
	git push heroku master

Make note of the app name after running `heroku create` You can check that everything is running by going to http://your-app-name-here.herokuapp.com/status

## Addons

There is an addon for Firefox in [addon/](https://github.com/mozilla/togetherjs/tree/develop/addon).

This isn't intended to be the "normal" way anyone uses TogetherJS, but it is a development tool to try TogetherJS out on a site that hasn't integrated `togetherjs-min.js` itself.  When you activate the addon (via a link in the [Add-On Toolbar](https://support.mozilla.org/en-US/kb/add-on-bar-quick-access-to-add-ons)) it simply adds `togetherjs-min.js` to every page in that tab (until you close the tab or turn it off).  Also if you open a link with `#&togetherjs=...` (the code used in the share link) it will automatically turn TogetherJS on for the tab.

### Installing

A simple way to install is simply to [click this link](https://togetherjs.com/togetherjs.xpi) in Firefox, and install the addon.  You can turn the addon on or off via the addon manager.  No restart is required.

### Building

You can build the addon using the [Addon-SDK](https://addons.mozilla.org/en-US/developers/builder). Once you've installed the SDK, go into the `addon/` directory and run `cfx xpi` to create an XPI (packaged addon file) or `cfx run` to start up Firefox with the addon installed (for development).

## Getting Help

### IRC / Live Chat

We are available on the `#togetherjs` channel on `irc.mozilla.org`. Logs are on [irclog.gr](http://irclog.gr/#browse/irc.mozilla.org/togetherjs)

If you don't use IRC, you can quickly join the chat from the web [using kiwiirc](https://kiwiirc.com/client/irc.mozilla.org/togetherjs).

### Issues

Please submit any issues you have via [the Github issue tracker](https://github.com/mozilla/togetherjs/issues/new).

Don't be shy about opening an issue.  If you have a question or feature request that might already be possible, we can exchange comments via the issue tracker to figure it out.  We don't have a mailing list, so issues are a good way to keep a persistent record of these exchanges.

### Email

Feel free to email us at [togetherjs@mozilla.com](mailto:togetherjs@mozilla.com) with any questions, suggestions, or concerns.
