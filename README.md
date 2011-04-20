ShareJS
=======

This is a little server (& client library) to allow concurrent editing of any kind of content. The server runs on NodeJS and the client works in NodeJS or a web browser.

At the moment only plain-text is supported, but JSON and rich text should be supported soon.

Check out [some cool demos](http://sharejs.org:8000/)


Installing and running
----------------------

    npm install share

Run the examples with:

    # sharejs-exampleserver

Run from node using:

    var client = require('share').client;

or

    var sharejs = require('share').server;

More proper docs incoming...

