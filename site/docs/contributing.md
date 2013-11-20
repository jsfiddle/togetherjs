# Contributing to TogetherJS

<!--
template: docs-contributing.tmpl

Note: you should update the index in that template when adding
sections to this document.
-->

Here are a variety of notes about contributing to the TogetherJS codebase.  This isn't stuff that applies if you are simply integrating TogetherJS in your site.

## Code Style

[Here is a style document](https://github.com/ianb/javascript).  It's a fork of the [Airbnb](https://github.com/airbnb/javascript) style guide, and maybe takes a little from the [Mozilla style guide](https://developer.mozilla.org/en-US/docs/Developer_Guide/Coding_Style), and then a little of our own opinions.

### Code Cleanliness

Please figure out how to get your editor to delete trailing whitespace!  It's a nuisance and creates useless diffs.  Files should also end with a newline.

## TogetherJS Patterns

### Modules

There are [some notes in the style guide](https://github.com/ianb/javascript#modules).  TogetherJS uses [requirejs](http://requirejs.org/) for module loading, and the AMD pattern generally.  Each module should go in `app/http/togetherjs/public/` and look like:

```javascript
define(["util", "jquery", "require"], function (util, $, require) {
  var myModule = util.Module("myModule");
  var assert = util.assert;
  myModule.object = ... // and so on
  return myModule;
});
```

The first list is the dependencies (modules) you need.  If you need to require module modules later (lazily, or later than load time due to circular dependencies) you must include `require` among your dependencies.  There *is* a global `require()` object, but you can't use it, because TogetherJS uses a [context](http://requirejs.org/docs/api.html#multiversion).

You should define an object with a name matching the name of the module (and filename).  This way an object or function will be named the same throughout the project, both when used internally and externally (e.g., `myModule.object`), and when it is being created.

If you want to load a module from the console, you do it like this:

```javascript
session = require({context: "togetherjs"})("session");
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

### this

You should understand how `this` is bound, and how that binding is lost.

Generally we prefer using `.bind(this)` to keep the references to this (as opposed to using `self = this`).  For example:

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

"Templates" are just elements that are cloned out of `interface.html`.  They generally have an id like `togetherjs-template-foo`, and you'd clone them by doing `templating.sub("foo", {vars})`.

You should avoid having text or markup in JavaScript, and instead clone templates or hide and show different elements to represent different states.  Occasionally you do need to put markup-related stuff in code (like pixel sizes or other details).  When this is the case leave a comment in both sources (HTML/CSS and JS) pointing to the other location.

### Stateless controls

Instead of "toggle" controls we prefer to show and hide controls for the alternate states.  For instances, if you have a expand/collapse control:

```html
<button id="togetherjs-collapse-foo" data-toggles="#togetherjs-expand-foo">-</button>
<button id="togetherjs-expand-foo" data-toggles="#togetherjs-collapse-foo" style="display: none">+</button>
```

Then use `ui.displayToggle("#togetherjs-expand-foo")` to show the expand button, and the collapse button will be automatically hidden.  Note that the selector in `data-toggles` can be inclusive of the element itself (everything matching selector will be hidden, except the element itself).

This requires less state in the JavaScript, as the control is always an assertion to do something specific.  Also it means that we have to do a minimum of manipulation in JavaScript, and the two controls are not required to be styled identically.

### Async

Use [jQuery.Deferred](http://api.jquery.com/category/deferred-object/) when possible.  This is exposed as `util.Deferred`


## Hosting the Hub Server

This has been [moved to the main docs](./#hosting-the-hub-server).

## The Issue Tracker and Milestones

We do most of our planning in the [Github issue tracker](https://github.com/mozilla/togetherjs/issues), and make use of the [Milestones](https://github.com/mozilla/togetherjs/issues/milestones) (more than labels).  You are welcome to just submit issues without worrying about this, but if you are looking at a ticket and want how it relates to our plans then you might want to know our system.

Generally we have three running milestones:

* "Release X" or "Beta 1039", etc: something that represents our planned work for the current iteration.  We don't generally complete everything we plan for in an iteration (i.e., we err on the side of including stuff in a milestone), so if something is important to you then you might still want to note this in a ticket.

* [Next Tasks](https://github.com/mozilla/togetherjs/issues?milestone=17&state=open): this is a long-standing milestone that represents tasks we want to do soon, but not in the current milestone.  Typically when planning the next iteration we'll look through this milestone and pick out issues.  If something in this milestone is a priority for you, please note that in a comment on the ticket so we can understand your needs.

* [Blue Sky](https://github.com/mozilla/togetherjs/issues?milestone=23&state=open): another long-standing milestone, this represents stuff we'd like to do but don't have any plans to do any time soon.  If you are looking to contribute this is an excellent place to look for ideas.  And if it's something you think would be helpful to you, a comment would be good -- especially one that outlines a use case.

* [Issues with no milestone](https://github.com/mozilla/togetherjs/issues?milestone=none&page=1&state=open): these are issues that haven't been triaged.  We try to assign milestones every week to these issues.  If we don't then probably we are caught up in something we need to focus on over a short period, or we're just all out on vacation or something.
