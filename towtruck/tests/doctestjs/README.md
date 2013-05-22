## doctest.js

For a more complete description please [read the main
page](http://doctestjs.org).

`doctest.js` is a test runner for Javascript, organized around *examples* and *expected result*.  Tests look like this:

```javascript
// Simple stuff:
print(3 * 4);
// => 12

// Or complicated stuff:
var complete = false;
var savedResult = null;
$.ajax({
  url: "/test",
  dataType: "json",
  success: function (result) {
    complete = true;
    savedResult = result;
  }
});
wait(function () {return complete;});
print(savedResult);
// => {value1: "something", value2: true}
```

And a bunch more features: check out the [tutorial](http://doctestjs.org/tutorial.html) to get started, or read the [reference](http://doctestjs.org/reference.html) for more detail.

## License

Doctest.js is released under an MIT-style license.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
