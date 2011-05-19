Wire protocol
=============

> Protocol version 0.2 - This protocol is be used by ShareJS 0.2, which hasn't been released yet.

ShareJS has two wire protocols you can use to create, view and edit documents. These are:

- REST frontend
- [Socket.IO](http://socket.io/) frontend

The RESTful protocol is simpler to use, but does not support live streaming operations.

Think of ShareJS as a key-value store which maps string names to document data. Documents are versioned. To edit a document, you must apply an _operation_ to the document.

The wire protocols let clients:

- Fetch a document's current version and contents
- Submit operations
- Receive operations as they are submitted (socket.io only)
- Perminantly delete documents (This is experimental, only available in the REST protocol and disabled by default).


Documents
---------

ShareJS is a key-value store mapping a document's name to a versioned document. Documents must be created before they can be used. Each document has a _version_, a _type_ and a _snapshot_.

The document's _type_ specifies a set of functions for interpretting and manipulating operations. You must set a document's type when it is created. After a document's type is set, it cannot be changed. Each type has a unique string name -- for example, the plain text type is called `'text'` and the JSON type is called `'json'`. More types will be added in time - in particular rich text and JSON. For details of how types work, see [Types](Types).

Document _versions_ start at 0. The version is incremented each time an operation is applied.

The document's _snapshot_ is the contents of the document at some particular version. For text documents, the snapshot is a string containing the document's contents. For JSON documents, the snapshot is a JSON object.

For example, a text document might have the snapshot `'abc'` at version 100. An _operation_ `[{i:'d', p:3}]` is applied at version 100 which inserts a `'d'` at the end of the document. After this operation is applied, the document has a snapshot at version 101 of `'abcd'`.

When a document is first created, it has:

- Version is set to 0
- Type set to the type specified in the _create_ request
- Snapshot set to the result of a call to `type.initialVersion()`. For text, this is an empty string `''`. For JSON, this is `null`.


RESTful web protocol
====================

... Spec not written yet ...


SocketIO Protocol
=================

The streaming protocol uses JSON messages sent over a standard [Socket.io](http://socket.io/) connection. A single socket.io connection can be used for many documents at the same time.

Here is an example of a normal client and server interaction:

    (1) C: {doc:'holiday', open:true, create:true, type:'text', snapshot:null}
    (2) S: {doc:'holiday', open;true, create:true, v:0}
    (3) C: {v:0, op:[{i:'Hi!', p:0}]}
    (4) S: {v:0}
    (5) C: {v:1, op:[{i:' there', p:2}]}
    (6) S: {v:1, op:[{i:'Oh, ', p:0}], meta:{...}}
    (7) S: {v:2}

1. Open the 'holiday' document. (Documents must be open in order to receive ops sent by other clients.) Create the document if it doesn't exist with `type:'text'`. If it already exists, send a snapshot.
2. The 'holiday' document has been opened at version 0. It was created by (1). The type and snapshot are not included because they can be inferred from the context.
3. Apply an op to the holiday document. (`doc:'holiday'` is inferred because that was the last doc the client named). The op is `[{i:'Hi!', p:0}]` which inserts `'Hi!'` at position 0 (the start of the document).
4. The op was applied at version 0. The document is now at version 1.
5. The client sends another op on the document.
6. The server tells the client that somebody else has sent an op at version 1 which inserted 'Oh, ' at the start of the document.
7. The server confirms that it received the client's op. The op was applied at version 2. In order to apply at version 2, the op must have been _transformed_ by the `v:1` op. In this case, the transformed operation would have been `[{i:' there', p:5}]`. The document is now at version 3 and has contents 'Oh, Hi there!'

After this has taken place, another client connects and requests a document snapshot:

    (1) C: {doc:'holiday', snapshot:null}
    (2) S: {doc:'holiday', v:3, type:'text', snapshot:'Oh, Hi there!', meta:{...}}

1. Request a snapshot for the 'holiday' document.
2. The 'holiday' document is a text document at version 3. Its contents are 'Oh, Hi there!'.


Spec
----

Each message in the socket.io protocol is a JSON object. Messages are interpreted based on which fields they contain.

Each message refers to a particular ShareJS document. Regardless of message type, the relevant document is specified using a `doc:DOCNAME` field. Both the server and client can leave this field out of a message if the message refers to the same document as the previous message.

In the example above, once the client sent doc:'holiday', the client no longer needed to specify the document name as all subsequent messages the client sends refer to doc:'holiday'. The same is true for the server (though the server still needs to send doc:'holiday' in its first message).

These are all the different messages the client & server can send to each other:

### Create a document

> This operation can be combined with _open_ and _get snapshot_, below.

Client:

    {doc:DOCNAME, create:true, type:TYPENAME, <meta:{...}>}

Server response:

    {doc:DOCNAME, create:true}
or

    {doc:DOCNAME, create:false}


Create a document with the specified type and optional metadata. The document will only be created if it does not already exist. This operation will never destroy data.


### Request a document snapshot

> This operation can be combined with _create_ and _open_.

Client:

    {doc:DOCNAME, <type:TYPE>, snapshot:null}

Server response:

    {doc:DOCNAME, snapshot:SNAPSHOT, v:VERSION, <type:TYPE>, <meta:{...}>}

or

    {doc:DOCNAME, snapshot:null, error:ERRORMESSAGE}


Request a document snapshot. If a type is specified, a document snapshot will only be returned if the real document's type matches.

The format of the snapshot object is type dependant. For text, the snapshot is a string containing the contents of the document.

If the document does not exist or any other error occurred, `snapshot:null` will be set in the response. However, __a null snapshot does not mean an error occurred__. Check the `error:ERRORMESSAGE` field to check for errors.

Valid error messages:

- __'Type mismatch':__ The requested document does not have the specified type
- __'Document does not exist':__ The requested document does not exist

> **NOTE:** Requesting a snapshot at a specified version may be added in a future version. Add an issue in the issue tracker if this is important to you.


### Open a document (Start streaming operations)

> This operation can be combined with _create_ and _get snapshot_.

Client:

    {doc:DOCNAME, open:true, <v:VERSION>, <type:TYPE>}

Server response:

    {doc:DOCNAME, open:true, v:VERSION}

> Then, repeated:

>     {doc:DOCNAME, v:APPLIEDVERSION, op:OPERATION, <meta:{...}>}

or

    {doc:DOCNAME, open:false, error:ERRORMESSAGE}


Open the specified document. Opening a document makes the server send the client all operations applied to the document. Operations sent by the client itself are excluded from this stream.

If a type is specified, the document will only be opened if the document's type matches.

If the server already has operations since VERSION, they are sent immediately.

Version is optional. If not specified, the most recent version is opened.

The version specified in the server response will be the same as the version specified in the client's request, or the most recent version if the client's request did not include a version.

Valid error messages:

- __'Type mismatch':__ The requested document does not have the specified type
- __'Document does not exist':__ The requested document does not exist

> **NOTE:** You can use this as a ghetto way to get the history of a document. Its kind of awful - I'll add a special API for getting historical operations later. You can make this happen sooner by filing a ticket.


### Close a document

Client:

    {doc:DOCNAME, open:false}

Server response:

    {doc:DOCNAME, open:false}

Close a document. No more operations will be sent to the client.

> **NOTE:** For a short window, the client may receive a few more operations from the server.


### Submit an op

Client:

    {doc:DOCNAME, v:VERSION, op:OP, <meta:META>}

Server response:

    {doc:DOCNAME, v:APPLIEDVERSION}

or

    {doc:DOCNAME, v:null, error:ERRORMESSAGE}

Submit the operation OP to the server. The op must be valid given the type of the document.

The op must be 'reasonably' recent. (To prevent denial-of-service attacks, The server can reject ops which are too old).

The version specified by the client is the version at which the operation is applied. This is the version the document has _before_ it is applied, not _after_ it has been applied. Generally, this should be the most recent version the client knows about. For example, if you are sending an operation to a new document (version 0), the version specified in your request is **0**.

The server responds with the version at which the operation was actually applied. This is usually the same as the version specified in the operation.

If multiple clients send operations at the same time, they are applied in the order they are received by the server. Your operation may be transformed by other operations before it is applied. If your client has the the document open, you will be sent the other operation before being sent confirmation that your operation was applied. The example near the start of this document shows this happening.

For text documents, operations are a list of operation components. Each component either inserts or deletes text at a particular location in the document. For example, this inserts 'hi' at position 50 in the document: `[{i:'hi', p:50}]` and this deletes it again: `[{d:'hi', p:50}]`.

Refer to (**not written yet**) documentation on the op type for specifics on what valid operations look like.
