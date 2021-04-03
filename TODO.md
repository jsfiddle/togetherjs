# Day to day towards full typing
- [ ] remove types for tjs.d.ts and use classes
- [ ] there is many different types of message that overlap in togetherjs.d.ts and peers.ts, and maybe in other places

# Things to check to validate full typing
- [x] split all .on("event1 event2") as multiple commands to have a good typechecking, the anonymous function would need to be named to be reused obviously
- [ ] check all TODO qw (stand for quick win), those should be things that can be done in less than 10 seconds, like deleting a line
- [ ] check all @deprecated tags and see if some are still used (some tags are in the middle of sentences so search for "@deprecated" and not for "/** @deprecated"
- [ ] check all TODO comments
    - [ ] TODO ! in particular
- [ ] check all TODO any comments
- [ ] check all FIXME comments?
- [ ] Configuration options seriously need to be reduced
- [ ] check all assert that are used for type checking
- [ ] check for @ts- comments
- check all // tslint- comments (maybe even without the //)
- [ ] search for all variables for which the unused status was hidden by prefixing them by underscore the regex might be something like [(,]_[a-zA-Z]
- [ ] check types
    - [ ] check all uses of any
        - [ ] "as any"
    - [ ] check all uses of unknown
    - [ ] check all type with "undefined | null" or "null | undefined"
    - [ ] check all uses of Function
    - [ ] search all "!." and "!;" and "!)"
    - [ ] check all unknown types
    - [ ] check all usages of object

# High priority towards full typing without logic change:
- [x] Find the logic for PeerSelf, PeerClass, ExternalPeer, PeerView

# Architectural changes (only after full typing)
- [X] Switch to a better import system
- [ ] remove JQuery
    - [x] set JQuery as private at first https://requirejs.org/docs/jquery.html
- [x] remove or update tiny colors, it's a whole library for only a few calls

# Logic changes (only after full typing)
- remove all ref to TowTruck, it's old enough to throw out legacy stuff
- use tslint to find useless nullchecks
- clean the require stuff

# Improvements (only after full typing)
- Browse PR on original repo to implement them

# Maybe towards full typing
- [ ] maybe I should convert the libs? Like walkabout?
- [x] replace all "} else " and "} catch("

# Misc
- [x] look at all usage of session.hub.on and set a message type for each event
    - [x] same for session.on
    - [x] same for session.send
    - [x] same for calls to .off
    - [x] same for templating.sub
    - [x] same for emit
        - [x] check all TODO emit error (only 2 remaining that will be solved later)
    - [x] same for ui.chat.system
    - [x] same for ui.chat.leftSession and others
    - [x] same for storage.tab.get

# Message Architecture

Send methods:
- [x] session.send
- [x] session.appSend
- [x] channel.send

Receiving methods:
- [x] .on(
    - [x] channel.on
    - [x] session.on
    - [x] peers.on
    - [x] session.hub.on
- [x] .once(
    - [x] TogetherJS.once
- [x] .emit(
- [x] peers.updateFromHello
- [x] .onmessage
    - [x] channel.onmessage
    - [x] route.onmessage

Other methods:
- [ ] session.makeHelloMessage

# Tests

run `node devserver.js` and go to [http://localhost:8080/togetherjs/tests/]

Functional tests:
- misc 22/22
- notifications 16/16
- walkthrough 2/2
- peer status 7/7
- forms 16/16
- ace 12/12
- codemirror 11/11

Unit tests:
- storage 6/6
- resolves 3/4, 1 failures
- elementFinder 2/2
- ot text 26/26
- linkify 4/4
- console 2/2
- misc (small) 8/8

# JQuery

For legacy reasons we use JQuery 1.11.1 which is apparently the last version of JQuery in the branch 1.x.
It was released on May 1st 2014 according to [this](https://blog.jquery.com/2014/05/01/jquery-1-11-1-and-2-1-1-released/)
The api at this date can be browsed here: https://web.archive.org/web/20140520215629/http://api.jquery.com/

# Playback

Typing `/record` in the chat starts the recording which will open a popup. Then, do some things on the page like moving your cursor or clicking. Then `/savelogs l2` will save it in the localstorage. Then `/playback local:l2` will replay those events.

# Browserify

`node node_modules/browserify/bin/cmd.js togetherjs/ts/main.ts -p \[ tsify -p . \] > togetherjs-package.js`

Cannot work for now. Would have to do an entrypoint that imports everything (named main.ts for example), needs some work.