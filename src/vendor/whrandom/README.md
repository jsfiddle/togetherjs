whrandom / random.js
====================

This is a port of Python's [whrandom](http://docs.python.org/release/2.4/lib/module-whrandom.html) module, which is a [pseudorandom number generator](http://en.wikipedia.org/wiki/Pseudorandom_number_generator).

That means it creates "random" numbers with a <em>seed</em>, and if you provide the same seed it will create the same set of numbers.  This is a common feature in many languages, but not offered by Javascript's `Math.random()`.

This isn't the best random number generator, but the algorithm is very simple.  


Mersenne Twister / mersenne.js
==============================

Python now prefers the [Marsenne Twister](http://en.wikipedia.org/wiki/Mersenne_twister).  It has some nice features over whrandom (you can read that page to see them).

I've taken a [piece of code](http://www.math.sci.hiroshima-u.ac.jp/~m-mat/MT/VERSIONS/JAVASCRIPT/java-script.html) written by Y. Okada and library-ized it some.  It matches the interface of whrandom.

Using it
--------

If you include `random.js` it will expose one variable: `WHRandomStream` (`mersenne.js` exposes `MersenneRandomStream`).  You can also require the module using [requirejs](http://requirejs.org/) or import it in Node (though I haven't provided a pacakge.json), and in both cases the exported object is `RandomStream` itself (e.g., `var RandomStream = require("./random.js");`, ditto `mersenne.js`)

To create a stream, call `RandomStream(seed)`; if no `seed` is provided then `Date.now()` is used.  To get new random numbers from a stream, simply call the function.  All random numbers are *between* 0 and 1 (but never actually 1), just like `Math.random()`.

`MersenneRandomStream` instances also have the methods:

`.int31()`: generates a random number on [0,0x7fffffff]-interval

`.real1()`: generates a random number on [0,1]-real-interval

`.real2()`: generates a random number on [0,1)-real-interval (the default)

`.real3()`: generates a random number on (0,1)-real-interval

`.res53()`: generates a random number on [0,1) with 53-bit resolution (basically higher resolution version of the default)
