TogetherJS client
=================

The client is a set of ES modules bundled by `build/build.mjs` (esbuild). The
entry point is `index.js`; everything else is grouped by what it does.

Two conventions are worth knowing before reading any of it:

- **`core/togetherjs.js` is imported, not global.** It defines the `TogetherJS`
  object and assigns `window.TogetherJS`, but every module that uses it imports
  it explicitly. Under RequireJS the load order made the global safe to read at
  module scope; in a single bundle it is not.
- **Configuration is read lazily.** The bundle evaluates when the `<script>`
  runs, which is *before* the host page's configuration has been applied, so
  nothing may read `TogetherJS.config` at module scope.

Modules on an import cycle (session ↔ ui, peers ↔ ui) publish themselves to
`core/registry.js` and look each other up at call time. A static import would
evaluate the dependency before the dependent's own body had run.

### `core/`

- `togetherjs.js`: the `TogetherJS` object — configuration, the event mixin,
  startup state, and the public API surface. Depends on nothing else.
- `session.js`: the most important module. Sets up the channel, routes
  messages, tracks peers, and carries the lifecycle events other modules hang
  off (`session.on("ui-ready")` is fired by `ui.js` but lives here).
- `channels.js`: abstraction over WebSockets and `postMessage`. Buffers output
  while the connection opens, handles JSON encoding, reconnects with backoff.
- `peers.js`: the objects representing other participants and yourself.
- `storage.js`: per-tab and per-client storage over `localStorage` /
  `sessionStorage`, with a promise-shaped API.
- `startup.js`: what to show when a session first starts — browser warnings,
  the intro, the share link.
- `who.js`: peeks into another room's occupants without joining it.
- `console.js`: TogetherJS's own log collector.
- `util.js`: general-purpose support code — assertions, URL handling, and
  `util.Deferred`, a native-promise deferred that keeps the progress
  notifications a couple of callers rely on.
- `events.js`: the event system. `EventEmitter` for classes, `mixinEvents()`
  for the module singletons; one implementation behind both.
- `registry.js`: the lazy-module registry described above.

### `dom/`

- `dom.js`: the jQuery replacement. Provides the subset of the jQuery API the
  client actually used, and nothing more.
- `animate.js`: the UI's animations, on the Web Animations API and CSS
  transitions.
- `elementFinder.js`: generates a locator for any element and finds elements
  from those locators, so peers can point at each other's DOM. Also decides
  which elements to ignore (TogetherJS's own, mostly).
- `templating.js`: builds nodes from DOM templates, substituting by class name.
- `eventMaker.js`: synthesises events, such as a fake click.
- `linkify.js`: turns URLs in text into links.

### `ui/`

- `ui.js`: most of the interface. Loads the markup and binds the controls;
  `ui.activateUI()` is the entry point.
- `windowing.js`: windows, notifications and modals.
- `chat.js`: chat logic and the slash commands. The chat UI itself is in
  `ui.js`.
- `icons.js`: the icon set, as inline SVG painted with `currentColor`.
- `palette.js`: the peer colours — an even OKLCH ramp — and colour validation.
- `dock-position.js`: which edge the dock is on, shared between `ui.js` and
  `windowing.js` without a circular import.
- `visibility.js`: normalises the Page Visibility API into a session event.

### `sync/`

- `cursor.js`: shared cursors and clicks — both capture and display.
- `forms.js`: form field synchronisation, including Ace, CodeMirror, CKEditor
  and TinyMCE.
- `ot.js`: operational transformation, which is what keeps text fields
  consistent when two people type into one at the same time. `SimpleHistory`
  leans on the hub to serialise changes and transposes the local queue around
  whatever comes back.
- `videos.js`: `<video>` / `<audio>` play, pause and seek.
- `youtube.js`: the same for embedded YouTube players.

### `rtc/`

Audio and video calling. See the header comment in `rtc/index.js`; the short
version is one `RTCPeerConnection` per peer, negotiated with the WebRTC spec's
perfect-negotiation pattern.

- `media.js`: the local microphone and camera.
- `connection.js`: a single peer connection.
- `mesh.js`: the set of connections, and the signaling.
- `ui.js`: the dock buttons and the video tiles.

### Other

- `templates/`: `interface.html`, `help.txt` and the `locale/*.json`
  translations. `build/templates.mjs` renders one copy per locale into
  `generated.js`, which is bundled; `templates.js` picks the right one at
  runtime. Locale keys are the English source strings, so rewording one drops
  its translations — the build reports the count on every run.
- `styles/`: plain CSS. Every selector is scoped to a TogetherJS root, and the
  design tokens (`--tj-*`, declared on `.togetherjs`) are the supported way
  for a host page to restyle the client.
- `vendor/`: third-party code. `walkabout/` (a fuzz tester, loaded on demand by
  the `/test` chat command) and `whrandom/` (a seeded PRNG, used by tests).
- `recorder.js` / `playback.js`: the `/record` and `/playback` commands.
  `recorder.js` is its own bundle, loaded by `examples/recorder.html`.
- `randomutil.js`: seeded random helpers, for tests.
