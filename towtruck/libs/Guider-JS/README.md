Guiders.js (version 1.3.0)
==========================

Guiders are a user experience design pattern for introducing users to a web application.  

Live Examples
-------------

Here are a couple examples hosted online.  You can also check out `README.html` for guiders in action!

[http://jeffpickhardt.com/guiders/](http://jeffpickhardt.com/guiders/)

[https://optimizely.appspot.com/edit#url=www.google.com](https://optimizely.appspot.com/edit#url=www.google.com)


Setup
-----

Here is sample code for initializing a couple of guiders.  Guiders are hidden when created, unless `.show()` is method chained immediately after `.createGuider`.

~~~ javascript
guiders.createGuider({
  buttons: [{name: "Next"}],
  description: "Guiders are a user interface design pattern for introducing features of software. This dialog box, for example, is the first in a series of guiders that together make up a guide.",
  id: "first",
  next: "second",
  overlay: true,
  title: "Welcome to Guiders.js!"
}).show();
/* .show() means that this guider will get shown immediately after creation. */

guiders.createGuider({
  attachTo: "#clock",
  buttons: [{name: "Close, then click on the clock.", onclick: guiders.hideAll}],
  description: "Custom event handlers can be used to hide and show guiders. This allows you to interactively show the user how to use your software by having them complete steps. To try it, click on the clock.",
  id: "third",
  next: "fourth",
  position: 2,
  title: "You can also advance guiders from custom event handlers.",
  width: 450
});
~~~~

The parameters for creating guiders are:

~~~
attachTo: (optional) selector of the html element you want to attach the guider to
autoFocus: (optional) if you want the browser to scroll to the position of the guider, set this to true
buttons: array of button objects
  {
    name: "Close",
    classString: "primary-button",
    onclick: callback function for when the button is clicked
      (if name is "close", "next", or "prev", onclick defaults to guiders.hideAll, guiders.next, or guiders.prev respectively)
   }
buttonCustomHTML: (optional) custom HTML that gets appended to the buttons div
classString: (optional) custom class name that the guider should additionally have
closeOnEscape: (optional) if true, the escape key will close the currently open guider
description: text description that shows up inside the guider
highlight: (optional) selector of the html element you want to highlight (will cause element to be above the overlay)
isHashable: (defaults to true) the guider will be shown auto-shown when a page is loaded with a url hash parameter #guider=guider_name
offset: fine tune the position of the guider, e.g. { left:0, top: -10 }
onClose: (optional) additional function to call if a guider is closed by the x button, close button, or escape key
onHide: (optional) additional function to call when the guider is hidden
onShow: (optional) additional function to call before the guider is shown
overlay: (optional) if true, an overlay will pop up between the guider and the rest of the page
position: (optional / required if using attachTo) clock position at which the guider should be attached to the html element. Can also use a description keyword (such as "topLeft" for 11 or "bottom" for 6)
shouldSkip: (optional) if this function evaluates to true, the guider will be skipped
title: title of the guider
width: (optional) custom width of the guider (it defaults to 400px)
xButton: (optional) if true, a X will appear in the top right corner of the guider, as another way to close the guider
~~~


Integration
-----------

Besides creating guiders, here is sample code you can use in your application to work with guiders:

~~~ javascript
guiders.hideAll(); // hides all guiders
guiders.next(); // hides the last shown guider, if shown, and advances to the next guider
guiders.show(id); // shows the guider, given the id used at creation
guiders.prev(); // shows the previous guider
~~~

You'll likely want to change the default values, such as the width (set to 400px).  These can be found at the top of `guiders.js` in the `_defaultSettings` object.  You'll also want to modify the css file to match your application's branding.

Creating a multi-page tour?  If the URL of the current window is of the form `http://www.myurl.com/mypage.html#guider=foo`, then the guider with id equal to `foo` will be shown automatically.  To use this, you can set the onHide of the last guider to an anonymous function: function() { window.location.href=`http://www.myurl.com/mypage.html#guider=foo`; }


In Closing
----------

Guiders are a great way to improve the user experience of your web application.  If you're interested in optimizing user experience through A/B testing, check out [Optimizely](http://www.optimizely.com).  We're the people who built Guiders in the first place.

If you have questions about Guiders, you can email me (Jeff Pickhardt) at `jeff+pickhardt@optimizely.com`.  Optimizely inquiries should be directed to `support@optimizely.com` or `sales@optimizely.com`.


License
-------

Released under the [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0.html).