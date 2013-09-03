# About Audio Chat and WebRTC

The live audio chat is based on [WebRTC](http://www.webrtc.org/).  This is a very new technology, built into some new browsers.

To enable WebRTC both you and your collaborator need a new browser.  Right now, [Firefox Nightly](http://nightly.mozilla.org/) is supported, and we believe that the newest release of Chrome should work.

Sometime in 2013 support for this should be available in new (non-experimental) versions of Firefox, Chrome, and both Firefox and Chrome for Android.

To see a summary of outstanding issues that we know of with audio chat see [this page](https://github.com/mozilla/towtruck/issues?labels=rtc&milestone=&page=1&state=open).

Note that audio chat will not work between some networks.  These networks require a [TURN server](http://en.wikipedia.org/wiki/Traversal_Using_Relays_around_NAT) which unfortunately we do not have allocated (and full support for TURN has not landed in some browsers).  Unfortunately when the network makes chat impossible, chat will simply not work – we don't receive an error, and can't tell you why chat is not working.  See [#327](https://github.com/mozilla/towtruck/issues/327) for progress.