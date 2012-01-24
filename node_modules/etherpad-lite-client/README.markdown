Etherpad Lite API
=================

Supports all the API calls described in the [Etherpad Lite API page][1].


Setup
-----

    $ npm install etherpad-lite-client


Usage
-----

    api = require('etherpad-lite-client')
    etherpad = api.connect({
      apikey: 'UcCGa6fPpkLflvPVBysOKs9eeuWV08Ul',
      host: 'localhost',
      port: 9001,
    })

    etherpad.createGroup(function(error, data) {
      if(error) console.error('Error creating group: ' + error.message)
      else console.log('New group created: ' + data.groupID)
    })


Certain API calls require that you pass some arguments:


    var args = {
      groupID: 'g.yJPG7ywIW6zPEQla',
      padName: 'testpad',
      text: 'Hello world!',
    }
    etherpad.createGroupPad(args, function(error, data) {
      if(error) console.error('Error creating pad: ' + error.message)
      else console.log('New pad created: ' + data.padID)
    })





### Callback & Returned Data ###

The callback function should look like this:

    function(error, data) {
      if(error) {
        // handle error using error.code and error.message
      }

      // some code
    }

The callback function takes two argument: `error` and `data`.

#### error ###
`error` is null if everything is fine. Otherwise it's a JavaScript object that
describes what's wrong.

It has two attributes: `code` and `message`.

`error.code`:

    1 wrong parameters
    2 internal error
    3 no such function
    4 no or wrong API Key
    -1 there was problem with calling Etherpad API

`error.message`: a text representation of the error

#### data ####

`data` is a JavaScript object from the Etherpad response or `null` (on error).


License
-------

This code is released under the MIT (Expat) license.

See the attached file LICENSE.txt for more details or visit:

<http://www.opensource.org/licenses/MIT>


[1]: https://github.com/Pita/etherpad-lite/wiki/HTTP-API
