TowTruck client
===============

This is most of the files for the TowTruck client.  The [`app/http/views/towtruck` directory](https://github.com/mozilla/towtruck/tree/develop/app/http/views/towtruck) has a couple other files that require substitution, and [`towtruck.less`](https://github.com/mozilla/towtruck/blob/develop/app/http/public/towtruck.less) has the styles.  [`interface.html`](https://github.com/mozilla/towtruck/blob/develop/app/http/views/towtruck/interface.html) has most of the markup.

An overview of the modules:

- `libs/`: contains external libraries, sometimes as [git subtree inclusions](https://github.com/apenwarr/git-subtree) and sometimes just copied in.

- `channels.js`: abstraction over WebSockets and other communication methods (like `postMessage`).  Buffers output while the connection is opening, handles JSON encoding/decoding.

- `chat.js`: handles the chat code, including logging old chat messages.  Doesn't actually include the chat UI, which is in `ui.js`

- `cobrowse.js`: handles cases when users are at different URLs.  Doesn't include actualy UI, just message managing.

- `cursor.js`: handles the shared cursors, both displaying and capturing events.  Also handles clicks.  This *does* include the relevant UI.

- `element-finder.js`: this generates a description/locator/path for any element, and finds elements based on those paths.  It generates something similar to a CSS selector.  It also includes a function to determine what elements should be ignored (generally TowTruck's own elements).

- `eventMaker.js`: this creates artificial events, like a fake click event.

- `modal.js`: creates modal dialogs.

- `playback.js`: handles the magic `/playback` command that plays recordings.

- `recorder.js`: this is used by `../recorder.html`, which is a kind of alternate mini-client used to record sessions when you put `/record` in the chat box.

- `session.js`: probably the most important and most core module in the system.  This sets up the channels, routes messages, tracks peers, and is used for some communication (like `session.on("ui-ready")` - which is actually signalled by `ui.js` but is fired on the session module).

- `towtruck.js` (in `app/http/views/towtruck`): this is the bootstrap code.  It is included on all pages, defines the `TowTruck` variable, and handles configuration and initial loading.

- `tracker.js`: this handles the tracking/syncing of individual pieces across clients.  The support code for sharing textareas, form controls, and CodeMirror and ACE components is in here.

- `ui.js`: this has most of the UI.  It loads the UI and binds most of the methods.  It's a jumble of UI stuff.  `ui.activateUI()` is the most important function.

- `util.js`: several bits of abstract support code are in here.  It doesn't depend on other things, and has fairly abstract general-purpose code.  It includes a pattern for creating classes, assertions, events.

- `walkthrough.js`: implements the walkthrough help.

- `webrtc.js`: handles the live audio chat and avatar editing.
