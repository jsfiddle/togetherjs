TowTruck - Who you call when you get stuck
===========================================

What is TowTruck?
-----------------

TowTruck is a service for your website that makes it surprisingly easy to collaborate in real-time.

Using TowTruck two people can interact on the same page, seeing each other's cursors, edits, and browsing a site together.  The TowTruck service is included by the web site owner, and a web site can customize and configure aspects of TowTruck's behavior on the site.

For more information and to see TowTruck in action, visit [towtruck.mozillalabs.com](https://towtruck.mozillalabs.com/)

If you want to integrate TowTruck onto your site also visit [towtruck.mozillalabs.com](https://towtruck.mozillalabs.com).

Contributing
============

The remainder of this document is about contributing to TowTruck - but reports, fixes, features, etc.  Look back at those other links if you are looking for something else.

Bug Reports
-----------

Please submit bug reports as [github issues](https://github.com/mozilla/towtruck/issues/new).  Don't worry about labels.  If you use the in-app feedback to give us a bug report that's fine too.

Roadmap & Plans
---------------

To see what we're planning or at least considering to do with TowTruck, look at [all bugs marked "enhancement"](https://github.com/mozilla/towtruck/issues?labels=enhancement&state=open).  (Or at least that report will be what we intend once [#260](https://github.com/mozilla/towtruck/issues/260) is fixed.)

Setting up a development environment
------------------------------------

TowTruck has two main pieces:

* The [server](https://github.com/mozilla/towtruck/blob/master/app/hub/server.js), which echos messages back and forth between users.  The server doesn't do much, you may gaze upon it's incredibly boring [history](https://github.com/mozilla/towtruck/commits/master/app/hub/server.js).  The nice part of this

* The client in [`app/https/public/towtruck`](https://github.com/mozilla/towtruck/tree/master/app/http/public/towtruck) and [`app/https/views/towtruck`](https://github.com/mozilla/towtruck/tree/master/app/http/views/towtruck), which does all the real work.

There is a TowTruck hub server deployed at `https://hub.towtruck.mozillalabs.com` - and there's little need for other server deployments.  If you want to try TowTruck out we recommend you use our hub server.  Note if you include TowTruck on an https site, you must use an https hub server.

Some of the static files contain configuration parameters (hopefully with [#277](https://github.com/mozilla/towtruck/issues/277) we'll be able to simplify this).  So to develop you either need to run the server or make a static copy.  Running the server is better when trying to commit your work.

First you'll need [LESS](http://lesscss.org/) to compile the [main CSS/.less file](https://github.com/mozilla/towtruck/blob/develop/app/http/public/towtruck.less):

```sh
$ npm install -g less
```

If you want to create a static copy of TowTruck (not as great for development), do:

```sh
$ git clone git://github.com/mozilla/towtruck.git
$ cd towtruck
$ ./bin/make-static-client STATIC_FILES http://url.where/you/will/publish
$ scp -r STATIC_FILES/* url.where:/www/public/you/will/publish/
```

Now you have your own static copy of the client, potentially with your own modifications and customizations of the code.

Running a Local Server
----------------------

If you do want to use the server (which conveniently updates those files on demand, so you don't have to rebuild after edits):

It's recommended that you use Foreman to run your development servers. "Why?", you ask. Here's a great intro: [Introducing Foreman](http://blog.daviddollar.org/2011/05/06/introducing-foreman.html).

Foreman is a [Ruby](http://www.ruby-lang.org/) project the easiest way to get it running locally is to be using a relatively recent version of Ruby and Gem and execute: `gem install foreman`. You may need administrator access to do this, in which case you should run it with sudo.

### Configuration for Foreman

Copy and edit your .env file. -- This should never be committed to the repo.

```
cp .env.sample .env
```

### Dependencies

Execute `npm install` in the application directory:

### Running in Development mode

```
foreman start -f Procfile.dev
```

This will start all the servers including the examples server.

Servers
-------

### Hub Server

This exists in app/hub/server.js.

- `server.js`: the Node.js server, just one file.  It's pretty dumb, just passing messages back and forth between clients.  It is a goal to keep it dumb, and leave the important logic in the client.

Third-party libraries are in `app/http/public/towtruck/libs/`.

To see an overview of the client code [read the TowTruck README](https://github.com/mozilla/towtruck/tree/develop/app/http/public/README.md)

A basic overview of the code, which is in `app/http/public/towtruck`:


- `channels.js`: abstraction over WebSockets and other communication methods (like `postMessage`).  Buffers output while the connection is opening, handles JSON encoding/decoding.

- `chat.js`: the chat widget

- `element-finder.js`: when you want to talk about a particular element with another browser/client, this creates a description and finds elements based on that description.  `#id` is the easiest description of course, but this handles elements that lack ids.

- `session.js`: this is where most of the setup work is done. It establishes the channels, routes messages to different components, and handles persistence.

- `towtruck.js`: this is the bootstrap code.  It doesn't do anything, but when asked it knows how to load up all the other modules and get things started.  It also detects if TowTruck should be started immediately (like when someone opens the "share" link).

- `tracker.js`: this handles the tracking/syncing of individual pieces across clients.  The support code for sharing textareas, form controls, and CodeMirror components is in here.

- `util.js`: several bits of abstract support code are in here.  It's also the file that must be loaded first, it sets up jQuery and Underscore as noConflict, creates the TowTruck object.  It also includes a pattern for creating classes, assertions, events.

- `cursor.js`: handles the shared cursors and clicks

- `webrtc.js`: handles the audio and avatar editing

- `cobrowse.js`: handles cases when the users are at different URLs

- `app/http/views/towtruck/*.tmpl`: these are Underscore templates for the UI bits.  These are automatically inlined into `towtruck-runner.js`.



### Examples Server

There are some examples in `app/http/public/example/`.

Bookmarklet
-----------

Go to `http://localhost:8080/bookmarklet.html` for a bookmarklet that you can use to start TowTruck.  This of course excludes the possibility of the page cooperating with TowTruck, but much of what it does is automatic anyway.

Firefox Add-on
--------------------

There's a Firefox Add-on that enables testing on sites that don't include towtruck.js on their own.

You can downlod the add-on here: https://towtruck.mozillalabs.com/towtruck.xpi

It adds a link into the status bar:

![TowTruck Add-on Link](https://towtruck.mozillalabs.com/images/readme/add-on-link.jpg)

Clicking it enables TowTruck on any site, such as http://github.com/

![TowTruck Enabled on Github](https://towtruck.mozillalabs.com/images/readme/add-on-enabled.jpg)


Testing
-------

There isn't much right now. [Walkabout.js](https://github.com/ianb/walkabout.js) is included in the code, which is a tool to do random things on a page.  The plan is to combine this with lots of santiy checks in the code itself.  You can activate Walkabout with `/test` in the chat (`/help` to see more options).

You can also go to `http://localhost:8080/tests/?name=exercise.js` for some other simple tests.

License
-------

This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this file,
You can obtain one at [http://mozilla.org/MPL/2.0/](http://mozilla.org/MPL/2.0/).
