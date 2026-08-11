TogetherJS - Surprisingly easy collaboration
============================================

What is TogetherJS?
-----------------

TogetherJS is a service for your website that makes it surprisingly easy to collaborate in real-time.

Using TogetherJS two people can interact on the same page, seeing each other's cursors, edits, and browsing a site together.  The TogetherJS service is included by the web site owner, and a web site can customize and configure aspects of TogetherJS's behavior on the site.

For more information and to see TogetherJS in action, visit [togetherjs.com](https://togetherjs.com/)

If you want to integrate TogetherJS onto your site see [the wiki](https://github.com/mozilla/togetherjs/wiki) and specifically [Getting Started](https://github.com/mozilla/togetherjs/wiki/Developers:-Getting-Started).

Contributing
============

The remainder of this document is about contributing to TogetherJS - but reports, fixes, features, etc.  Look back at those other links if you are looking for something else.

Bug Reports
-----------

Please submit bug reports as [github issues](https://github.com/mozilla/togetherjs/issues/new).  Don't worry about labels or milestones.  If you use the in-app feedback to give us a bug report that's fine too.

Roadmap & Plans
---------------

To see what we're planning or at least considering to do with TogetherJS, look at [see our bug tracker](https://github.com/mozilla/togetherjs/issues?state=open).

Setting up a development environment
------------------------------------

TogetherJS has two main pieces:

* The hub in [`hub-worker/`](hub-worker/), which echoes messages back and forth between users.  It doesn't do much: it broadcasts whatever it receives to everyone else in the room, and understands none of it.

* The client in [`src/`](src/), which does all the real work.

There is no shared hub server anymore, so you'll need to host your own (see "Hosting the Hub Server" in `site/docs/index.md`). The recommended way is [`hub-worker/`](hub-worker/), a Cloudflare Workers + Durable Objects port of the relay logic that runs on Cloudflare's free plan. Note if you include TogetherJS on an https site, you must use an https/wss hub server (Cloudflare Workers handle this automatically).

The client is a set of ES modules under `src/`, bundled with
[esbuild](https://esbuild.github.io/). To build it, install
[Node](https://nodejs.org/) 20 or newer and run:

```sh
$ npm install
$ npm run build
```

That writes `dist/`:

* `togetherjs.js` — the whole client, ready to drop into a page with
  `<script src=".../togetherjs.js"></script>`
* `togetherjs.min.js` — the same thing, minified, with a source map
* `togetherjs.esm.js` — an ES module entry, for `import { TogetherJS } from "togetherjs"`
* `togetherjs.css`, `images/` — the stylesheet and assets
* `recorder.js`, `walkabout.js` — separate bundles, loaded on demand

To develop, run a watching build with a static server:

```sh
$ npm run dev
```

Then open `examples/index.html`. It expects a hub at `http://localhost:8787`
(run `npx wrangler dev` inside `hub-worker/`), or you can point it elsewhere
with `?hub=http://host:port`.

The hub URL baked into a build comes from the `HUB_URL` environment variable:

```sh
$ HUB_URL=https://hub.example.com npm run build
```

`BASE_URL` does the same for the URL the client's own assets are served from;
leave it unset and the client works out where it was loaded from.

Testing
-------

Unit tests use [Vitest](https://vitest.dev/) and live in `tests/unit/`:

```sh
$ npm test
```

End-to-end tests use [Playwright](https://playwright.dev/) and live in
`tests/e2e/`. They drive two or three real browser contexts through a session
against an in-process stand-in for the hub, covering cursors, chat, form sync
and the audio/video mesh:

```sh
$ npm run test:e2e
```

Lint with `npm run lint` and format with `npm run format`.

`examples/manual/` holds pages for poking at particular behaviours by hand.

License
-------

This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this file,
You can obtain one at [http://mozilla.org/MPL/2.0/](http://mozilla.org/MPL/2.0/).
