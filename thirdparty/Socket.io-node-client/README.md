# Socket.IO node client

This is a modified version of the nodejs socketio client which is much more compatible with the real socketio client.

> Please note that I'm not the author of [Socket.IO](https://github.com/LearnBoost/Socket.IO) - that juicy goodness belongs to LearnBoost

The `io-client.js` script that allows your client JavaScript that depends on Socket.IO to run in Node. This means that you shuold be able to run your script both on the client side and server side without any modifications.

# Example

Where the client side code includes Socket.IO as follows, this *shim* will allow your client code to also run on the server without any modifications (though assuming you're able to import your code as a module in node):

    var socket = new io.Socket('localhost', {'port': 8000});

    socket.on('connect', function () {
      console.log('yay, connected!');
      socket.send('hi there!');
    });

    socket.on('message', function (msg) {
      console.log('a new message came in: ' + JSON.stringify(msg));
    });

    socket.connect();

If the above code was in `myapp.js`, you can use it in a node app as follows:

    var io = require('./io-client').io;
        clientApp = require('./myapp.js');

Now `myapp.js` will run without any modifications in a node environment. 

# Note

I've only tested this shim a little bit and it works perfectly to get [förbind](http://github.com/remy/forbind) connecting from the server side.  I've not tested broadcasts or multiple messages or message dropping - maybe there's a solution already that I've not spotted!
