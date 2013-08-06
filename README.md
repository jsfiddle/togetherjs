TowTruck - Who you call when you get stuck
===========================================

What is TowTruck?
-----------------

TowTruck is a service for your website that makes it surprisingly easy to collaborate in real-time.

Using TowTruck two people can interact on the same page, seeing each other's cursors, edits, and browsing a site together.  The TowTruck service is included by the web site owner, and a web site can customize and configure aspects of TowTruck's behavior on the site.

For more information and to see TowTruck in action, visit [towtruck.mozillalabs.com](https://towtruck.mozillalabs.com/)

If you want to integrate TowTruck onto your site see [the wiki](https://github.com/mozilla/towtruck/wiki) and specifically [Getting Started](https://github.com/mozilla/towtruck/wiki/Developers:-Getting-Started).

Contributing
============

The remainder of this document is about contributing to TowTruck - but reports, fixes, features, etc.  Look back at those other links if you are looking for something else.

Bug Reports
-----------

Please submit bug reports as [github issues](https://github.com/mozilla/towtruck/issues/new).  Don't worry about labels or milestones.  If you use the in-app feedback to give us a bug report that's fine too.

Roadmap & Plans
---------------

To see what we're planning or at least considering to do with TowTruck, look at [see our bug tracker](https://github.com/mozilla/towtruck/issues?state=open).

Setting up a development environment
------------------------------------

TowTruck has two main pieces:

* The [server](https://github.com/mozilla/towtruck/blob/develop/hub/server.js), which echos messages back and forth between users.  The server doesn't do much, you may gaze upon it's incredibly boring [history](https://github.com/mozilla/towtruck/commits/develop/hub/server.js).

* The client in [`towtruck/`](https://github.com/mozilla/towtruck/tree/develop/towtruck) which does all the real work.

There is a TowTruck hub server deployed at `https://hub.towtruck.mozillalabs.com` - and there's little need for other server deployments.  If you want to try TowTruck out we recommend you use our hub server.  Note if you include TowTruck on an https site, you must use an https hub server.

The files need to be lightly "built": we use [LESS](http://lesscss.org/) for styles, and a couple files are generated.  To develop you need to build the library using [Grunt](http://gruntjs.com/).

To build a copy of the library, check out TowTruck:

```sh
$ git clone git://github.com/mozilla/towtruck.git
$ cd towtruck
```

Then [install npm](http://nodejs.org/download/) and run:

```sh
$ npm install
$ npm install -g grunt-cli
```

This will install a bunch of stuff, most of which is only used for development.  The only "server" dependency is [WebSocket-Node](https://github.com/Worlize/WebSocket-Node) (and if you use our hub then you don't need to worry about the server).  By default everything is installed locally, i.e., in `node_modules/`.  This works just fine, but it is useful to install the `grunt` command-line program globally, which `npm install -g grunt-cli` does.

Now you can build TowTruck, like:

```sh
$ grunt build buildsite --no-hardlink
```

This will create a copy of the entire `towtruck.mozillalabs.com` site in `build/`.  You'll need to setup a local web server of your own pointed to the `build/` directory.

If you want to develop with TowTruck you probably want the files built continually.  To do this use:

```sh
$ grunt devwatch
```

This will rebuild when changes are detected.  Note that Grunt is configured to create [hard links](http://en.wikipedia.org/wiki/Hard_link) instead of copying so that most changes you make to files in `towtruck/` don't need to be rebuilt to show up in `build/towtruck/`.  `--no-hardlink` turns this behavior off.

You may with to create a static copy of the TowTruck client to distribute and use on your website.  To do this run:

```sh
$ grunt build --base-url https://myapp.com --no-hardlink --dest static-myapp
```

Then `static-myapp/towtruck.js` and `static-myapp/towtruck-min.js` will be in place, and the rest of the code will be under `static-myapp/towtruck/`.  You would deploy these on your server.


Testing
-------

Tests are go in `build/towtruck/tests/` -- if you have the server setup you can go there to see a list of tests.  The tests use [doctest.js](http://doctestjs.org/).

License
-------

This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this file,
You can obtain one at [http://mozilla.org/MPL/2.0/](http://mozilla.org/MPL/2.0/).
