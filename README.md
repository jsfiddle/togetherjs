TowTruck - Who you call when you get stuck
===========================================

What is TowTruck?
-----------------
TowTruck is a simple, easy-to-use collaboration add-on for web applications.


Introduction
------------

You can see a screencast of the TowTruck prototype (found in "prototype" branch) in action here: [https://vimeo.com/36754286](https://vimeo.com/36754286)

Setup
-----

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

This exists in app/hub/server.js. By default in dev mode, it serves the setup code here: [http://localhost:8080/towtruck.js](http://localhost:8080/towtruck.js).

- `server.js`: the Node.js server, just one file.  It's pretty dumb, just passing messages back and forth between clients.  It is a goal to keep it dumb, and leave the important logic in the client.  Most of the code you'll see in there is to make development easier, handling the sequential loading of modules, compiling LESS, inserting templates, etc.

Third-party libraries in `app/http/public/towtruck/libs/`.

A basic overview of the code, which is in `app/http/public/towtruck`:


- `channels.js`: abstraction over WebSockets and other communication methods.  Buffers output while the connection is opening, handles JSON encoding/decoding.

- `chat.js`: the chat widget

- `element-finder.js`: when you want to talk about a particular element with another browser/client, this creates a description and finds elements based on that description.  `#id` is the easiest description of course, but this handles elements that lack ids.

- `session.js`: this is where most of the setup work is done. It establishes the channels, routes messages to different components, and handles persistence.

- `towtruck.js`: this is the bootstrap code.  It doesn't do anything, but when asked it knows how to load up all the other modules and get things started.  It also detects if TowTruck should be started immediately (like when someone opens the "share" link).

- `tracker.js`: this handles the tracking/syncing of individual pieces across clients.  The support code for sharing textareas, form controls, and CodeMirror components is in here.

- `util.js`: several bits of abstract support code are in here.  It's also the file that must be loaded first, it sets up jQuery and Underscore as noConflict, creates the TowTruck object.  It also includes a pattern for creating classes, assertions, events.

- `app/http/views/towtruck/*.tmpl`: these are Underscore templates for the UI bits.  These are automatically inlined into `towtruck-runner.js`.


### Examples Server

There are some examples in `app/examples/`. These are served up on `EXAMPLE_SERVER_PORT` which defaults to [http://localhost:8081](http://localhost:8081)

[http://localhost:8081/friendlycode.html](http://localhost:8081/friendlycode.html) is an example of a [CodeMirror](http://codemirror.net/) editor, embedded in [FriendlyCode](https://github.com/mozilla/friendlycode) (which in turn is the basis of [Thimble](https://thimble.webmaker.org/en-US/)).




Integration
-----------

TowTruck is meant to be an unintrusive bit of Javascript you add to your page to enable these collaborative features.  It inspects the page to determine what fields can be synchronized between the two browsers, and adds its own interface on top of the content.

`towtruck.js` itself is just a small piece of code to start up TowTruck, it should not cause overhead in your code.  You can either include an element on your page `<div id="towtruck-starter"></div>`, and a TowTruck button will be added to that, or you can call `TowTruck()` yourself.

You can enter `/help` into the chat window to see some developer-oriented features.

### Docking

In order to enable docking, you must have at least one element in your page with the class `towtruck-undocked`.  When the chat interface is "docked" this class is swapped for `towtruck-docked`.  You can also put `data-towtruck-doc-*` attributes on your body element, which are additional CSS rules applied to the chat window when docked.

You may generally find it sufficient to do:

```css
#container.towtruck-docked {
  margin-right: 420px;
}
```

The idea being that you clear a 420px area on the left side of the screen when the interface is docked.  Of course 420px is a very specific number, and it likely to change, so please test docking if you use it.

Bookmarklet
-----------

Go to `http://localhost:8080/bookmarklet.html` for a bookmarklet that you can use to start TowTruck.  This of course excludes the possibility of the page cooperating with TowTruck, but much of what it does is automatic anyway.


Testing
-------

There isn't much right now. [Walkabout.js](https://github.com/ianb/walkabout.js) is included in the code, which is a tool to do random things on a page.  The plan is to combine this with lots of santiy checks in the code itself.  You can activate Walkabout with `/test` in the chat (`/help` to see more options).

You can also go to `http://localhost:8080/tests/?name=exercise.js` for some other simple tests.

License
-------

This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this file,
You can obtain one at [http://mozilla.org/MPL/2.0/](http://mozilla.org/MPL/2.0/).
