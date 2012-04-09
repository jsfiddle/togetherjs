Slowparse is an experimental JavaScript-based HTML parser for Mozilla Webmaking initiatives.

Until now, most of Mozilla's Webmaking experiments that involve writing HTML ([lovebomb.me][], [Storything][], [X-Ray Goggles][], etc) have used `.innerHTML` to parse HTML into a DOM. However, this has a number of disadvantages:

* It's difficult to map an element in the generated DOM back to its original HTML source code. This is useful in a variety of scenarios such as Jessica Klein's [lovebomb mockups][] and [webmaker tutorials][].

* It's completely insecure. For our webmaker initiatives that really need to scale, we'd like to have more fine-grained control over what kinds of elements and attributes are allowed in code.

* It can be difficult to help the user pinpoint errors in their code, e.g. mismatching tags.

Slowparse is intended to solve all of these problems. It parses HTML and uses a host DOM implementation to create the DOM representation of the page. Each generated DOM node has an expando property called `parseInfo` which provides metadata mapping the location of the node in the original source code. It also provides detailed error feedback so that users can easily pinpoint why their code isn't working the way they intend.

**Presently, the code is mostly just tests, and no real implementation.** Please refer to `test/test-slowparse.js` for more information on the library's proposed API.

  [lovebomb.me]: http://lovebomb.me
  [Storything]: http://storything.toolness.org/
  [X-Ray Goggles]: http://hackasaurus.org/goggles/
  [lovebomb mockups]: http://jessicaklein.blogspot.com/2012/03/iterating-on-bombs.html
  [webmaker tutorials]: http://www.toolness.com/wp/2012/03/webmaker-tutorial-prototyping/
