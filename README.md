walkabout.js
============

An automatic jQuery app tester.

This code figures out what your application is paying attention to,
and does it.  It fills in fields with random values.  It finds the
events you listen for and fires those events.  It finds internal links
(like `<a href="#foo">`) and clicks them.  It's a little like a fuzz
tester for your app.

You can use it like so:

```javascript
// This makes something like $('#some-input').val() return random values:
jQuery.fn.val.patch();

// Now, fiddle around, do 100 random things:
Walkabout.runManyActions({
  times: 100
});
```

You can hint about what's a valid input for something:

You can add `data-walkabout-disable="1"` to any element to suppress
activation of that element or any of its children.

You can use `data-walkabout-eventname="..."` to set attributes on the
event that is created, such as `data-walkabout-keyup="{which: 13}"`

You can use `data-walkabout-options="['a', 'b']"` to give the valid inputs
for a field.


Bookmarklet
-----------

If you want to try walkabout.js on some random jQuery site, you can
use the [bookmarklet](http://ianb.github.com/walkabout.js).  This will
load Walkabout and also start a simple UI to start the runs.  In
addition to starting a run it'll also track any uncaught errors and
any calls to `console.warn()` or `console.error()`.


Non-jQuery Support
------------------

There's some experimental support for working with code that doesn't
use jQuery.  It *might* work with other frameworks, but is more
intended to work with code that doesn't use a framework.

This technique uses code rewriting to capture calls to
`.addEventListener()` and `.value`.  The code can't use any tricks, it
needs to actually use those literal names -- which is usually fine in
"normal" code, but might not be in fancy or optimized code.  E.g.,
`el["addEventListener"](...)` would not be found.

You can use `Walkabout.rewriteListeners(code)` to rewrite the code.

The code transformation looks like this:

```javascript
document.getElementById("el").addEventListener("click", function () {}, true);
var value = document.getElementById("textarea").value;

// Becomes:
Walkabout.addEventListener(document.getElementById("el"), "click", function () {}, true);
var value = Walkabout.value(document.getElementById("textarea"));
```

And to find actions you use `Walkabout.findActions(element)`.


Proxy Server
------------

An application could include `walkabout.js` on its own, and if it
doesn't use jQuery it could also run `Walkabout.rewriteListeners()` on
all its code.  But maybe you don't feel like doing that, maybe you
want to try it out without all that work.

There is a proxy server `node-proxy.js` that makes this easier.  As
you might guess, you have to install Node.js to use it.

The server expects to receive requests for the website you want to
actually access.  To do this you have to edit `/etc/hosts` to point
the request locally, e.g.:

```
127.0.0.1 site-to-test.com
```

Then when you access `http://site-to-test.com` it will connect
locally, and the proxy server in turn will forward the request to the
actual server (note though that site-to-test.com must be an actual
domain name, not another entry in `/etc/hosts`).  Any HTML responses
will have the Walkabout Javascript added, and Javascript will be
rewritten.

Note that it binds to port 80, and so you must run it as root.  This
isn't awesome, pull requests to drop root welcome.  A tool like
[authbind](http://en.wikipedia.org/wiki/Authbind) also could help.

When you are done you should definitely stop the server, and undo the
`/etc/hosts` entry.

Note many live sites seem to notice the proxy, though I don't know
how.  I seem to be blocked from news.ycombinator.com now after using
it in my own testing.  Any ideas welcome.


To Do
-----

Lots of stuff, of course.  But:

- Sometimes the validation options (like `data-walkabout-options`)
  should be obeyed, and sometimes they should be ignored.  Obeying
  them progresses you through the site, disobeying them does some fuzz
  testing.

- Not all form controls get triggered, I think.  E.g., checkboxes
  don't get checked.

- `.val()` should figure out better what's a reasonable return value.
  E.g., a textarea returns multi-line strings, a checkbox returns
  true/false.

- The generator could have smarts about what scripts are successful
  and which are not.  Starting with a successful script (that
  progresses you through the application), and then tweaking that
  script and increasing randomness at the end of the script.

- We could look at code coverage as a score.  Or we could even just
  look at event coverage - hidden elements often have events bound,
  but we know they have to be visible to be triggered.

- Something more Gaussian with the values generated.  Like, sometimes
  you should make a 100 character input.  But maybe not as often as a
  10 character input.  And sometimes a 1 character input.

- z-index effects whether some actions can happen - e.g., an element
  might be visible but not clickable because of overlays.  We should
  test for that.
