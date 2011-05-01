Client API
==========

The client library lets you view and edit sharejs documents remotely using the server's socket.io frontend.

The API lets you do the following things:

- Get document snapshots
- Stream ops as they are submitted to a document
- Submit ops

The following stuff is currently unsupported:

- Getting historical operations
- Undo
- Listing documents
- Deleting documents


Accessing the client library
----------------------------

From node.js:

    var sharejs = require('share').client;

    sharejs.open('hello', 'text', {host: 'example.com', port: 8000}, function(doc, error) {
        ...
    });


From a website hosted by the share.js server:

    <script src="/socket.io/socket.io.js"></script>
    <script src="/share/share.js"></script>

    sharejs.open('hello', 'text', function(doc, error) {
        ...
    });


From a website hosted elsewhere:

    <script src="http://example.com:8000/socket.io/socket.io.js"></script>
    <script src="http://example.com:8000/share/share.js"></script>

    sharejs.open('hello', 'text', {host: 'example.com', port: 8000}, function(doc, error) {
        ...
    });


Opening documents
-----------------

    sharejs.open(docName, type, [options], function(doc, error){ ... })

Open a sharejs document with the given name and type. A handle to the document will be passed to the callback once its snapshot has been received by the server.

If the document does not already exist, it will be created using the specified type before being returned to the callback. If the document already exists and has a different type, an error will be passed to the callback.

Document names are case sensitive.

The type can be specified as a string (eg, `'text'`) or an object (eg, `require('share').types.text`).

Options is an object which can contain the following fields:

- **`host`**: hostname of the sharejs server
- **`port`**: port of the sharejs server
- **`basePath`**: base path of the socket.io frontend. Leave this blank unless you've fiddled with it in the server configuration

In web clients, options can be left out. It will default to:

    {host: window.location.hostname, port: window.location.port}

This method is a convenience method for `connection.open`, below.

---

Connections
-----------

> __NOTE:__ Connections don't currently automatically reconnect when disconnected. They should also emit events for connecting and disconnecting. If this is important to you, please help out :)

A Connection manages a connection to a share.js server. You only need one connection to a given server no matter how many documents you have open.

If you use the `sharejs.open` API (above), connections are created for you automatically.


    connection = new sharejs.Connection(host, port, [basePath])

Create a connection to a sharejs server running at the default hostname & path. Set basePath to whatever the socket.io basepath is set to in the server (blank if you haven't changed it).


    connection.open(docName, type, function(doc, error) {...})

Open a sharejs document with the given name and type. A handle to the document will be passed to the callback once its snapshot has been received by the server.

If all you want to do is open documents of a known type on a known server, I recommend using `sharejs.open`, above. This way, the connection will be managed for you.

If the document does not already exist, it will be created using the specified type before being returned to the callback. If the document already exists and has a different type, an error will be passed to the callback.

Document names are case sensitive.

The type can be specified as a string (eg, `'text'`) or an object (eg, `require('share').types.text`).


    connection.openExisting(docName, function(doc, error) {...})

Open an existing document. If the document does not exist, the callback is passed `null`.


    connection.disconnect()

Disconnect from the server. Once disconnected, all documents currently open through the connection will stop sending and receiving ops. There is no reconnect.


---

Documents
---------

All open methods in the client return `Document` objects. These objects are handles to documents sitting on the share.js server. The document object implements client-side OT so you don't have to worry about concurrency in your app.

You cannot create documents directly. Instead, use any of the `open()` methods described above.

    doc.snapshot

The document's current state. For text documents, this is a string containing the contents of the document. This snapshot includes any modifications made locally which have not yet propogated to the server.


    doc.version

The document's version on the server. This is a number counting from 1 when the document was first created. It is incremented each time an operation is applied to the document on the server. The client will compose together multiple operations if they happen close together, so be aware may not be incremented as often as you expect it to.


    doc.type

The OT type of the document. This object contains the document type's OT functions. See the section on OT types for details.


    doc.submitOp(op, [version], [function(appliedOp) {...}])

Submit an operation to the document. The operation must be valid given the document's type. The operation will be applied to the local document snapshot immediately (before submitOp returns).

It will be applied to the server as soon as possible (only one op is allowed in-flight at a time). If multiple ops are applied within the same scheduler frame, they are composed together before being sent. Ie, if you call `doc.submit(op1); doc.submit(op2);`, the client will compose `op1` and `op2` for you.

If a version is specified, it indicates the document version at which the operation is valid. Operations submitted against old document versions are transformed before being applied. (Think of this like `git rebase`). version must be >= the version at which the document was opened by the client. If it is left out, the current document version is assumed. If you don't know what any of this means, leave the version out.

If a callback is specified, it will be called once the server has acknowledged the operation. It is passed the operation as it was accepted by the server, if thats interesting to you. This will not necessarily be the same as the op that was submitted originally. You don't need to wait for the callback before calling submitOp() again.

If the op is invalid, submitOp will throw an exception and the document will not be modified. If your code generating the ops is correct, this should never happen.

I expect most people will never use the version and callback fields of submitOp. Just call `submitOp(myCoolOp)` as much as you like and the client code will take care of everything else.

Text operations look like this:

Insert 'Some text' at position 100 in the document:

    {i:'Some text', p:100}

Delete 'blargh' at position 300:

    {d:'blargh', p:300}

Multiple changes can be specified in the same operation. This deletes 'Sam' in the document at position 10 in the document string, and replaces it with 'Seph' at the same location.

    [{d:'Sam', p:10}, {i:'Seph', p:10}]

See the documentation on types for more detail, as well as op specs for other types.

    doc.close([callback])

Close the document. When the server acknowledges that the document has been closed, the callback is called and the `'closed'` event is emitted.

### Events

The document is a simple event emitter. Use `doc.on(event, callback)` to register callbacks and `doc.removeListener(event, callback)` to remove them.

    doc.on('remoteop', function(op) {})

Emitted each time the document is changed remotely with the op from the server. If you're hooking sharejs up to an editor, listen to this event and update the contents of the editor window accordingly.

By the time your callback is called, the document's `snapshot` and `version` will have been updated by the change. If you want, your listener method can just read the snapshot out of the document again.

    doc.on('change', function(op) {})

Emitted each time the document is changed either locally or remotely. The op which modified the document is passed to the callback.


    doc.on('closed', function() {})

Emitted when the server has acknowledged that the document is closed.

