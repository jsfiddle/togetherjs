- Switch to a better import system

- remove types for tjs.d.ts and use classes
- look at all usage of session.hub.on and set a message type for each event
    - same for session.on
    - same for session.send(
    - same for calls to .off
    - X same for templating.sub
    - same for ui.chat.system
- remove JQuery

- maybe I should convert the libs? Like walkabout?

- remove all ref to TowTruckConfig_, it's old enough to throw out legacy stuff
- use tslint to find useless nullchecks
- clean the require stuff
- check all TODO comments
- check all TODO any comments
- check all FIXME comments?
- check all uses of any
- check all uses of unknown
- check all type with "undefined | null" or "null | undefined"
- check all usages od object
- Configuration options seriously need to be reduced
- check all uses of Function
- search all "!." and "!;" and "!)"
- check all unknown types
- check all assert that are used for type checking
- there is many different types of message that overlap in togetherjs.d.ts and peers.ts, and maybe in other places
- replace all "} else"

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


