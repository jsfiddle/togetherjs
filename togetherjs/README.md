TogetherJS client
=================

This is all the files for the TogetherJS client.
An overview of the modules:

- `libs/`: contains external libraries, sometimes as [git subtree inclusions](https://github.com/apenwarr/git-subtree) and sometimes just copied in.

- `analytics.js`: a little library for handling Google Analytics opt-in support

- `channels.js`: abstraction over WebSockets and other communication methods (like `postMessage`).  Buffers output while the connection is opening, handles JSON encoding/decoding.

- `chat.js`: handles the chat code, including logging old chat messages.  Doesn't actually include the chat UI, which is in `ui.js`

- `cursor.js`: handles the shared cursors, both displaying and capturing events.  Also handles clicks.  This *does* include the relevant UI.

- `elementFinder.js`: this generates a description/locator/path for any element, and finds elements based on those paths.  It generates something similar to a CSS selector.  It also includes a function to determine what elements should be ignored (generally TogetherJS's own elements).

- `eventMaker.js`: this creates artificial events, like a fake click event.

- `forms.js`: handles synchronization of forms, including CodeMirror and ACE support.

- `jqueryPlugins.js`: some plugins for jQuery; doesn't export anything.

- `linkify.js`: detects and adds links to plain text.

- `ot.js`: operational transformation support: what keeps big chunks of text in sync when multiple people are simultaneously editing those fields.

- `peers.js`: handles the objects representing the peers and oneself.

- `playback.js`: handles the magic `/playback` command that plays recordings.

- `randomutil.js`: some functions/methods for random numbers, really just for testing.

- `recorder.js`: this is used by `recorder.html`, which is a kind of alternate mini-client used to record sessions when you put `/record` in the chat box.

- `session.js`: probably the most important and most core module in the system.  This sets up the channels, routes messages, tracks peers, and is used for some communication (like `session.on("ui-ready")` - which is actually signalled by `ui.js` but is fired on the session module).

- `startup.js`: handles the logic of what to display when TogetherJS is first started up (including warning messages, introductory stuff, the share link, confirmation of joining the session)

- `storage.js`: an abstraction of per-tab and client storage.  Mostly uses `localStorage` (or `sessionStorage`), but designed so it could use an async backed someday, perhaps.

- `templates.js`: this is generated dynamically, and includes the `*.html` content as inlined strings.  Basically just a container for these strings.

- `templating.js`: handles creating nodes based on DOM templates.  Does some substitution based on specific class names.

- `togetherjs.js`: this is the bootstrap code.  It is included on all pages, defines the `TogetherJS` variable, and handles configuration and initial loading.

- `ui.js`: this has most of the UI.  It loads the UI and binds most of the methods.  It's a jumble of UI stuff.  `ui.activateUI()` is the most important function.

- `util.js`: several bits of abstract support code are in here.  It doesn't depend on other things, and has fairly abstract general-purpose code.  It includes a pattern for creating classes, assertions, events.

- `walkthrough.js`: implements the walkthrough help.

- `webrtc.js`: handles the live audio chat and avatar editing.

- `windowing.js`: handles creating the different windows, notifications, and modal windows.
