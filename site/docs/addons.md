# Addons

There is an addon for Firefox in [addon/](https://github.com/mozilla/towtruck/tree/develop/addon).

This isn't intended to be the "normal" way anyone uses TowTruck, but it is a development tool to try TowTruck out on a site that hasn't integrated `towtruck.js` itself.  When you activate the addon (via a link in the [Add-On Toolbar](https://support.mozilla.org/en-US/kb/add-on-bar-quick-access-to-add-ons)) it simply adds `towtruck.js` to every page in that tab (until you close the tab or turn it off).  Also if you open a link with `#&towtruck=...` (the code used in the share link) it will automatically turn TowTruck on for the tab.

## Installing

A simple way to install is simply to [click this link](http://towtruck.mozillalabs.com/towtruck.xpi) in Firefox, and install the addon.  You can turn the addon on or off via the addon manager.  No restart is required.

## Building

You can build the addon using the [Addon-SDK](https://addons.mozilla.org/en-US/developers/builder).  Once you've installed the SDK, go into the `addon/` directory and run `cfx xpi` to create an XPI (packaged addon file) or `cfx run` to start up Firefox with the addon installed (for development).
