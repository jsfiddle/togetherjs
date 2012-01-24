# Document Metadata Design Proposal

> This feature isn't fully implemented yet

I'm planning on adding metadata support to documents. The idea is to add a sidechannel for data like creation time, cursor positions, connected users, etc.

## New document interface

A document will consist of:

- **Version**: A version number counting from 0
- **Snapshot**: The current document contents
- **Meta**: *(NEW, not yet implemented)* An object containing misc data about the document:
  - Arbitrary user data, set when an object is created. Editable by the server only.
  - **Creation time**
  - **Last modified time**: This is updated automatically on each client each time it sees a document operation
  - **Session data**: An object with an entry for every client that is currently connected. Map clientIds to:
      - **Username** (optional)
      - **Cursor position** (type dependant)
      - **Connection time** maybe?
      - Any other user data. This can be filled in by the auth function when a client connects. (And maybe clients should be able to edit this as well?)

Unlike the document data, metadata changes will not be persisted. Metadata changes will not bump the document's version number. (-wm: I assume that some things like the time stamps will be persisted? And what about when client IDs are stored with ops, shouldn't the user names be persisted?)

Initial document metadata can be set at document creation time.

Some metadata fields like last modified time and cursor positions will be updated automatically on all clients whenever an operation is submitted. (-wm: this will probably mean storing the time delta between the server and client)

## Metadata operations

> This is implemented, but the only path handled now is 'shout'

We also add a new kind of operation, a **meta operation**. I've thought about using the JSON OT type for this, but it means that if someone wants to implement the sharejs wire protocol, they have to implement JSON OT (which is really complicated). So I'm going to keep it simple.

Metadata operations express changes in the metadata object. They look like this:

- NOT **Version**: Metadata changes should be independent of current document version number
- **Path**: List of object keys to reach the target of the change. All path elements except the last must already exist.
- **New value**: *(optional)* JSON object which replaces whatever was at the metadata object before. If this is missing, the object is removed.

Some paths are special:

- ``['shout', ...]``: Broadcasts the value to all clients, doesn't keep it in memory. Full path is ignored.
- ``['ctime']``, ``['mtime']``, ``['sessions']``: Read only, see above

Metadata gets consistency guarantees by restricting who is allowed to submit metadata changes.

The server can send metadata operations to clients:

- [``shout``]: ``value`` is the value being broadcast, ``by`` is the clientid that shouted (not implemented). This results in an event emitted by Doc: ``('shout', value)``.
  > (Right now the full path used is given to the client, perhaps this could be used to send specific Doc events instead of just "shout", like ``('shout_foo', value)`` for ``path: ['shout', 'foo']``?)

The model emits ``('applyMetaOp', path, value)`` for all successful meta operations

## Transforming cursor positions

> not implemented

Types can also specify cursor transforms. This is important to make cursors move as you edit content surrounding them.

```coffeescript
TYPE.transformCursor = (position, operation) -> newPosition
```

Clients are responsible for updating cursor positions in two scenarios:

- When they generate operations locally they transform everyone's cursor position by the operation
- When they receive updated cursor positions from the server against an old version

The server will pre-transform cursor positions before rebroadcasting them.


## Expected usage

- **A new client connects** - the server will add an entry corresponding to the client in the session data
- **A user moves their cursor** - they send a metadata op which is broadcast via the server to indicate their new cursor position. (Note that cursor positions may be more complicated than just a number. Imagine a user exploring a spreadsheet...)
- **The client sees a new document operation** It updates the last modified time of the session data using its local clock. It doesn't tell anyone else - they'll each have each made the same change locally as well.

- - -

#### Still to figure out

- How does the client learn its own ID?
  - It could get another special metadata field when it opens a document
  - It could be told its ID when it gets its first message from the server, or when it opens a document
- Are clients allowed to make arbitrary changes to the document's metadata?
- What is the client API for querying cursor positions and getting notified of metadata changes?

