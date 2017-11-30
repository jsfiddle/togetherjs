## TogetherJS - Surprisingly easy collaboration

<details><summary>Table of Contents (ToC)</summary>

Table of Contents (ToC)
=========================

* [What is TogetherJS](#what-is-together-js)
* [Contributing](#contributing)
* [Bug Reports](#bug-reports)
* [Roadmap & Plans](#roadmap-and-plans)
* [Setting up a development environment](#setting-up-a-development-environment)
* [Running a local server](#running-a-local-server)
* [Testing](#testing)
* [License](#license)

---

</details>

<details><summary>what is TogetherJS?</summary>

### What is TogetherJS?

<sub><b>TogetherJS is a service for your website that makes it surprisingly easy to collaborate in real-time.</b></sub>

<sub><b>Using TogetherJS two people can interact on the same page, seeing each other's cursors, edits, and browsing a site together.  The TogetherJS service is included by the web site owner, and a web site can customize and configure aspects of TogetherJS's behavior on the site.</b></sub>

<sub><b>For more information and to see TogetherJS in action, visit [togetherjs.com](https://togetherjs.com/)</b></sub>

<sub><b>If you want to integrate TogetherJS onto your site see [the wiki](https://github.com/mozilla/togetherjs/wiki) and specifically [Getting Started](https://github.com/mozilla/togetherjs/wiki/Developers:-Getting-Started).</b></sub>

---

</details>

<details><summary>contributing</summary>

### Contributing

<sub><b>The remainder of this document is about contributing to TogetherJS - but reports, fixes, features, etc.  Look back at those other links if you are looking for something else.</b></sub>

---


</details>

<details><summary>bug reports</summary>

### Bug Reports

<sub><b>Please submit bug reports as [github issues](https://github.com/mozilla/togetherjs/issues/new).  Don't worry about labels or milestones.  If you use the in-app feedback to give us a bug report that's fine too.</b></sub>

---

</details>

<details><summary>bug reports</summary>

### Roadmap & Plans

<sub><b>To see what we're planning or at least considering to do with TogetherJS, look at [see our bug tracker](https://github.com/mozilla/togetherjs/issues?state=open).</b></sub>

---

</details>

<details><summary>bug reports</summary>

### Setting up a development environment

<sub><b>TogetherJS has two main pieces:</b></sub>

* <sub><b>The [server](https://github.com/mozilla/togetherjs/blob/develop/hub/server.js), which echos messages back and forth between users.  The server doesn't do much, you may gaze upon its incredibly boring [history](https://github.com/mozilla/togetherjs/commits/develop/hub/server.js).</b></sub>

* <sub><b>The client in [`togetherjs/`](https://github.com/mozilla/togetherjs/tree/develop/togetherjs) which does all the real work.</b></sub>

<sub><b>There is a TogetherJS hub server deployed at `https://hub.togetherjs.com` - and there's little need for other server deployments.  If you want to try TogetherJS out we recommend you use our hub server.  Note if you include TogetherJS on an https site, you must use an https hub server.</b></sub>

<sub><b>The files need to be lightly "built": we use [LESS](http://lesscss.org/) for styles, and a couple files are generated.  To develop you need to build the library using [Grunt](http://gruntjs.com/).</b></sub>

<sub><b>To build a copy of the library, check out TogetherJS:</b></sub>

```sh
$ git clone git://github.com/mozilla/togetherjs.git
$ cd togetherjs
```

<sub><b>Then [install npm](http://nodejs.org/download/) and run:</b></sub>

```sh
$ npm install
$ npm install -g grunt-cli
```

<sub><b>This will install a bunch of stuff, most of which is only used for development.  The only "server" dependency is [WebSocket-Node](https://github.com/Worlize/WebSocket-Node) (and if you use our hub then you don't need to worry about the server).  By default everything is installed locally, i.e., in `node_modules/`.  This works just fine, but it is useful to install the `grunt` command-line program globally, which `npm install -g grunt-cli` does.</b></sub>

<sub><b>Now you can build TogetherJS, like:</b></sub>

```sh
$ grunt build buildsite --no-hardlink
```

<sub><b>This will create a copy of the entire `togetherjs.com` site in `build/`.  You'll need to setup a local web server of your own pointed to the `build/` directory. To start a server on port 8080, run:</b></sub>

```sh
$ node devserver.js
```

<sub><b>If you want to develop with TogetherJS you probably want the files built continually.  To do this use:</b></sub>

```sh
$ grunt devwatch
```

<sub><b>This will rebuild when changes are detected.  Note that Grunt is configured to create [hard links](http://en.wikipedia.org/wiki/Hard_link) instead of copying so that most changes you make to files in `togetherjs/` don't need to be rebuilt to show up in `build/togetherjs/`.  `--no-hardlink` turns this behavior off.</b></sub>

<sub><b>You may wish to create a static copy of the TogetherJS client to distribute and use on your website.  To do this run:</b></sub>

```sh
$ grunt build --base-url https://myapp.com --no-hardlink --dest static-myapp
```

<sub><b>Then `static-myapp/togetherjs.js` and `static-myapp/togetherjs-min.js` will be in place, and the rest of the code will be under `static-myapp/togetherjs/`.  You would deploy these on your server.</b></sub>

---

</details>

<details><summary>running a local server</summary>

### Running a local server

<sub><b>You shouldn't need to run your own version of the hub server.  But if you
happen to make changes to the server, you can change the default hub
URL by setting the HUB_URL environment variable when building.  For example:</b></sub>
```
$ HUB_URL=http://localhost:8080 grunt devwatch
```

---

</details>

<details><summary>testing</summary>

### Testing

<sub><b>Tests are in `togetherjs/tests/` -- these are [doctest.js](http://doctestjs.org/) tests.  To actually run the tests build togetherjs, serve it up, and go to `http://localhost:PORT/togetherjs/tests/` -- from there the tests are linked to from the top of the page.  The actual tests are `*.js` files in `togetherjs/tests/`, generally `test_*.js` for unit-style tests, and `func_*.js` for functional tests.</b></sub>

<sub><b>The "Manual testing" link is something that lets you simulate different conditions in TogetherJS without setting up a second browser/client.</b></sub>

<sub><b>There is unfortunately no automated runner for these tests.  It might be nice if [Karma](http://karma-runner.github.io/) could be setup with doctest.js in general, but so far that isn't done.</b></sub>

---

</details>

<details><summary>license</summary>

### License

<sub><b>This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this file,
You can obtain one at [http://mozilla.org/MPL/2.0/](http://mozilla.org/MPL/2.0/).</b></sub>

---

</details>

<img src="https://orig00.deviantart.net/5b95/f/2016/070/3/b/mit_license_logo_by_excaliburzero-d9ur2lg.png" width="70"></img> <img src="https://pbs.twimg.com/profile_images/821735271049768960/jJZXlJwZ.jpg" width="50"></img> 
