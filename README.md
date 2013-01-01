Tow Truck - Who you call when you get stuck
===========================================

Introduction
------------

You can see a screencast of the TowTruck prototype (found in "prototype" branch) in action here: https://vimeo.com/36754286

Setup
-----

The server is in `src/server.js`.  To run it you should install Node.js, and `npm install node-static websocket less coffee-script`.  Then run `node src/server.js` and use `http://localhost:8080/towtruck.js` to include the setup code.

There are examples in `examples/` - you should serve these up yourself (they aren't served through `server.js`).

`towtruck.js` is just a small piece of code to allow the startup of TowTruck.  You can either include an element `<div id="towtruck-starter"></div>` in your page, and a TowTruck button will be added to that, or you can call `startTowTruck()` yourself.

The actual implementation uses:

- `channels.js`: abstraction over WebSockets
- `towtruck-runner.js`: the actual code for setting up connections, UI, etc.
- `towtruck.less`: compiled to CSS when you load `towtruck.css`
- jQuery; used in noConflict mode

Bookmarklet
-----------

Go to `http://localhost:8080/bookmarklet.html` for a bookmarklet that you can use to start TowTruck.  This of course excludes the possibility of the page cooperating with TowTruck, but it can do some stuff on its own anyway.

License
-------

This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this file,
You can obtain one at [http://mozilla.org/MPL/2.0/](http://mozilla.org/MPL/2.0/).
