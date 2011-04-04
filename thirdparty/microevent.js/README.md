# MicroEvent.js

_MicroEvent.js_ is a event emitter library which provides the
[observer pattern](http://en.wikipedia.org/wiki/Observer_pattern) to javascript objects.
It works on node.js and browser. It is a single .js file containing
a <a href="https://github.com/jeromeetienne/microevent.js/blob/master/microevent.js#L12-32">20 lines class</a>
(only 321-bytes after minification+gzip). 

## How to Use It

You need a single file [microevent.js](https://github.com/jeromeetienne/microevent.js/raw/master/microevent.js).
Include it in a webpage via the usual script tag.

    <script src="microevent.js"></script>

To include it in a nodejs code isnt much harder

    var MicroEvent = require('./microevent.js')

Now suppose you got a class `Foobar`, and you wish it to support the observer partern. do 

    MicroEvent.mixin(Foobar)

That's it. The repository contains an [example in browser](https://github.com/jeromeetienne/microevent.js/blob/master/examples/example.html)
and an [example in nodejs](https://github.com/jeromeetienne/microevent.js/blob/master/examples/example.js).
Both use the same code in different contexts. Let me walk you thru it.

## Example

First we define the class which gonna use MicroEvent.js. This is a ticker, it is
publishing 'tick' event every second, and add the current date as parameter

    var Ticker = function(){
        var self = this;
        setInterval(function(){
            self.publish('tick', new Date());
        }, 1000);
    };

We mixin _MicroEvent_ into _Ticker_ and we are all set.

    MicroEvent.mixin(Ticker);

Now lets actually use the _Ticker_ Class. First, create the object.

    var ticker = new Ticker();
    
and subscribe our _tick_ event with its data parameter

    ticker.subscribe('tick', function(date) {
        console.log('notified date', date);
    });

And you will see this output:

    notified date Tue, 22 Mar 2011 14:43:41 GMT
    notified date Tue, 22 Mar 2011 14:43:42 GMT
    ...

## Conclusion

MicroEvent.js is available on github <a href='https://github.com/jeromeetienne/microevent.js'>here</a>
under <a href='https://github.com/jeromeetienne/microevent.js/blob/master/MIT-LICENSE.txt'>MIT license</a>.
If you hit bugs, fill issues on github.
Feel free to fork, modify and have fun with it :)

