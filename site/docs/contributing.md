# Contributing

Here are a variety of notes about contributing to the TowTruck codebase.  This isn't stuff that applies if you are simply integrating TowTruck in your site.

## Code Style

[Here is a style document](https://github.com/ianb/javascript).  It's a fork of the [Airbnb](https://github.com/airbnb/javascript) style guide, and maybe takes a little from the [Mozilla style guide](https://developer.mozilla.org/en-US/docs/Developer_Guide/Coding_Style), and then a little of our own opinions.

### Code Cleanliness

Please figure out how to get your editor to delete trailing whitespace!  It's a nuisance and creates useless diffs.  Files should also end with a newline.

## TowTruck Patterns

### Modules

There are [some notes in the style guide](https://github.com/ianb/javascript#modules).  TowTruck uses [requirejs](http://requirejs.org/) for module loading, and the AMD pattern generally.  Each module should go in `app/http/towtruck/public/` and look like:

```javascript
define(["util", "jquery", "require"], function (util, $, require) {
  var myModule = util.Module("myModule");
  var assert = util.assert;
  myModule.object = ... // and so on
  return myModule;
});
```

The first list is the dependencies (modules) you need.  If you need to require module modules later (lazily, or later than load time due to circular dependencies) you must include `require` among your dependencies.  There *is* a global `require()` object, but you can't use it, because TowTruck uses a [context](http://requirejs.org/docs/api.html#multiversion).

You should define an object with a name matching the name of the module (and filename).  This way an object or function will be named the same throughout the project, both when used internally and externally (e.g., `myModule.object`), and when it is being created.

If you want to load a module from the console, you do it like this:

```javascript
session = require({context: "towtruck"})("session");
```

(This form of `require` only works when the module is already loaded, but from the console that's usually the case.)

### Classes

There is a class factory in `util.Class`.  It supports subclassing, but we haven't used any subclasses yet, and I'm not sure we will.  Look at the implementation if you want to know more.

To define a class, do:

```javascript
var MyClass = util.Class({
  constructor: function (...) {...}
});
MyClass.classMethod = function (...) {...};
var instance = MyClass();
```

The `constructor` function is called when the object is instantiated.  You don't need to use `new` when creating instances, and really you shouldn't (it'll just create an object that'll be thrown away).  MyClass.prototype is what you would expect.

### `this`

You should understand how `this` is bound, and how that binding is lost.

Generally we prefer using `.bind(this)` to keep the references to this.  For example:

```
var MyClass = Class({

  goodExample: function () {
    doSomething((function () {return this.foo;}).bind(this));
  },

  badExample: function () {
    var self = this;
    doSomething(function () {return self.foo;});
  }
});
```

Why?  Mostly so that `this` is always called `this`, and you don't have to figure out whether or where there is an alias.

### Templating

Right now we aren't using any real templating system.  Almost everything is in `app/http/views/interface.html` – and most likely any new markup should also go there.

We try to keep most of the code that actually touches the ui in `ui.js` – though it's not done very strictly.  Moving stuff back into ui.js is appreciated though.

"Templates" are just elements that are cloned out of `interface.html`.  They generally have an id like `towtruck-template-foo`, and you'd clone them by doing `ui.cloneTemplate("foo")`.

You should avoid having text or markup in Javascript, and instead clone templates or hide and show different elements to represent different states.  Occasionally you do need to put markup-related stuff in code (like pixel sizes or other details).  When this is the case leave a comment in both sources (HTML/CSS and JS) pointing to the other location.

### Async

Use [jQuery.Deferred](http://api.jquery.com/category/deferred-object/) when possible.
