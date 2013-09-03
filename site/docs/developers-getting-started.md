# Developers: Getting Started

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