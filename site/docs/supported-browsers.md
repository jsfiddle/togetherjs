# Browser Support

TowTruck is intended for relatively newer browsers.  Especially as we experiment with what we're doing, supporting older browsers causes far more challenge than it is an advantage.

The bare minimum that we've identified for TowTruck is [WebSocket support](http://caniuse.com/websockets).  That said, we generally only test on the most recent version of Firefox and Chrome, so bugs specific to older browsers are more likely (but please [submit bugs](https://github.com/mozilla/towtruck/issues/new) from those browsers anyway – we aren't deliberately not supporting them).  Our next set of browsers to target will be mobile browsers.

## Internet Explorer

With IE 10 it is *possible* to support Internet Explorer (version 9 and before do not support WebSockets).  However we do not test at all regularly on Internet Explorer, and we know we have active issues but are not trying to fix them.  Pull requests to support Internet Explorer are welcome, but right now we don't plan to address bug reports for Internet Explorer that don't come with a pull request.  If Internet Explorer support is important to you we do [welcome your feedback](https://docs.google.com/a/mozilla.com/forms/d/1lVE7JyRo_tjakN0mLG1Cd9X9vseBX9wci153z9JcNEs/viewform).  No decision is set in stone, but we don't want to mislead you with respect to our current priorities and intentions.

# Supported Browsers

We recommend the most recent release of [Firefox](http://www.mozilla.org/en-US/firefox/new/) or [Chrome](https://www.google.com/intl/en/chrome/browser/).

If you want to have [WebRTC support](https://github.com/mozilla/towtruck/wiki/About-Audio-Chat-and-WebRTC) and are using Firefox, as of April 2013 this requires [Firefox Nightly](http://nightly.mozilla.org/) (this support will be moving towards beta and release in the coming months).

We haven't done much testing on mobile (yet!) and cannot recommend anything there.