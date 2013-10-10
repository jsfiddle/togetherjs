/*global util */
Test.require("util");
// => Loaded modules: util

util.assertValidUrl("http://foo.com");
// =>
util.assertValidUrl("//foobar");
// =>
util.assertValidUrl("data:image/png,asdf");
// =>
util.assertValidUrl("javascript:alert()");
// => Error: AssertionError: ...
util.assertValidUrl("foobar.com");
// => Error: AssertionError: ...
util.assertValidUrl("http://test.com); something: foo");
// => Error: AssertionError: ...
util.assertValidUrl("HTTPS://test.com");
// =>
