/*global linkify */
Test.require("linkify");
// => Loaded modules: linkify

print(linkify($("<span>this is a test</span>")));
// => <span>this is a test</span>
print(linkify($("<span>http://foo.com test</span>")));
/* =>
<span>
  <a href="http://foo.com" target="_blank">http://foo.com</a>
test</span>
*/

print(linkify($("<span>yahoo (http://yahoo.com)</span>")));
/* =>
<span>yahoo (
  <a href="http://yahoo.com" target="_blank">http://yahoo.com</a>
)</span>
*/
