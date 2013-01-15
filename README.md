Tow Truck - Who you call when you get stuck
===========================================

Introduction
------------

You can see a screencast of the TowTruck prototype (found in "prototype" branch) in action here: https://vimeo.com/36754286

Setup
-----

It's recommended that you use Foreman to run your development servers. "Why?", you ask. Here's a great intro: <a href="http://blog.daviddollar.org/2011/05/06/introducing-foreman.html">Introducing Foreman</a>.

```
cp .env.sample .env
```

The hub server is in `app/hub/server.js`. To run it, you should have fore To run it you should install Node.js, and run `npm install` in the root of this project.  Then run `node src/server.js` and use `http://localhost:8080/towtruck.js` to include the setup code.

There are examples in `examples/` - you should serve these up yourself (they aren't served through `server.js`).  `examples/textarea.html` is an example of sharing the content of a textarea and some other form controls.  `examples/friendlycode.html` is an example of a [CodeMirror](http://codemirror.net/) editor, embedded in [FriendlyCode](https://github.com/mozilla/friendlycode) (which in turn is the basis of [Thimble](https://thimble.webmaker.org/en-US/)).

TowTruck is meant to be an unintrusive bit of Javascript you add to your page to enable these collaborative features.  It inspects the page to determine what fields can be synchronized between the two browsers, and adds its own interface on top of the content.

`towtruck.js` itself is just a small piece of code to start up TowTruck, it should not cause overhead in your code.  You can either include an element on your page `<div id="towtruck-starter"></div>`, and a TowTruck button will be added to that, or you can call `startTowTruck()` yourself.

You can enter `/help` into the chat window to see some developer-oriented features.

Bookmarklet
-----------

Go to `http://localhost:8080/bookmarklet.html` for a bookmarklet that you can use to start TowTruck.  This of course excludes the possibility of the page cooperating with TowTruck, but much of what it does is automatic anyway.

Code
----

The code is in `src/` with third-party libraries in `src/libs/`.

A basic overview of the code:

- `server.js`: the Node.js server, just one file.  It's pretty dumb, just passing messages back and forth between clients.  It is a goal to keep it dumb, and leave the important logic in the client.  Most of the code you'll see in there is to make development easier, handling the sequential loading of modules, compiling LESS, inserting templates, etc.

- `channels.js`: abstraction over WebSockets and other communication methods.  Buffers output while the connection is opening, handles JSON encoding/decoding.

- `chat.js`: the chat widget

- `element-finder.js`: when you want to talk about a particular element with another browser/client, this creates a description and finds elements based on that description.  `#id` is the easiest description of course, but this handles elements that lack ids.

- `intro.js`: the intro screen, and what you get when you hit *i*

- `towtruck-runner.js`: this is where most of the setup work is done.  It establishes the channels, routes messages to different components, and handles persistence.

- `towtruck.js`: this is the bootstrap code.  It doesn't do anything, but when asked it knows how to load up all the other modules and get things started.  It also detects if TowTruck should be started immediately (like when someone opens the "share" link).

- `tracker.js`: this handles the tracking/syncing of individual pieces across clients.  The support code for sharing textareas, form controls, and CodeMirror components is in here.

- `util.js`: several bits of abstract support code are in here.  It's also the file that must be loaded first, it sets up jQuery and Underscore as noConflict, creates the TowTruck object.  It also includes a pattern for creating classes, assertions, events.

- `*.tmpl`: these are Underscore templates for the UI bits.  These are automatically inlined into `towtruck-runner.js`.

Testing
-------

There isn't much right now.  [Walkabout.js](https://github.com/ianb/walkabout.js) is included in the code, which is a tool to do random things on a page.  The plan is to combine this with lots of santiy checks in the code itself.  You can activate Walkabout with `/test` in the chat (`/help` to see more options).

License
-------

This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this file,
You can obtain one at [http://mozilla.org/MPL/2.0/](http://mozilla.org/MPL/2.0/).
