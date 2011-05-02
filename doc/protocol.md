Wire protocol
=============

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

ShareJS is a key-value store mapping a document's name to a versioned document. At any moment in time, each document has a _version_, a _type_ and a _snapshot_.

The document's _type_ specifies a set of functions for interpretting and manipulating operations. You must set a document's type before you can use it. After a document's type is set, it cannot be changed. Each type has a unique string name. Currently only the plaintext type is defined. (Its name is `'text'`.) More types will be added in time - in particular rich text and JSON. For details of how types work, see [Types](Types).

Document _versions_ start at 0. The version is incremented to 1 when it is first created (when its type is set), and then increased by 1 each time an op is applied.

The document's _snapshot_ is the contents of the document at some particular version. For text documents, the snapshot is a string containing the document's contents.

For example, a text document might have the snapshot `'abc'` at version 100. An _operation_ `[{i:'d', p:3}]` is applied at version 100 which inserts a `'d'` at the end of the document. After this operation is applied, the document has a snapshot at version 101 of `'abcd'`.

Documents are created implicitly by setting their type. Do this by submitting an operation to the document at version 0 with contents `{type:'TYPENAME'}`. When you do this, the document has:

- Version is set to 1
- Type set to the type named by the op.
- Snapshot set to the result of a call to `type.initialVersion()`. For text, this is an empty string `''`.

> __NOTE:__ This is kind of confusing. I'm considering making a special 'create' message instead.


RESTful web protocol
====================

... Not written yet ...


SocketIO Protocol
=================

The streaming protocol uses JSON messages sent over a standard [Socket.io](http://socket.io/) connection. A single socket.io connection can be used for many documents at the same time.

Example
-------

Here is an example of a client and server interaction:

    (1) C: {doc:'holiday', snapshot:null}
    (2) S: {doc:'holiday', v:0, type:null, snapshot:null}
    (3) C: {v:0, op:{type:'text'}}
    (4) S: {v:0}
    (5) C: {v:1, follow:true}
    (6) S: {v:1, follow:true}
    (7) C: {v:1, op:[{i:'hello', p:0}]}
    (8) S: {v:1, op:[{i:'internet', p:0}], meta:{...}}
    (9) S: {v:2}

1. Get the 'holiday' document
2. The 'holiday' document is at version 0. It has no type and its content is null
3. Apply an op to the holiday document. (The doc:'holiday' is inferred because that was the last doc the client named). The op is {type:'text'} which sets the type to be 'text'.
4. The op was applied at version 0
5. Register to receive events on the document
6. Server confirms that the client is following the document
7. The client sends an op on the document, inserting the text 'hello' at v=1.
8. The server tells the client that somebody else sent an op at version 1 which inserted 'internet' at the start of the document.
9. The server confirms that it received the client's op. The op was applied at version 2.


Spec
----

Each message in the socket.io protocol is a JSON object. Messages are interpretted based on which fields they contain.

Each message will refer to a particular ShareJS document. Regardless of message type, the relevant document is specified using a `doc:DOCNAME` field. Both the server and client can leave this field out of a message if the message refers to the same document as the previous message.

In the example above, once the client sent doc:'holiday', the client no longer needed to specify the document name as all subsequent messages the client sends refer to doc:'holiday'. The same is true for the server (though the server still needs to send doc:'holiday' in its first message).

These are all the different messages the client & server can send to each other:

### Follow a document (Start streaming operations)

Client:

    {doc:DOCNAME, <v:VERSION>, follow:true}

Server response:

    {doc:DOCNAME, v:VERSION, follow:true}
or

    {doc:DOCNAME, follow:false, error:ERRORMESSAGE}


This requests that the server send the client every operation applied to the document from the specified version onwards. Operations sent by the client itself are excluded from this stream.

If there have been operations since the named version, they will be sent to the client immediately after confirming that the client is following the document.

Version is optional. If not specified, it defaults to the most recent version.

The version specified in its message will be the same as the version specified in the client's request, or the most recent version if the client's request did not include a version.

> **NOTE:** You can use this as a ghetto way to get the history of a document. Its kind of awful - I'll add a special API for getting historical operations in a later version.


### Unfollow a document

Client:

    {doc:DOCNAME, follow:false}

Server response:

    {doc:DOCNAME, follow:false}

Stop following a document. No more operations will be sent to the client. Note that the client may still receive ops from the server that were sent before the server received the unfollow command.


### Request a document snapshot

Client:

    {doc:DOCNAME, <v:VERSION>, snapshot:null}

Server response:

    {doc:DOCNAME, v:VERSION, snapshot:SNAPSHOT, type:TYPE}

or

    {doc:DOCNAME, v:VERSION, snapshot:null, error:ERRORMESSAGE}

> **NOTE:** Requesting a snapshot at a specified version is not currently supported.

Request a snapshot at the specified version. The version is optional - If not included, the most recent version will be used.

The server sends the snapshot back to the client. TYPE is the name of the type of the document, eg, 'text'.

The format of the snapshot object is type dependant. For text, the snapshot is a string containing the contents of the document.

The snapshot may be null for valid documents. Look for the `error:` field to test if an error occurred in the request.

If the document does not exist, the server responds with `{doc:DOCNAME, v:0, snapshot:null, type:null}`


### Submit an op

Client:

    {doc:DOCNAME, v:VERSION, op:OP, <meta:META>}

Server response:

    {doc:DOCNAME, v:APPLIEDVERSION}

or

    {doc:DOCNAME, v:null, error:ERRORMESSAGE}

Submit the operation OP to the server. The op must be valid given the type of the document.

The op must be 'reasonably' recent. (To prevent denial-of-service attacks, The server can reject ops which are too old).

The version specified by the client is the version at which the operation is applied. This is the version the document has _before_ it is applied, not _after_ it has been applied. Generally, this should be the most recent version the client knows about.

The server responds with the version at which the operation was actually applied. Again, this is the version the document was before the operation was applied. Usually, this will be the same as the version specified in the operation.

If multiple clients send operations at the same time, they are applied in the order they are received by the server. Your operation may be transformed by other operations before it is applied. If your client is following the document, and you will be sent the other operation before being sent confirmation that your operation was applied. The example near the top of this document shows this happening.

For text documents, operations are a list of operation components. Each component either inserts or deletes text at a particular location in the document. For example, this inserts 'hi' at position 50 in the document: `[{i:'hi', p:50}]` and this deletes it again: `[{d:'hi', p:50}]`.

Refer to (**not written yet**) documentation on the op type for specifics on what valid operations look like.

This API is currently also used to set a document's type, which creates the document in the first place. Submit an op which says `{type:TYPENAME}` to set a document's type. **This will be changed in a future update.**


