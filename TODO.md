# Day to day towards full typing
- remove types for tjs.d.ts and use classes
- there is many different types of message that overlap in togetherjs.d.ts and peers.ts, and maybe in other places

# Things to check to validate full typing
- check all TODO comments
    TODO ! in particular
- check all TODO any comments
- check all FIXME comments?
- check all uses of any
- check all uses of unknown
- check all type with "undefined | null" or "null | undefined"
- check all uses of Function
- search all "!." and "!;" and "!)"
- check all unknown types
- check all usages of object
- Configuration options seriously need to be reduced
- check all assert that are used for type checking

# High priority towards full typing without logic change:
- Find the logic for PeerSelf, PeerClass, ExternalPeer

# Architectural changes (only after full typing)
- Switch to a better import system
- remove JQuery

# Logic changes (only after full typing)
- remove all ref to TowTruckConfig_, it's old enough to throw out legacy stuff
- use tslint to find useless nullchecks
- clean the require stuff

# Improvements (only after full typing)
- Browse PR on original repo to implement them

# Maybe towards full typing
- maybe I should convert the libs? Like walkabout?
- replace all "} else"

# Misc
- look at all usage of session.hub.on and set a message type for each event
    - X same for session.on
    - X same for session.send
    - X same for calls to .off
    - X same for templating.sub
    - same for emit
        - check all TODO emit error (only 2 remaining that will be solved later)
    - X same for ui.chat.system
    - X same for ui.chat.leftSession and others
    - same for storage.tab.get

# Message Architecture

Send methods:
- X session.send
- X session.appSend
- X channel.send

Receiving methods:
- X .on(
    - x channel.on
    - x session.on
    - x peers.on
    - x session.hub.on
- X .once(
    - x TogetherJS.once
- X .emit(
- X peers.updateFromHello
- X .onmessage
    - X channel.onmessage
    - x route.onmessage

Other methods:
- session.makeHelloMessage

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
