walkabout.js
============

An automatic jQuery tester.

This code figures out what your application is waiting for, and does
it.  It fills in fields with random values.  It finds the events you
listen for and fires those events.  It finds internal links (like `<a
href="#foo">`) and clicks them.  It's a little like a fuzz tester for
your app.

You can use it like so:

```javascript
// This makes something like $('#some-input').val() return random values:
jQuery.fn.val.patch();

// Now, fiddle around, do a 100 random things:
var count = 100;
function step() {
  $(document).findActions().pick().run();
  count--;
  if (count > 0) {
    setTimeout(step, 10);
  }
}
step();
```
