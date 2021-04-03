/*global util */
Test.require("util");
// => Loaded modules: util

util.util.assertValidUrl("http://foo.com");
// =>
util.util.assertValidUrl("//foobar");
// =>
util.util.assertValidUrl("data:image/png,asdf");
// =>
util.util.assertValidUrl("javascript:alert()");
// => Error: AssertionError: ...
util.util.assertValidUrl("foobar.com");
// => Error: AssertionError: ...
util.util.assertValidUrl("http://test.com); something: foo");
// => Error: AssertionError: ...
util.util.assertValidUrl("HTTPS://test.com");
// =>
