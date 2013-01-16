ShareJS
=======

This is a little server (& client library) to allow concurrent editing of any kind of content. The server runs on NodeJS and the client works in NodeJS or a web browser.

ShareJS currently supports operational transform on plain-text and arbitrary JSON data.

**Immerse yourself in [API Documentation](https://github.com/josephg/ShareJS/wiki).**

**Visit [Google groups](https://groups.google.com/forum/?fromgroups#!forum/sharejs) for discussions and announcements**

**Check out the [live interactive demos](http://sharejs.org/).**

> Note: CI sometimes breaks for random reasons even though the tests work locally. Don't stress!
[![Build Status](https://secure.travis-ci.org/josephg/ShareJS.png)](http://travis-ci.org/josephg/ShareJS)


Browser support
---------------

ShareJS **should** work with all of them ![logos of all of all the browsers](http://twitter.github.com/bootstrap/assets/img/browsers.png)

That said, I only test regularly with FF, Safari and Chrome, and occasionally with IE8+. **File bug reports if you have issues**


Installing and running
----------------------

    # npm install share

Run the examples with:

    # sharejs-exampleserver

If you want redis support, you'll need to install redis:

    # sudo brew install redis
    # npm install -g redis

### From source

Install redis (optional)
    
* Mac:

        # sudo brew install redis

* Linux:
   
        # sudo apt-get install redis

Then:

    # git clone git://github.com/josephg/ShareJS.git
    # cd ShareJS
    # npm install redis   # If you want redis support
    # npm link

Run the tests:

    # cake test

Build the coffeescript into .js:

    # cake build
    # cake webclient

Run the example server:

    # bin/exampleserver

Running a server
----------------

There are two ways to run a sharejs server:

1. Embedded in a node.js server app:

    ```javascript
    var connect = require('connect'),
        sharejs = require('share').server;

    var server = connect(
          connect.logger(),
          connect.static(__dirname + '/my_html_files')
        );

    var options = {db: {type: 'none'}}; // See docs for options. {type: 'redis'} to enable persistance.

    // Attach the sharejs REST and Socket.io interfaces to the server
    sharejs.attach(server, options);

    server.listen(8000);
    console.log('Server running at http://127.0.0.1:8000/');
    ```
    The above script will start up a ShareJS server on port 8000 which hosts static content from the `my_html_files` directory. See [bin/exampleserver](https://github.com/josephg/ShareJS/blob/master/bin/exampleserver) for a more complex configuration example.

    > See the [Connect](http://senchalabs.github.com/connect/) or [Express](http://expressjs.com/) documentation for more complex routing.

2. From the command line:

        # sharejs
    Configuration is pulled from a configuration file that can't be easily edited at the moment. For now, I recommend method #1 above.

3. If you are just mucking around, run:

        # sharejs-exampleserver
  
    This will run a simple server on port 8000, and host all the example code there. Run it and check out http://localhost:8000/ . The example server stores everything in ram, so don't get too attached to your data.

    > If you're running sharejs from source, you can launch the example server by running `bin/exampleserver`.


Putting Share.js on your website
--------------------------------

If you want to get a simple editor working in your webpage with sharejs, here's what you need to do:

First, get an ace editor on your page:

```html
<div id="editor"></div>
```

Your web app will need access to the following JS files:

- Ace (http://ace.ajax.org/)
- Browserchannel
- ShareJS client and ace bindings.

Add these script tags:

```html
<script src="http://ajaxorg.github.com/ace/build/src/ace.js"></script>
<script src="/channel/bcsocket.js"></script>
<script src="/share/share.js"></script>
<script src="/share/ace.js"></script>
```

And add this code:

```html
<script>
    var editor = ace.edit("editor");

    sharejs.open('hello', 'text', function(error, doc) {
        doc.attach_ace(editor);
    });
</script>
```

> **NOTE:** If you're using the current version in npm (0.4) or earler, the argument order is the other way around (`function(doc, error)`).

Thats about it :)

The easiest way to get your code running is to check sharejs out from source and put your html and css files in the `examples/` directory. Run `bin/exampleserver` to launch the demo server and browse to http://localhost:8000/your-app.html .

See the [wiki](https://github.com/josephg/ShareJS/wiki) for documentation.

Its also possible to use sharejs without ace. See the textarea example for details.

Writing a client using node.js
------------------------------

The client API is the same whether you're using the web or nodejs.

Here's an example application which opens a document and inserts some text in it. Every time an op is applied to the document, it'll print out the document's version.

Run this from a couple terminal windows when sharejs is running to see it go.

```javascript
var client = require('share').client;

// Open the 'hello' document, which should have type 'text':
client.open('hello', 'text', 'http://localhost:8000/sjs', function(error, doc) {
    // Insert some text at the start of the document (position 0):
    doc.insert("Hi there!\n", 0);

    // Get the contents of the document for some reason:
    console.log(doc.snapshot);

    doc.on('change', function(op) {
        console.log('Version: ' + doc.version);
    });

    // Close the doc if you want your node app to exit cleanly
    // doc.close();
});
```

> **NOTE:** If you're using the current version in npm (0.4) or earler, the argument order is the other way around (`function(doc, error)`).

See [`the wiki`](https://github.com/josephg/ShareJS/wiki) for API documentation, and `examples/node*` for some more example apps.


